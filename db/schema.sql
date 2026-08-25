CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT
);

CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    followers INT CHECK (followers IS NULL OR followers >= 0),
    popularity INT CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100),
    spotify_url TEXT
);

CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    album_type TEXT,
    release_date DATE,
    total_tracks INT CHECK (total_tracks IS NULL OR total_tracks >= 0),
    image_url TEXT,
    popularity INT CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100),
    spotify_url TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    album_id TEXT REFERENCES albums(id),
    duration_ms INT CHECK (duration_ms IS NULL OR duration_ms >= 0),
    explicit BOOLEAN,
    track_number INT CHECK (track_number IS NULL OR track_number > 0),
    spotify_url TEXT,
    popularity INT CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100),
    danceability REAL CHECK (danceability IS NULL OR danceability BETWEEN 0 AND 1),
    energy REAL CHECK (energy IS NULL OR energy BETWEEN 0 AND 1),
    loudness REAL,
    valence REAL CHECK (valence IS NULL OR valence BETWEEN 0 AND 1),
    tempo REAL CHECK (tempo IS NULL OR tempo >= 0),
    acousticness REAL CHECK (acousticness IS NULL OR acousticness BETWEEN 0 AND 1),
    instrumentalness REAL CHECK (instrumentalness IS NULL OR instrumentalness BETWEEN 0 AND 1),
    liveness REAL CHECK (liveness IS NULL OR liveness BETWEEN 0 AND 1),
    speechiness REAL CHECK (speechiness IS NULL OR speechiness BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS genres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS track_genre (
    track_id TEXT REFERENCES tracks(id),
    genre_id TEXT REFERENCES genres(id),
    PRIMARY KEY (track_id, genre_id)
);

CREATE TABLE IF NOT EXISTS track_artist (
    track_id TEXT REFERENCES tracks(id),
    artist_id TEXT REFERENCES artists(id),
    PRIMARY KEY (track_id, artist_id)
);

CREATE TABLE IF NOT EXISTS album_artist (
    album_id TEXT REFERENCES albums(id),
    artist_id TEXT REFERENCES artists(id),
    PRIMARY KEY (album_id, artist_id)
);

CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT REFERENCES users(id),
    image_url TEXT,
    followers INT
);

CREATE TABLE IF NOT EXISTS playlist_track (
    playlist_id TEXT REFERENCES playlists(id),
    track_id TEXT REFERENCES tracks(id),
    added_at TIMESTAMPTZ,
    track_order INT CHECK (track_order IS NULL OR track_order >= 0),
    PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_playlists_owner_id ON playlists(owner_id);
CREATE INDEX IF NOT EXISTS idx_track_genre_genre_id ON track_genre(genre_id);
CREATE INDEX IF NOT EXISTS idx_track_artist_artist_id ON track_artist(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_artist_artist_id ON album_artist(artist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_track_track_id ON playlist_track(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_track_order ON playlist_track(playlist_id, track_order);
