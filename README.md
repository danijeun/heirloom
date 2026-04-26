# Heirloom

*A living dictionary for dying family languages. Humans create. Claude preserves.*

[![Live demo](https://img.shields.io/badge/demo-heirloom--production-cc785c)](https://heirloom-production-92b1.up.railway.app/)
![Python](https://img.shields.io/badge/python-3.11-blue)
![FastAPI](https://img.shields.io/badge/fastapi-0.115-009688)
![React](https://img.shields.io/badge/react-19-61dafb)
![Vite](https://img.shields.io/badge/vite-8-646cff)
![Claude](https://img.shields.io/badge/claude-opus--4--7-cc785c)
![License](https://img.shields.io/badge/license-MIT-green)

**Live:** https://heirloom-production-92b1.up.railway.app/ — open on a phone, scan a handwritten artifact, record a voice note over any word, share by link.

## Table of contents

- [Why Heirloom](#why-heirloom)
- [Golden path](#golden-path)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [API](#api)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Claude integration](#claude-integration)
- [Deploy on Railway](#deploy-on-railway)
- [Docker](#docker)
- [Project structure](#project-structure)
- [Privacy and ethics](#privacy-and-ethics)
- [Roadmap](#roadmap)
- [Limitations](#limitations)
- [License](#license)

## Why Heirloom

Every family owns artifacts that nobody can fully read anymore. A grandmother's recipe card in mixed Spanglish. A great grandfather's letter in Ladino. A lullaby half remembered in Quechua. A diary written in a regional dialect that the town no longer speaks. Existing tools target major languages and printed text. They fail on handwriting, fail on regional dialects, and discard the one thing that matters most: the human voice that knows how the words are supposed to sound.

Heirloom turns a phone camera and an elder's voice into a permanent family scale archive. Claude is the scribe. The elder is the source. The information does not exist in Claude's weights. Only the human knows.

## Golden path

1. **Scan.** Photograph any handwritten artifact.
2. **Read.** Claude transcribes character by character, drafts a tentative translation, and flags every uncertain word.
3. **Voice.** An elder taps a span and records a short clip: pronunciation, meaning, the story behind the word.
4. **Keep.** The artifact becomes an interactive heirloom page with the original image, transcription, translation, and tappable voice clips. Shareable by unguessable URL.

## Quickstart

Two terminals.

```bash
# Backend
cd heirloom
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt
export $(grep -v '^#' .env | xargs)
uvicorn server.main:app --reload --port 8000
```

```bash
# Frontend
cd heirloom/web
npm install
npm run dev
# http://localhost:5173
```

Vite proxies `/api/*` to FastAPI on port 8000. SQLite is the default store. Set `DATABASE_URL` for Postgres.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | required | Claude API credentials. |
| `DATABASE_URL` | unset | Postgres connection string. Takes precedence over SQLite. |
| `DATABASE_PATH` | `/data/heirloom.db` | SQLite file path when `DATABASE_URL` is unset. |
| `AUDIO_DIR` | unset | Optional filesystem mirror for uploaded audio blobs. |
| `HEIRLOOM_MAX_UPLOAD_MB` | `8` | Hard cap on incoming image size. |
| `HEIRLOOM_MAX_AUDIO_MB` | `4` | Hard cap on incoming audio size. |
| `HEIRLOOM_MAX_AUDIO_SECONDS` | `60` | Server side enforced audio duration cap. |
| `HEIRLOOM_MAX_CALLS_PER_HOUR` | `60` | Per IP rate limit, rolling one hour window. |
| `HEIRLOOM_COOKIE_SECRET` | required for auth | Signs session cookies. 32 bytes hex. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables Google OAuth sign in. |
| `HEIRLOOM_BASE_URL` | request host | Public base URL used for OAuth redirects. |

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe. Verifies database connectivity. |
| `POST` | `/api/artifacts` | Multipart image upload. Returns an artifact id. |
| `GET` | `/api/artifacts/{id}` | Artifact, transcription, translation, spans, attached clips. |
| `GET` | `/api/artifacts/demo` | Pre cached demo response for the live pitch fallback. |
| `POST` | `/api/artifacts/{id}/spans` | Create a user selected span for attaching audio. |
| `POST` | `/api/spans/{id}/audio` | Multipart audio upload bound to a span. |
| `GET` | `/api/audio/{id}` | Streams the stored audio clip. |
| `GET` | `/auth/google/login` | Begins Google OAuth sign in. |
| `GET` | `/auth/google/callback` | OAuth callback. Sets a signed session cookie. |
| `POST` | `/auth/logout` | Clears the session cookie. |
| `GET` | `/api/me` | Current user, or anonymous session info. |
| `GET` | `/api/me/artifacts` | Artifacts owned by the signed in user. |
| `POST` | `/api/me/claim` | Claim anonymous artifacts after sign in. |

Sample artifact response:

```json
{
  "id": "9f3a...e4b1",
  "status": "ready",
  "transcription_text": "Receta de la abuela.\nMaiz, manteca, y un poco de panela.",
  "translation_text": "Grandmother's recipe.\nCorn, lard, and a bit of panela (raw cane sugar).",
  "original_language_guess": "Spanish (regional)",
  "spans": [
    {
      "id": "a1b2c3d4",
      "start_char": 41,
      "end_char": 47,
      "text": "panela",
      "is_uncertain": true,
      "audio_clips": [
        { "id": "c0ffee01", "url": "/api/audio/c0ffee01", "mime_type": "audio/mp4", "duration_ms": 3200 }
      ]
    }
  ]
}
```

## Architecture

```
[React Web Client]
     |  HTTP (image upload, artifact fetch, audio upload, share)
     v
[FastAPI Server]
     +--> Claude API (claude_opus_4_7 multimodal): transcribe, translate, flag uncertainty
     +--> SQL (SQLite or Postgres): artifacts, spans, audio_clips
     +--> Optional filesystem mirror: AUDIO_DIR
```

Plain HTTP. No WebSocket. No SSE. The client polls `GET /api/artifacts/{id}` until `status` leaves `pending`. Audio attaches to text spans in the transcript, never to image coordinates, because Claude's token level bounding boxes on handwritten low resource scripts are unreliable.

## Data model

```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  created_at INTEGER,
  image_url TEXT,
  original_language_guess TEXT,
  transcription_text TEXT,
  translation_text TEXT,
  claude_model TEXT,
  status TEXT,                    -- pending | ready | failed
  error_message TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_cents INTEGER
);

CREATE TABLE spans (
  id TEXT PRIMARY KEY,
  artifact_id TEXT REFERENCES artifacts(id),
  start_char INTEGER,
  end_char INTEGER,
  text TEXT,
  is_uncertain INTEGER
);

CREATE TABLE audio_clips (
  id TEXT PRIMARY KEY,
  span_id TEXT REFERENCES spans(id),
  file_path TEXT,
  content BLOB,
  mime_type TEXT,
  duration_ms INTEGER,
  speaker_name TEXT,
  created_at INTEGER
);
```

Artifact ids are 128 bit hex generated by `secrets.token_hex(16)`. Share URLs are public by link and must not be enumerable.

## Claude integration

One model, three uses: vision OCR on handwritten scripts, cautious draft translation, and uncertainty flags as character ranges. The system prompt is cached for cost efficiency. The user prompt requests a strict JSON object with `language_guess`, `transcription`, `translation`, and `uncertain_spans`. The server validates the response, downscales images to 2048 px on the longest edge before the API call, and logs request id, latency, input and output tokens, and computed cost in cents per call.

## Deploy on Railway

1. New service from this repository's Dockerfile.
2. Add a Postgres plugin in the same project.
3. Bind `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app service.
4. Set `ANTHROPIC_API_KEY`, `HEIRLOOM_MAX_CALLS_PER_HOUR`, `HEIRLOOM_MAX_UPLOAD_MB`, `HEIRLOOM_MAX_AUDIO_MB`, `HEIRLOOM_MAX_AUDIO_SECONDS`.
5. No volume required. Audio is stored in SQL.
6. Deploy. Railway HTTPS satisfies `getUserMedia` and `MediaRecorder` on iOS Safari.

## Docker

```bash
docker build -t heirloom .
docker run --rm -p 8000:8000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e DATABASE_URL=$DATABASE_URL \
  heirloom
```

The Dockerfile is multi stage: Node 20 builds the Vite bundle into `web/dist`, then a Python 3.11 slim runtime copies the bundle and serves it through FastAPI's `StaticFiles`.

## Project structure

```
heirloom/
  Dockerfile
  railway.json
  server/
    main.py            # FastAPI app, routes, SPA fallback
    claude_client.py   # Anthropic SDK call, prompt caching, JSON parse
    db.py              # SQLAlchemy engine, schema bootstrap
    images.py          # HEIC normalization, downscale to 2048 px
    pricing.py         # Token to cents conversion
    rate_limit.py      # Per IP rolling window
    requirements.txt
  web/
    index.html
    package.json
    vite.config.ts
    src/
      main.tsx
      api.ts
      recorder.ts
      ErrorBoundary.tsx
      styles.css
      pages/
        Home.tsx
        Artifact.tsx
```

## Privacy and ethics

Artifact ids are unguessable so a leaked URL cannot be walked. Voice clips capture content that only the speaker possesses, which is treated as a consent boundary, not a content asset. The post hackathon plan, documented in `CLAUDE.md` under *v1.5 Living Web Archive*, replaces "share by unguessable URL" with revocable share grants, magic link identity, per clip speaker consent, family member roles, audit logging, and BagIt export.

## Roadmap

The hackathon scope ends with the golden path. The next iteration adds magic link authentication, revocable share grants, per clip speaker consent, family invites and roles, an event sourced audit log, soft delete with tombstones, and a BagIt archival export. Long form plan in `CLAUDE.md`.

## Limitations

Claude vision is best effort on rare and endangered scripts. Uncertainty flags are surfaced to the elder as a feature, not hidden as a bug. iOS Safari and Android Chrome disagree on `MediaRecorder` MIME types, so the client probes supported codecs at runtime. The rate limiter is in process and resets on restart, which is acceptable at hackathon scale and replaced by a durable counter at production scale.

## Built for

Claude Builder Club Spring 2026 Hackathon at NJIT. Track: Creative Flourishing. Kupfrian Hall, Newark NJ. Ten hours.

## License

MIT.
