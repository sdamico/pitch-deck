-- Backfill views schema and defer view_id foreign keys until views exists.
-- This keeps fresh migration bootstrap order valid when applying 001..012.

CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS view_files (
  view_id INTEGER NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES data_room_files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (view_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_view_files_file_id ON view_files(file_id);

ALTER TABLE data_room_access ADD COLUMN IF NOT EXISTS view_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_data_room_access_view_id ON data_room_access(view_id);

-- Clean dangling references before attaching foreign keys.
UPDATE data_room_access dra
SET view_id = NULL
WHERE dra.view_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM views v WHERE v.id = dra.view_id
  );

UPDATE invite_links il
SET view_id = NULL
WHERE il.view_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM views v WHERE v.id = il.view_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_room_access_view_id_fkey'
  ) THEN
    ALTER TABLE data_room_access
      ADD CONSTRAINT data_room_access_view_id_fkey
      FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invite_links_view_id_fkey'
  ) THEN
    ALTER TABLE invite_links
      ADD CONSTRAINT invite_links_view_id_fkey
      FOREIGN KEY (view_id) REFERENCES views(id) ON DELETE SET NULL;
  END IF;
END $$;
