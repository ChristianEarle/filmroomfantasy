-- Draft pick ownership per league. Keyed on the pick's identity
-- (league, year, round, original owner); owner_id mutates as picks are
-- traded so chains collapse to current ownership without a trade graph.
CREATE TABLE IF NOT EXISTS team_draft_picks (
  id TEXT PRIMARY KEY,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  original_owner_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  draft_year INTEGER NOT NULL,
  draft_round INTEGER NOT NULL,
  acquired_via TEXT NOT NULL DEFAULT 'native',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_draft_picks_identity
  ON team_draft_picks(league_id, draft_year, draft_round, original_owner_id);
CREATE INDEX IF NOT EXISTS idx_team_draft_picks_owner ON team_draft_picks(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_draft_picks_league ON team_draft_picks(league_id);
