-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);

-- Bootstrap admin
-- Add your admin email here:
-- INSERT INTO admins (email) VALUES ('you@example.com')
--   ON CONFLICT (email) DO NOTHING;
