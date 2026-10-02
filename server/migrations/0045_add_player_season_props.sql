-- Season-long sportsbook player prop lines (season O/U totals). There's no
-- API source for these (The Odds API only carries weekly game props), so
-- they're imported manually via /api/admin/sync-season-props (JSON or CSV).
CREATE TABLE IF NOT EXISTS player_season_props (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES nfl_players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  season INTEGER NOT NULL,
  stat TEXT NOT NULL,            -- pass_yds|pass_tds|rush_yds|rush_tds|rec_yds|receptions|rec_tds|interceptions
  line REAL NOT NULL,
  over_price INTEGER,
  under_price INTEGER,
  book TEXT NOT NULL,
  source_url TEXT,
  captured_at TEXT NOT NULL,     -- YYYY-MM-DD
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_season_props_unique ON player_season_props(season, player_name, stat, book, captured_at);
CREATE INDEX IF NOT EXISTS idx_season_props_player ON player_season_props(season, player_id);
