-- Cached AI post-game recaps, generated at most once per game and shared
-- by every viewer.
CREATE TABLE IF NOT EXISTS game_ai_recaps (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES nfl_games(id) ON DELETE CASCADE,
  recap TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_ai_recaps_game
  ON game_ai_recaps(game_id);
