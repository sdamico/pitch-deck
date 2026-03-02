-- Track views and heartbeats for data room pages and file previews
-- page_slug stores the page slug for pages, or 'file:<id>' for file preview views
CREATE TABLE IF NOT EXISTS data_room_page_views (
  id SERIAL PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  email TEXT,
  page_slug TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'view',  -- 'view' or 'heartbeat'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dr_page_views_slug ON data_room_page_views(page_slug);
CREATE INDEX idx_dr_page_views_email ON data_room_page_views(email);
CREATE INDEX idx_dr_page_views_session ON data_room_page_views(session_id);
