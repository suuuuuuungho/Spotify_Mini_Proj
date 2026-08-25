import json

import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download

PLAYLISTS_REPO = "devmaxjasper/spotify_public_playlists"
PLAYLISTS_FILE = "playlists_preview.csv"
AUDIO_FEATURES_REPO = "GildasLeDrogoff/spotify-huge-track-analysis-dataset"
AUDIO_FEATURES_FILE = "spotify-huge-audio-features.parquet"
GENRE_REPO = "maharshipandya/spotify-tracks-dataset"
GENRE_FILE = "dataset.csv"

AUDIO_FEATURE_COLUMNS = [
    "danceability",
    "energy",
    "loudness",
    "valence",
    "tempo",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "key",
    "mode",
]


def _image_url(images):
    return images[0]["url"] if images else None


def _spotify_url(obj):
    return (obj.get("external_urls") or {}).get("spotify")


def _normalize_date(release_date, precision):
    if not release_date or release_date.startswith("0000"):
        return None
    if precision == "day":
        return release_date
    if precision == "month":
        return f"{release_date}-01"
    return f"{release_date}-01-01"


def load_playlists():
    """Parses the raw Spotify API JSON embedded in the playlists dataset into
    normalized record dicts, deduplicated by id."""
    path = hf_hub_download(PLAYLISTS_REPO, PLAYLISTS_FILE, repo_type="dataset")

    users = {}
    artists = {}
    albums = {}
    tracks = {}
    track_artist = set()
    album_artist = set()
    playlists = {}
    playlist_track = []
    seen_playlist_track = set()

    import csv

    csv.field_size_limit(2**31 - 1)
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw = row.get("raw_data")
            if not raw:
                continue
            try:
                data = json.loads(raw)
                if isinstance(data, str):
                    # a handful of rows are double-encoded (JSON string of JSON)
                    data = json.loads(data)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, dict):
                continue

            playlist_id = data.get("id")
            owner = data.get("owner") or {}
            owner_id = owner.get("id")
            if not playlist_id or not owner_id:
                continue

            users[owner_id] = {"id": owner_id, "display_name": owner.get("display_name")}
            playlists[playlist_id] = {
                "id": playlist_id,
                "name": data.get("name"),
                "description": data.get("description"),
                "owner_id": owner_id,
                "is_public": data.get("public"),
                "is_collaborative": data.get("collaborative"),
                "image_url": _image_url(data.get("images")),
                "followers": (data.get("followers") or {}).get("total"),
            }

            items = ((data.get("tracks") or {}).get("items")) or []
            for position, item in enumerate(items):
                track = item.get("track")
                if not track or track.get("is_local") or track.get("type") != "track":
                    continue
                track_id = track.get("id")
                if not track_id:
                    continue

                album = track.get("album") or {}
                album_id = album.get("id")
                if album_id and album_id not in albums:
                    albums[album_id] = {
                        "id": album_id,
                        "name": album.get("name"),
                        "album_type": album.get("album_type"),
                        "release_date": _normalize_date(
                            album.get("release_date"), album.get("release_date_precision")
                        ),
                        "total_tracks": album.get("total_tracks"),
                        "image_url": _image_url(album.get("images")),
                        "spotify_url": _spotify_url(album),
                    }
                for artist in album.get("artists") or []:
                    artist_id = artist.get("id")
                    if artist_id:
                        artists.setdefault(
                            artist_id,
                            {"id": artist_id, "name": artist.get("name"), "spotify_url": _spotify_url(artist)},
                        )
                        if album_id:
                            album_artist.add((album_id, artist_id))

                if track_id not in tracks:
                    tracks[track_id] = {
                        "id": track_id,
                        "name": track.get("name"),
                        "album_id": album_id,
                        "duration_ms": track.get("duration_ms"),
                        "explicit": track.get("explicit"),
                        "track_number": track.get("track_number"),
                        "disc_number": track.get("disc_number"),
                        "isrc": (track.get("external_ids") or {}).get("isrc"),
                        "spotify_url": _spotify_url(track),
                    }
                for artist in track.get("artists") or []:
                    artist_id = artist.get("id")
                    if artist_id:
                        artists.setdefault(
                            artist_id,
                            {"id": artist_id, "name": artist.get("name"), "spotify_url": _spotify_url(artist)},
                        )
                        track_artist.add((track_id, artist_id))

                pt_key = (playlist_id, track_id)
                if pt_key not in seen_playlist_track:
                    seen_playlist_track.add(pt_key)
                    playlist_track.append(
                        (playlist_id, track_id, item.get("added_at"), position)
                    )

    return {
        "users": users,
        "artists": artists,
        "albums": albums,
        "tracks": tracks,
        "track_artist": track_artist,
        "album_artist": album_artist,
        "playlists": playlists,
        "playlist_track": playlist_track,
    }


