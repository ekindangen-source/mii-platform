BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS created_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conname = 'fk_customers_created_by'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT fk_customers_created_by
      FOREIGN KEY (created_by)
      REFERENCES app_users(user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS
  idx_customers_created_by
ON customers (created_by);

COMMIT;
