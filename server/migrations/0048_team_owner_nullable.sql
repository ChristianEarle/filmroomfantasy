-- Make teams.owner_id nullable so a synced opponent roster with no matching
-- app user can have no owner instead of being defaulted to whichever app
-- user last ran the league sync. See server/src/services/leagueSync.ts
-- (decideTeamOwnerId) for the corrected ownership logic this supports.
--
-- SQLite has no ALTER COLUMN, so we rebuild the table. Triggers are bound
-- to the table and are dropped along with it, so they're recreated below.
CREATE TABLE teams_new (
	id text PRIMARY KEY NOT NULL,
	league_id text NOT NULL,
	owner_id text,
	external_owner_id text,
	owner_display_name text,
	name text NOT NULL,
	wins integer DEFAULT 0 NOT NULL,
	losses integer DEFAULT 0 NOT NULL,
	ties integer DEFAULT 0 NOT NULL,
	points_for real DEFAULT 0 NOT NULL,
	points_against real DEFAULT 0 NOT NULL,
	playoff_seed integer,
	waiver_priority integer DEFAULT 1,
	faab_budget integer DEFAULT 100,
	streak text,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	FOREIGN KEY (league_id) REFERENCES leagues(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (owner_id) REFERENCES users(id) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO teams_new (id, league_id, owner_id, external_owner_id, owner_display_name, name, wins, losses, ties, points_for, points_against, playoff_seed, waiver_priority, faab_budget, streak, created_at, updated_at)
  SELECT id, league_id, owner_id, external_owner_id, owner_display_name, name, wins, losses, ties, points_for, points_against, playoff_seed, waiver_priority, faab_budget, streak, created_at, updated_at
  FROM teams;
--> statement-breakpoint
DROP TABLE teams;
--> statement-breakpoint
ALTER TABLE teams_new RENAME TO teams;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teams_league_id ON teams(league_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS check_team_record_positive
BEFORE INSERT ON teams
FOR EACH ROW
WHEN NEW.wins < 0 OR NEW.losses < 0 OR NEW.ties < 0
BEGIN
  SELECT RAISE(ABORT, 'wins, losses, and ties must be non-negative');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS check_team_record_positive_update
BEFORE UPDATE ON teams
FOR EACH ROW
WHEN NEW.wins < 0 OR NEW.losses < 0 OR NEW.ties < 0
BEGIN
  SELECT RAISE(ABORT, 'wins, losses, and ties must be non-negative');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS check_team_faab_positive
BEFORE INSERT ON teams
FOR EACH ROW
WHEN NEW.faab_budget IS NOT NULL AND NEW.faab_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'faab_budget must be non-negative');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS check_team_faab_positive_update
BEFORE UPDATE ON teams
FOR EACH ROW
WHEN NEW.faab_budget IS NOT NULL AND NEW.faab_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'faab_budget must be non-negative');
END;
