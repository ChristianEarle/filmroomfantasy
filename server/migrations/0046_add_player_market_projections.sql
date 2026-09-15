-- Deterministic "Market" (sportsbook-implied) season projection + VORP ranking
-- layer. Built on top of #305's player_season_props / buildSeasonProjectionsFromSeasonProps
-- (Tier A), with a weekly-prop-line extrapolation fallback (Tier B) for players
-- without season prop coverage. Populated by /api/admin/sync-market-projections.
CREATE TABLE IF NOT EXISTS player_market_projections (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES nfl_players(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  as_of_week INTEGER NOT NULL,
  scoring_format TEXT NOT NULL,              -- ppr|half-ppr|standard
  season_points REAL,
  ros_points REAL,
  per_game_rate REAL,
  remaining_games INTEGER,
  market_rank INTEGER,
  position_rank INTEGER,
  tier INTEGER,
  vorp REAL,
  confidence TEXT NOT NULL DEFAULT 'none',   -- season_props|weekly_extrapolation|none
  source TEXT NOT NULL DEFAULT 'market',
  computed_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_proj_unique ON player_market_projections(player_id, season_year, as_of_week, scoring_format);
CREATE INDEX IF NOT EXISTS idx_market_proj_week ON player_market_projections(season_year, as_of_week, scoring_format, market_rank);
