-- Add email, ip, user_agent columns to admin_sessions for audit trail
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add success flag to admin_login_attempts for audit trail
ALTER TABLE admin_login_attempts ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT FALSE;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_ip_time ON admin_login_attempts(ip, attempted_at);
