-- Rank history: daily snapshots of draft_rankings used to compute rank
-- movement (1d/7d/30d deltas) and trend sparklines. One row per player per
-- variant per snapshot date; the unique index makes the daily snapshot job
-- idempotent (INSERT OR IGNORE).
CREATE TABLE IF NOT EXISTS `rank_history` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL REFERENCES `nfl_players`(`id`) ON DELETE CASCADE,
  `ranking_type` text NOT NULL,
  `scoring_format` text NOT NULL,
  `superflex` integer NOT NULL DEFAULT 0,
  `overall_rank` integer NOT NULL,
  `position_rank` integer NOT NULL,
  `season_year` integer NOT NULL,
  `snapshot_date` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS `rank_history_unique` ON `rank_history` (`player_id`, `scoring_format`, `superflex`, `ranking_type`, `snapshot_date`);
CREATE INDEX IF NOT EXISTS `idx_rank_history_variant` ON `rank_history` (`ranking_type`, `scoring_format`, `superflex`, `season_year`, `snapshot_date`);
