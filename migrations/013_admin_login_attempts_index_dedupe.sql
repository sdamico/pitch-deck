-- Remove duplicate index introduced by migrations 008 and 011.
-- Keep idx_admin_login_ip_time as canonical for (ip, attempted_at).
DROP INDEX IF EXISTS idx_admin_attempts_ip_time;
