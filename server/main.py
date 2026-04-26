import logging
import os
import secrets
import shutil
import time
import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import bindparam, text
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

load_dotenv()

from . import auth, db, pricing, rate_limit
from .auth import get_current_user, require_user
from .claude_client import transcribe_image
from .images import ACCEPTED_MIME, normalize_to_jpeg

AUDIO_DIR = Path(os.environ["AUDIO_DIR"]) if os.environ.get("AUDIO_DIR") else None
MAX_UPLOAD_MB = int(os.environ.get("HEIRLOOM_MAX_UPLOAD_MB", "8"))
MAX_AUDIO_MB = int(os.environ.get("HEIRLOOM_MAX_AUDIO_MB", "4"))
MAX_AUDIO_S = int(os.environ.get("HEIRLOOM_MAX_AUDIO_SECONDS", "60"))
WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("heirloom")

app = FastAPI(title="Heirloom")

# Authlib needs a Starlette session for OAuth state during the redirect dance.
# This is NOT the user session; it's a short-lived signed cookie holding
# `state` + `nonce` between /auth/google/login and /auth/google/callback.
_session_secret = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
app.add_middleware(
    SessionMiddleware,
    secret_key=_session_secret,
    session_cookie="heirloom_oauth_state",
    max_age=600,  # 10 minutes; the OAuth dance takes seconds
    same_site="lax",
    https_only=auth.COOKIE_SECURE,
)


@app.on_event("startup")
def _startup() -> None:
    if AUDIO_DIR is not None:
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    db.init_db()
    log.info(
        "startup ok database_url=%s database_path=%s audio_dir=%s",
        bool(db.DATABASE_URL),
        db.DATABASE_PATH,
        AUDIO_DIR,
    )


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = secrets.token_hex(6)
    t0 = time.time()
    response = await call_next(request)
    log.info(
        "rid=%s %s %s -> %s %dms",
        rid, request.method, request.url.path, response.status_code,
        int((time.time() - t0) * 1000),
    )
    response.headers["x-request-id"] = rid
    return response


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


# --- Auth routes ------------------------------------------------------------

@app.get("/auth/google/login")
async def auth_google_login(request: Request):
    return await auth.google_login(request)


@app.get("/auth/google/callback")
async def auth_google_callback(request: Request):
    return await auth.google_callback(request)


@app.post("/auth/logout")
def auth_logout(request: Request):
    return auth.logout(request)


@app.get("/api/me")
def api_me(user=Depends(get_current_user)):
    return {
        "user": user,
        "anonymous": user is None,
        "google_configured": auth.is_configured(),
    }


@app.get("/api/me/artifacts")
def api_me_artifacts(user=Depends(require_user)):
    with db.conn() as c:
        rows = c.execute(
            text(
                """SELECT id, status, created_at, original_language_guess,
                          transcription_text, translation_text
                   FROM artifacts WHERE owner_user_id = :uid
                   ORDER BY created_at DESC LIMIT 200"""
            ),
            {"uid": user["id"]},
        ).mappings().fetchall()
    return {
        "artifacts": [
            {
                "id": r["id"],
                "status": r["status"],
                "created_at": r["created_at"],
                "original_language_guess": r["original_language_guess"] or "",
                "transcription_preview": (r["transcription_text"] or "")[:140],
                "has_translation": bool(r["translation_text"]),
            }
            for r in rows
        ]
    }


@app.post("/api/me/claim")
def api_me_claim(payload: dict = Body(...), user=Depends(require_user)):
    """Idempotently claim previously-anonymous artifacts. Only sets owner_user_id
    on rows where it is currently NULL; defends shared-device users from each other."""
    raw_ids = payload.get("artifact_ids") or []
    if not isinstance(raw_ids, list):
        raise HTTPException(400, "artifact_ids must be a list of strings")
    artifact_ids = [str(x) for x in raw_ids if isinstance(x, str) and x][:500]
    if not artifact_ids:
        return {"claimed": 0, "skipped": 0}
    with db.conn() as c:
        stmt = text(
            "UPDATE artifacts SET owner_user_id = :uid "
            "WHERE owner_user_id IS NULL AND id IN :ids"
        ).bindparams(bindparam("ids", expanding=True))
        result = c.execute(stmt, {"uid": user["id"], "ids": artifact_ids})
        claimed = result.rowcount or 0
    return {"claimed": claimed, "skipped": len(artifact_ids) - claimed}


