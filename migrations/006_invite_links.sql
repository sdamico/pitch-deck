-- Self-service invite links for deck + data room access
CREATE TABLE IF NOT EXISTS invite_links (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  view_id INTEGER REFERENCES views(id) ON DELETE SET NULL,  -- null = full data room access
  label TEXT,               -- admin note, e.g. "Series B investors"
  created_by TEXT,
  expires_at TIMESTAMPTZ,   -- optional expiration
  max_uses INTEGER,         -- optional limit (null = unlimited)
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links (code);
