# Heirloom

A living dictionary for dying family languages. Humans create. Claude preserves.

Built for the Claude Builder Club Spring 2026 Hackathon @ NJIT, Track: Creative Flourishing.

## Golden path

Upload a photo of a handwritten artifact -> Claude transcribes and drafts a translation, flags uncertain words -> an elder taps any span and records a voice clip -> share one public page with scan, text, and audio.

## Local dev

Two terminals.

```bash
# 1. Backend
cd server
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)
uvicorn server.main:app --reload --port 8000
```

(Run uvicorn from the repo root: `cd .. && uvicorn server.main:app --reload --port 8000`)

```bash
# 2. Frontend
cd web
npm install
npm run dev
# open http://localhost:5173
```

The Vite dev server proxies `/api/*` to the FastAPI server on port 8000.

For local SQLite fallback, set `DATABASE_PATH`. For Postgres, set `DATABASE_URL`.

## Production build

```bash
docker build -t heirloom .
docker run --rm -p 8000:8000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e DATABASE_URL=$DATABASE_URL \
  heirloom
```

## Deploy on Railway

1. Create a new Railway project from this GitHub repo.
2. Add a PostgreSQL service in the same Railway project.
3. In the app service, set `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
4. Set `ANTHROPIC_API_KEY`, `HEIRLOOM_MAX_CALLS_PER_HOUR=60`, `HEIRLOOM_MAX_UPLOAD_MB=8`, `HEIRLOOM_MAX_AUDIO_MB=4`, and `HEIRLOOM_MAX_AUDIO_SECONDS=60`.
5. Do not mount a volume. Artifacts, spans, and uploaded audio are stored in SQL.
6. Deploy. Railway HTTPS is enough for `getUserMedia` and `MediaRecorder` in production.

## Architecture

Plain HTTP. SQL database for artifacts, spans, and audio blobs. No WebSocket, no SSE.

```text
artifacts (id, status, transcription_text, translation_text, ...)
spans (id, artifact_id, start_char, end_char, text, is_uncertain)
audio_clips (id, span_id, content, mime_type, duration_ms)
```

Audio attaches to text spans in the transcript, not image coordinates.

## Demo fallback

`GET /api/artifacts/demo` returns a hardcoded artifact for the live pitch in case Claude is unavailable.
