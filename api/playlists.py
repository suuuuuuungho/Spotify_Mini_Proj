import uuid
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor, execute_values
from pydantic import BaseModel

from api.deps import get_current_user_id, get_db, get_spotify_access_token

router = APIRouter(prefix="/playlists", tags=["playlists"])


class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TrackAdd(BaseModel):
    track_id: str


class TrackBulkAdd(BaseModel):
    track_ids: List[str]


@router.get("")
def list_my_playlists(user_id: str = Depends(get_current_user_id), conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT p.*, count(pt.track_id) AS track_count
            FROM playlists p
            LEFT JOIN playlist_track pt ON pt.playlist_id = p.id
            WHERE p.owner_id = %s
            GROUP BY p.id
            ORDER BY p.name
            """,
            (user_id,),
        )
        return cur.fetchall()


def _spotify_pages(url: str, access_token: str):
    params = {"limit": 50}
    while url:
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Spotify login expired. Log in again.")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Spotify rate limit reached. Try again later.")
        if not response.ok:
            raise HTTPException(
                status_code=502,
                detail=f"Spotify API request failed ({response.status_code}).",
            )
        page = response.json()
        yield page
        url = page.get("next")
        params = None


def _release_date(value):
    if not value:
        return None
    if len(value) == 4:
        return f"{value}-01-01"
    if len(value) == 7:
        return f"{value}-01"
    return value


@router.post("/import-spotify")
def import_spotify_playlists(
    user_id: str = Depends(get_current_user_id),
    access_token: str = Depends(get_spotify_access_token),
    conn=Depends(get_db),
):
    spotify_playlists = []
    for page in _spotify_pages("https://api.spotify.com/v1/me/playlists", access_token):
        spotify_playlists.extend(page.get("items", []))

    playlists_imported = 0
    tracks_imported = 0
    playlists_without_items = []

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for playlist in spotify_playlists:
                if not playlist or not playlist.get("id"):
                    continue

                spotify_playlist_id = playlist["id"]
                local_playlist_id = f"spotify:{user_id}:{spotify_playlist_id}"
                images = playlist.get("images") or []
                cur.execute(
                    """
                    INSERT INTO playlists (id, name, description, owner_id, image_url, followers)
                    VALUES (%s, %s, %s, %s, %s, 0)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        owner_id = EXCLUDED.owner_id,
                        image_url = EXCLUDED.image_url
                    """,
                    (
                        local_playlist_id,
                        playlist.get("name") or "Untitled playlist",
                        playlist.get("description"),
                        user_id,
                        images[0].get("url") if images else None,
                    ),
                )

                playlist_items = []
                items_url = f"https://api.spotify.com/v1/playlists/{spotify_playlist_id}/items"
                try:
                    for page in _spotify_pages(items_url, access_token):
                        playlist_items.extend(page.get("items", []))
                except HTTPException as error:
                    if error.status_code == 502:
                        playlists_without_items.append(spotify_playlist_id)
                    else:
                        raise

                cur.execute("DELETE FROM playlist_track WHERE playlist_id = %s", (local_playlist_id,))
                for track_order, item in enumerate(playlist_items):
                    track = (item or {}).get("track") or (item or {}).get("item")
                    if not track or track.get("type") != "track" or not track.get("id"):
                        continue

                    album = track.get("album") or {}
                    album_id = album.get("id")
                    album_images = album.get("images") or []
                    if album_id:
                        cur.execute(
                            """
                            INSERT INTO albums (
                                id, name, album_type, release_date, total_tracks,
                                image_url, popularity, spotify_url
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, NULL, %s)
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                album_type = EXCLUDED.album_type,
                                release_date = EXCLUDED.release_date,
                                total_tracks = EXCLUDED.total_tracks,
                                image_url = EXCLUDED.image_url,
                                spotify_url = EXCLUDED.spotify_url
                            """,
                            (
                                album_id,
                                album.get("name") or "Unknown album",
                                album.get("album_type"),
                                _release_date(album.get("release_date")),
                                album.get("total_tracks"),
                                album_images[0].get("url") if album_images else None,
                                (album.get("external_urls") or {}).get("spotify"),
                            ),
                        )

                    cur.execute(
                        """
                        INSERT INTO tracks (
                            id, name, album_id, duration_ms, explicit, track_number,
                            spotify_url, popularity
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            album_id = EXCLUDED.album_id,
                            duration_ms = EXCLUDED.duration_ms,
                            explicit = EXCLUDED.explicit,
                            track_number = EXCLUDED.track_number,
                            spotify_url = EXCLUDED.spotify_url,
                            popularity = EXCLUDED.popularity
                        """,
                        (
                            track["id"],
                            track.get("name") or "Unknown track",
                            album_id,
                            track.get("duration_ms"),
                            track.get("explicit"),
                            track.get("track_number"),
                            (track.get("external_urls") or {}).get("spotify"),
                            track.get("popularity"),
                        ),
                    )

                    for artist in track.get("artists") or []:
                        if not artist.get("id"):
                            continue
                        cur.execute(
                            """
                            INSERT INTO artists (id, name, spotify_url)
                            VALUES (%s, %s, %s)
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                spotify_url = EXCLUDED.spotify_url
                            """,
                            (
                                artist["id"],
                                artist.get("name") or "Unknown artist",
                                (artist.get("external_urls") or {}).get("spotify"),
                            ),
                        )
                        cur.execute(
                            """
                            INSERT INTO track_artist (track_id, artist_id)
                            VALUES (%s, %s)
                            ON CONFLICT DO NOTHING
                            """,
                            (track["id"], artist["id"]),
                        )
                        if album_id:
                            cur.execute(
                                """
                                INSERT INTO album_artist (album_id, artist_id)
                                VALUES (%s, %s)
                                ON CONFLICT DO NOTHING
                                """,
                                (album_id, artist["id"]),
                            )

                    cur.execute(
                        """
                        INSERT INTO playlist_track (playlist_id, track_id, added_at, track_order)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (playlist_id, track_id) DO UPDATE SET
                            added_at = EXCLUDED.added_at,
                            track_order = EXCLUDED.track_order
                        """,
                        (local_playlist_id, track["id"], (item or {}).get("added_at"), track_order),
                    )
                    tracks_imported += 1

                playlists_imported += 1

            conn.commit()
    except Exception:
        conn.rollback()
        raise

    return {
        "playlists_imported": playlists_imported,
        "tracks_imported": tracks_imported,
        "playlists_without_items": playlists_without_items,
    }


@router.post("", status_code=201)
def create_playlist(
    body: PlaylistCreate, user_id: str = Depends(get_current_user_id), conn=Depends(get_db)
):
    playlist_id = str(uuid.uuid4())
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            INSERT INTO playlists (id, name, description, owner_id, followers)
            VALUES (%s, %s, %s, %s, 0)
            RETURNING *
            """,
            (playlist_id, body.name, body.description, user_id),
        )
        conn.commit()
        return cur.fetchone()


@router.get("/{playlist_id}")
def get_playlist(
    playlist_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(get_db)
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT * FROM playlists WHERE id = %s AND owner_id = %s", (playlist_id, user_id)
        )
        playlist = cur.fetchone()
        if not playlist:
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute(
            """
            SELECT t.*, pt.track_order, pt.added_at, a.name AS album_name, a.image_url AS album_image_url
            FROM playlist_track pt
            JOIN tracks t ON t.id = pt.track_id
            LEFT JOIN albums a ON a.id = t.album_id
            WHERE pt.playlist_id = %s
            ORDER BY pt.track_order
            """,
            (playlist_id,),
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
        playlist["tracks"] = tracks
        return playlist


@router.patch("/{playlist_id}")
def update_playlist(
    playlist_id: str,
    body: PlaylistUpdate,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM playlists WHERE id = %s AND owner_id = %s", (playlist_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute(
            """
            UPDATE playlists SET
                name = COALESCE(%s, name),
                description = COALESCE(%s, description)
            WHERE id = %s
            RETURNING *
            """,
            (body.name, body.description, playlist_id),
        )
        conn.commit()
        return cur.fetchone()


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(get_db)
):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM playlists WHERE id = %s AND owner_id = %s", (playlist_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute("DELETE FROM playlist_track WHERE playlist_id = %s", (playlist_id,))
        cur.execute("DELETE FROM playlists WHERE id = %s", (playlist_id,))
        conn.commit()


@router.post("/{playlist_id}/tracks", status_code=201)
def add_track(
    playlist_id: str,
    body: TrackAdd,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM playlists WHERE id = %s AND owner_id = %s FOR UPDATE",
            (playlist_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute(
            "SELECT COALESCE(MAX(track_order), -1) + 1 AS next_order FROM playlist_track WHERE playlist_id = %s",
            (playlist_id,),
        )
        next_order = cur.fetchone()["next_order"]
        cur.execute(
            """
            INSERT INTO playlist_track (playlist_id, track_id, added_at, track_order)
            VALUES (%s, %s, now(), %s)
            ON CONFLICT (playlist_id, track_id) DO NOTHING
            """,
            (playlist_id, body.track_id, next_order),
        )
        conn.commit()
    return {"ok": True}


@router.post("/{playlist_id}/tracks/bulk", status_code=201)
def add_tracks_bulk(
    playlist_id: str,
    body: TrackBulkAdd,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM playlists WHERE id = %s AND owner_id = %s FOR UPDATE",
            (playlist_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute(
            "SELECT COALESCE(MAX(track_order), -1) + 1 AS next_order FROM playlist_track WHERE playlist_id = %s",
            (playlist_id,),
        )
        next_order = cur.fetchone()["next_order"]
        rows = [
            (playlist_id, track_id, next_order + i)
            for i, track_id in enumerate(body.track_ids)
        ]
        if rows:
            execute_values(
                cur,
                """
                INSERT INTO playlist_track (playlist_id, track_id, added_at, track_order)
                VALUES %s
                ON CONFLICT (playlist_id, track_id) DO NOTHING
                """,
                rows,
                template="(%s, %s, now(), %s)",
            )
        conn.commit()
    return {"ok": True, "added": len(rows)}


@router.delete("/{playlist_id}/tracks/{track_id}", status_code=204)
def remove_track(
    playlist_id: str,
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM playlists WHERE id = %s AND owner_id = %s", (playlist_id, user_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="playlist not found")
        cur.execute(
            "DELETE FROM playlist_track WHERE playlist_id = %s AND track_id = %s",
            (playlist_id, track_id),
        )
        conn.commit()
