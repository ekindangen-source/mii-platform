BEGIN;

CREATE TABLE IF NOT EXISTS daily_summary_runs (
  report_date date PRIMARY KEY,
  status text NOT NULL
    CHECK (
      status IN (
        'running',
        'sent',
        'failed'
      )
    ),
  started_at timestamptz NOT NULL
    DEFAULT NOW(),
  sent_at timestamptz,
  recipients text,
  message_id text,
  error_message text
);

CREATE INDEX IF NOT EXISTS
  idx_daily_summary_runs_status
ON daily_summary_runs (status);

COMMIT;
