-- Remove the foreign key constraint on trade_analysis_usage.user_id so that
-- anonymous usage rows (keyed by "anon_<ip>") can be recorded. Previously the
-- FK silently rejected anon inserts, which meant anonymous users were never
-- rate-limited against the advertised weekly cap.
CREATE TABLE trade_analysis_usage_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT (datetime('now')),
  date_key TEXT NOT NULL
);

INSERT INTO trade_analysis_usage_new (id, user_id, used_at, date_key)
  SELECT id, user_id, used_at, date_key FROM trade_analysis_usage;

DROP TABLE trade_analysis_usage;
ALTER TABLE trade_analysis_usage_new RENAME TO trade_analysis_usage;

CREATE INDEX IF NOT EXISTS idx_trade_usage_user_date
  ON trade_analysis_usage(user_id, date_key);
