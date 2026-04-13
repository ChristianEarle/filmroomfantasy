-- Draft Rankings table for AI-generated draft rankings
CREATE TABLE IF NOT EXISTS `draft_rankings` (
  `id` text PRIMARY KEY NOT NULL,
  `player_id` text NOT NULL REFERENCES `nfl_players`(`id`) ON DELETE CASCADE,
  `ranking_type` text NOT NULL,
  `scoring_format` text NOT NULL,
  `superflex` integer NOT NULL DEFAULT 0,
  `overall_rank` integer NOT NULL,
  `position_rank` integer NOT NULL,
  `tier` integer NOT NULL,
  `projected_points` real,
  `adp` real,
  `adp_delta` real,
  `rationale` text NOT NULL,
  `season_year` integer NOT NULL,
  `generated_at` integer NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS `draft_rank_unique` ON `draft_rankings` (`player_id`, `ranking_type`, `scoring_format`, `superflex`, `season_year`);
CREATE INDEX IF NOT EXISTS `idx_draft_rank_type` ON `draft_rankings` (`ranking_type`, `scoring_format`, `superflex`, `season_year`);
