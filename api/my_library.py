from fastapi import APIRouter, Depends
from google.cloud import firestore
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

from api.deps import get_current_user_id, get_db
from db.firestore_client import get_client as get_firestore_client

router = APIRouter(prefix="/library", tags=["library"])

RECENTLY_PLAYED_LIMIT = 20


class RecordPlay(BaseModel):
    track_id: str


@router.get("/artists")
def library_artists(user_id: str = Depends(get_current_user_id), conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT DISTINCT ar.*
            FROM artists ar
            JOIN track_artist ta ON ta.artist_id = ar.id
            JOIN playlist_track pt ON pt.track_id = ta.track_id
            JOIN playlists p ON p.id = pt.playlist_id
            WHERE p.owner_id = %s
            ORDER BY ar.name
            """,
            (user_id,),
        )
        return cur.fetchall()


@router.get("/albums")
def library_albums(user_id: str = Depends(get_current_user_id), conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT DISTINCT al.*
            FROM albums al
            JOIN tracks t ON t.album_id = al.id
            JOIN playlist_track pt ON pt.track_id = t.id
            JOIN playlists p ON p.id = pt.playlist_id
            WHERE p.owner_id = %s
            ORDER BY al.name
            """,
            (user_id,),
        )
        return cur.fetchall()


def _plays_ref(user_id: str):
    return get_firestore_client().collection("recently_played").document(user_id).collection("plays")


@router.post("/recently-played", status_code=204)
def record_play(body: RecordPlay, user_id: str = Depends(get_current_user_id)):
    _plays_ref(user_id).document(body.track_id).set({"played_at": firestore.SERVER_TIMESTAMP})


@router.get("/recently-played")
def recently_played(user_id: str = Depends(get_current_user_id), conn=Depends(get_db)):
    docs = (
        _plays_ref(user_id)
        .order_by("played_at", direction=firestore.Query.DESCENDING)
        .limit(RECENTLY_PLAYED_LIMIT)
        .stream()
    )
    track_ids = [doc.id for doc in docs]
    if not track_ids:
        return []

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.id = ANY(%s)
            """,
            (track_ids,),
        )
        tracks_by_id = {t["id"]: t for t in cur.fetchall()}
        for t in tracks_by_id.values():
            t["artists"] = []
        cur.execute(
            """
            SELECT ta.track_id, ar.id, ar.name
            FROM artists ar
            JOIN track_artist ta ON ta.artist_id = ar.id
            WHERE ta.track_id = ANY(%s)
            """,
            (track_ids,),
        )
        for row in cur.fetchall():
            track = tracks_by_id.get(row["track_id"])
            if track:
                track["artists"].append({"id": row["id"], "name": row["name"]})

    return [tracks_by_id[tid] for tid in track_ids if tid in tracks_by_id]
