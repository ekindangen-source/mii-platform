BEGIN;

CREATE SEQUENCE IF NOT EXISTS
  public.customer_interactions_number_seq
AS bigint
START WITH 1
INCREMENT BY 1
MINVALUE 1
CACHE 1;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_customer_contacts_customer_contact
ON customer_contacts (customer_id, contact_id);

CREATE TABLE IF NOT EXISTS customer_interactions (
  interaction_id text PRIMARY KEY
    DEFAULT public.mii_next_record_id(
      'INT',
      'public.customer_interactions_number_seq'::regclass
    ),
  customer_id text NOT NULL,
  contact_id text,
  interaction_type text NOT NULL,
  interaction_at timestamptz NOT NULL DEFAULT NOW(),
  participants text,
  notes text NOT NULL,
  next_action text,
  next_action_date date,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_customer_interactions_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_interactions_contact
    FOREIGN KEY (customer_id, contact_id)
    REFERENCES customer_contacts(customer_id, contact_id)
    ON DELETE SET NULL (contact_id),
  CONSTRAINT fk_customer_interactions_created_by
    FOREIGN KEY (created_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_customer_interactions_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_customer_interactions_type
    CHECK (
      interaction_type IN (
        'call',
        'email',
        'meeting',
        'visit',
        'whatsapp',
        'other'
      )
    ),
  CONSTRAINT chk_customer_interactions_notes
    CHECK (length(btrim(notes)) > 0)
);

ALTER SEQUENCE
  public.customer_interactions_number_seq
OWNED BY customer_interactions.interaction_id;

CREATE INDEX IF NOT EXISTS
  idx_customer_interactions_customer_date
ON customer_interactions (
  customer_id,
  interaction_at DESC,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_customer_interactions_contact
ON customer_interactions (contact_id);

CREATE INDEX IF NOT EXISTS
  idx_customer_interactions_next_action_date
ON customer_interactions (next_action_date)
WHERE next_action_date IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS
  public.customer_interaction_photos_number_seq
AS bigint
START WITH 1
INCREMENT BY 1
MINVALUE 1
CACHE 1;

CREATE TABLE IF NOT EXISTS customer_interaction_photos (
  photo_id text PRIMARY KEY
    DEFAULT public.mii_next_record_id(
      'IPH',
      'public.customer_interaction_photos_number_seq'::regclass
    ),
  interaction_id text NOT NULL,
  photo_path text NOT NULL UNIQUE,
  original_name text,
  mime_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_customer_interaction_photos_interaction
    FOREIGN KEY (interaction_id)
    REFERENCES customer_interactions(interaction_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_interaction_photos_created_by
    FOREIGN KEY (created_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_customer_interaction_photo_size
    CHECK (
      file_size_bytes > 0
      AND file_size_bytes <= 1048576
    ),
  CONSTRAINT chk_customer_interaction_photo_mime
    CHECK (
      mime_type IN (
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    )
);

ALTER SEQUENCE
  public.customer_interaction_photos_number_seq
OWNED BY customer_interaction_photos.photo_id;

CREATE INDEX IF NOT EXISTS
  idx_customer_interaction_photos_interaction
ON customer_interaction_photos (
  interaction_id,
  created_at,
  photo_id
);

COMMIT;
