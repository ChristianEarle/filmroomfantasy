-- Drop the orphaned team_scouting_reports table (created in 0029 for the
-- since-removed Trade Finder). The Drizzle definition was removed earlier;
-- no code references remain. Approved for removal 2026-09-06.
DROP TABLE IF EXISTS team_scouting_reports;
