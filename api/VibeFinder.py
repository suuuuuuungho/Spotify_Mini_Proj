from fastapi import APIRouter, Depends
from psycopg2.extras import RealDictCursor

from api.deps import get_db

router = APIRouter(prefix="/discover", tags=["discover"])


@router.get("/mood")
def mood(
    energy: float = 0.5,
    valence: float = 0.5,
    danceability: float = 0.5,
    acousticness: float = 0.5,
    liveness: float = 0.5,
    speechiness: float = 0.5,
    limit: int = 30,
    conn=Depends(get_db),
):
    # mood_vector stores [energy, valence, danceability, acousticness, liveness, speechiness];
    # <=> is pgvector's cosine distance operator, so this rides the ivfflat index below
    # instead of computing an abs()-sum over every row on every request.
    target = f"[{energy},{valence},{danceability},{acousticness},{liveness},{speechiness}]"
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url,
                t.mood_vector <=> %(target)s::vector AS score
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.mood_vector IS NOT NULL
            ORDER BY t.mood_vector <=> %(target)s::vector
            LIMIT %(limit)s
            """,
            {"target": target, "limit": limit},
        )
        tracks = cur.fetchall()

        track_ids = [t["id"] for t in tracks]
        if track_ids:
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
            for t in tracks:
                t["artists"] = artists_by_track.get(t["id"], [])

        return tracks
