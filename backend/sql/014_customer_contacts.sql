BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_type text;

UPDATE customers
SET account_type = 'organization'
WHERE
  account_type IS NULL
  OR account_type NOT IN (
    'organization',
    'individual'
  );

ALTER TABLE customers
  ALTER COLUMN account_type
  SET DEFAULT 'organization';

ALTER TABLE customers
  ALTER COLUMN account_type
  SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conname = 'chk_customers_account_type'
      AND conrelid = 'customers'::regclass
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT chk_customers_account_type
      CHECK (
        account_type IN (
          'organization',
          'individual'
        )
      );
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS
  public.customer_contacts_number_seq
AS bigint
START WITH 1
INCREMENT BY 1
MINVALUE 1
CACHE 1;

CREATE TABLE IF NOT EXISTS customer_contacts (
  contact_id text PRIMARY KEY
    DEFAULT public.mii_next_record_id(
      'PIC',
      'public.customer_contacts_number_seq'::regclass
    ),
  customer_id text NOT NULL,
  full_name text NOT NULL,
  job_title text,
  telephone text,
  email text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_customer_contacts_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_contacts_created_by
    FOREIGN KEY (created_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_customer_contacts_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL
);

ALTER SEQUENCE
  public.customer_contacts_number_seq
OWNED BY customer_contacts.contact_id;

CREATE INDEX IF NOT EXISTS
  idx_customer_contacts_customer
ON customer_contacts (
  customer_id,
  is_active,
  is_primary
);

CREATE INDEX IF NOT EXISTS
  idx_customer_contacts_name
ON customer_contacts (
  lower(full_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_customer_contacts_one_primary
ON customer_contacts (customer_id)
WHERE is_primary = true;

-- Convert the current single customer contact fields into
-- one primary PIC when any legacy contact detail exists.
-- Existing customer columns are retained as a read-only
-- fallback for backward compatibility.
INSERT INTO customer_contacts
(
  customer_id,
  full_name,
  job_title,
  telephone,
  email,
  is_primary,
  is_active,
  notes,
  created_by,
  updated_by
)
SELECT
  c.customer_id,
  COALESCE(
    NULLIF(BTRIM(c.contact_person), ''),
    NULLIF(BTRIM(c.company), ''),
    'Primary Contact'
  ),
  NULLIF(BTRIM(c.position), ''),
  NULLIF(BTRIM(c.telephone), ''),
  NULLIF(BTRIM(c.email), ''),
  true,
  true,
  'Migrated from the legacy customer contact fields.',
  c.created_by,
  c.created_by
FROM customers c
WHERE
  (
    NULLIF(BTRIM(c.contact_person), '') IS NOT NULL
    OR NULLIF(BTRIM(c.position), '') IS NOT NULL
    OR NULLIF(BTRIM(c.telephone), '') IS NOT NULL
    OR NULLIF(BTRIM(c.email), '') IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM customer_contacts cc
    WHERE cc.customer_id = c.customer_id
  );

COMMIT;
