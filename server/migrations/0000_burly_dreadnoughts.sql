CREATE TABLE `league_members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`platform` text,
	`external_id` text,
	`scoring_format` text DEFAULT 'ppr' NOT NULL,
	`team_count` integer DEFAULT 12 NOT NULL,
	`current_week` integer DEFAULT 1 NOT NULL,
	`season_year` integer NOT NULL,
	`draft_date` integer,
	`trade_deadline` integer,
	`playoff_weeks` integer DEFAULT 3 NOT NULL,
	`playoff_teams` integer DEFAULT 6 NOT NULL,
	`waiver_type` text DEFAULT 'faab' NOT NULL,
	`waiver_budget` integer DEFAULT 100,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matchups` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`week` integer NOT NULL,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`home_score` real,
	`away_score` real,
	`home_projected_score` real,
	`away_projected_score` real,
	`is_playoff` integer DEFAULT false NOT NULL,
	`is_championship` integer DEFAULT false NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nfl_games` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`week` integer NOT NULL,
	`season_year` integer NOT NULL,
	`season_type` text DEFAULT 'regular',
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`game_time` integer NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`spread` real,
	`over_under` real,
	`home_moneyline` integer,
	`away_moneyline` integer,
	`tv_network` text,
	`stadium` text,
	`weather` text,
	`is_complete` integer DEFAULT false NOT NULL,
	`quarter` text,
	`time_remaining` text
);
--> statement-breakpoint
CREATE TABLE `nfl_players` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`name` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`team` text NOT NULL,
	`position` text NOT NULL,
	`depth_chart_order` integer,
	`jersey_number` integer,
	`bye_week` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`injury_note` text,
	`injury_body_part` text,
	`headshot_url` text,
	`age` integer,
	`height` text,
	`weight` integer,
	`college` text,
	`years_exp` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_news` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`headline` text NOT NULL,
	`content` text NOT NULL,
	`source` text,
	`source_url` text,
	`impact_level` text,
	`published_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_projections` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`week` integer NOT NULL,
	`season_year` integer NOT NULL,
	`projected_points` real NOT NULL,
	`projected_points_low` real,
	`projected_points_high` real,
	`scoring_format` text NOT NULL,
	`week_rank` integer,
	`position_rank` integer,
	`proj_pass_yards` real,
	`proj_pass_tds` real,
	`proj_rush_yards` real,
	`proj_rush_tds` real,
	`proj_receptions` real,
	`proj_rec_yards` real,
	`proj_rec_tds` real,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_weekly_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`week` integer NOT NULL,
	`season_year` integer NOT NULL,
	`opponent` text,
	`game_result` text,
	`pass_attempts` integer DEFAULT 0,
	`pass_completions` integer DEFAULT 0,
	`pass_yards` real DEFAULT 0,
	`pass_tds` integer DEFAULT 0,
	`pass_interceptions` integer DEFAULT 0,
	`rush_attempts` integer DEFAULT 0,
	`rush_yards` real DEFAULT 0,
	`rush_tds` integer DEFAULT 0,
	`targets` integer DEFAULT 0,
	`receptions` integer DEFAULT 0,
	`receiving_yards` real DEFAULT 0,
	`receiving_tds` integer DEFAULT 0,
	`fumbles` integer DEFAULT 0,
	`fumbles_lost` integer DEFAULT 0,
	`two_point_conversions` integer DEFAULT 0,
	`fg_made` integer DEFAULT 0,
	`fg_attempts` integer DEFAULT 0,
	`fg_40_plus_made` integer DEFAULT 0,
	`fg_50_plus_made` integer DEFAULT 0,
	`xp_made` integer DEFAULT 0,
	`xp_attempts` integer DEFAULT 0,
	`sacks` real DEFAULT 0,
	`def_interceptions` integer DEFAULT 0,
	`fumbles_recovered` integer DEFAULT 0,
	`defense_tds` integer DEFAULT 0,
	`safeties` integer DEFAULT 0,
	`points_allowed` integer DEFAULT 0,
	`fantasy_points_ppr` real DEFAULT 0,
	`fantasy_points_half` real DEFAULT 0,
	`fantasy_points_std` real DEFAULT 0,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `roster_spots` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`player_id` text NOT NULL,
	`slot` text NOT NULL,
	`is_starter` integer DEFAULT false NOT NULL,
	`acquired_at` integer NOT NULL,
	`acquired_type` text DEFAULT 'draft',
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`ties` integer DEFAULT 0 NOT NULL,
	`points_for` real DEFAULT 0 NOT NULL,
	`points_against` real DEFAULT 0 NOT NULL,
	`playoff_seed` integer,
	`waiver_priority` integer DEFAULT 1,
	`faab_budget` integer DEFAULT 100,
	`streak` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trade_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text NOT NULL,
	`from_team_id` text NOT NULL,
	`to_team_id` text NOT NULL,
	`player_id` text,
	`draft_pick_year` integer,
	`draft_pick_round` integer,
	FOREIGN KEY (`trade_id`) REFERENCES `trades`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`proposing_team_id` text NOT NULL,
	`receiving_team_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposing_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiving_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`player_id` text,
	`add_team_id` text,
	`drop_team_id` text,
	`drop_player_id` text,
	`faab_bid` integer,
	`waiver_priority` integer,
	`process_at` integer,
	`processed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`add_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drop_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`drop_player_id`) REFERENCES `nfl_players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`username` text NOT NULL,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_league_unique` ON `league_members` (`user_id`,`league_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `matchup_unique` ON `matchups` (`league_id`,`week`,`home_team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nfl_games_external_id_unique` ON `nfl_games` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nfl_game_unique` ON `nfl_games` (`week`,`season_year`,`home_team`,`away_team`);--> statement-breakpoint
CREATE UNIQUE INDEX `nfl_players_external_id_unique` ON `nfl_players` (`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_projection_unique` ON `player_projections` (`player_id`,`week`,`season_year`,`scoring_format`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_week_unique` ON `player_weekly_stats` (`player_id`,`week`,`season_year`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_player_unique` ON `roster_spots` (`team_id`,`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);