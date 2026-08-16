-- Weekly practice-participation status (DNP/Limited/Full), sourced from
-- nflverse's free public injuries dataset. Distinct from the existing
-- status/injury_note columns (Sleeper's real-time game-status designation);
-- this tracks how a player practiced that week, which the app didn't
-- surface anywhere before.
ALTER TABLE nfl_players ADD COLUMN practice_status TEXT;
ALTER TABLE nfl_players ADD COLUMN practice_status_week INTEGER;
ALTER TABLE nfl_players ADD COLUMN practice_status_season INTEGER;
