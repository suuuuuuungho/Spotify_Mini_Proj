-- Postgres 이미지를 pgvector/pgvector:pg16으로 교체하는 과정에서 일부 환경에서
-- 인덱스가 손상되어 존재하는 행이 인덱스 스캔으로는 조회되지 않고, 그로 인해
-- PK 제약이 무력화되어 중복 행이 쌓이는 문제가 관측됨. 아래는 그걸 정리하는 스크립트.
-- 증상: 아티스트로 곡을 검색해도 일부 곡에 아티스트가 안 붙어 보이는 등.

BEGIN;

DELETE FROM track_artist a USING (
    SELECT ctid, row_number() OVER (PARTITION BY track_id, artist_id ORDER BY ctid) rn
    FROM track_artist
) b WHERE a.ctid = b.ctid AND b.rn > 1;

DELETE FROM album_artist a USING (
    SELECT ctid, row_number() OVER (PARTITION BY album_id, artist_id ORDER BY ctid) rn
    FROM album_artist
) b WHERE a.ctid = b.ctid AND b.rn > 1;

DELETE FROM track_genre a USING (
    SELECT ctid, row_number() OVER (PARTITION BY track_id, genre_id ORDER BY ctid) rn
    FROM track_genre
) b WHERE a.ctid = b.ctid AND b.rn > 1;

DELETE FROM playlist_track a USING (
    SELECT ctid, row_number() OVER (PARTITION BY playlist_id, track_id ORDER BY ctid) rn
    FROM playlist_track
) b WHERE a.ctid = b.ctid AND b.rn > 1;

ALTER TABLE artists DISABLE TRIGGER ALL;
ALTER TABLE albums DISABLE TRIGGER ALL;
ALTER TABLE tracks DISABLE TRIGGER ALL;

DELETE FROM artists a USING (
    SELECT ctid, row_number() OVER (PARTITION BY id ORDER BY (followers IS NOT NULL) DESC, ctid) rn
    FROM artists
) b WHERE a.ctid = b.ctid AND b.rn > 1;

DELETE FROM albums a USING (
    SELECT ctid, row_number() OVER (PARTITION BY id ORDER BY (popularity IS NOT NULL) DESC, ctid) rn
    FROM albums
) b WHERE a.ctid = b.ctid AND b.rn > 1;

DELETE FROM tracks a USING (
    SELECT ctid, row_number() OVER (PARTITION BY id ORDER BY (danceability IS NOT NULL) DESC, ctid) rn
    FROM tracks
) b WHERE a.ctid = b.ctid AND b.rn > 1;

ALTER TABLE artists ENABLE TRIGGER ALL;
ALTER TABLE albums ENABLE TRIGGER ALL;
ALTER TABLE tracks ENABLE TRIGGER ALL;

COMMIT;

-- REINDEX는 트랜잭션 밖에서 실행해야 함 (autocommit 필요)
REINDEX DATABASE spotify;