def enrich_with_audio_features(track_ids, artist_names):
    """Downloads the (multi-GB, cached after first run) audio-features parquet
    and scans only the needed columns locally, matching tracks by id and
    artists by name (this dataset has no real artist/album ids). Per-row-group
    HTTP range requests over a 56M-row file were too slow to be usable, so a
    one-time bulk download + local scan is the reliable path.
    Returns (track_stats, artist_stats, album_stats)."""
    columns = (
        ["track_id", "artist_name", "album_name", "track_popularity", "artist_popularity",
         "artist_followers", "album_popularity"]
        + AUDIO_FEATURE_COLUMNS
    )
    print("    downloading audio-features parquet (cached after first run)...")
    path = hf_hub_download(AUDIO_FEATURES_REPO, AUDIO_FEATURES_FILE, repo_type="dataset")
    pf = pq.ParquetFile(path)

    track_ids = set(track_ids)
    artist_names_lower = {n.lower() for n in artist_names}

    track_stats = {}
    artist_stats = {}
    album_stats = {}

    rows_scanned = 0
    for batch in pf.iter_batches(columns=columns, batch_size=200_000):
        rows_scanned += batch.num_rows
        print(
            f"    scanned {rows_scanned:,} rows | "
            f"track_stats={len(track_stats)} artist_stats={len(artist_stats)}"
        )
        cols = {name: batch.column(name).to_pylist() for name in columns}
        for i, track_id in enumerate(cols["track_id"]):
            matched_track = track_id in track_ids
            artist_name_lower = (cols["artist_name"][i] or "").lower()
            matched_artist = artist_name_lower in artist_names_lower
            if not matched_track and not matched_artist:
                continue

            if matched_track and track_id not in track_stats:
                track_stats[track_id] = {
                    "track_id": track_id,
                    "popularity": cols["track_popularity"][i],
                    **{feat: cols[feat][i] for feat in AUDIO_FEATURE_COLUMNS},
                }
            if matched_artist and artist_name_lower not in artist_stats:
                artist_stats[artist_name_lower] = {
                    "followers": cols["artist_followers"][i],
                    "popularity": cols["artist_popularity"][i],
                }
            album_name_lower = (cols["album_name"][i] or "").lower()
            if album_name_lower and album_name_lower not in album_stats:
                album_stats[album_name_lower] = {"popularity": cols["album_popularity"][i]}

        if len(track_stats) >= len(track_ids) and len(artist_stats) >= len(artist_names_lower):
            break

    return track_stats, artist_stats, album_stats


def enrich_with_genre(track_ids):
    """Returns (genres, track_genre) built from the genre-labeled dataset,
    matched by track_id. A track can carry multiple genres since the source
    dataset repeats the same track_id under different genre labels."""
    path = hf_hub_download(GENRE_REPO, GENRE_FILE, repo_type="dataset")
    track_ids = set(track_ids)

    import csv

    csv.field_size_limit(2**31 - 1)
    genres = {}
    track_genre = set()
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_id = row.get("track_id")
            genre_name = row.get("track_genre")
            if not track_id or not genre_name or track_id not in track_ids:
                continue
            genres.setdefault(genre_name, {"id": genre_name, "name": genre_name})
            track_genre.add((track_id, genre_name))

    return genres, track_genre
