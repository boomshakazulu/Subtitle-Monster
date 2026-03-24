import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDb } from "./db.js";
import { Movie } from "./models/Movie.js";
import { Subtitle } from "./models/Subtitle.js";
import { Translation } from "./models/Translation.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const localUrl = process.env.LOCAL_TRANSLATOR_URL || "http://localhost:8000";
const localColdStartMs = Number(process.env.LOCAL_COLD_START_MS || 5000);

const tmdbKey = process.env.TMDB_API_KEY;
const tmdbToken = process.env.TMDB_ACCESS_TOKEN;
const tmdbBase = "https://api.themoviedb.org/3";
const tmdbImageBase = "https://image.tmdb.org/t/p/w342";

const NLLB_LANG_MAP = {
  EN: "eng_Latn",
  ES: "spa_Latn",
  FR: "fra_Latn",
  DE: "deu_Latn",
  IT: "ita_Latn",
  "PT-BR": "por_Latn",
  JA: "jpn_Jpan",
  KO: "kor_Hang",
  ZH: "zho_Hans"
};

let queue = Promise.resolve();
let queueLength = 0;

function enqueue(fn) {
  queueLength += 1;
  queue = queue.then(fn, fn).finally(() => {
    queueLength -= 1;
  });
  return queue;
}

function parseSrt(srtText) {
  const blocks = srtText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/\n\n+/);

  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const index = lines[0] || "";
      const time = lines[1] || "";
      const textLines = lines.slice(2);
      return { index, time, text: textLines.join("\n") };
    })
    .filter((b) => b.time && b.text);
}

function buildSrt(entries) {
  return entries
    .map((e, i) => {
      const idx = e.index && /^\d+$/.test(e.index) ? e.index : String(i + 1);
      return `${idx}\n${e.time}\n${e.text}`;
    })
    .join("\n\n")
    .trim();
}

async function waitForLocalService(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${localUrl}/health`);
      if (res.ok) return true;
    } catch {
      // ignore while warming
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function mapToNllb(code) {
  if (!code) return null;
  if (code.includes("_")) return code;
  return NLLB_LANG_MAP[code.toUpperCase()] || null;
}

async function translateWithLocal(texts, sourceLang, targetLang) {
  const src = mapToNllb(sourceLang);
  const tgt = mapToNllb(targetLang);
  if (!src || !tgt) {
    throw new Error("Local translator requires NLLB language codes or known ISO codes");
  }

  const ok = await waitForLocalService(localColdStartMs);
  if (!ok) {
    throw new Error("Local translator not ready (cold start timeout)");
  }

  const res = await fetch(`${localUrl}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, sourceLang: src, targetLang: tgt })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Local translation failed");
  }

  const data = await res.json();
  return data.texts || [];
}

