-- Add snap count columns for played detection and snap percentage
ALTER TABLE player_weekly_stats ADD COLUMN off_snaps INTEGER DEFAULT 0;
ALTER TABLE player_weekly_stats ADD COLUMN def_snaps INTEGER DEFAULT 0;
ALTER TABLE player_weekly_stats ADD COLUMN st_snaps INTEGER DEFAULT 0;
ALTER TABLE player_weekly_stats ADD COLUMN tm_off_snaps INTEGER DEFAULT 0;
ALTER TABLE player_weekly_stats ADD COLUMN tm_def_snaps INTEGER DEFAULT 0;
ALTER TABLE player_weekly_stats ADD COLUMN tm_st_snaps INTEGER DEFAULT 0;
