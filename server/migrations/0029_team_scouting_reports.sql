-- Trade Finder: persist team scouting reports so we only re-scout a team
-- when its roster actually changes. Previously /trade-finder/needs hit
-- the HTTP cache with a day-key, which meant every day was a fresh AI
-- call even when the roster was identical.
--
-- One row per team. rosterFingerprint is a stable hash of the sorted
-- player IDs on the team at the time of generation. The route compares
-- the current fingerprint to the stored one and only re-scouts when
-- they differ.

CREATE TABLE IF NOT EXISTS team_scouting_reports (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  current_week INTEGER NOT NULL,
  roster_fingerprint TEXT NOT NULL,
  window TEXT NOT NULL,
  position_grades_json TEXT NOT NULL,
  top_needs_json TEXT NOT NULL,
  top_strengths_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_scouting_reports_fingerprint
  ON team_scouting_reports(team_id, roster_fingerprint);
