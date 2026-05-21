-- Tag each projection (and each snapshot of an old projection) with its provider
-- so the Projection Movers tab can:
--   1. Display "OURS" vs "SLEEPER" per row
--   2. Filter movement comparisons to same-source snapshots only — avoids
--      conflating a provider switch (props → sleeper fallback) with real
--      line movement.
-- Backfill is 'sleeper' since auto mode has historically defaulted to Sleeper
-- for any player without prop coverage; rows that were actually props-sourced
-- self-correct on the next 4h sync cron.

ALTER TABLE player_projections ADD COLUMN source TEXT NOT NULL DEFAULT 'sleeper';
ALTER TABLE projection_line_snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'sleeper';
