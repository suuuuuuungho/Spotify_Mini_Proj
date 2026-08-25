import json
import os
from typing import List, Literal

from fastapi import APIRouter, Depends
from google.cloud import firestore
from openai import OpenAI
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

from api.deps import get_current_user_id, get_db, get_optional_user_id
from db.firestore_client import get_client as get_firestore_client

router = APIRouter(prefix="/chat", tags=["chat"])

HISTORY_LIMIT = 50

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
    "- If the user is just making small talk (greetings, thanks, chit-chat unrelated to music discovery), do not call any tool — just reply naturally and briefly.\n"
    # 사용자가 인사, 감사 인사, 음악 탐색과 무관한 잡담을 하면 도구를 호출하지 말고 짧고 자연스럽게 대답하세요.
    "- If the request is too vague to search with (no mood, genre, artist, or song mentioned — e.g. just \"recommend something\"), do not call a tool with guessed/default values. Instead call show_mood_picker, then reply with something like \"어떤 기분이나 장르의 음악을 듣고 싶으신가요?\n아래 Vibe Finder로 찾아보세요!\" (keep it close to this, translated/adjusted naturally, with a real line break between the two sentences).\n"
    # 요청이 너무 모호해서(무드, 장르, 아티스트, 곡 중 아무것도 언급되지 않아 검색할 근거가 없으면) 짐작한 기본값으로 도구를 호출하지 말고, show_mood_picker를 호출한 뒤 "어떤 기분이나 장르의 음악을 듣고 싶으신가요?\n아래 Vibe Finder로 찾아보세요!"와 비슷하게 답하세요.
    "- You may call a tool more than once and combine judgement across results if needed.\n\n"
    # 필요하다면 도구를 여러 번 호출하고 결과를 종합해 판단해도 됩니다.
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
                        "description": "Free text to match against track names. Empty string to skip.",
                        # 곡 이름과 비교할 검색어이며, 빈 문자열이면 이름 검색을 생략합니다.
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


def _search_tracks(conn, found_tracks, query="", genre="", limit=20):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            LEFT JOIN track_genre tg ON tg.track_id = t.id AND %(genre)s != ''
            WHERE (%(query)s = '' OR t.name ILIKE '%%' || %(query)s || '%%')
              AND (%(genre)s = '' OR tg.genre_id = %(genre)s)
            ORDER BY t.popularity DESC NULLS LAST
            LIMIT %(limit)s
            """,
            {"query": query, "genre": genre, "limit": limit},
        )
        rows = cur.fetchall()
    found_tracks[:] = rows
    return f"Found {len(rows)} tracks." if rows else "No tracks matched."


def _find_tracks_by_mood(
    conn, found_tracks, energy=0.5, valence=0.5, danceability=0.5, acousticness=0.5, limit=20
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
            ORDER BY score
            LIMIT %(limit)s
            """,
            {
                "energy": energy,
                "valence": valence,
                "danceability": danceability,
                "acousticness": acousticness,
                "limit": limit,
            },
        )
        rows = cur.fetchall()
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


def _messages_ref(user_id: str):
    return get_firestore_client().collection("chat_history").document(user_id).collection("messages")


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

    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + [
        {"role": m.role, "content": m.content} for m in body.messages
    ]

    reply = ""
    for _ in range(5):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )
        message = response.choices[0].message
        messages.append(message.model_dump(exclude_none=True))

        if not message.tool_calls:
            reply = message.content or ""
            break

        for tool_call in message.tool_calls:
            args = json.loads(tool_call.function.arguments or "{}")
            result = handlers[tool_call.function.name](**args)
            messages.append(
                {"role": "tool", "tool_call_id": tool_call.id, "content": result}
            )

    for t in found_tracks:
        t["artists"] = []

    if user_id and body.messages:
        last_user_message = body.messages[-1]
        messages_ref = _messages_ref(user_id)
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

    return {"reply": reply, "tracks": found_tracks, "show_mood_picker": show_mood_picker[0]}


@router.get("/history")
def get_history(user_id: str = Depends(get_current_user_id)):
    docs = (
        _messages_ref(user_id)
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


@router.delete("/history", status_code=204)
def clear_history(user_id: str = Depends(get_current_user_id)):
    for doc in _messages_ref(user_id).stream():
        doc.reference.delete()
