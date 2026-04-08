-- Feature 3: historical trade tracking
-- Adds source/external_id/executed_at + AI grading columns to the existing
-- `trades` table. The `trades` + `trade_items` tables were previously
-- unused by any write path (only admin cleanup referenced them); this
-- migration repurposes them for auto-ingested and manually-logged trades.

ALTER TABLE trades ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE trades ADD COLUMN external_id TEXT;
ALTER TABLE trades ADD COLUMN executed_at INTEGER;
ALTER TABLE trades ADD COLUMN season_year INTEGER;
ALTER TABLE trades ADD COLUMN week_executed INTEGER;
ALTER TABLE trades ADD COLUMN ai_fairness_score REAL;
ALTER TABLE trades ADD COLUMN ai_grade TEXT;
ALTER TABLE trades ADD COLUMN ai_analysis_json TEXT;
ALTER TABLE trades ADD COLUMN ai_graded_at INTEGER;
ALTER TABLE trades ADD COLUMN trade_context_snapshot_json TEXT;

-- Idempotent ingest key: (league, source, external_id) must be unique
CREATE UNIQUE INDEX IF NOT EXISTS trades_source_external_unique
  ON trades(league_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_league_executed
  ON trades(league_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_trades_ai_graded_at
  ON trades(ai_graded_at);
