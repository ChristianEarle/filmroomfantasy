-- Track trade analyzer usage per user per day
CREATE TABLE IF NOT EXISTS trade_analysis_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  date_key TEXT NOT NULL -- YYYY-MM-DD for daily grouping
);

CREATE INDEX IF NOT EXISTS idx_trade_usage_user_date ON trade_analysis_usage(user_id, date_key);
