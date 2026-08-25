from fastapi import APIRouter, Depends
from psycopg2.extras import RealDictCursor

from api.deps import get_db

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/genres")
def genre_stats(conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT g.id, g.name, count(*) AS track_count,
                avg(t.energy) AS avg_energy,
                avg(t.valence) AS avg_valence,
                avg(t.danceability) AS avg_danceability,
                avg(t.tempo) AS avg_tempo
            FROM genres g
            JOIN track_genre tg ON tg.genre_id = g.id
            JOIN tracks t ON t.id = tg.track_id
            WHERE t.energy IS NOT NULL AND t.valence IS NOT NULL
            GROUP BY g.id, g.name
            ORDER BY track_count DESC
            """
        )
        return cur.fetchall()


@router.get("/top-artists")
def top_artists(limit: int = 20, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, name, followers, popularity
            FROM artists
            WHERE followers IS NOT NULL
            ORDER BY followers DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


@router.get("/top-tracks")
def top_tracks(limit: int = 15, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.id, t.name, t.popularity, t.duration_ms, t.explicit,
                a.name AS album_name, a.image_url AS album_image_url
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.popularity IS NOT NULL
            ORDER BY t.popularity DESC
            LIMIT %s
            """,
            (limit,),
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
            by_track = {}
            for row in cur.fetchall():
                by_track.setdefault(row["track_id"], []).append(
                    {"id": row["id"], "name": row["name"]}
                )
            for t in tracks:
                t["artists"] = by_track.get(t["id"], [])
        return tracks


@router.get("/overview")
def overview(conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                (SELECT count(*) FROM tracks) AS total_tracks,
                (SELECT count(*) FROM artists) AS total_artists,
                (SELECT count(*) FROM albums) AS total_albums,
                (SELECT count(*) FROM playlists) AS total_playlists,
                (SELECT count(*) FROM tracks WHERE explicit) AS explicit_tracks,
                (SELECT avg(energy) FROM tracks WHERE energy IS NOT NULL) AS avg_energy,
                (SELECT avg(danceability) FROM tracks WHERE danceability IS NOT NULL) AS avg_danceability,
                (SELECT avg(valence) FROM tracks WHERE valence IS NOT NULL) AS avg_valence,
                (SELECT avg(tempo) FROM tracks WHERE tempo IS NOT NULL) AS avg_tempo
            """
        )
        return cur.fetchone()


@router.get("/release-decades")
def release_decades(conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT (date_part('decade', release_date) * 10)::int AS decade, count(*) AS album_count
            FROM albums
            WHERE release_date IS NOT NULL
            GROUP BY decade
            ORDER BY decade
            """
        )
        return cur.fetchall()
