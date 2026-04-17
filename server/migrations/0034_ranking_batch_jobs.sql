-- Tracks Anthropic Batch API jobs submitted by the weekly draft-rankings cron.
-- Each job row represents one batch submission that may contain multiple
-- variant requests (e.g. redraft-ppr, redraft-half-ppr, dynasty-rookie-ppr,
-- dynasty-rookie-half-ppr).

CREATE TABLE IF NOT EXISTS ranking_batch_jobs (
  id TEXT PRIMARY KEY,
  anthropic_batch_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'submitted' | 'in_progress' | 'completed' | 'failed'
  season_year INTEGER NOT NULL,
  variants TEXT NOT NULL, -- JSON array of { customId, rankingType, scoringFormat, superflex }
  submitted_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ranking_batch_jobs_status
  ON ranking_batch_jobs(status);
