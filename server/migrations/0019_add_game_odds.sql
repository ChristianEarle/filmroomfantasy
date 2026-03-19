CREATE TABLE IF NOT EXISTS game_odds (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  sport_key TEXT NOT NULL DEFAULT 'americanfootball_nfl',
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market TEXT NOT NULL,
  home_point REAL,
  away_point REAL,
  home_price INTEGER,
  away_price INTEGER,
  over_point REAL,
  under_point REAL,
  over_price INTEGER,
  under_price INTEGER,
  snapshot_time TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 2025,
  week INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, bookmaker, market, snapshot_time)
);
CREATE INDEX IF NOT EXISTS idx_game_odds_game_id ON game_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_game_odds_week ON game_odds(week);
CREATE INDEX IF NOT EXISTS idx_game_odds_commence ON game_odds(commence_time);
