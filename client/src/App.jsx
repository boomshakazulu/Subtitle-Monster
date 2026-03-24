import { useMemo, useState } from "react";

const LANGUAGES = [
  { code: "EN", label: "English" },
  { code: "ES", label: "Spanish" },
  { code: "FR", label: "French" },
  { code: "DE", label: "German" },
  { code: "IT", label: "Italian" },
  { code: "PT-BR", label: "Portuguese (BR)" },
  { code: "JA", label: "Japanese" },
  { code: "KO", label: "Korean" },
  { code: "ZH", label: "Chinese" }
];

function App() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loadingMovie, setLoadingMovie] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [uploadLang, setUploadLang] = useState("EN");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [translating, setTranslating] = useState({});

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setSearchResults([]);
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setError(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const loadMovie = async (movieId) => {
    setLoadingMovie(true);
    setError("");
    try {
      const res = await fetch(`/api/movies/${movieId}`);
      if (!res.ok) throw new Error("Movie fetch failed");
      const data = await res.json();
      setSelectedMovie(data.movie);
      setSubtitles(data.subtitles || []);
    } catch (err) {
      setError(err.message || "Movie fetch failed");
    } finally {
      setLoadingMovie(false);
    }
  };

  const handleUpload = async (file) => {
    if (!selectedMovie || !file) return;
    setUploading(true);
    setError("");
    try {
      const text = await file.text();
      const res = await fetch(`/api/movies/${selectedMovie.id}/subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: uploadLang, srt: text })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      await loadMovie(selectedMovie.id);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleTranslate = async (subtitleId, targetLang) => {
    setTranslating((prev) => ({ ...prev, [`${subtitleId}_${targetLang}`]: true }));
    setError("");
    try {
      const res = await fetch(`/api/subtitles/${subtitleId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Translation failed");
      }
      await loadMovie(selectedMovie.id);
    } catch (err) {
      setError(err.message || "Translation failed");
    } finally {
      setTranslating((prev) => ({ ...prev, [`${subtitleId}_${targetLang}`]: false }));
    }
  };

  const downloadTranslation = async (translationId, filename) => {
    const res = await fetch(`/api/translations/${translationId}`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([data.srt || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadSubtitle = async (subtitleId, filename) => {
    const res = await fetch(`/api/subtitles/${subtitleId}`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([data.srt || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const languageMap = useMemo(() => {
    const map = new Map();
    LANGUAGES.forEach((lang) => map.set(lang.code, lang.label));
    return map;
  }, []);

  return (
    <div className="flex flex-col gap-10 text-ink">
      <header className="grid items-end gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted">Subtitle Monster</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Find a movie, upload subtitles, translate missing languages.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted">
            Search TMDb, attach subtitle files per movie, then translate and download
            missing language versions.
          </p>
        </div>
        <div className="grid gap-4 rounded-2xl border border-stroke bg-gradient-to-br from-[rgba(255,138,0,0.12)] to-[rgba(0,209,255,0.08)] p-6 shadow-glow">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-[0.12em] text-muted">Provider</span>
            <span className="text-lg font-semibold">DeepL / Local NLLB</span>
          </div>
          <div className="text-sm text-muted">
            Cache + queue enabled. Cold start budget: 5 seconds.
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-stroke bg-surface p-5">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies by title"
            className="flex-1 rounded-xl border border-white/20 bg-[#06080c] px-4 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-br from-accent to-[#ffb347] px-5 py-2.5 font-semibold text-[#1a140e] shadow-cta disabled:cursor-not-allowed disabled:opacity-60"
            disabled={searching}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {searchResults.map((movie) => (
            <button
              key={movie.id}
              onClick={() => loadMovie(movie.id)}
              className="flex gap-4 rounded-xl border border-white/10 bg-[#10131a] p-4 text-left transition hover:border-white/30"
            >
              <div className="h-20 w-14 overflow-hidden rounded-md bg-black/30">
                {movie.posterUrl ? (
                  <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <div className="text-sm font-semibold">{movie.title}</div>
                <div className="text-xs text-muted">{movie.releaseDate || "Unknown"}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stroke bg-surface p-5">
        {!selectedMovie ? (
          <div className="text-sm text-muted">Select a movie to manage subtitles.</div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-4">
              {selectedMovie.posterUrl ? (
                <img
                  src={selectedMovie.posterUrl}
                  alt=""
                  className="h-24 w-16 rounded-lg object-cover"
                />
              ) : null}
              <div>
                <div className="text-xl font-semibold">{selectedMovie.title}</div>
                <div className="text-sm text-muted">{selectedMovie.releaseDate}</div>
                <p className="mt-2 max-w-2xl text-sm text-muted">
                  {selectedMovie.overview}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-full border border-dashed border-white/25 bg-surface2 px-4 py-2 text-xs">
                <input
                  type="file"
                  accept=".srt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
                {uploading ? "Uploading…" : "Upload subtitle (.srt)"}
              </label>
              <select
                value={uploadLang}
                onChange={(e) => setUploadLang(e.target.value)}
                className="rounded-lg border border-white/20 bg-[#06080c] px-3 py-2 text-sm text-ink"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
              {loadingMovie && <span className="text-xs text-muted">Loading…</span>}
            </div>

            <div className="grid gap-4">
              {subtitles.length === 0 ? (
                <div className="text-sm text-muted">No subtitles uploaded yet.</div>
              ) : (
                subtitles.map((sub) => {
                  const existingTargets = new Set(
                    (sub.translations || []).map((t) => t.targetLang)
                  );
                  const missing = LANGUAGES.filter(
                    (lang) => lang.code !== sub.language && !existingTargets.has(lang.code)
                  );
                  return (
                    <div key={sub.id} className="rounded-xl border border-white/10 bg-[#10131a] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            Subtitle: {languageMap.get(sub.language) || sub.language}
                          </div>
                          <div className="text-xs text-muted">
                            Uploaded {new Date(sub.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <button
                          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-ink"
                          onClick={() =>
                            downloadSubtitle(
                              sub.id,
                              `${selectedMovie.title}.${sub.language}.srt`
                            )
                          }
                        >
                          Download original
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {(sub.translations || []).map((t) => (
                          <button
                            key={t.id}
                            className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100"
                            onClick={() =>
                              downloadTranslation(
                                t.id,
                                `${selectedMovie.title}.${t.targetLang}.srt`
                              )
                            }
                          >
                            Download {languageMap.get(t.targetLang) || t.targetLang}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {missing.length === 0 ? (
                          <span className="text-xs text-muted">All listed languages available.</span>
                        ) : (
                          missing.map((lang) => (
                            <button
                              key={lang.code}
                              className="rounded-full border border-white/20 px-3 py-1 text-xs text-ink"
                              disabled={translating[`${sub.id}_${lang.code}`]}
                              onClick={() => handleTranslate(sub.id, lang.code)}
                            >
                              {translating[`${sub.id}_${lang.code}`]
                                ? "Translating…"
                                : `Translate ${lang.label}`}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="text-xs text-muted">
        <p>This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
      </footer>
    </div>
  );
}

export default App;