@app.get("/health")
def health():
    try:
        with db.conn() as c:
            c.execute(text("SELECT 1")).fetchone()
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/api/artifacts")
async def create_artifact(
    request: Request,
    image: UploadFile = File(...),
    user=Depends(get_current_user),
):
    ip = _client_ip(request)
    if not rate_limit.allow(ip):
        raise HTTPException(429, "Rate limit exceeded (per hour)")

    if image.content_type not in ACCEPTED_MIME:
        raise HTTPException(415, f"Unsupported media type: {image.content_type}")

    raw = await image.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Image exceeds {MAX_UPLOAD_MB} MB cap")

    try:
        jpeg, _ = normalize_to_jpeg(raw)
    except Exception as e:
        raise HTTPException(400, f"Could not decode image: {e}")

    artifact_id = secrets.token_hex(16)
    now = int(time.time())
    owner_user_id = user["id"] if user else None
    with db.conn() as c:
        c.execute(
            text(
                """INSERT INTO artifacts (id, created_at, status, owner_user_id, image_url, image_content)
                   VALUES (:id, :created_at, 'pending', :owner, :image_url, :image_content)"""
            ),
            {
                "id": artifact_id,
                "created_at": now,
                "owner": owner_user_id,
                "image_url": f"/api/artifacts/{artifact_id}/image",
                "image_content": jpeg,
            },
        )

    try:
        result = transcribe_image(jpeg)
        parsed = result["parsed"]
        transcription = parsed.get("transcription", "") or ""
        translation = parsed.get("translation", "") or ""
        language = parsed.get("language_guess", "") or ""
        uncertain = parsed.get("uncertain_spans", []) or []

        cents = pricing.cost_cents(
            result["input_tokens"], result["output_tokens"],
            result.get("cache_read", 0), result.get("cache_write", 0),
        )
        log.info(
            "rid=artifact=%s claude_ms=%d in=%d out=%d cache_r=%d cache_w=%d cost_cents=%d",
            artifact_id, result["latency_ms"], result["input_tokens"], result["output_tokens"],
            result.get("cache_read", 0), result.get("cache_write", 0), cents,
        )

        with db.conn() as c:
            c.execute(
                text(
                    """UPDATE artifacts
                       SET status='ready', transcription_text=:transcription_text, translation_text=:translation_text,
                           original_language_guess=:original_language_guess, claude_model=:claude_model,
                           input_tokens=:input_tokens, output_tokens=:output_tokens, cost_cents=:cost_cents
                       WHERE id=:id"""
                ),
                {
                    "transcription_text": transcription,
                    "translation_text": translation,
                    "original_language_guess": language,
                    "claude_model": result["model"],
                    "input_tokens": result["input_tokens"],
                    "output_tokens": result["output_tokens"],
                    "cost_cents": cents,
                    "id": artifact_id,
                },
            )
            for span in uncertain:
                start, end = int(span.get("start", 0)), int(span.get("end", 0))
                if end <= start or start < 0 or end > len(transcription):
                    continue
                meaning_options = span.get("meaning_options") or []
                c.execute(
                    text(
                        """INSERT INTO spans (id, artifact_id, start_char, end_char, text, is_uncertain, meaning_options)
                           VALUES (:id, :artifact_id, :start_char, :end_char, :text, 1, :meaning_options)"""
                    ),
                    {
                        "id": secrets.token_hex(8),
                        "artifact_id": artifact_id,
                        "start_char": start,
                        "end_char": end,
                        "text": transcription[start:end],
                        "meaning_options": json.dumps(meaning_options),
                    },
                )
    except Exception as e:
        log.exception("artifact %s failed", artifact_id)
        with db.conn() as c:
            c.execute(
                text("UPDATE artifacts SET status='failed', error_message=:error_message WHERE id=:id"),
                {"error_message": str(e)[:500], "id": artifact_id},
            )

    return {"id": artifact_id}


