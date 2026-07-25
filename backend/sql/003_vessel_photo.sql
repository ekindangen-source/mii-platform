-- MII Platform
-- Add one optional photo to each vessel.

BEGIN;

ALTER TABLE public.vessels
  ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN public.vessels.photo_path IS
  'Relative API path for the vessel photo, for example /uploads/vessels/<random-name>.jpg';

COMMIT;
