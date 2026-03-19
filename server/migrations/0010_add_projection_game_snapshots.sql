-- Projection line snapshots for historical trends (biggest movers)
CREATE TABLE IF NOT EXISTS `projection_line_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`week` integer NOT NULL,
	`season_year` integer NOT NULL,
	`scoring_format` text NOT NULL,
	`snapshot_at` integer NOT NULL,
	`projected_points` real NOT NULL,
	`proj_pass_yards` real,
	`proj_pass_tds` real,
	`proj_rush_yards` real,
	`proj_rush_tds` real,
	`proj_receptions` real,
	`proj_rec_yards` real,
	`proj_rec_tds` real,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `proj_snap_player_week` ON `projection_line_snapshots` (`player_id`,`week`,`season_year`,`scoring_format`,`snapshot_at`);
--> statement-breakpoint
-- Game line snapshots for betting trends
CREATE TABLE IF NOT EXISTS `game_line_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`snapshot_at` integer NOT NULL,
	`spread` real,
	`over_under` real,
	FOREIGN KEY (`game_id`) REFERENCES `nfl_games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `game_snap_game` ON `game_line_snapshots` (`game_id`,`snapshot_at`);