@app.get("/api/artifacts/demo")
def demo_artifact():
    """Pre-cached demo response. Replace data here with a real Claude response before pitch."""
    return {
        "id": "demo",
        "status": "ready",
        "transcription_text": "Receta de la abuela.\nMaiz, manteca, y un poco de panela.",
        "translation_text": "Grandmother's recipe.\nCorn, lard, and a bit of panela (raw cane sugar).",
        "original_language_guess": "Spanish (regional)",
        "spans": [{"id": "demo-s1", "start_char": 41, "end_char": 47,
                   "text": "panela", "is_uncertain": True,
                   "meaning_options": [
                       {"word": "panela", "meaning": "raw cane sugar formed in cakes"},
                       {"word": "piloncillo", "meaning": "unrefined brown sugar in cone or block form"},
                       {"word": "rapadura", "meaning": "solid evaporated cane juice sweetener"},
                   ],
                   "audio_clips": []}],
    }


@app.delete("/api/artifacts/{artifact_id}", status_code=204)
def delete_artifact(artifact_id: str, request: Request, user=Depends(require_user)):
    if request.headers.get("x-requested-with") != "heirloom-web":
        raise HTTPException(400, "Missing required header")
    with db.conn() as c:
        result = c.execute(
            text("DELETE FROM artifacts WHERE id=:id AND owner_user_id=:uid"),
            {"id": artifact_id, "uid": user["id"]},
        )
        if result.rowcount == 0:
            log.warning("delete miss user=%s artifact=%s", user["id"], artifact_id)
            raise HTTPException(404, "Not found")
    if AUDIO_DIR is not None:
        folder = AUDIO_DIR / artifact_id
        if folder.exists():
            try:
                shutil.rmtree(folder)
            except OSError as e:
                log.warning("rmtree failed artifact=%s err=%s", artifact_id, e)
    return Response(status_code=204)


@app.get("/api/artifacts/{artifact_id}")
def get_artifact(artifact_id: str):
    with db.conn() as c:
        row = c.execute(
            text("SELECT * FROM artifacts WHERE id=:id"),
            {"id": artifact_id},
        ).mappings().fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        spans_rows = c.execute(
            text("SELECT * FROM spans WHERE artifact_id=:artifact_id ORDER BY start_char"),
            {"artifact_id": artifact_id},
        ).mappings().fetchall()
        span_ids = [s["id"] for s in spans_rows]
        clips_by_span: dict[str, list] = {sid: [] for sid in span_ids}
        if span_ids:
            stmt = text(
                "SELECT * FROM audio_clips WHERE span_id IN :span_ids ORDER BY created_at"
            ).bindparams(bindparam("span_ids", expanding=True))
            for clip in c.execute(stmt, {"span_ids": span_ids}).mappings().fetchall():
                clips_by_span[clip["span_id"]].append({
                    "id": clip["id"], "url": f"/api/audio/{clip['id']}",
                    "mime_type": clip["mime_type"], "duration_ms": clip["duration_ms"],
                    "speaker_name": clip["speaker_name"],
                })

    return {
        "id": row["id"], "status": row["status"], "error": row["error_message"],
        "image_url": row["image_url"] or f"/api/artifacts/{artifact_id}/image",
        "transcription_text": row["transcription_text"] or "",
        "translation_text": row["translation_text"] or "",
        "original_language_guess": row["original_language_guess"] or "",
        "spans": [
            {"id": s["id"], "start_char": s["start_char"], "end_char": s["end_char"],
             "text": s["text"], "is_uncertain": bool(s["is_uncertain"]),
             "meaning_options": _parse_meaning_options_for_span(s["text"], s.get("meaning_options")),
             "audio_clips": clips_by_span.get(s["id"], [])}
            for s in spans_rows
        ],
    }


