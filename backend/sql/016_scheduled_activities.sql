BEGIN;

CREATE SEQUENCE IF NOT EXISTS
  public.scheduled_activities_number_seq
AS bigint
START WITH 1
INCREMENT BY 1
MINVALUE 1
CACHE 1;

CREATE TABLE IF NOT EXISTS scheduled_activities (
  activity_id text PRIMARY KEY
    DEFAULT public.mii_next_record_id(
      'ACT',
      'public.scheduled_activities_number_seq'::regclass
    ),
  customer_id text NOT NULL,
  contact_id text,
  assigned_to text NOT NULL,
  activity_type text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz,
  location text,
  purpose text NOT NULL,
  notes text,
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_attempt_count integer NOT NULL DEFAULT 0,
  reminder_last_attempt_at timestamptz,
  reminder_error text,
  status text NOT NULL DEFAULT 'planned',
  completed_interaction_id text,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_scheduled_activities_customer
    FOREIGN KEY (customer_id)
    REFERENCES customers(customer_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_scheduled_activities_contact
    FOREIGN KEY (customer_id, contact_id)
    REFERENCES customer_contacts(customer_id, contact_id)
    ON DELETE SET NULL (contact_id),
  CONSTRAINT fk_scheduled_activities_assigned_to
    FOREIGN KEY (assigned_to)
    REFERENCES app_users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_scheduled_activities_completed_interaction
    FOREIGN KEY (completed_interaction_id)
    REFERENCES customer_interactions(interaction_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_scheduled_activities_created_by
    FOREIGN KEY (created_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_scheduled_activities_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES app_users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_scheduled_activities_type
    CHECK (
      activity_type IN (
        'meeting',
        'visit',
        'call',
        'follow_up'
      )
    ),
  CONSTRAINT chk_scheduled_activities_status
    CHECK (
      status IN (
        'planned',
        'confirmed',
        'completed',
        'cancelled',
        'rescheduled',
        'no_show'
      )
    ),
  CONSTRAINT chk_scheduled_activities_purpose
    CHECK (length(btrim(purpose)) > 0),
  CONSTRAINT chk_scheduled_activities_end
    CHECK (
      scheduled_end IS NULL
      OR scheduled_end > scheduled_start
    ),
  CONSTRAINT chk_scheduled_activities_reminder
    CHECK (
      reminder_at IS NULL
      OR reminder_at <= scheduled_start
    ),
  CONSTRAINT chk_scheduled_activities_attempts
    CHECK (reminder_attempt_count >= 0)
);

ALTER SEQUENCE
  public.scheduled_activities_number_seq
OWNED BY scheduled_activities.activity_id;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_scheduled_activities_completed_interaction
ON scheduled_activities (completed_interaction_id)
WHERE completed_interaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_scheduled_activities_assignee_start
ON scheduled_activities (
  assigned_to,
  scheduled_start,
  status
);

CREATE INDEX IF NOT EXISTS
  idx_scheduled_activities_customer_start
ON scheduled_activities (
  customer_id,
  scheduled_start DESC
);

CREATE INDEX IF NOT EXISTS
  idx_scheduled_activities_status_start
ON scheduled_activities (
  status,
  scheduled_start
);

CREATE INDEX IF NOT EXISTS
  idx_scheduled_activities_reminder_due
ON scheduled_activities (
  reminder_at,
  reminder_last_attempt_at
)
WHERE
  reminder_at IS NOT NULL
  AND reminder_sent_at IS NULL
  AND status IN ('planned', 'confirmed');

COMMIT;
