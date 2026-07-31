BEGIN;
CREATE TABLE IF NOT EXISTS user_invitations (
  invitation_id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  email_sent_at timestamptz,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_invitations_user_id ON user_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_pending ON user_invitations(user_id,expires_at)
WHERE accepted_at IS NULL AND revoked_at IS NULL;
COMMIT;
