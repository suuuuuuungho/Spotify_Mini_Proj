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
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url,
                abs(t.energy - %(energy)s) + abs(t.valence - %(valence)s) +
                abs(t.danceability - %(danceability)s) + abs(t.acousticness - %(acousticness)s) +
                abs(t.liveness - %(liveness)s) + abs(t.speechiness - %(speechiness)s) AS score
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.energy IS NOT NULL AND t.valence IS NOT NULL
                AND t.danceability IS NOT NULL AND t.acousticness IS NOT NULL
                AND t.liveness IS NOT NULL AND t.speechiness IS NOT NULL
            ORDER BY score
            LIMIT %(limit)s
            """,
            {
                "energy": energy,
                "valence": valence,
                "danceability": danceability,
                "acousticness": acousticness,
                "liveness": liveness,
                "speechiness": speechiness,
                "limit": limit,
            },
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
