-- Add CHECK constraints for data integrity
-- SQLite supports CHECK constraints but they must be added via new columns or table rebuilds.
-- Since ALTER TABLE ADD CHECK is not supported in SQLite, we use triggers for runtime validation.

-- Ensure weeks are positive (1-22)
CREATE TRIGGER IF NOT EXISTS check_matchup_week_positive
BEFORE INSERT ON matchups
FOR EACH ROW
WHEN NEW.week < 1 OR NEW.week > 22
BEGIN
  SELECT RAISE(ABORT, 'week must be between 1 and 22');
END;

CREATE TRIGGER IF NOT EXISTS check_matchup_week_positive_update
BEFORE UPDATE ON matchups
FOR EACH ROW
WHEN NEW.week < 1 OR NEW.week > 22
BEGIN
  SELECT RAISE(ABORT, 'week must be between 1 and 22');
END;

-- Ensure season year is reasonable
CREATE TRIGGER IF NOT EXISTS check_league_season_year
BEFORE INSERT ON leagues
FOR EACH ROW
WHEN NEW.season_year < 2000 OR NEW.season_year > 2100
BEGIN
  SELECT RAISE(ABORT, 'season_year must be between 2000 and 2100');
END;

CREATE TRIGGER IF NOT EXISTS check_league_season_year_update
BEFORE UPDATE ON leagues
FOR EACH ROW
WHEN NEW.season_year < 2000 OR NEW.season_year > 2100
BEGIN
  SELECT RAISE(ABORT, 'season_year must be between 2000 and 2100');
END;

-- Ensure wins/losses/ties are non-negative
CREATE TRIGGER IF NOT EXISTS check_team_record_positive
BEFORE INSERT ON teams
FOR EACH ROW
WHEN NEW.wins < 0 OR NEW.losses < 0 OR NEW.ties < 0
BEGIN
  SELECT RAISE(ABORT, 'wins, losses, and ties must be non-negative');
END;

CREATE TRIGGER IF NOT EXISTS check_team_record_positive_update
BEFORE UPDATE ON teams
FOR EACH ROW
WHEN NEW.wins < 0 OR NEW.losses < 0 OR NEW.ties < 0
BEGIN
  SELECT RAISE(ABORT, 'wins, losses, and ties must be non-negative');
END;

-- Ensure FAAB budget is non-negative
CREATE TRIGGER IF NOT EXISTS check_team_faab_positive
BEFORE INSERT ON teams
FOR EACH ROW
WHEN NEW.faab_budget IS NOT NULL AND NEW.faab_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'faab_budget must be non-negative');
END;

CREATE TRIGGER IF NOT EXISTS check_team_faab_positive_update
BEFORE UPDATE ON teams
FOR EACH ROW
WHEN NEW.faab_budget IS NOT NULL AND NEW.faab_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'faab_budget must be non-negative');
END;

-- Ensure league waiver budget is non-negative
CREATE TRIGGER IF NOT EXISTS check_league_waiver_budget
BEFORE INSERT ON leagues
FOR EACH ROW
WHEN NEW.waiver_budget IS NOT NULL AND NEW.waiver_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'waiver_budget must be non-negative');
END;

CREATE TRIGGER IF NOT EXISTS check_league_waiver_budget_update
BEFORE UPDATE ON leagues
FOR EACH ROW
WHEN NEW.waiver_budget IS NOT NULL AND NEW.waiver_budget < 0
BEGIN
  SELECT RAISE(ABORT, 'waiver_budget must be non-negative');
END;

-- Ensure team count is positive
CREATE TRIGGER IF NOT EXISTS check_league_team_count
BEFORE INSERT ON leagues
FOR EACH ROW
WHEN NEW.team_count < 2 OR NEW.team_count > 32
BEGIN
  SELECT RAISE(ABORT, 'team_count must be between 2 and 32');
END;

CREATE TRIGGER IF NOT EXISTS check_league_team_count_update
BEFORE UPDATE ON leagues
FOR EACH ROW
WHEN NEW.team_count < 2 OR NEW.team_count > 32
BEGIN
  SELECT RAISE(ABORT, 'team_count must be between 2 and 32');
END;

-- Ensure player weekly stats week is valid
CREATE TRIGGER IF NOT EXISTS check_stats_week
BEFORE INSERT ON player_weekly_stats
FOR EACH ROW
WHEN NEW.week < 1 OR NEW.week > 22
BEGIN
  SELECT RAISE(ABORT, 'week must be between 1 and 22');
END;

-- Ensure NFL games week is valid
CREATE TRIGGER IF NOT EXISTS check_game_week
BEFORE INSERT ON nfl_games
FOR EACH ROW
WHEN NEW.week < 1 OR NEW.week > 22
BEGIN
  SELECT RAISE(ABORT, 'week must be between 1 and 22');
END;
