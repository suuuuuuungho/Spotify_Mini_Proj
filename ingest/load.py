from psycopg2.extras import execute_values

from db.postgres import get_connection


def upsert_users(conn, users):
    rows = [(u["id"], u.get("display_name")) for u in users]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO users (id, display_name)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
            """,
            rows,
        )
    conn.commit()


def upsert_user_profile(conn, profiles):
    rows = [
        (p["user_id"], p.get("email"), p.get("country"), p.get("product"), p.get("image_url"))
        for p in profiles
    ]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO user_profile (user_id, email, country, product, image_url)
            VALUES %s
            ON CONFLICT (user_id) DO UPDATE SET
                email = EXCLUDED.email,
                country = EXCLUDED.country,
                product = EXCLUDED.product,
                image_url = EXCLUDED.image_url
            """,
            rows,
        )
    conn.commit()


def upsert_artists(conn, artists):
    rows = [
        (a["id"], a.get("name"), a.get("followers"), a.get("popularity"), a.get("spotify_url"))
        for a in artists
    ]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO artists (id, name, followers, popularity, spotify_url)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                followers = COALESCE(EXCLUDED.followers, artists.followers),
                popularity = COALESCE(EXCLUDED.popularity, artists.popularity),
                spotify_url = EXCLUDED.spotify_url
            """,
            rows,
        )
    conn.commit()


def upsert_albums(conn, albums):
    rows = [
        (
            a["id"],
            a.get("name"),
            a.get("album_type"),
            a.get("release_date"),
            a.get("total_tracks"),
            a.get("image_url"),
            a.get("popularity"),
            a.get("spotify_url"),
        )
        for a in albums
    ]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO albums (id, name, album_type, release_date, total_tracks, image_url, popularity, spotify_url)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                album_type = EXCLUDED.album_type,
                release_date = EXCLUDED.release_date,
                total_tracks = EXCLUDED.total_tracks,
                image_url = EXCLUDED.image_url,
                popularity = COALESCE(EXCLUDED.popularity, albums.popularity),
                spotify_url = EXCLUDED.spotify_url
            """,
            rows,
        )
    conn.commit()


def upsert_tracks(conn, tracks):
    rows = [
        (
            t["id"],
            t.get("name"),
            t.get("album_id"),
            t.get("duration_ms"),
            t.get("explicit"),
            t.get("track_number"),
            t.get("disc_number"),
            t.get("isrc"),
            t.get("spotify_url"),
            t.get("popularity"),
            t.get("danceability"),
            t.get("energy"),
            t.get("loudness"),
            t.get("valence"),
            t.get("tempo"),
            t.get("acousticness"),
            t.get("instrumentalness"),
            t.get("liveness"),
            t.get("speechiness"),
            t.get("key"),
            t.get("mode"),
        )
        for t in tracks
    ]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO tracks (
                id, name, album_id, duration_ms, explicit, track_number, disc_number, isrc, spotify_url,
                popularity, danceability, energy, loudness, valence, tempo, acousticness,
                instrumentalness, liveness, speechiness, key, mode
            )
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                album_id = EXCLUDED.album_id,
                duration_ms = EXCLUDED.duration_ms,
                explicit = EXCLUDED.explicit,
                track_number = EXCLUDED.track_number,
                disc_number = EXCLUDED.disc_number,
                isrc = EXCLUDED.isrc,
                spotify_url = EXCLUDED.spotify_url,
                popularity = COALESCE(EXCLUDED.popularity, tracks.popularity),
                danceability = COALESCE(EXCLUDED.danceability, tracks.danceability),
                energy = COALESCE(EXCLUDED.energy, tracks.energy),
                loudness = COALESCE(EXCLUDED.loudness, tracks.loudness),
                valence = COALESCE(EXCLUDED.valence, tracks.valence),
                tempo = COALESCE(EXCLUDED.tempo, tracks.tempo),
                acousticness = COALESCE(EXCLUDED.acousticness, tracks.acousticness),
                instrumentalness = COALESCE(EXCLUDED.instrumentalness, tracks.instrumentalness),
                liveness = COALESCE(EXCLUDED.liveness, tracks.liveness),
                speechiness = COALESCE(EXCLUDED.speechiness, tracks.speechiness),
                key = COALESCE(EXCLUDED.key, tracks.key),
                mode = COALESCE(EXCLUDED.mode, tracks.mode)
            """,
            rows,
        )
    conn.commit()


def upsert_genres(conn, genres):
    rows = [(g["id"], g.get("name")) for g in genres]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO genres (id, name)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            """,
            rows,
        )
    conn.commit()


def upsert_track_genre(conn, pairs):
    rows = list(pairs)
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO track_genre (track_id, genre_id) VALUES %s ON CONFLICT DO NOTHING",
            rows,
        )
    conn.commit()


def upsert_track_artist(conn, pairs):
    rows = list(pairs)
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO track_artist (track_id, artist_id) VALUES %s ON CONFLICT DO NOTHING",
            rows,
        )
    conn.commit()


def upsert_album_artist(conn, pairs):
    rows = list(pairs)
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO album_artist (album_id, artist_id) VALUES %s ON CONFLICT DO NOTHING",
            rows,
        )
    conn.commit()


def upsert_playlists(conn, playlists):
    rows = [
        (
            p["id"],
            p.get("name"),
            p.get("description"),
            p.get("owner_id"),
            p.get("is_public"),
            p.get("is_collaborative"),
            p.get("image_url"),
            p.get("followers"),
        )
        for p in playlists
    ]
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO playlists (id, name, description, owner_id, is_public, is_collaborative, image_url, followers)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                owner_id = EXCLUDED.owner_id,
                is_public = EXCLUDED.is_public,
                is_collaborative = EXCLUDED.is_collaborative,
                image_url = EXCLUDED.image_url,
                followers = EXCLUDED.followers
            """,
            rows,
        )
    conn.commit()


def upsert_playlist_track(conn, rows):
    rows = list(rows)
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO playlist_track (playlist_id, track_id, added_at, position)
            VALUES %s
            ON CONFLICT (playlist_id, track_id) DO UPDATE SET
                added_at = EXCLUDED.added_at,
                position = EXCLUDED.position
            """,
            rows,
        )
    conn.commit()
