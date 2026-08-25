# Spotify OAuth 로그인과 사용자 세션을 관리하는 API
# 주요 기능:
# - Spotify 로그인 페이지로 이동
# - 인증 완료 후 사용자 정보를 users 테이블에 저장
# - Redis 로그인 세션 및 브라우저 쿠키 생성
# - 현재 로그인한 사용자 정보 조회
# - 로그아웃 처리

# 필요한 패키지 Import
import os
import urllib.parse
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from psycopg2.extras import RealDictCursor

from api.deps import (
    SESSION_COOKIE,
    create_session,
    delete_session,
    get_current_user_id,
    get_db,
    get_session_id,
)

router = APIRouter(prefix="/auth", tags=["auth"]) # 로그인 관련 API 주소를 /auth로 묶음

CLIENT_ID = os.environ["SPOTIFY_CLIENT_ID"] # Spotify ID
CLIENT_SECRET = os.environ["SPOTIFY_CLIENT_SECRET"] # Spotify Secret
REDIRECT_URI = os.environ["SPOTIFY_APP_REDIRECT_URI"] # 로그인 후 돌아올 API 주소
FRONTEND_URL = os.environ["FRONTEND_URL"] # 로그인 완료 후 이동할 화면

# Spotify 로그인 페이지로 이동
@router.get("/login") # /auth/login
def login():
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": "playlist-read-private playlist-read-collaborative",
    }
    return RedirectResponse(
        f"https://accounts.spotify.com/authorize?{urllib.parse.urlencode(params)}"
    )

# Spotify에서 사용자 정보를 받아 PostgreSQL의 users 테이블에 저장하고, 
# Redis에 로그인 세션을 만들어 로그인 상태를 유지함
@router.get("/callback")
def callback(code: str, conn=Depends(get_db)):
    token_response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        },
    )
    token_response.raise_for_status()
    tokens = token_response.json()
    access_token = tokens["access_token"]

    profile_response = requests.get(
        "https://api.spotify.com/v1/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    profile_response.raise_for_status()
    profile = profile_response.json()

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            INSERT INTO users (id, display_name)
            VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET
                display_name = EXCLUDED.display_name
            """,
            (
                profile["id"],
                profile.get("display_name"),
            ),
        )
        conn.commit()

    session_id = create_session(profile["id"], tokens)
    redirect = RedirectResponse(FRONTEND_URL)
    redirect.set_cookie(
        key=SESSION_COOKIE,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=int(os.environ["SESSION_TTL_SECONDS"]),
    )
    return redirect

# 현재 로그인한 사용자의 ID와 이름을 반환
@router.get("/me")
def me(user_id: str = Depends(get_current_user_id), conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, display_name
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="user not found")
        return user

# Redis의 로그인 세션과 브라우저 쿠키를 삭제하여 로그아웃 처리
@router.post("/logout")
def logout(response: Response, session_id: Optional[str] = Depends(get_session_id)):
    if session_id:
        delete_session(session_id)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}