@app.get("/api/artifacts/{artifact_id}/image")
def get_artifact_image(artifact_id: str):
    with db.conn() as c:
        row = c.execute(
            text("SELECT image_content FROM artifacts WHERE id=:id"),
            {"id": artifact_id},
        ).mappings().fetchone()
        if not row or row["image_content"] is None:
            raise HTTPException(404, "Artifact image not found")
    return Response(content=bytes(row["image_content"]), media_type="image/jpeg")


def _parse_meaning_options(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict] = []
    for option in data:
        if not isinstance(option, dict):
            continue
        word = str(option.get("word") or "").strip()
        meaning = str(option.get("meaning") or "").strip()
        if word and meaning:
            out.append({"word": word, "meaning": meaning})
    return out[:3]


def _parse_meaning_options_for_span(span_text: str, raw: str | None) -> list[dict]:
    parsed = _parse_meaning_options(raw)
    return [{"word": span_text, "meaning": option["meaning"]} for option in parsed]


@app.post("/api/artifacts/{artifact_id}/spans")
def create_span(artifact_id: str, payload: dict):
    """Create a user-selected span (non-uncertain) for attaching audio."""
    start = int(payload.get("start_char", -1))
    end = int(payload.get("end_char", -1))
    with db.conn() as c:
        art = c.execute(
            text("SELECT transcription_text FROM artifacts WHERE id=:id"),
            {"id": artifact_id},
        ).mappings().fetchone()
        if not art:
            raise HTTPException(404, "Artifact not found")
        transcription = art["transcription_text"] or ""
        if not (0 <= start < end <= len(transcription)):
            raise HTTPException(400, "Invalid span range")
        # Reject overlap with any existing span on this artifact
        overlap = c.execute(
            text(
                "SELECT 1 FROM spans WHERE artifact_id=:aid "
                "AND start_char < :end AND end_char > :start LIMIT 1"
            ),
            {"aid": artifact_id, "start": start, "end": end},
        ).fetchone()
        if overlap:
            raise HTTPException(409, "Span overlaps an existing span")
        sid = secrets.token_hex(8)
        c.execute(
            text(
                """INSERT INTO spans (id, artifact_id, start_char, end_char, text, is_uncertain)
                   VALUES (:id, :artifact_id, :start_char, :end_char, :text, 0)"""
            ),
            {
                "id": sid,
                "artifact_id": artifact_id,
                "start_char": start,
                "end_char": end,
                "text": transcription[start:end],
            },
        )
    return {"id": sid, "start_char": start, "end_char": end, "text": transcription[start:end]}


@app.delete("/api/spans/{span_id}", status_code=204)
def delete_span(span_id: str, request: Request, user=Depends(get_current_user)):
    if request.headers.get("x-requested-with") != "heirloom-web":
        raise HTTPException(400, "Missing required header")
    with db.conn() as c:
        row = c.execute(
            text(
                """SELECT s.artifact_id, a.owner_user_id
                   FROM spans s JOIN artifacts a ON a.id = s.artifact_id
                   WHERE s.id = :id"""
            ),
            {"id": span_id},
        ).mappings().fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        owner = row["owner_user_id"]
        if owner is not None and (user is None or user["id"] != owner):
            raise HTTPException(403, "Forbidden")
        clips = c.execute(
            text("SELECT file_path FROM audio_clips WHERE span_id=:sid"),
            {"sid": span_id},
        ).mappings().fetchall()
        # FK ON DELETE CASCADE removes audio_clips rows automatically.
        c.execute(text("DELETE FROM spans WHERE id=:id"), {"id": span_id})
    for clip in clips:
        if clip["file_path"]:
            try:
                Path(clip["file_path"]).unlink(missing_ok=True)
            except OSError as e:
                log.warning("span-cascade unlink failed span=%s err=%s", span_id, e)
    return Response(status_code=204)


