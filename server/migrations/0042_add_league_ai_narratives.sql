-- Cached AI-generated narratives for the League Analyzer, generated at most
-- once per (team, season, week) or (league, season, week) and shared by
-- every viewer of that league.
CREATE TABLE IF NOT EXISTS team_ai_narratives (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  narrative TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_ai_narratives_identity
  ON team_ai_narratives(team_id, season_year, week);

CREATE TABLE IF NOT EXISTS league_ai_pulses (
  id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  narrative TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_ai_pulses_identity
  ON league_ai_pulses(league_id, season_year, week);
