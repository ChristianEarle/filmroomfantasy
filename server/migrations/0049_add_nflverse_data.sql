-- Free nflverse data (https://github.com/nflverse/nflverse-data), pulled by
-- /api/admin/sync-nflverse from the release CSVs:
--   * nfl_players.gsis_id: the NFL GSIS id nflverse keys everything on,
--     filled from the weekly roster file's sleeper_id column.
--   * player_usage_weekly: per-player-week usage and efficiency the Sleeper
--     box score lacks (target share, air-yards share, WOPR, RACR, EPA,
--     first downs, yards after catch, CPOE, sacks taken).
--   * player_practice_reports: the official Wed-Fri practice report and the
--     game-status designation for the week.
--   * nfl_games roof/surface/temp/wind: game environment from the schedule
--     file, plus the moneylines that the ESPN scoreboard never provided.

ALTER TABLE `nfl_players` ADD COLUMN `gsis_id` TEXT;
CREATE INDEX IF NOT EXISTS `idx_nfl_players_gsis_id` ON `nfl_players`(`gsis_id`);

ALTER TABLE `nfl_games` ADD COLUMN `roof` TEXT;
ALTER TABLE `nfl_games` ADD COLUMN `surface` TEXT;
ALTER TABLE `nfl_games` ADD COLUMN `temp` INTEGER;
ALTER TABLE `nfl_games` ADD COLUMN `wind` INTEGER;

CREATE TABLE IF NOT EXISTS `player_usage_weekly` (
  `id` TEXT PRIMARY KEY,
  `player_id` TEXT NOT NULL REFERENCES `nfl_players`(`id`) ON DELETE CASCADE,
  `gsis_id` TEXT NOT NULL,
  `season_year` INTEGER NOT NULL,
  `week` INTEGER NOT NULL,
  `team` TEXT,
  `opponent` TEXT,
  `completions` INTEGER,
  `pass_attempts` INTEGER,
  `pass_yards` REAL,
  `pass_tds` INTEGER,
  `pass_interceptions` INTEGER,
  `sacks_suffered` INTEGER,
  `pass_air_yards` REAL,
  `pass_yards_after_catch` REAL,
  `pass_first_downs` INTEGER,
  `pass_epa` REAL,
  `pass_cpoe` REAL,
  `pacr` REAL,
  `carries` INTEGER,
  `rush_yards` REAL,
  `rush_tds` INTEGER,
  `rush_first_downs` INTEGER,
  `rush_epa` REAL,
  `targets` INTEGER,
  `receptions` INTEGER,
  `rec_yards` REAL,
  `rec_tds` INTEGER,
  `rec_air_yards` REAL,
  `rec_yards_after_catch` REAL,
  `rec_first_downs` INTEGER,
  `rec_epa` REAL,
  `racr` REAL,
  `target_share` REAL,
  `air_yards_share` REAL,
  `wopr` REAL,
  `fantasy_points` REAL,
  `fantasy_points_ppr` REAL,
  `updated_at` INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `player_usage_week_unique` ON `player_usage_weekly`(`player_id`, `season_year`, `week`);
CREATE INDEX IF NOT EXISTS `idx_player_usage_week` ON `player_usage_weekly`(`season_year`, `week`);

CREATE TABLE IF NOT EXISTS `player_practice_reports` (
  `id` TEXT PRIMARY KEY,
  `player_id` TEXT NOT NULL REFERENCES `nfl_players`(`id`) ON DELETE CASCADE,
  `gsis_id` TEXT NOT NULL,
  `season_year` INTEGER NOT NULL,
  `week` INTEGER NOT NULL,
  `team` TEXT,
  `report_status` TEXT,
  `report_primary_injury` TEXT,
  `report_secondary_injury` TEXT,
  `practice_status` TEXT,
  `practice_primary_injury` TEXT,
  `practice_secondary_injury` TEXT,
  `updated_at` INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `player_practice_week_unique` ON `player_practice_reports`(`player_id`, `season_year`, `week`);
CREATE INDEX IF NOT EXISTS `idx_player_practice_week` ON `player_practice_reports`(`season_year`, `week`);
