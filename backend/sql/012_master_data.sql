BEGIN;

CREATE TABLE IF NOT EXISTS master_data_categories (
  category_key text PRIMARY KEY,
  category_label text NOT NULL,
  module_name text NOT NULL,
  field_name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_data_values (
  value_id bigserial PRIMARY KEY,
  category_key text NOT NULL
    REFERENCES master_data_categories(category_key)
    ON DELETE RESTRICT,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_master_data_value_case_insensitive
ON master_data_values (
  category_key,
  LOWER(value)
);

CREATE INDEX IF NOT EXISTS
  idx_master_data_values_active_sort
ON master_data_values (
  category_key,
  is_active,
  sort_order,
  LOWER(value)
);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS lead_source text;

ALTER TABLE engines
  ADD COLUMN IF NOT EXISTS engine_type text;

INSERT INTO master_data_categories (
  category_key,
  category_label,
  module_name,
  field_name,
  description,
  sort_order
)
VALUES
  ('customer_source', 'Customer Source', 'Customers', 'lead_source',
   'How the customer first came to MII.', 10),
  ('vessel_boat_builder', 'Boat Builder', 'Vessels', 'builder',
   'Boat builder or shipyard.', 20),
  ('vessel_material', 'Vessel Material', 'Vessels', 'hull_material',
   'Primary hull construction material.', 30),
  ('vessel_type', 'Vessel Type', 'Vessels', 'hull_type',
   'Hull form or vessel classification.', 40),
  ('engine_brand', 'Engine Brand', 'Engines', 'brand',
   'Engine manufacturer or brand.', 50),
  ('engine_type', 'Engine Type', 'Engines', 'engine_type',
   'Engine installation or propulsion type.', 60),
  ('engine_fuel', 'Engine Fuel', 'Engines', 'fuel_type',
   'Engine energy or fuel type.', 70)
ON CONFLICT (category_key)
DO UPDATE SET
  category_label = EXCLUDED.category_label,
  module_name = EXCLUDED.module_name,
  field_name = EXCLUDED.field_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT *
FROM (
  VALUES
    ('customer_source', 'Referral', 10),
    ('customer_source', 'Walk-in', 20),
    ('customer_source', 'Website', 30),
    ('customer_source', 'Social Media', 40),
    ('customer_source', 'Sales Prospecting', 50),
    ('customer_source', 'Existing Customer', 60),
    ('customer_source', 'Dealer / Partner', 70),
    ('customer_source', 'Event / Exhibition', 80),
    ('customer_source', 'Other', 999),

    ('vessel_material', 'Fiberglass', 10),
    ('vessel_material', 'Aluminum', 20),
    ('vessel_material', 'Wood', 30),
    ('vessel_material', 'Steel', 40),
    ('vessel_material', 'HDPE', 50),
    ('vessel_material', 'Inflatable', 60),
    ('vessel_material', 'Other', 999),

    ('vessel_type', 'Monohull', 10),
    ('vessel_type', 'Catamaran', 20),
    ('vessel_type', 'Trimaran', 30),
    ('vessel_type', 'RIB', 40),
    ('vessel_type', 'Fishing', 50),
    ('vessel_type', 'Passenger', 60),
    ('vessel_type', 'Leisure', 70),
    ('vessel_type', 'Workboat', 80),
    ('vessel_type', 'Other', 999),

    ('engine_brand', 'Yamaha', 10),
    ('engine_brand', 'Suzuki', 20),
    ('engine_brand', 'Tohatsu', 30),
    ('engine_brand', 'Honda', 40),
    ('engine_brand', 'Mercury', 50),
    ('engine_brand', 'Other', 999),

    ('engine_type', 'Outboard', 10),
    ('engine_type', 'Inboard', 20),
    ('engine_type', 'Sterndrive', 30),
    ('engine_type', 'Electric', 40),
    ('engine_type', 'Other', 999),

    ('engine_fuel', 'Gasoline', 10),
    ('engine_fuel', 'Diesel', 20),
    ('engine_fuel', 'Electric', 30),
    ('engine_fuel', 'Hybrid', 40),
    ('engine_fuel', 'Other', 999)
) AS seed(category_key, value, sort_order)
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT 'vessel_boat_builder', TRIM(builder), 100
FROM vessels
WHERE NULLIF(TRIM(builder), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT 'vessel_material', TRIM(hull_material), 100
FROM vessels
WHERE NULLIF(TRIM(hull_material), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT 'vessel_type', TRIM(hull_type), 100
FROM vessels
WHERE NULLIF(TRIM(hull_type), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT 'engine_brand', TRIM(brand), 100
FROM engines
WHERE NULLIF(TRIM(brand), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
SELECT 'engine_fuel', TRIM(fuel_type), 100
FROM engines
WHERE NULLIF(TRIM(fuel_type), '') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO master_data_values (
  category_key,
  value,
  sort_order
)
VALUES ('vessel_boat_builder', 'Other', 999)
ON CONFLICT DO NOTHING;

COMMIT;
