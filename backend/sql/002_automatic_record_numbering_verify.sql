-- Read-only verification for automatic record numbering.

SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'customers' AND column_name = 'customer_id')
    OR
    (table_name = 'vessels' AND column_name = 'vessel_id')
    OR
    (table_name = 'engines' AND column_name = 'engine_id')
    OR
    (table_name = 'trips' AND column_name = 'trip_id')
    OR
    (
      table_name = 'maintenance'
      AND column_name = 'maintenance_id'
    )
  )
ORDER BY table_name;

SELECT
  'customers_number_seq' AS sequence_name,
  last_value,
  is_called
FROM public.customers_number_seq
UNION ALL
SELECT
  'vessels_number_seq',
  last_value,
  is_called
FROM public.vessels_number_seq
UNION ALL
SELECT
  'engines_number_seq',
  last_value,
  is_called
FROM public.engines_number_seq
UNION ALL
SELECT
  'trips_number_seq',
  last_value,
  is_called
FROM public.trips_number_seq
UNION ALL
SELECT
  'maintenance_number_seq',
  last_value,
  is_called
FROM public.maintenance_number_seq;
