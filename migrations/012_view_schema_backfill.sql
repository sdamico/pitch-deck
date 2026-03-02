-- Backfill for environments that applied older migrations before views schema existed.
-- Safe no-op on fresh installs where 006_invite_links.sql already provisions these objects.

CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS view_files (
  view_id INTEGER NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES data_room_files(id) ON DELETE CASCADE,
  PRIMARY KEY (view_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_view_files_view_id ON view_files (view_id);
CREATE INDEX IF NOT EXISTS idx_view_files_file_id ON view_files (file_id);

ALTER TABLE data_room_access
  ADD COLUMN IF NOT EXISTS view_id INTEGER REFERENCES views(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_data_room_access_view_id ON data_room_access (view_id);