async function tmdbFetch(path, params = {}) {
  if (!tmdbKey && !tmdbToken) {
    throw new Error("TMDB_API_KEY or TMDB_ACCESS_TOKEN not configured");
  }
  const url = new URL(`${tmdbBase}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  if (tmdbKey) {
    url.searchParams.set("api_key", tmdbKey);
  }
  const res = await fetch(url.toString(), {
    headers: tmdbToken ? { Authorization: `Bearer ${tmdbToken}` } : undefined
  });
  if (!res.ok) {
    throw new Error(`TMDb request failed: ${res.status}`);
  }
  return res.json();
}

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    provider: "local",
    queueLength
  });
});

app.get("/api/tmdb/search", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: "query is required" });
    }
    const data = await tmdbFetch("/search/movie", { query });
    const results = (data.results || []).map((movie) => ({
      id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date,
      posterPath: movie.poster_path,
      posterUrl: movie.poster_path ? `${tmdbImageBase}${movie.poster_path}` : null
    }));
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "TMDb search failed" });
  }
});

app.get("/api/movies/:tmdbId", async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    const movieData = await tmdbFetch(`/movie/${tmdbId}`);

    const movie = await Movie.findOne({ tmdbId });
    const subtitleDocs = movie
      ? await Subtitle.find({ movie: movie._id }).lean()
      : [];

    const subtitles = await Promise.all(
      subtitleDocs.map(async (sub) => {
        const translations = await Translation.find({ subtitle: sub._id }).lean();
        return {
          id: sub._id,
          language: sub.language,
          createdAt: sub.createdAt,
          translations: translations.map((t) => ({
            id: t._id,
            targetLang: t.targetLang,
            provider: t.provider,
            createdAt: t.createdAt
          }))
        };
      })
    );

    res.json({
      movie: {
        id: movieData.id,
        title: movieData.title,
        overview: movieData.overview,
        releaseDate: movieData.release_date,
        posterUrl: movieData.poster_path ? `${tmdbImageBase}${movieData.poster_path}` : null
      },
      subtitles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Movie fetch failed" });
  }
});

app.post("/api/movies/:tmdbId/subtitles", async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId);
    const { language, srt } = req.body || {};
    if (!language || !srt) {
      return res.status(400).json({ error: "language and srt are required" });
    }

    const movieData = await tmdbFetch(`/movie/${tmdbId}`);
    let movie = await Movie.findOne({ tmdbId });
    if (!movie) {
      movie = await Movie.create({
        tmdbId,
        title: movieData.title,
        posterPath: movieData.poster_path,
        releaseDate: movieData.release_date
      });
    }

    const subtitle = await Subtitle.create({
      movie: movie._id,
      language: language.toUpperCase(),
      srtText: srt
    });

    res.json({
      subtitle: {
        id: subtitle._id,
        language: subtitle.language,
        createdAt: subtitle.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Subtitle upload failed" });
  }
});

app.get("/api/subtitles/:id", async (req, res) => {
  try {
    const subtitle = await Subtitle.findById(req.params.id).lean();
    if (!subtitle) {
      return res.status(404).json({ error: "Subtitle not found" });
    }
    res.json({ id: subtitle._id, language: subtitle.language, srt: subtitle.srtText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Subtitle fetch failed" });
  }
});

app.get("/api/translations/:id", async (req, res) => {
  try {
    const translation = await Translation.findById(req.params.id).lean();
    if (!translation) {
      return res.status(404).json({ error: "Translation not found" });
    }
    res.json({
      id: translation._id,
      targetLang: translation.targetLang,
      provider: translation.provider,
      srt: translation.srtText
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Translation fetch failed" });
  }
});

app.post("/api/subtitles/:id/translate", async (req, res) => {
  const job = async () => {
    const { targetLang } = req.body || {};
    if (!targetLang) {
      return res.status(400).json({ error: "targetLang is required" });
    }

    const subtitle = await Subtitle.findById(req.params.id);
    if (!subtitle) {
      return res.status(404).json({ error: "Subtitle not found" });
    }

    const existing = await Translation.findOne({
      subtitle: subtitle._id,
      targetLang: targetLang.toUpperCase(),
      provider: "local"
    }).lean();

    if (existing) {
      return res.json({
        translation: {
          id: existing._id,
          targetLang: existing.targetLang,
          provider: existing.provider,
          cached: true
        }
      });
    }

    const entries = parseSrt(subtitle.srtText);
    const texts = entries.map((e) => e.text);
    const translatedTexts = await translateWithLocal(texts, subtitle.language, targetLang);

    const outEntries = entries.map((e, i) => ({
      ...e,
      text: translatedTexts[i] || e.text
    }));

    const outSrt = buildSrt(outEntries);
    const translation = await Translation.create({
      subtitle: subtitle._id,
      targetLang: targetLang.toUpperCase(),
      provider: "local",
      srtText: outSrt
    });

    return res.json({
      translation: {
        id: translation._id,
        targetLang: translation.targetLang,
        provider: translation.provider,
        cached: false
      }
    });
  };

  try {
    await enqueue(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Translation failed" });
  }
});

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to DB", err);
    process.exit(1);
  });
