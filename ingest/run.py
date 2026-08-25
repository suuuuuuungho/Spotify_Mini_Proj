import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingest.datasets import enrich_with_audio_features, enrich_with_genre, load_playlists
from ingest.load import (
    upsert_album_artist,
    upsert_albums,
    upsert_artists,
    upsert_genres,
    upsert_playlist_track,
    upsert_playlists,
    upsert_track_artist,
    upsert_track_genre,
    upsert_tracks,
    upsert_users,
)
from db.postgres import get_connection


def main():
    print("== loading playlists dataset ==")
    data = load_playlists()
    print(
        f"  users={len(data['users'])} artists={len(data['artists'])} albums={len(data['albums'])} "
        f"tracks={len(data['tracks'])} playlists={len(data['playlists'])} "
        f"playlist_track={len(data['playlist_track'])}"
    )

    print("== enriching with audio-features dataset (streams remote parquet, may take a few minutes) ==")
    artist_names = {a["name"] for a in data["artists"].values() if a.get("name")}
    track_stats, artist_stats, album_stats = enrich_with_audio_features(
        data["tracks"].keys(), artist_names
    )
    print(
        f"  matched track_stats={len(track_stats)} artist_stats={len(artist_stats)} "
        f"album_stats={len(album_stats)}"
    )

    for track_id, stats in track_stats.items():
        data["tracks"][track_id].update(stats)
    for artist in data["artists"].values():
        stats = artist_stats.get((artist.get("name") or "").lower())
        if stats:
            artist.update(stats)
    for album in data["albums"].values():
        stats = album_stats.get((album.get("name") or "").lower())
        if stats:
            album.update(stats)

    print("== enriching with genre dataset ==")
    genres, track_genre = enrich_with_genre(data["tracks"].keys())
    print(f"  genres={len(genres)} track_genre={len(track_genre)}")

    conn = get_connection()
    try:
        print("== loading core tables ==")
        upsert_users(conn, data["users"].values())
        upsert_artists(conn, data["artists"].values())
        upsert_albums(conn, data["albums"].values())
        upsert_tracks(conn, data["tracks"].values())
        upsert_track_artist(conn, data["track_artist"])
        upsert_album_artist(conn, data["album_artist"])
        upsert_playlists(conn, data["playlists"].values())
        upsert_playlist_track(conn, data["playlist_track"])

        print("== loading genre tables ==")
        upsert_genres(conn, genres.values())
        upsert_track_genre(conn, track_genre)
    finally:
        conn.close()

    print("== done ==")


if __name__ == "__main__":
    main()
