-- Cached AI recap for one finalized NFL game, generated at most once and
-- shared by every viewer (Pro/Elite gated to control Anthropic cost).
CREATE TABLE IF NOT EXISTS game_ai_recaps (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES nfl_games(id) ON DELETE CASCADE,
  recap TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_ai_recaps_game_id
  ON game_ai_recaps(game_id);
