import os
import json
import secrets
import time
from typing import Optional

import requests
from fastapi import Cookie, Depends, HTTPException

from db.postgres import get_connection
from db.redis_client import get_client as get_redis_client

SESSION_COOKIE = "session_id"


def get_db():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def create_session(user_id: str, spotify_tokens: Optional[dict] = None) -> str:
    session_id = secrets.token_urlsafe(32)
    session = {"user_id": user_id}
    if spotify_tokens:
        session.update(
            {
                "spotify_access_token": spotify_tokens["access_token"],
                "spotify_refresh_token": spotify_tokens.get("refresh_token"),
                "spotify_expires_at": int(time.time()) + spotify_tokens.get("expires_in", 3600),
            }
        )
    get_redis_client().set(
        f"session:{session_id}",
        json.dumps(session),
        ex=int(os.environ["SESSION_TTL_SECONDS"]),
    )
    return session_id


def delete_session(session_id: str):
    get_redis_client().delete(f"session:{session_id}")


def get_session_id(
    session_id: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE)
) -> Optional[str]:
    return session_id


def get_current_user_id(
    session_id: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE)
) -> str:
    if not session_id:
        raise HTTPException(status_code=401, detail="not authenticated")
    raw_session = get_redis_client().get(f"session:{session_id}")
    if not raw_session:
        raise HTTPException(status_code=401, detail="session expired")
    try:
        return json.loads(raw_session)["user_id"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return raw_session


def get_optional_user_id(
    session_id: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE)
) -> Optional[str]:
    if not session_id:
        return None
    raw_session = get_redis_client().get(f"session:{session_id}")
    if not raw_session:
        return None
    try:
        return json.loads(raw_session)["user_id"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return raw_session


def get_spotify_access_token(
    session_id: Optional[str] = Depends(get_session_id),
) -> str:
    if not session_id:
        raise HTTPException(status_code=401, detail="not authenticated")

    redis_client = get_redis_client()
    session_key = f"session:{session_id}"
    raw_session = redis_client.get(session_key)
    if not raw_session:
        raise HTTPException(status_code=401, detail="session expired")

    try:
        session = json.loads(raw_session)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Spotify permission is missing. Log out and log in again.",
        )

    access_token = session.get("spotify_access_token")
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Spotify permission is missing. Log out and log in again.",
        )
    if session.get("spotify_expires_at", 0) > time.time() + 60:
        return access_token

    refresh_token = session.get("spotify_refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Spotify login expired. Log in again.")

    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": os.environ["SPOTIFY_CLIENT_ID"],
            "client_secret": os.environ["SPOTIFY_CLIENT_SECRET"],
        },
        timeout=15,
    )
    if not response.ok:
        raise HTTPException(status_code=401, detail="Spotify login expired. Log in again.")

    refreshed = response.json()
    session["spotify_access_token"] = refreshed["access_token"]
    session["spotify_refresh_token"] = refreshed.get("refresh_token", refresh_token)
    session["spotify_expires_at"] = int(time.time()) + refreshed.get("expires_in", 3600)
    ttl = redis_client.ttl(session_key)
    redis_client.set(session_key, json.dumps(session), ex=ttl if ttl > 0 else int(os.environ["SESSION_TTL_SECONDS"]))
    return session["spotify_access_token"]
