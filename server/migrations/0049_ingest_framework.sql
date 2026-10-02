-- Ingest job framework (filmroom-ingest Worker). ingest_jobs is the scheduling
-- ledger: due time, dispatch and run leases, backoff and quarantine. Every
-- time column is integer milliseconds since epoch, compared in SQL against
-- D1's own clock. ingest_owner is the per-group cutover switch: a group is
-- leased by the ingest Worker only while its owner is 'ingest'; under
-- 'legacy' the existing cron keeps writing it.
CREATE TABLE IF NOT EXISTS ingest_jobs (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  group_name TEXT NOT NULL,
  params TEXT NOT NULL DEFAULT '{}',
  resource_class TEXT NOT NULL DEFAULT 'light',   -- light|heavy
  priority INTEGER NOT NULL DEFAULT 5,            -- 1 = most urgent
  next_run_at INTEGER NOT NULL,
  dirty_at INTEGER,                               -- set by markDue; honoured by the fenced completion
  dirty_due_at INTEGER,
  dispatch_token TEXT,                            -- dispatch lease (30 min)
  queued_until INTEGER,
  current_run_id TEXT,                            -- run lease = claim + 16 min (> 15 min platform wall)
  run_expires_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,            -- consecutive failures
  disabled_until INTEGER,                         -- quarantine
  last_started_at INTEGER,
  last_finished_at INTEGER,
  last_success_at INTEGER,
  last_status TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_due ON ingest_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_ingest_jobs_run ON ingest_jobs(run_expires_at) WHERE current_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  job_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  dispatch_token TEXT,                            -- the claimed message's token; matches its dead letter to this run
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL,                           -- running|ok|partial|skipped|failed|killed|superseded
  d1_calls INTEGER,
  rows_read INTEGER,
  rows_written INTEGER,
  upstream_calls INTEGER,
  credits_used INTEGER,
  detail TEXT,                                    -- JSON
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_runs_job ON ingest_runs(job_key, started_at);

CREATE TABLE IF NOT EXISTS ingest_owner (
  group_name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,                            -- legacy|ingest
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_heartbeat (
  name TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  detail TEXT                                     -- JSON
);

-- One row per paid upstream call, inserted before the call is made, so a
-- retried job never pays twice for the same idempotency key.
CREATE TABLE IF NOT EXISTS paid_calls (
  idem_key TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  external_ref TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_state (
  provider TEXT PRIMARY KEY,
  quota_used INTEGER,
  quota_remaining INTEGER,
  last_cost INTEGER,
  observed_at INTEGER,
  blocked_reason TEXT,
  blocked_since INTEGER
);

CREATE TABLE IF NOT EXISTS alert_log (
  alert_key TEXT PRIMARY KEY,
  opened_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  breaches INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER
);

INSERT OR IGNORE INTO ingest_owner (group_name, owner, updated_at) VALUES
  ('odds', 'legacy', 0),
  ('props', 'legacy', 0),
  ('stats', 'legacy', 0),
  ('projections', 'legacy', 0),
  ('market', 'legacy', 0),
  ('players', 'legacy', 0),
  ('news', 'legacy', 0),
  ('games', 'legacy', 0),
  ('leagues', 'legacy', 0),
  ('rankings', 'legacy', 0),
  ('maintenance', 'legacy', 0);

INSERT OR IGNORE INTO ingest_jobs (key, kind, group_name, params, resource_class, priority, next_run_at, created_at, updated_at)
VALUES ('odds:lines', 'odds-lines', 'odds', '{}', 'light', 5, 0, 0, 0);
