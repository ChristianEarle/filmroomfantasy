-- Page views table for visitor analytics
CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  user_id TEXT,
  session_id TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  device TEXT,
  browser TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);
