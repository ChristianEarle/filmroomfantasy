CREATE TABLE IF NOT EXISTS player_props (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_external_id TEXT,
  market TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  over_point REAL,
  over_price INTEGER,
  under_point REAL,
  under_price INTEGER,
  yes_price INTEGER,
  no_price INTEGER,
  snapshot_time TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 2025,
  week INTEGER NOT NULL,
  home_team TEXT,
  away_team TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, player_name, market, bookmaker, snapshot_time)
);
CREATE INDEX IF NOT EXISTS idx_player_props_name ON player_props(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_week ON player_props(week);
CREATE INDEX IF NOT EXISTS idx_player_props_market ON player_props(market);
CREATE INDEX IF NOT EXISTS idx_player_props_external_id ON player_props(player_external_id);
