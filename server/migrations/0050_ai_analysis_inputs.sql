-- The AI take used to be generated once per (player, season, week) and
-- never touched again, so a projection that moved, a Friday practice
-- designation or a new prop line never reached it. Each row now records a
-- fingerprint of the inputs it was written from and when; the analysis
-- route regenerates when the fingerprint changes (with a 30-minute floor)
-- and the client shows what the take was based on.
ALTER TABLE `player_ai_analyses` ADD COLUMN `inputs_hash` TEXT;
ALTER TABLE `player_ai_analyses` ADD COLUMN `basis` TEXT;
ALTER TABLE `player_ai_analyses` ADD COLUMN `updated_at` INTEGER;