@app.delete("/api/audio/{clip_id}", status_code=204)
def delete_audio(clip_id: str, request: Request, user=Depends(get_current_user)):
    if request.headers.get("x-requested-with") != "heirloom-web":
        raise HTTPException(400, "Missing required header")
    with db.conn() as c:
        row = c.execute(
            text(
                """SELECT ac.file_path, a.owner_user_id
                   FROM audio_clips ac
                   JOIN spans s ON s.id = ac.span_id
                   JOIN artifacts a ON a.id = s.artifact_id
                   WHERE ac.id = :id"""
            ),
            {"id": clip_id},
        ).mappings().fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        owner = row["owner_user_id"]
        if owner is not None and (user is None or user["id"] != owner):
            raise HTTPException(403, "Forbidden")
        c.execute(text("DELETE FROM audio_clips WHERE id=:id"), {"id": clip_id})
    if row["file_path"]:
        try:
            Path(row["file_path"]).unlink(missing_ok=True)
        except OSError as e:
            log.warning("audio unlink failed clip=%s err=%s", clip_id, e)
    return Response(status_code=204)


@app.post("/api/spans/{span_id}/audio")
async def upload_audio(span_id: str, request: Request,
                       audio: UploadFile = File(...),
                       duration_ms: int = 0,
                       speaker_name: str = ""):
    if not rate_limit.allow(_client_ip(request)):
        raise HTTPException(429, "Rate limit exceeded")
    if duration_ms and duration_ms > MAX_AUDIO_S * 1000:
        raise HTTPException(413, f"Audio exceeds {MAX_AUDIO_S}s")

    raw = await audio.read()
    if len(raw) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(413, f"Audio exceeds {MAX_AUDIO_MB} MB")

    with db.conn() as c:
        span = c.execute(
            text("SELECT artifact_id FROM spans WHERE id=:id"),
            {"id": span_id},
        ).mappings().fetchone()
        if not span:
            raise HTTPException(404, "Span not found")
        artifact_id = span["artifact_id"]

    ext = {"audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg",
           "audio/mpeg": "mp3", "audio/wav": "wav"}.get(audio.content_type or "", "bin")
    clip_id = secrets.token_hex(8)
    file_path = None
    if AUDIO_DIR is not None:
        folder = AUDIO_DIR / artifact_id
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{clip_id}.{ext}"
        path.write_bytes(raw)
        file_path = str(path)

    with db.conn() as c:
        c.execute(
            text(
                """INSERT INTO audio_clips
                   (id, span_id, file_path, content, mime_type, duration_ms, speaker_name, created_at)
                   VALUES (:id, :span_id, :file_path, :content, :mime_type, :duration_ms, :speaker_name, :created_at)"""
            ),
            {
                "id": clip_id,
                "span_id": span_id,
                "file_path": file_path,
                "content": raw,
                "mime_type": audio.content_type or "application/octet-stream",
                "duration_ms": duration_ms or None,
                "speaker_name": speaker_name or None,
                "created_at": int(time.time()),
            },
        )
    return {"id": clip_id, "url": f"/api/audio/{clip_id}"}


@app.get("/api/audio/{clip_id}")
def get_audio(clip_id: str):
    with db.conn() as c:
        row = c.execute(
            text("SELECT file_path, content, mime_type FROM audio_clips WHERE id=:id"),
            {"id": clip_id},
        ).mappings().fetchone()
        if not row:
            raise HTTPException(404, "Not found")
    if row["content"] is not None:
        return Response(content=bytes(row["content"]), media_type=row["mime_type"])
    if row["file_path"]:
        return FileResponse(row["file_path"], media_type=row["mime_type"])
    raise HTTPException(404, "Audio content missing")


# --- SPA static fallback (must be LAST) ---
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


if WEB_DIST.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(WEB_DIST), html=True), name="web")
else:
    @app.get("/")
    def _placeholder():
        return {"message": "Hello Heirloom — web/dist not built yet"}
