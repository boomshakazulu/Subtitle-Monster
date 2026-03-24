# Subtitle Monster

Monorepo for SRT translation using a local NLLB model.

## Structure
- `client/` React + Vite + Tailwind
- `server/` Express API
- `translation-service/` FastAPI + NLLB local translator

## Environment
Copy `server/.env.example` to `server/.env` and configure:

```
MONGODB_URI=mongodb://localhost:27017/subtitle_monster
TMDB_API_KEY=your_tmdb_v3_key
TMDB_ACCESS_TOKEN=your_tmdb_v4_read_access_token
LOCAL_TRANSLATOR_URL=http://localhost:8000
LOCAL_COLD_START_MS=5000
PORT=5000
```

## Local Translator
The local service uses `facebook/nllb-200-distilled-1.3B` by default.

From `translation-service/`:

```
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Dev
From repo root:

```
npm run dev
```

## Notes
- Local translation requires a source language (NLLB does not auto-detect).
- Translations are stored in MongoDB and requests are queued (single worker).
- TMDb attribution text is required in the UI.
