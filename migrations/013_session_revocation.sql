-- Add explicit viewer-session revocation marker used by logout/auth checks.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_revoked_at ON sessions(revoked_at);
