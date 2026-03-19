-- Add owner_display_name to teams table
-- Stores the display name from Sleeper/ESPN/Yahoo so standings show the correct owner
-- instead of the app user who connected the league
ALTER TABLE teams ADD COLUMN owner_display_name TEXT;
