-- Cached per-player AI takes, generated at most once per (player, season,
-- week) and shared by every viewer.
CREATE TABLE IF NOT EXISTS player_ai_analyses (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  analysis TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_ai_analyses_identity
  ON player_ai_analyses(player_id, season_year, week);
