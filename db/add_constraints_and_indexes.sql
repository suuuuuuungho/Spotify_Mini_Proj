BEGIN;

ALTER TABLE artists ADD CONSTRAINT artists_followers_check
    CHECK (followers IS NULL OR followers >= 0) NOT VALID;
ALTER TABLE artists ADD CONSTRAINT artists_popularity_check
    CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE albums ADD CONSTRAINT albums_total_tracks_check
    CHECK (total_tracks IS NULL OR total_tracks >= 0) NOT VALID;
ALTER TABLE albums ADD CONSTRAINT albums_popularity_check
    CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_duration_ms_check
    CHECK (duration_ms IS NULL OR duration_ms >= 0) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_track_number_check
    CHECK (track_number IS NULL OR track_number > 0) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_popularity_check
    CHECK (popularity IS NULL OR popularity BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_danceability_check
    CHECK (danceability IS NULL OR danceability BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_energy_check
    CHECK (energy IS NULL OR energy BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_valence_check
    CHECK (valence IS NULL OR valence BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_tempo_check
    CHECK (tempo IS NULL OR tempo >= 0) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_acousticness_check
    CHECK (acousticness IS NULL OR acousticness BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_instrumentalness_check
    CHECK (instrumentalness IS NULL OR instrumentalness BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_liveness_check
    CHECK (liveness IS NULL OR liveness BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE tracks ADD CONSTRAINT tracks_speechiness_check
    CHECK (speechiness IS NULL OR speechiness BETWEEN 0 AND 1) NOT VALID;
ALTER TABLE playlist_track ADD CONSTRAINT playlist_track_order_check
    CHECK (track_order IS NULL OR track_order >= 0) NOT VALID;

DROP INDEX IF EXISTS idx_track_genre_track_id;
CREATE INDEX IF NOT EXISTS idx_track_genre_genre_id ON track_genre(genre_id);
CREATE INDEX IF NOT EXISTS idx_track_artist_artist_id ON track_artist(artist_id);
CREATE INDEX IF NOT EXISTS idx_album_artist_artist_id ON album_artist(artist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_track_track_id ON playlist_track(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_track_order ON playlist_track(playlist_id, track_order);

COMMIT;
