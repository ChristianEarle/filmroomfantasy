-- Per-user player watchlist. One row per (user, player); the unique index makes
-- adds idempotent and the user index keeps list reads cheap. Both foreign keys
-- cascade so rows are cleaned up when a user or player is deleted.
CREATE TABLE IF NOT EXISTS user_player_watchlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_player_watchlist_unique ON user_player_watchlist(user_id, player_id);
CREATE INDEX IF NOT EXISTS idx_user_player_watchlist_user ON user_player_watchlist(user_id);
