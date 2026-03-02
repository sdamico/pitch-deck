-- Data room: per-user access control
CREATE TABLE IF NOT EXISTS data_room_access (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_room_access_email ON data_room_access (LOWER(email));

-- Data room: files (binary content stored as bytea)
CREATE TABLE IF NOT EXISTS data_room_files (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT '/',
  content BYTEA NOT NULL DEFAULT '\x',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_room_files_folder ON data_room_files (folder);

-- Data room: download tracking
CREATE TABLE IF NOT EXISTS data_room_downloads (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES data_room_files(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_room_downloads_email ON data_room_downloads (email);
CREATE INDEX IF NOT EXISTS idx_data_room_downloads_file ON data_room_downloads (file_id);
CREATE INDEX IF NOT EXISTS idx_data_room_downloads_created ON data_room_downloads (created_at DESC);
