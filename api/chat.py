import json
import os
import re
import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from google.cloud import firestore
from openai import APIStatusError, OpenAI
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

from api.deps import get_current_user_id, get_db, get_optional_user_id
from db.firestore_client import get_client as get_firestore_client

router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_LIMIT = 50
CONTEXT_LIMIT = 12

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
MODEL = "gpt-4o-mini"

SYSTEM_PROMPT = (
    "You are a music discovery assistant for a Spotify-catalog mini app.\n"
    # 당신은 Spotify 카탈로그 미니 앱의 음악 탐색 도우미입니다.
    "Never invent track or artist names — only ever reference tracks a tool returned.\n\n"
    # 곡이나 아티스트 이름을 만들어내지 말고, 도구가 반환한 곡만 언급하세요.
    "Tool choice matters:\n"
    # 도구 선택이 중요합니다.
    "- If the user names a mood/vibe/feeling (chill, sad, hype, acoustic, energetic, happy, danceable, calm, intense, etc.) — even combined with a genre — call find_tracks_by_mood with energy/valence/danceability/acousticness set to reflect that vibe (0.0-1.0).\n"
    # 사용자가 분위기나 감정을 말하면 장르와 함께 요청하더라도, 해당 분위기를 반영한 오디오 특성값으로 find_tracks_by_mood를 호출하세요.
    "This is audio-feature matching, not a text search, so it works even when the mood word never appears in a track title.\n"
    # 이것은 텍스트 검색이 아닌 오디오 특성 매칭이므로, 분위기 단어가 곡 제목에 없어도 작동합니다.
    "- If the user names a specific song, artist, or genre with no mood description, call search_tracks (use list_genres first to resolve an exact genre id).\n"
    # 분위기 설명 없이 특정 곡, 아티스트 또는 장르를 말하면 search_tracks를 호출하고, 정확한 장르 ID가 필요하면 list_genres를 먼저 사용하세요.
    "- The catalog stores song and artist names in their original script (mostly English), not translated. If the user writes a song or artist name in Korean or another language, convert it to how it actually appears in the catalog (e.g. \"테일러 스위프트\" -> \"Taylor Swift\") before calling search_tracks — never pass the untranslated name as the query.\n"
    # 카탈로그의 곡/아티스트 이름은 번역 없이 원어(대부분 영어)로 저장돼 있습니다. 사용자가 한글 등 다른 언어로 이름을 말하면, search_tracks를 호출하기 전에 카탈로그에 실제로 쓰이는 표기(예: "테일러 스위프트" -> "Taylor Swift")로 바꾸세요 — 번역 안 된 이름을 그대로 query에 넣지 마세요.
    "- If you're not fully sure of the exact original-script spelling (lesser-known artist/song), still make your best guess and call search_tracks. If that returns no results, try 1-2 alternate spellings/transliterations. If it's still not found after that, tell the user you couldn't find it and ask them to type the exact name in its original spelling — don't just say \"not found\" after a single guess.\n"
    # 원어 철자를 100% 확신할 수 없는(덜 알려진 아티스트/곡) 경우에도, 가장 그럴듯한 철자로 먼저 search_tracks를 호출하세요. 결과가 없으면 다른 철자/표기로 1~2번 더 시도하세요. 그래도 못 찾으면, 못 찾았다고 말하고 정확한 원어 이름을 직접 입력해달라고 요청하세요 — 한 번 시도하고 바로 "못 찾았다"고 하지 마세요.
    "- If the user is just making small talk (greetings, thanks, chit-chat unrelated to music discovery), do not call any tool — just reply naturally and briefly.\n"
    # 사용자가 인사, 감사 인사, 음악 탐색과 무관한 잡담을 하면 도구를 호출하지 말고 짧고 자연스럽게 대답하세요.
    "- If the request is too vague to search with (no mood, genre, artist, or song mentioned — e.g. just \"recommend something\"), do not call a tool with guessed/default values. Instead call show_mood_picker, then reply with something like \"어떤 기분이나 장르의 음악을 듣고 싶으신가요?\n아래 Vibe Finder로 찾아보세요!\" (keep it close to this, translated/adjusted naturally, with a real line break between the two sentences).\n"
    # 요청이 너무 모호해서(무드, 장르, 아티스트, 곡 중 아무것도 언급되지 않아 검색할 근거가 없으면) 짐작한 기본값으로 도구를 호출하지 말고, show_mood_picker를 호출한 뒤 "어떤 기분이나 장르의 음악을 듣고 싶으신가요?\n아래 Vibe Finder로 찾아보세요!"와 비슷하게 답하세요.
    "- You may call a tool more than once and combine judgement across results if needed.\n\n"
    # 필요하다면 도구를 여러 번 호출하고 결과를 종합해 판단해도 됩니다.
    "Conversation memory: earlier assistant messages may include a \"[Shown tracks: ...]\" note listing what was actually shown — this is context for you only, never repeat that literal bracket text to the user. Use it to answer follow-ups about previous results (e.g. \"who sings the second one\", \"more like that\").\n"
    # 이전 assistant 메시지에 "[Shown tracks: ...]"라는 표기가 붙어있을 수 있는데, 이건 실제로 보여준 곡 목록을 알려주는 당신만을 위한 참고용 정보입니다 — 이 대괄호 텍스트 자체를 사용자에게 그대로 말하지 마세요. 이전 결과에 대한 후속 질문(예: "두 번째 곡 누가 불렀어", "그거랑 비슷한 걸로")에 답할 때 이 정보를 활용하세요.
    "A short follow-up (a mood word, \"more like that\", \"something else\") usually continues the most recent artist/genre/topic — don't drop that context and start an unrelated new search unless the user clearly signals a topic change. If the previous turn was about a specific artist and the follow-up adds a mood/vibe word, you MUST call find_tracks_by_mood with that artist's exact catalog spelling in the artist parameter — never leave artist empty in this case, that would silently search the whole catalog instead of that artist.\n"
    # "신나는 곡", "비슷한 걸로", "다른 거" 같은 짧은 후속 요청은 보통 직전 대화의 아티스트/장르/주제를 이어가는 것입니다 — 사용자가 명확히 주제를 바꾸지 않는 한, 그 맥락을 버리고 관련 없는 새 검색을 하지 마세요. 직전 대화가 특정 아티스트에 대한 것이었고 후속 요청이 무드/분위기 단어를 추가한 거라면, find_tracks_by_mood의 artist 파라미터를 반드시 채우세요 — 비워두면 카탈로그 전체에서 검색하게 됩니다.
    "Example: user asks \"Taylor Swift\" -> you find her tracks. User then says \"more upbeat\" -> call find_tracks_by_mood(energy=0.8, valence=0.8, artist=\"Taylor Swift\"), NOT find_tracks_by_mood(energy=0.8, valence=0.8) with artist left empty.\n\n"
    # 예시: 사용자가 "테일러 스위프트"라고 물어서 그녀의 곡을 찾아준 뒤, 사용자가 "더 신나게"라고 하면 find_tracks_by_mood(energy=0.8, valence=0.8, artist="Taylor Swift")를 호출해야지, artist를 비운 채 find_tracks_by_mood(energy=0.8, valence=0.8)만 호출하면 안 됩니다.
    "Keep replies to 1-3 short, friendly sentences.\n"
    # 답변은 짧고 친근한 1~3개 문장으로 작성하세요.
    "The app already shows the matched tracks as cards below your message, so don't list every title yourself — just say what you found.\n"
    # 앱이 추천 곡을 메시지 아래 카드로 보여주므로 모든 제목을 나열하지 말고 무엇을 찾았는지만 말하세요.
    "Always reply in Korean, regardless of what language the user wrote in."
    # 사용자가 어떤 언어로 물어보든 항상 한글로 답하세요.
)

