-- MII Platform
-- Automatic record numbering migration
--
-- New formats:
--   Customers:   CUST-000001
--   Vessels:     VSL-000001
--   Engines:     ENG-000001
--   Trips:       TRP-000001
--   Maintenance: MNT-000001
--
-- This migration:
--   * does not rename or modify existing IDs;
--   * creates one independent PostgreSQL sequence per table;
--   * starts each sequence after the highest existing matching ID;
--   * preserves a sequence's higher current value if rerun;
--   * adds database defaults for all future records.

BEGIN;

CREATE OR REPLACE FUNCTION public.mii_next_record_id(
  prefix text,
  sequence_name regclass
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  next_number bigint;
BEGIN
  next_number := nextval(sequence_name);

  RETURN prefix || '-' ||
    lpad(
      next_number::text,
      greatest(6, length(next_number::text)),
      '0'
    );
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.customers_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.vessels_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.engines_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.trips_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE SEQUENCE IF NOT EXISTS public.maintenance_number_seq
  AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

DO $$
DECLARE
  existing_max bigint;
  current_value bigint;
  current_called boolean;
  target_value bigint;
BEGIN
  SELECT
    COALESCE(
      MAX(
        substring(customer_id from '^CUST-([0-9]+)$')::bigint
      ),
      0
    )
  INTO existing_max
  FROM public.customers
  WHERE customer_id ~ '^CUST-[0-9]+$';

  SELECT last_value, is_called
  INTO current_value, current_called
  FROM public.customers_number_seq;

  target_value := greatest(existing_max, current_value);

  PERFORM setval(
    'public.customers_number_seq',
    CASE WHEN target_value > 0 THEN target_value ELSE 1 END,
    existing_max > 0 OR current_called
  );
END;
$$;

DO $$
DECLARE
  existing_max bigint;
  current_value bigint;
  current_called boolean;
  target_value bigint;
BEGIN
  SELECT
    COALESCE(
      MAX(
        substring(vessel_id from '^VSL-([0-9]+)$')::bigint
      ),
      0
    )
  INTO existing_max
  FROM public.vessels
  WHERE vessel_id ~ '^VSL-[0-9]+$';

  SELECT last_value, is_called
  INTO current_value, current_called
  FROM public.vessels_number_seq;

  target_value := greatest(existing_max, current_value);

  PERFORM setval(
    'public.vessels_number_seq',
    CASE WHEN target_value > 0 THEN target_value ELSE 1 END,
    existing_max > 0 OR current_called
  );
END;
$$;

DO $$
DECLARE
  existing_max bigint;
  current_value bigint;
  current_called boolean;
  target_value bigint;
BEGIN
  SELECT
    COALESCE(
      MAX(
        substring(engine_id from '^ENG-([0-9]+)$')::bigint
      ),
      0
    )
  INTO existing_max
  FROM public.engines
  WHERE engine_id ~ '^ENG-[0-9]+$';

  SELECT last_value, is_called
  INTO current_value, current_called
  FROM public.engines_number_seq;

  target_value := greatest(existing_max, current_value);

  PERFORM setval(
    'public.engines_number_seq',
    CASE WHEN target_value > 0 THEN target_value ELSE 1 END,
    existing_max > 0 OR current_called
  );
END;
$$;

DO $$
DECLARE
  existing_max bigint;
  current_value bigint;
  current_called boolean;
  target_value bigint;
BEGIN
  SELECT
    COALESCE(
      MAX(
        substring(trip_id from '^TRP-([0-9]+)$')::bigint
      ),
      0
    )
  INTO existing_max
  FROM public.trips
  WHERE trip_id ~ '^TRP-[0-9]+$';

  SELECT last_value, is_called
  INTO current_value, current_called
  FROM public.trips_number_seq;

  target_value := greatest(existing_max, current_value);

  PERFORM setval(
    'public.trips_number_seq',
    CASE WHEN target_value > 0 THEN target_value ELSE 1 END,
    existing_max > 0 OR current_called
  );
END;
$$;

DO $$
DECLARE
  existing_max bigint;
  current_value bigint;
  current_called boolean;
  target_value bigint;
BEGIN
  SELECT
    COALESCE(
      MAX(
        substring(
          maintenance_id from '^MNT-([0-9]+)$'
        )::bigint
      ),
      0
    )
  INTO existing_max
  FROM public.maintenance
  WHERE maintenance_id ~ '^MNT-[0-9]+$';

  SELECT last_value, is_called
  INTO current_value, current_called
  FROM public.maintenance_number_seq;

  target_value := greatest(existing_max, current_value);

  PERFORM setval(
    'public.maintenance_number_seq',
    CASE WHEN target_value > 0 THEN target_value ELSE 1 END,
    existing_max > 0 OR current_called
  );
END;
$$;

ALTER SEQUENCE public.customers_number_seq
  OWNED BY public.customers.customer_id;

ALTER SEQUENCE public.vessels_number_seq
  OWNED BY public.vessels.vessel_id;

ALTER SEQUENCE public.engines_number_seq
  OWNED BY public.engines.engine_id;

ALTER SEQUENCE public.trips_number_seq
  OWNED BY public.trips.trip_id;

ALTER SEQUENCE public.maintenance_number_seq
  OWNED BY public.maintenance.maintenance_id;

ALTER TABLE public.customers
  ALTER COLUMN customer_id
  SET DEFAULT public.mii_next_record_id(
    'CUST',
    'public.customers_number_seq'::regclass
  );

ALTER TABLE public.vessels
  ALTER COLUMN vessel_id
  SET DEFAULT public.mii_next_record_id(
    'VSL',
    'public.vessels_number_seq'::regclass
  );

ALTER TABLE public.engines
  ALTER COLUMN engine_id
  SET DEFAULT public.mii_next_record_id(
    'ENG',
    'public.engines_number_seq'::regclass
  );

ALTER TABLE public.trips
  ALTER COLUMN trip_id
  SET DEFAULT public.mii_next_record_id(
    'TRP',
    'public.trips_number_seq'::regclass
  );

ALTER TABLE public.maintenance
  ALTER COLUMN maintenance_id
  SET DEFAULT public.mii_next_record_id(
    'MNT',
    'public.maintenance_number_seq'::regclass
  );

COMMIT;
