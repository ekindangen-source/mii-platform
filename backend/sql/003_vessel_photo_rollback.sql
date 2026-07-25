-- WARNING:
-- This removes the database reference to vessel photos.
-- Photo files on disk are intentionally retained.

BEGIN;

ALTER TABLE public.vessels
  DROP COLUMN IF EXISTS photo_path;

COMMIT;
