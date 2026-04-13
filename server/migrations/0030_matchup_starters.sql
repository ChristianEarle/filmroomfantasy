-- Store weekly starting lineups so trade impact can be calculated
-- against actual lineup decisions, not raw player production.
-- Sleeper's /matchups/:week endpoint already returns a `starters`
-- array per roster — we just need to persist it.

ALTER TABLE matchups ADD COLUMN home_starters_json TEXT;
ALTER TABLE matchups ADD COLUMN away_starters_json TEXT;
