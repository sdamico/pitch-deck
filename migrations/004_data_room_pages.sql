-- Sub-pages: hosted HTML bundles within the data room
ALTER TABLE data_room_files ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE data_room_files ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE data_room_files ADD COLUMN IF NOT EXISTS page_id INTEGER REFERENCES data_room_files(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_room_files_slug ON data_room_files (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_data_room_files_page_id ON data_room_files (page_id) WHERE page_id IS NOT NULL;
