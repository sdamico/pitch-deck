-- Admin login rate limiting
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_attempts_ip_time ON admin_login_attempts(ip, attempted_at);