TOOLS = [
    # 1. 곡 이름 또는 장르로 검색
    {
        "type": "function",
        "function": {
            "name": "search_tracks",
            "description": "Search the track catalog by track name and/or exact genre id.",
            # 곡 이름 또는 정확한 장르 ID로 음악 카탈로그를 검색합니다.
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Free text to match against track names or artist names (e.g. a song title or an artist's name). Empty string to skip.",
                        # 곡 이름 또는 아티스트 이름과 비교할 검색어이며, 빈 문자열이면 이름 검색을 생략합니다.
                    },
                    "genre": {
                        "type": "string",
                        "description": 'Exact genre id to filter by, e.g. "pop" or "k-pop" (use list_genres to find it). Empty string to skip.',
                        # pop 또는 k-pop 같은 정확한 장르 ID이며, 빈 문자열이면 장르 필터를 생략합니다.
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of tracks to return.",
                        # 반환할 최대 곡 수입니다.
                    },
                },
                "required": [],
            },
        },
    },

    # 2. 분위기와 오디오 특성으로 검색
    {
        "type": "function",
        "function": {
            "name": "find_tracks_by_mood",
            "description": "Find tracks by audio-feature mood. Each parameter is 0.0-1.0.",
            # 0.0~1.0 범위의 오디오 특성값을 사용해 분위기에 맞는 곡을 찾습니다.
            "parameters": {
                "type": "object",
                "properties": {
                    "energy": {
                        "type": "number",
                        "description": "How calm (0.0) vs intense (1.0) the track feels.",
                        # 곡이 차분한지(0.0), 강렬한지(1.0)를 나타냅니다.
                    },
                    "valence": {
                        "type": "number",
                        "description": "How sad (0.0) vs happy (1.0) the track feels.",
                        # 곡이 슬픈지(0.0), 행복한지(1.0)를 나타냅니다.
                    },
                    "danceability": {
                        "type": "number",
                        "description": "How still (0.0) vs groovy/danceable (1.0) the track feels.",
                        # 곡이 정적인지(0.0), 춤추기 좋은지(1.0)를 나타냅니다.
                    },
                    "acousticness": {
                        "type": "number",
                        "description": "How electronic (0.0) vs acoustic (1.0) the track feels.",
                        # 곡이 전자음 중심인지(0.0), 어쿠스틱한지(1.0)를 나타냅니다.
                    },
                    "artist": {
                        "type": "string",
                        "description": "Optional exact catalog spelling of an artist name to restrict results to (e.g. when continuing a mood request about a specific artist from earlier in the conversation). Empty string to search the whole catalog.",
                        # 결과를 특정 아티스트로 한정하고 싶을 때(예: 대화 앞부분에서 언급된 아티스트에 대한 무드 후속 요청) 카탈로그 표기 그대로의 아티스트 이름. 전체 카탈로그에서 찾으려면 빈 문자열.
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of tracks to return.",
                        # 반환할 최대 곡 수입니다.
                    },
                },
                "required": [],
            },
        },
    },

    # 3. 사용 가능한 장르 목록 조회
    {
        "type": "function",
        "function": {
            "name": "list_genres",
            "description": "List available genre ids in the catalog, most common first.",
            # 카탈로그에서 사용 가능한 장르 ID를 곡이 많은 순서로 반환합니다.
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },

    # 4. 요청이 모호할 때 Vibe Finder 슬라이더 카드를 보여주기 위한 신호 (DB 조회 없음)
    {
        "type": "function",
        "function": {
            "name": "show_mood_picker",
            "description": "Call this instead of guessing when the request has no mood, genre, artist, or song to search with. Shows the user a mood-slider picker card so they can specify what they want directly.",
            # 검색 근거(무드/장르/아티스트/곡)가 하나도 없을 때, 짐작하는 대신 이걸 호출하세요. 사용자가 직접 원하는 걸 고를 수 있는 무드 슬라이더 카드를 보여줍니다.
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None


def _attach_artists(conn, rows):
    track_ids = [t["id"] for t in rows]
    if not track_ids:
        return
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT ta.track_id, ar.id, ar.name
            FROM track_artist ta
            JOIN artists ar ON ar.id = ta.artist_id
            WHERE ta.track_id = ANY(%s)
            """,
            (track_ids,),
        )
        artists_by_track = {}
        for row in cur.fetchall():
            artists_by_track.setdefault(row["track_id"], []).append(
                {"id": row["id"], "name": row["name"]}
            )
    for t in rows:
        t["artists"] = artists_by_track.get(t["id"], [])


def _search_tracks(conn, found_tracks, query="", genre="", limit=20):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            LEFT JOIN track_genre tg ON tg.track_id = t.id AND %(genre)s != ''
            WHERE (
                %(query)s = ''
                OR t.name ILIKE '%%' || %(query)s || '%%'
                OR EXISTS (
                    SELECT 1 FROM track_artist ta
                    JOIN artists ar ON ar.id = ta.artist_id
                    WHERE ta.track_id = t.id AND ar.name ILIKE '%%' || %(query)s || '%%'
                )
            )
              AND (%(genre)s = '' OR tg.genre_id = %(genre)s)
            ORDER BY t.popularity DESC NULLS LAST
            LIMIT %(limit)s
            """,
            {"query": query, "genre": genre, "limit": limit},
        )
        rows = cur.fetchall()
    _attach_artists(conn, rows)
    found_tracks[:] = rows
    return f"Found {len(rows)} tracks." if rows else "No tracks matched."


def _find_tracks_by_mood(
    conn, found_tracks, energy=0.5, valence=0.5, danceability=0.5, acousticness=0.5, artist="", limit=20
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url,
                abs(t.energy - %(energy)s) + abs(t.valence - %(valence)s) +
                abs(t.danceability - %(danceability)s) + abs(t.acousticness - %(acousticness)s) AS score
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.energy IS NOT NULL AND t.valence IS NOT NULL
                AND t.danceability IS NOT NULL AND t.acousticness IS NOT NULL
                AND (
                    %(artist)s = ''
                    OR EXISTS (
                        SELECT 1 FROM track_artist ta
                        JOIN artists ar ON ar.id = ta.artist_id
                        WHERE ta.track_id = t.id AND ar.name ILIKE '%%' || %(artist)s || '%%'
                    )
                )
            ORDER BY score
            LIMIT %(limit)s
            """,
            {
                "energy": energy,
                "valence": valence,
                "danceability": danceability,
                "acousticness": acousticness,
                "artist": artist,
                "limit": limit,
            },
        )
        rows = cur.fetchall()
    _attach_artists(conn, rows)
    found_tracks[:] = rows
    return f"Found {len(rows)} tracks." if rows else "No tracks matched."


def _show_mood_picker(mood_picker_flag):
    mood_picker_flag[0] = True
    return "Showing the user a mood-slider picker card. Now write your short reply."


def _list_genres(conn, found_tracks):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT g.id, count(*) AS track_count
            FROM genres g
            JOIN track_genre tg ON tg.genre_id = g.id
            GROUP BY g.id
            ORDER BY track_count DESC
            LIMIT 60
            """
        )
        rows = cur.fetchall()
    return ", ".join(r["id"] for r in rows)


def _sessions_ref(user_id: str):
    return get_firestore_client().collection("chat_history").document(user_id).collection("sessions")


def _messages_ref(user_id: str, session_id: str):
    return _sessions_ref(user_id).document(session_id).collection("messages")


def _ensure_session(user_id: str, session_id: Optional[str], title_hint: str):
    """session_id가 없으면 새 세션을 만들고, 있으면 그대로 씀. 세션 문서에
    아직 title이 없으면(첫 메시지) 사용자의 첫 메시지로 제목을 붙인다."""
    sessions_ref = _sessions_ref(user_id)
    if not session_id:
        session_id = str(uuid.uuid4())
        sessions_ref.document(session_id).set(
            {
                "title": title_hint[:60],
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )
    else:
        doc_ref = sessions_ref.document(session_id)
        doc = doc_ref.get()
        if doc.exists:
            doc_ref.update({"updated_at": firestore.SERVER_TIMESTAMP})
        else:
            doc_ref.set(
                {
                    "title": title_hint[:60],
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                }
            )
    return session_id


def _load_recent_history(user_id: str, session_id: str, limit: int = CONTEXT_LIMIT):
    docs = (
        _messages_ref(user_id, session_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    history = [doc.to_dict() for doc in docs]
    history.reverse()
    return history


def _track_summary(tracks):
    parts = []
    for t in tracks[:10]:
        artists = ", ".join(a["name"] for a in (t.get("artists") or []))
        parts.append(f"{t.get('name')} — {artists}" if artists else t.get("name", ""))
    return ", ".join(parts)


def _strip_shown_tracks_note(reply):
    """모델이 컨텍스트에서 본 "[Shown tracks: ...]" 패턴을 그대로 따라 답변에
    적어버리는 경우가 있어서, 프롬프트 지시만으론 안 막히길래 반환 직전에
    한 번 더 제거하는 안전장치."""
    return re.sub(r"\n*\[Shown tracks:.*?\]", "", reply, flags=re.DOTALL).strip()


def _history_to_messages(history):
    """Firestore에 저장된 과거 대화를 OpenAI 컨텍스트용 메시지로 변환.
    과거 assistant 턴에 곡 목록이 있었으면, 화면에는 안 보이지만 LLM이
    후속 질문("그 중 첫 곡 아티스트는?", "더 신나는 걸로")에 답할 수 있게
    곡 요약을 content에 덧붙인다."""
    messages = []
    for h in history:
        content = h.get("content") or ""
        if h.get("role") == "assistant" and h.get("tracks"):
            content = f"{content}\n\n[Shown tracks: {_track_summary(h['tracks'])}]"
        messages.append({"role": h.get("role"), "content": content})
    return messages


@router.post("")
def chat(body: ChatRequest, user_id: str = Depends(get_optional_user_id), conn=Depends(get_db)):
    found_tracks = []
    show_mood_picker = [False]
    handlers = {
        "search_tracks": lambda **kw: _search_tracks(conn, found_tracks, **kw),
        "find_tracks_by_mood": lambda **kw: _find_tracks_by_mood(conn, found_tracks, **kw),
        "list_genres": lambda **kw: _list_genres(conn, found_tracks, **kw),
        "show_mood_picker": lambda **kw: _show_mood_picker(show_mood_picker, **kw),
    }

    if not body.messages:
        return {"reply": "", "tracks": [], "show_mood_picker": False, "session_id": body.session_id}
    last_user_message = body.messages[-1]

    session_id = body.session_id
    if user_id:
        session_id = _ensure_session(user_id, body.session_id, last_user_message.content)
        # Firestore에 저장된 실제 히스토리(곡 목록 포함)를 컨텍스트로 사용 —
        # 프론트가 보낸 role/content만 있는 body.messages보다 신뢰할 수 있음.
        chat_messages = _history_to_messages(_load_recent_history(user_id, session_id)) + [
            {"role": "user", "content": last_user_message.content}
        ]
    else:
        chat_messages = [{"role": m.role, "content": m.content} for m in body.messages]

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + chat_messages

    reply = ""
    for _ in range(5):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
        except APIStatusError as error:
            if error.status_code == 429:
                raise HTTPException(
                    status_code=503,
                    detail="OpenAI API 사용 한도에 도달했어요. 잠시 후 다시 시도해주세요.",
                )
            raise HTTPException(status_code=502, detail="OpenAI API 요청에 실패했어요.")
        message = response.choices[0].message
        messages.append(message.model_dump(exclude_none=True))

        if not message.tool_calls:
            reply = _strip_shown_tracks_note(message.content or "")
            break

        for tool_call in message.tool_calls:
            args = json.loads(tool_call.function.arguments or "{}")
            result = handlers[tool_call.function.name](**args)
            messages.append(
                {"role": "tool", "tool_call_id": tool_call.id, "content": result}
            )

    if user_id:
        messages_ref = _messages_ref(user_id, session_id)
        messages_ref.add(
            {
                "role": last_user_message.role,
                "content": last_user_message.content,
                "tracks": [],
                "show_mood_picker": False,
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )
        messages_ref.add(
            {
                "role": "assistant",
                "content": reply,
                "tracks": found_tracks,
                "show_mood_picker": show_mood_picker[0],
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )

    return {
        "reply": reply,
        "tracks": found_tracks,
        "show_mood_picker": show_mood_picker[0],
        "session_id": session_id,
    }


@router.get("/sessions")
def list_sessions(user_id: str = Depends(get_current_user_id)):
    docs = _sessions_ref(user_id).order_by(
        "updated_at", direction=firestore.Query.DESCENDING
    ).stream()
    return [
        {"id": doc.id, "title": (doc.to_dict() or {}).get("title") or "New chat"}
        for doc in docs
    ]


@router.post("/sessions", status_code=201)
def create_chat_session(user_id: str = Depends(get_current_user_id)):
    session_id = str(uuid.uuid4())
    _sessions_ref(user_id).document(session_id).set(
        {
            "title": "New chat",
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )
    return {"id": session_id, "title": "New chat"}


@router.delete("/sessions/{chat_session_id}", status_code=204)
def delete_chat_session(chat_session_id: str, user_id: str = Depends(get_current_user_id)):
    for doc in _messages_ref(user_id, chat_session_id).stream():
        doc.reference.delete()
    _sessions_ref(user_id).document(chat_session_id).delete()


@router.get("/sessions/{chat_session_id}/history")
def get_session_history(chat_session_id: str, user_id: str = Depends(get_current_user_id)):
    docs = (
        _messages_ref(user_id, chat_session_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(HISTORY_LIMIT)
        .stream()
    )
    messages = [
        {
            "role": d.get("role"),
            "content": d.get("content"),
            "tracks": d.get("tracks") or [],
            "show_mood_picker": d.get("show_mood_picker") or False,
        }
        for d in (doc.to_dict() for doc in docs)
    ]
    messages.reverse()
    return {"messages": messages}
