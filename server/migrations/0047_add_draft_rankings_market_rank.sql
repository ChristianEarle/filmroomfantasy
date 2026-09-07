-- Persist the deterministic Market (sportsbook-implied) VORP rank that was
-- in effect when each draft_rankings row was generated, for auditability.
-- GET /api/draft-rankings still joins a *live* marketRank from
-- player_market_projections for display; this column records what the AI
-- prompt actually saw at generation time. NULL for rows generated before
-- this column existed, and for variants with no market coverage.
ALTER TABLE `draft_rankings` ADD COLUMN `market_rank` integer;
