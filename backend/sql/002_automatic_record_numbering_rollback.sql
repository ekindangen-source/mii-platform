-- MII Platform
-- Roll back automatic ID defaults.
--
-- Existing generated IDs remain unchanged.
-- Sequences are intentionally retained so counters are not reused
-- if the feature is enabled again later.

BEGIN;

ALTER TABLE public.customers
  ALTER COLUMN customer_id DROP DEFAULT;

ALTER TABLE public.vessels
  ALTER COLUMN vessel_id DROP DEFAULT;

ALTER TABLE public.engines
  ALTER COLUMN engine_id DROP DEFAULT;

ALTER TABLE public.trips
  ALTER COLUMN trip_id DROP DEFAULT;

ALTER TABLE public.maintenance
  ALTER COLUMN maintenance_id DROP DEFAULT;

DROP FUNCTION IF EXISTS public.mii_next_record_id(
  text,
  regclass
);

COMMIT;
