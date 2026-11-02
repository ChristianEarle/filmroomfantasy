-- Splits the "dynasty_rookie" ranking type into two distinct types:
-- "dynasty" (new — whole-player-pool long-term asset value) and "rookie"
-- (the existing rookie-only ranking, renamed for clarity now that it's no
-- longer the only dynasty-flavored variant). Existing rows tagged
-- 'dynasty_rookie' are rookie-only rankings, so they rename to 'rookie'
-- directly; the new 'dynasty' variant has no historical data and starts
-- fresh on the next batch.
UPDATE `draft_rankings` SET `ranking_type` = 'rookie' WHERE `ranking_type` = 'dynasty_rookie';
UPDATE `rank_history` SET `ranking_type` = 'rookie' WHERE `ranking_type` = 'dynasty_rookie';
