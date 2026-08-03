BEGIN;

ALTER TABLE customer_interactions
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz;

ALTER TABLE scheduled_activities
  ADD COLUMN IF NOT EXISTS source_interaction_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_scheduled_activities_source_interaction'
  ) THEN
    ALTER TABLE scheduled_activities
      ADD CONSTRAINT fk_scheduled_activities_source_interaction
      FOREIGN KEY (source_interaction_id)
      REFERENCES customer_interactions(interaction_id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_scheduled_activities_source_interaction
ON scheduled_activities (source_interaction_id)
WHERE source_interaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_customer_interactions_next_action_at
ON customer_interactions (next_action_at)
WHERE next_action_at IS NOT NULL;

-- Preserve existing date-only follow-ups at 09:00 WIB.
UPDATE customer_interactions
SET next_action_at =
  (next_action_date::timestamp + TIME '09:00')
  AT TIME ZONE 'Asia/Jakarta'
WHERE
  next_action_at IS NULL
  AND next_action_date IS NOT NULL
  AND NULLIF(btrim(next_action), '') IS NOT NULL;

-- Add one Agenda follow-up for each existing interaction next action.
INSERT INTO scheduled_activities
(
  customer_id,
  contact_id,
  assigned_to,
  activity_type,
  scheduled_start,
  purpose,
  notes,
  reminder_at,
  status,
  source_interaction_id,
  created_by,
  updated_by
)
SELECT
  ci.customer_id,
  ci.contact_id,
  COALESCE(ci.created_by, ci.updated_by),
  'follow_up',
  ci.next_action_at,
  ci.next_action,
  'Created automatically from interaction ' || ci.interaction_id,
  CASE
    WHEN ci.next_action_at > NOW()
      THEN ci.next_action_at - INTERVAL '15 minutes'
    ELSE NULL
  END,
  'planned',
  ci.interaction_id,
  ci.created_by,
  COALESCE(ci.updated_by, ci.created_by)
FROM customer_interactions ci
WHERE
  ci.next_action_at IS NOT NULL
  AND NULLIF(btrim(ci.next_action), '') IS NOT NULL
  AND COALESCE(ci.created_by, ci.updated_by) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM scheduled_activities sa
    WHERE sa.source_interaction_id = ci.interaction_id
  );

COMMIT;
