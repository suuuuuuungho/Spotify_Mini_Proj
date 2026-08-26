CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS mood_vector vector(6);

UPDATE tracks
SET mood_vector = ARRAY[energy, valence, danceability, acousticness, liveness, speechiness]::vector
WHERE energy IS NOT NULL
    AND valence IS NOT NULL
    AND danceability IS NOT NULL
    AND acousticness IS NOT NULL
    AND liveness IS NOT NULL
    AND speechiness IS NOT NULL;

-- Powers /discover/mood's `mood_vector <=> target` nearest-neighbor query.
CREATE INDEX IF NOT EXISTS idx_tracks_mood_vector
    ON tracks USING ivfflat (mood_vector vector_cosine_ops)
    WITH (lists = 100);
