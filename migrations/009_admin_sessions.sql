-- Admin sessions (replaces deterministic SHA-256 token)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
