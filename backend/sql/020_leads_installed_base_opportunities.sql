BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.crm_leads_number_seq
AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 CACHE 1;

CREATE TABLE IF NOT EXISTS crm_leads (
  lead_id text PRIMARY KEY DEFAULT public.mii_next_record_id(
    'LEAD', 'public.crm_leads_number_seq'::regclass
  ),
  account_type text NOT NULL DEFAULT 'organization',
  name text NOT NULL,
  contact_name text NOT NULL,
  contact_title text,
  contact_phone text NOT NULL,
  contact_email text,
  industry text,
  province text,
  address text,
  source text,
  product_interest text,
  estimated_value numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  owner_id text NOT NULL,
  next_action text,
  next_action_at timestamptz,
  notes text,
  disqualified_reason text,
  converted_customer_id text,
  converted_opportunity_id text,
  converted_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_crm_leads_owner FOREIGN KEY (owner_id)
    REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_crm_leads_customer FOREIGN KEY (converted_customer_id)
    REFERENCES customers(customer_id) ON DELETE SET NULL,
  CONSTRAINT fk_crm_leads_created_by FOREIGN KEY (created_by)
    REFERENCES app_users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_crm_leads_updated_by FOREIGN KEY (updated_by)
    REFERENCES app_users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_crm_leads_account_type CHECK (
    account_type IN ('organization','individual')
  ),
  CONSTRAINT chk_crm_leads_status CHECK (
    status IN ('new','contacted','qualified','converted','disqualified')
  ),
  CONSTRAINT chk_crm_leads_name CHECK (length(btrim(name)) > 0),
  CONSTRAINT chk_crm_leads_contact CHECK (length(btrim(contact_name)) > 0),
  CONSTRAINT chk_crm_leads_phone CHECK (length(btrim(contact_phone)) > 0),
  CONSTRAINT chk_crm_leads_value CHECK (estimated_value >= 0),
  CONSTRAINT chk_crm_leads_next_action CHECK (
    (next_action IS NULL AND next_action_at IS NULL)
    OR (next_action IS NOT NULL AND next_action_at IS NOT NULL)
  ),
  CONSTRAINT chk_crm_leads_disqualified CHECK (
    status <> 'disqualified'
    OR length(btrim(COALESCE(disqualified_reason, ''))) > 0
  ),
  CONSTRAINT chk_crm_leads_converted CHECK (
    status <> 'converted'
    OR (converted_customer_id IS NOT NULL AND converted_at IS NOT NULL)
  )
);

ALTER SEQUENCE public.crm_leads_number_seq OWNED BY crm_leads.lead_id;

CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_status_action
  ON crm_leads (owner_id, status, next_action_at);
CREATE INDEX IF NOT EXISTS idx_crm_leads_name
  ON crm_leads (lower(name));

ALTER TABLE sales_opportunities
  ADD COLUMN IF NOT EXISTS vessel_id text,
  ADD COLUMN IF NOT EXISTS engine_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_opportunities_vessel') THEN
    ALTER TABLE sales_opportunities ADD CONSTRAINT fk_sales_opportunities_vessel
      FOREIGN KEY (vessel_id) REFERENCES vessels(vessel_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_opportunities_engine') THEN
    ALTER TABLE sales_opportunities ADD CONSTRAINT fk_sales_opportunities_engine
      FOREIGN KEY (engine_id) REFERENCES engines(engine_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_crm_leads_opportunity') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT fk_crm_leads_opportunity
      FOREIGN KEY (converted_opportunity_id)
      REFERENCES sales_opportunities(opportunity_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_opportunities_installed_base
  ON sales_opportunities (vessel_id, engine_id);

COMMIT;
