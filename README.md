# Heirloom

A living dictionary for dying family languages. Humans create. Claude preserves.

Built for the Claude Builder Club Spring 2026 Hackathon @ NJIT — Track: Creative Flourishing.

## Golden path

Upload a photo of a handwritten artifact → Claude transcribes + drafts a translation, flags uncertain words → an elder taps any span and records a voice clip → share one public page with scan + text + audio.

## Local dev

Two terminals.

```bash
# 1. Backend
cd server
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)
export DATABASE_PATH=$PWD/../data/heirloom.db AUDIO_DIR=$PWD/../data/audio
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

## Production build (single container)

```bash
docker build -t heirloom .
docker run --rm -p 8000:8000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $PWD/data:/data \
  heirloom
```

## Deploy (Railway)

1. New service from this GitHub repo (Dockerfile auto-detected).
2. Mount a 1 GB volume at `/data`.
3. Env vars: `ANTHROPIC_API_KEY`, `HEIRLOOM_MAX_CALLS_PER_HOUR=60`, `HEIRLOOM_MAX_UPLOAD_MB=8`, `DATABASE_PATH=/data/heirloom.db`, `AUDIO_DIR=/data/audio`.
4. Custom domain → HTTPS auto.

`getUserMedia` and `MediaRecorder` are HTTPS-only on iOS Safari. Railway's HTTPS satisfies this in prod; for local mobile testing use Ngrok.

## Architecture

Plain HTTP. SQLite. Local volume for audio. No WebSocket, no SSE.

```
artifacts (id, status, transcription_text, translation_text, ...)
spans (id, artifact_id, start_char, end_char, text, is_uncertain)
audio_clips (id, span_id, file_path, mime_type, duration_ms)
```

Audio attaches to **text spans in the transcript**, not to image coordinates — Claude's bounding boxes on handwritten low-resource scripts aren't reliable.

## Demo fallback

`GET /api/artifacts/demo` returns a hardcoded artifact for the live pitch in case Claude is unavailable.
