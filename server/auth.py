"""Google OAuth + server-side session auth.

Flow (final consolidated plan):
- /auth/google/login redirects to Google.
- /auth/google/callback exchanges code (Authlib does PKCE/state/id_token validation),
  upserts users, mints a sessions row, sets a __Host- cookie holding the raw session id.
- get_current_user dependency reads the cookie, looks up the row, slides expiry.
- POST /api/me/claim sets owner_user_id on previously-anonymous artifacts; client
  tracks the unowned artifact ids in localStorage.
"""

from __future__ import annotations

import logging
import os
import secrets
import time
from typing import Any

from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy import text

from . import db

log = logging.getLogger("heirloom.auth")

SESSION_COOKIE = "__Host-heirloom_sid"
SESSION_TTL_S = 30 * 24 * 3600  # 30 days
CLEANUP_PROBABILITY = 0.01  # 1% sweep on each successful login

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
COOKIE_SECURE = BASE_URL.startswith("https://")

oauth = OAuth()
oauth.register(
    name="google",
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _now() -> int:
    return int(time.time())


def _set_session_cookie(response, session_id: str) -> None:
    # __Host- prefix mandates Secure + Path=/ + no Domain.
    # In local dev (http://localhost) we drop the __Host- requirement by writing a plain name.
    name = SESSION_COOKIE if COOKIE_SECURE else "heirloom_sid"
    response.set_cookie(
        key=name,
        value=session_id,
        max_age=SESSION_TTL_S,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response) -> None:
    for name in (SESSION_COOKIE, "heirloom_sid"):
        response.delete_cookie(key=name, path="/")


def _read_session_cookie(request: Request) -> str | None:
    return request.cookies.get(SESSION_COOKIE) or request.cookies.get("heirloom_sid")


def _upsert_user(conn, google_sub: str, email: str, name: str | None, picture_url: str | None) -> str:
    row = conn.execute(
        text("SELECT id FROM users WHERE google_sub = :sub"),
        {"sub": google_sub},
    ).mappings().fetchone()
    now = _now()
    if row:
        user_id = row["id"]
        conn.execute(
            text(
                """UPDATE users SET email = :email, name = :name,
                       picture_url = :picture, last_login_at = :now
                   WHERE id = :id"""
            ),
            {"email": email, "name": name, "picture": picture_url, "now": now, "id": user_id},
        )
        return user_id
    user_id = secrets.token_hex(16)
    conn.execute(
        text(
            """INSERT INTO users (id, google_sub, email, name, picture_url, created_at, last_login_at)
               VALUES (:id, :sub, :email, :name, :picture, :now, :now)"""
        ),
        {"id": user_id, "sub": google_sub, "email": email, "name": name,
         "picture": picture_url, "now": now},
    )
    return user_id


def _create_session(conn, user_id: str) -> str:
    sid = secrets.token_hex(32)
    now = _now()
    conn.execute(
        text(
            """INSERT INTO sessions (id, user_id, created_at, expires_at)
               VALUES (:id, :user_id, :created, :expires)"""
        ),
        {"id": sid, "user_id": user_id, "created": now, "expires": now + SESSION_TTL_S},
    )
    return sid


def _maybe_cleanup_expired(conn) -> None:
    if secrets.randbelow(100) == 0:  # roughly 1%
        conn.execute(
            text("DELETE FROM sessions WHERE expires_at < :now"),
            {"now": _now()},
        )


async def google_login(request: Request):
    if not is_configured():
        raise HTTPException(503, "Google OAuth is not configured")
    redirect_uri = f"{BASE_URL}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


async def google_callback(request: Request):
    if not is_configured():
        raise HTTPException(503, "Google OAuth is not configured")
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as e:
        log.warning("oauth callback rejected: %s", e)
        raise HTTPException(400, f"OAuth error: {e.error}")

    info = token.get("userinfo") or {}
    google_sub = info.get("sub")
    email = (info.get("email") or "").strip().lower()
    email_verified = bool(info.get("email_verified"))
    name = info.get("name") or None
    picture_url = info.get("picture") or None

    if not google_sub or not email:
        raise HTTPException(400, "Google did not return a usable identity")
    if not email_verified:
        raise HTTPException(403, "Google account email is not verified")

    with db.conn() as c:
        user_id = _upsert_user(c, google_sub, email, name, picture_url)
        sid = _create_session(c, user_id)
        _maybe_cleanup_expired(c)

    # Land on /mine (frontend handles the localStorage claim there).
    from fastapi.responses import RedirectResponse
    response = RedirectResponse(url="/mine", status_code=302)
    _set_session_cookie(response, sid)
    return response


def logout(request: Request):
    from fastapi.responses import Response
    sid = _read_session_cookie(request)
    if sid:
        with db.conn() as c:
            c.execute(text("DELETE FROM sessions WHERE id = :id"), {"id": sid})
    response = Response(status_code=204)
    _clear_session_cookie(response)
    return response


def get_current_user(request: Request) -> dict[str, Any] | None:
    sid = _read_session_cookie(request)
    if not sid:
        return None
    now = _now()
    with db.conn() as c:
        row = c.execute(
            text(
                """SELECT u.id, u.email, u.name, u.picture_url, s.expires_at, s.created_at
                   FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.id = :sid"""
            ),
            {"sid": sid},
        ).mappings().fetchone()
        if not row or row["expires_at"] < now:
            return None
        # Slide expiry if more than ~24h have passed since last extension. Cheap approximation:
        # extend whenever remaining < 29 days. Avoids per-request writes.
        if row["expires_at"] - now < SESSION_TTL_S - 24 * 3600:
            c.execute(
                text("UPDATE sessions SET expires_at = :exp WHERE id = :sid"),
                {"exp": now + SESSION_TTL_S, "sid": sid},
            )
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "picture_url": row["picture_url"],
    }


def require_user(user: dict[str, Any] | None = Depends(get_current_user)) -> dict[str, Any]:
    if not user:
        raise HTTPException(401, "Sign in required")
    return user
