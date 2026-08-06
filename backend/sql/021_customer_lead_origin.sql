BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS origin_lead_id text,
  ADD COLUMN IF NOT EXISTS creation_method text NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_customers_origin_lead'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT fk_customers_origin_lead
      FOREIGN KEY (origin_lead_id)
      REFERENCES crm_leads(lead_id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_creation_method'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT chk_customers_creation_method
      CHECK (creation_method IN ('legacy','lead_conversion','admin_import'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_customers_lead_origin'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT chk_customers_lead_origin
      CHECK (
        creation_method <> 'lead_conversion'
        OR origin_lead_id IS NOT NULL
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_origin_lead
  ON customers (origin_lead_id)
  WHERE origin_lead_id IS NOT NULL;

COMMIT;
