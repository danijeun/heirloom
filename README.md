<div align="center">

# Heirloom

**A living dictionary for dying family languages.**
*Humans create. Claude preserves.*

[![Live](https://img.shields.io/badge/live-heirloom--production-cc785c?style=flat-square)](https://heirloom-production-92b1.up.railway.app/)
[![Claude](https://img.shields.io/badge/claude-opus--4--7-cc785c?style=flat-square)](https://www.anthropic.com/)
![Python](https://img.shields.io/badge/python-3.11-3776ab?style=flat-square)
![FastAPI](https://img.shields.io/badge/fastapi-0.115-009688?style=flat-square)
![React](https://img.shields.io/badge/react-19-61dafb?style=flat-square)
![Vite](https://img.shields.io/badge/vite-8-646cff?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)

[**Live demo**](https://heirloom-production-92b1.up.railway.app/) · [Golden path](#golden-path) · [Quickstart](#quickstart) · [API](#api) · [Architecture](#architecture) · [Privacy](#privacy--ethics)

</div>

---

## What this is

Every family owns artifacts that nobody can fully read anymore. A grandmother's recipe card in mixed Spanglish. A great-grandfather's letter in Ladino. A lullaby half-remembered in Quechua. A diary in a regional dialect the town no longer speaks.

Existing tools target major languages and printed text. They fail on handwriting, fail on regional dialects, and discard the one thing that matters most: **the human voice that knows how the words are supposed to sound.**

Heirloom turns a phone camera and an elder's voice into a permanent, family-scale archive. Claude is the scribe. The elder is the source. The information does not exist in Claude's weights — only the human knows.

## Table of contents

- [Golden path](#golden-path)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [API](#api)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Claude integration](#claude-integration)
- [Project structure](#project-structure)
- [Deploy](#deploy)
- [Privacy & ethics](#privacy--ethics)
- [Roadmap](#roadmap)
- [Limitations](#limitations)
- [Built for](#built-for)
- [License](#license)

## Golden path

```
SCAN  →  READ  →  VOICE  →  KEEP
```

1. **Scan.** Photograph any handwritten artifact (letter, recipe, prayer, margin note).
2. **Read.** Claude transcribes character-by-character, drafts a tentative translation, and flags every uncertain word.
3. **Voice.** An elder taps a span and records a short clip — pronunciation, meaning, the story behind the word.
4. **Keep.** The artifact becomes an interactive heirloom page: original image, transcription, translation, and tappable voice clips. Shareable by unguessable URL.

## Quickstart

Two terminals. Python 3.11 and Node 20.

```bash
# 1. Backend — FastAPI on :8000
cd heirloom
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
uvicorn server.main:app --reload --port 8000
```

```bash
# 2. Frontend — Vite on :5173 (proxies /api to :8000)
cd heirloom/web
npm install
npm run dev
```

Open `http://localhost:5173`. SQLite is the default store; set `DATABASE_URL` to use Postgres. Voice capture requires HTTPS on iOS Safari — for local mobile testing, use `mkcert` or an ngrok tunnel.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | **required** | Claude API credentials. |
| `DATABASE_URL` | unset | Postgres connection string. Takes precedence over SQLite. |
| `DATABASE_PATH` | `/data/heirloom.db` | SQLite file path when `DATABASE_URL` is unset. |
| `AUDIO_DIR` | unset | Optional filesystem mirror for uploaded audio blobs (audio is also stored inline in SQL). |
| `HEIRLOOM_MAX_UPLOAD_MB` | `8` | Hard cap on incoming image size. |
| `HEIRLOOM_MAX_AUDIO_MB` | `4` | Hard cap on incoming audio size. |
| `HEIRLOOM_MAX_AUDIO_SECONDS` | `60` | Server-side audio duration cap. |
| `HEIRLOOM_MAX_CALLS_PER_HOUR` | `60` | Per-IP rate limit, rolling 1-hour window. |
| `HEIRLOOM_COOKIE_SECRET` | required for auth | Signs session cookies. 32 bytes hex. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables Google OAuth sign-in. |
| `HEIRLOOM_BASE_URL` | request host | Public base URL used for OAuth redirects. |

## API

All endpoints return JSON unless noted. Errors follow `{"detail": "..."}`.

### Artifacts

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/artifacts` | Multipart image upload. Accepts `image/jpeg`, `image/png`, `image/heic`, `image/heif`. Returns `{ id, status }`. |
| `GET` | `/api/artifacts/{id}` | Artifact, transcription, translation, spans, attached audio clips. Poll until `status` leaves `pending`. |
| `GET` | `/api/artifacts/demo` | Pre-cached demo artifact — fallback for live pitch. |
| `DELETE` | `/api/artifacts/{id}` | Owner-only. Cascades to spans and clips. |

### Spans & audio

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/artifacts/{id}/spans` | Create a user-selected span (range of characters in the transcript) for attaching audio. |
| `DELETE` | `/api/spans/{id}` | Remove a span. |
| `POST` | `/api/spans/{id}/audio` | Multipart audio upload bound to a span. |
| `GET` | `/api/audio/{id}` | Streams the stored audio clip. |
| `DELETE` | `/api/audio/{id}` | Remove a single voice clip. |

### Identity

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google/login` | Begin Google OAuth. |
| `GET` | `/auth/google/callback` | OAuth callback. Sets a signed session cookie. |
| `POST` | `/auth/logout` | Clear session. |
| `GET` | `/api/me` | Current user, or anonymous session info. |
| `GET` | `/api/me/artifacts` | Artifacts owned by the signed-in user. |
| `POST` | `/api/me/claim` | Claim anonymous artifacts after sign-in. |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe. Verifies database connectivity. |

### Sample artifact response

```json
{
  "id": "9f3a...e4b1",
  "status": "ready",
  "original_language_guess": "Spanish (regional)",
  "transcription_text": "Receta de la abuela.\nMaiz, manteca, y un poco de panela.",
  "translation_text": "Grandmother's recipe.\nCorn, lard, and a bit of panela (raw cane sugar).",
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
┌──────────────────────┐  HTTP (image upload, fetch, audio upload, share)
│   React 19 + Vite    │ ───────────────────────────────────────────────┐
│  TanStack Query · Zod │                                                 │
│  Radix · framer-motion│                                                 ▼
└──────────────────────┘                                  ┌──────────────────────────┐
                                                          │       FastAPI            │
                                                          │  ┌────────────────────┐  │
                                                          │  │ Claude Opus 4.7    │  │
                                                          │  │ (vision · prompt   │  │
                                                          │  │  caching · JSON)   │  │
                                                          │  └────────────────────┘  │
                                                          │  ┌────────────────────┐  │
                                                          │  │ SQLite or Postgres │  │
                                                          │  │ artifacts · spans  │  │
                                                          │  │ audio_clips        │  │
                                                          │  └────────────────────┘  │
                                                          └──────────────────────────┘
```

Plain HTTP. No WebSocket, no SSE. The client polls `GET /api/artifacts/{id}` until `status` leaves `pending`.

**Audio attaches to text spans in the transcript, never to image coordinates** — Claude's token-level bounding boxes on handwritten low-resource scripts are unreliable, so the source of truth for where a clip belongs is a character range in the transcribed text.

## Data model

```sql
CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,                -- 128-bit hex (secrets.token_hex(16))
  created_at INTEGER,
  image_url TEXT,
  original_language_guess TEXT,
  transcription_text TEXT,
  translation_text TEXT,
  claude_model TEXT,
  status TEXT,                        -- pending | ready | failed
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
  content BLOB,                       -- inline storage; AUDIO_DIR optional mirror
  mime_type TEXT,
  duration_ms INTEGER,
  speaker_name TEXT,
  created_at INTEGER
);
```

Artifact ids are 128-bit hex. Share URLs are public-by-link and **must not be enumerable** — this is an ethics requirement, not just a security one.

## Claude integration

One model (`claude-opus-4-7`), three uses:

- **Vision OCR** — transcribe handwritten, possibly low-resource scripts character-by-character.
- **Translation** — produce a *cautious* draft English gloss, never authoritative.
- **Uncertainty flags** — return character ranges the UI underlines for human correction.

The system prompt is **cached** for cost and latency. Images are server-side downscaled to 2048 px on the longest edge before the API call. HEIC and HEIF are normalized to JPEG via `pillow-heif`. The user message requests a strict JSON object:

```json
{
  "language_guess": "string",
  "transcription": "string",
  "translation": "string",
  "uncertain_spans": [{ "start": 0, "end": 0, "reason": "string" }]
}
```

Responses are validated with pydantic. Per-call telemetry — request id, latency, input/output tokens, and computed cost in cents — is logged.

## Project structure

```
heirloom/
├── Dockerfile                  # multi-stage: node 20 build → python 3.11 runtime
├── railway.json
├── server/
│   ├── main.py                 # FastAPI app, routes, SPA fallback
│   ├── claude_client.py        # Anthropic SDK call, prompt caching, JSON parse
│   ├── db.py                   # SQLAlchemy engine, schema bootstrap
│   ├── images.py               # HEIC normalization, 2048 px downscale
│   ├── auth.py                 # Google OAuth + signed session cookies
│   ├── pricing.py              # Token → cents conversion
│   ├── rate_limit.py           # Per-IP rolling window
│   └── requirements.txt
└── web/
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── api.ts              # typed client, Zod-validated payloads
        ├── auth.ts
        ├── recorder.ts         # MediaRecorder w/ runtime MIME negotiation
        ├── ErrorBoundary.tsx
        ├── styles.css
        ├── pages/              # Home · Artifact · Mine
        └── components/         # Nav · Footer · SpanToken · VoicePopup · Waveform · …
```

## Deploy

### Railway (recommended)

1. New service from this repository's `Dockerfile`.
2. (Optional) Add a Postgres plugin and bind `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
3. Set `ANTHROPIC_API_KEY` plus the `HEIRLOOM_*` caps and `HEIRLOOM_COOKIE_SECRET`.
4. No volume required — audio is stored in SQL. Railway HTTPS satisfies `getUserMedia` and `MediaRecorder` on iOS Safari.
5. Push to `main`. Auto-deploy.

### Docker

```bash
docker build -t heirloom .
docker run --rm -p 8000:8000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e DATABASE_URL=$DATABASE_URL \
  -e HEIRLOOM_COOKIE_SECRET=$(openssl rand -hex 32) \
  heirloom
```

The Dockerfile is multi-stage: Node 20 builds the Vite bundle into `web/dist`, then a Python 3.11 slim runtime copies the bundle and serves it through FastAPI's `StaticFiles` (with SPA fallback so `/a/<id>` survives a refresh).

## Privacy & ethics

- **Unguessable share URLs.** A leaked link cannot be walked into another family's heirloom.
- **The voice belongs to the speaker.** Voice clips capture content that only the speaker possesses. We treat that as a consent boundary, not a content asset.
- **Claude as scribe, not author.** The system prompt explicitly tells Claude it is *not* the author. Uncertainty is surfaced, never hidden.
- **No training on family data.** Heirloom does not feed user audio, transcriptions, or images into model training.

The post-hackathon plan (documented in `CLAUDE.md` under *v1.5 — Living Web Archive*) replaces "share by unguessable URL" with revocable share grants, magic-link identity, per-clip speaker consent, family-member roles, an event-sourced audit log, soft delete with tombstones, and a BagIt archival export.

## Roadmap

The hackathon scope ends at the golden path. Next up:

- **v1.5 — Living Web Archive.** Magic-link auth, revocable share grants (`/s/<nonce>`), per-clip speaker consent (visibility · attribution · posthumous), family invites and roles, version history with `If-Match` concurrency, audit log, soft delete with tombstones, BagIt export, honest privacy headers (`noai`, `noimageai`, strict CSP).
- **v2.** EPUB 3 with Media Overlays, optional Internet Archive deposit, end-to-end encryption for persecuted-language use cases.

## Limitations

- Claude vision is best-effort on rare and endangered scripts. **Uncertainty flags are surfaced as a feature, not hidden as a bug.**
- iOS Safari and Android Chrome disagree on `MediaRecorder` MIME types. The client probes supported codecs at runtime (Safari prefers `audio/mp4`; others prefer `audio/webm;codecs=opus`).
- The rate limiter is in-process and resets on restart — fine at hackathon scale, replaced by a durable counter at production scale.
- Translation is always labeled draft. The elder's voice is the authoritative layer.

## Built for

Claude Builder Club Spring 2026 Hackathon @ NJIT — Track: *Creative Flourishing*. Kupfrian Hall, Newark NJ. Ten hours.

> *"Anthropic asked: are we keeping humans as creators, or replacing them? Heirloom cannot replace the speaker. The information does not exist without her. That is the whole point."*

## License

MIT.
