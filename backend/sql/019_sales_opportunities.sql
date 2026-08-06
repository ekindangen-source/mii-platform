BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.sales_opportunities_number_seq
AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE TABLE IF NOT EXISTS sales_opportunities (
  opportunity_id text PRIMARY KEY DEFAULT public.mii_next_record_id(
    'OPP',
    'public.sales_opportunities_number_seq'::regclass
  ),
  customer_id text NOT NULL,
  contact_id text,
  owner_id text NOT NULL,
  title text NOT NULL,
  product_interest text,
  description text,
  stage text NOT NULL DEFAULT 'prospecting',
  estimated_value numeric(18,2) NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date,
  next_action text,
  next_action_at timestamptz,
  competitor text,
  loss_reason text,
  closed_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sales_opportunities_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  CONSTRAINT fk_sales_opportunities_contact
    FOREIGN KEY (customer_id, contact_id)
    REFERENCES customer_contacts(customer_id, contact_id) ON DELETE SET NULL (contact_id),
  CONSTRAINT fk_sales_opportunities_owner
    FOREIGN KEY (owner_id) REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_sales_opportunities_created_by
    FOREIGN KEY (created_by) REFERENCES app_users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_sales_opportunities_updated_by
    FOREIGN KEY (updated_by) REFERENCES app_users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_sales_opportunities_title CHECK (length(btrim(title)) > 0),
  CONSTRAINT chk_sales_opportunities_stage CHECK (
    stage IN ('prospecting','qualified','proposal','negotiation','won','lost')
  ),
  CONSTRAINT chk_sales_opportunities_value CHECK (estimated_value >= 0),
  CONSTRAINT chk_sales_opportunities_probability CHECK (probability BETWEEN 0 AND 100),
  CONSTRAINT chk_sales_opportunities_next_action CHECK (
    (next_action IS NULL AND next_action_at IS NULL)
    OR (next_action IS NOT NULL AND next_action_at IS NOT NULL)
  ),
  CONSTRAINT chk_sales_opportunities_loss_reason CHECK (
    stage <> 'lost' OR length(btrim(COALESCE(loss_reason, ''))) > 0
  )
);

ALTER SEQUENCE public.sales_opportunities_number_seq
OWNED BY sales_opportunities.opportunity_id;

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_owner_stage_close
  ON sales_opportunities (owner_id, stage, expected_close_date);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_customer_updated
  ON sales_opportunities (customer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_open_next_action
  ON sales_opportunities (next_action_at)
  WHERE stage NOT IN ('won', 'lost') AND next_action_at IS NOT NULL;

COMMIT;
