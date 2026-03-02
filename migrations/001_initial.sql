-- Magic link tokens
CREATE TABLE IF NOT EXISTS magic_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_tokens (token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email ON magic_tokens (email);

-- Viewer sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions (email);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at DESC);

-- Slide view + heartbeat events
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'heartbeat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);

-- Email whitelist/blacklist rules
CREATE TABLE IF NOT EXISTS email_rules (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('allow', 'block')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- KV settings (access_mode, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES ('access_mode', 'whitelist_only')
  ON CONFLICT (key) DO NOTHING;
