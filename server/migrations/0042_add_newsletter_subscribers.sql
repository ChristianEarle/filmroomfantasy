-- Email capture for the weekly fantasy football newsletter (waiver targets,
-- start/sit advice, injury updates). Capture-only for now; sending is a
-- future follow-up.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at INTEGER NOT NULL
);
