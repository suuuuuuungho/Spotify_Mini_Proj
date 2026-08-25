# PostgreSQL에 저장된 음악 카탈로그를 조회하는 API
#
# 주요 기능:
# - 장르 목록 조회
# - 곡 검색 및 상세 정보 조회
# - 앨범과 수록곡 조회
# - 아티스트와 관련 곡 조회


from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from api.deps import get_db

router = APIRouter(tags=["catalog"])

# 전체 장르 목록
@router.get("/genres")
def list_genres(conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT g.id, g.name, count(tg.track_id) AS track_count
            FROM genres g
            LEFT JOIN track_genre tg ON tg.genre_id = g.id
            GROUP BY g.id, g.name
            ORDER BY track_count DESC
            """
        )
        return cur.fetchall()

# 곡을 검색하거나 장르별로 조회
@router.get("/tracks")
def list_tracks(
    q: str = "", genre: str = "", limit: int = 20, offset: int = 0, conn=Depends(get_db)
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            LEFT JOIN track_genre tg ON tg.track_id = t.id AND %(genre)s != ''
            WHERE (%(q)s = '' OR t.name ILIKE '%%' || %(q)s || '%%')
              AND (%(genre)s = '' OR tg.genre_id = %(genre)s)
            ORDER BY t.name
            LIMIT %(limit)s OFFSET %(offset)s
            """,
            {"q": q, "genre": genre, "limit": limit, "offset": offset},
        )
        return cur.fetchall()

# 선택한 곡의 앨범, 아티스트, 장르 정보를 반환
@router.get("/tracks/{track_id}")
def get_track(track_id: str, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT t.*, a.name AS album_name, a.image_url AS album_image_url, a.release_date
            FROM tracks t
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE t.id = %s
            """,
            (track_id,),
        )
        track = cur.fetchone()
        if not track:
            raise HTTPException(status_code=404, detail="track not found")
        cur.execute(
            """
            SELECT ar.* FROM artists ar
            JOIN track_artist ta ON ta.artist_id = ar.id
            WHERE ta.track_id = %s
            """,
            (track_id,),
        )
        track["artists"] = cur.fetchall()
        cur.execute(
            """
            SELECT g.id, g.name FROM genres g
            JOIN track_genre tg ON tg.genre_id = g.id
            WHERE tg.track_id = %s
            """,
            (track_id,),
        )
        track["genres"] = cur.fetchall()
        return track

# 앨범 정보, 참여 아티스트, 수록곡을 반환
@router.get("/albums/{album_id}")
def get_album(album_id: str, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM albums WHERE id = %s", (album_id,))
        album = cur.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail="album not found")
        cur.execute(
            "SELECT * FROM tracks WHERE album_id = %s ORDER BY track_number", (album_id,)
        )
        album["tracks"] = cur.fetchall()
        cur.execute(
            """
            SELECT ar.* FROM artists ar
            JOIN album_artist aa ON aa.artist_id = ar.id
            WHERE aa.album_id = %s
            """,
            (album_id,),
        )
        album["artists"] = cur.fetchall()
        return album


@router.get("/artists/{artist_id}")
def get_artist(artist_id: str, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM artists WHERE id = %s", (artist_id,))
        artist = cur.fetchone()
        if not artist:
            raise HTTPException(status_code=404, detail="artist not found")
        cur.execute(
            """
            SELECT t.*, a.name AS album_name FROM tracks t
            JOIN track_artist ta ON ta.track_id = t.id
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE ta.artist_id = %s
            ORDER BY t.name
            LIMIT 50
            """,
            (artist_id,),
        )
        artist["tracks"] = cur.fetchall()
        return artist
