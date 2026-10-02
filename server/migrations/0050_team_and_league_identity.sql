-- 0050: one platform team = one teams row; one platform league = one leagues row.
--
-- Until now team and league identity lived only in application code, and
-- every sync path decided it a little differently. The result on 2026-10-02:
-- eleven leagues with an extra placeholder team, Skeetsters with stranded
-- 2025 team rows ranked as its strongest teams, and Skeetsters itself stored
-- twice. See server/src/services/teamIdentity.ts and leagueIdentity.ts.

-- 1. The platform's stable team key. Sleeper: roster_id (stamped by the next
--    sync; Sleeper rows were keyed on the manager's user id, which changes).
--    ESPN, Yahoo and MFL already stored their team id in external_owner_id,
--    so it is copied over here.
ALTER TABLE teams ADD COLUMN external_team_id TEXT;

UPDATE teams
SET external_team_id = external_owner_id
WHERE external_owner_id IS NOT NULL
  AND league_id IN (SELECT id FROM leagues WHERE platform IN ('espn', 'yahoo', 'mfl'));

-- 2. Fold duplicate league rows (same platform + external_id) into one. The
--    survivor is the row with the most trade history (prior seasons' trades
--    can't be re-imported: trade ingest only reads the current Sleeper
--    league), then the most members, then the oldest. Members carry over
--    (keeping commissioner rights and any known platform identity); the
--    duplicate's current-season teams, matchups, trades and picks are copies
--    of the same platform data and cascade away with it. In production on
--    2026-10-02 this folds Skeetsters 337f07d6 (14 trades, all also in the
--    survivor) into 5f5691c4 (37 trades incl. 2025), losing nothing.
CREATE TABLE _league_merge (loser_id TEXT PRIMARY KEY, keeper_id TEXT NOT NULL);

INSERT INTO _league_merge (loser_id, keeper_id)
SELECT l.id,
       (SELECT k.id FROM leagues k
         WHERE k.platform IS l.platform AND k.external_id = l.external_id
         ORDER BY (SELECT count(*) FROM trades t WHERE t.league_id = k.id) DESC,
                  (SELECT count(*) FROM league_members m WHERE m.league_id = k.id) DESC,
                  k.created_at ASC,
                  k.id ASC
         LIMIT 1)
FROM leagues l
WHERE l.external_id IS NOT NULL;

DELETE FROM _league_merge WHERE loser_id = keeper_id;

INSERT OR IGNORE INTO league_members (id, user_id, league_id, role, external_username, joined_at)
SELECT lower(hex(randomblob(16))), m.user_id, lm.keeper_id, m.role, m.external_username, m.joined_at
FROM league_members m
JOIN _league_merge lm ON lm.loser_id = m.league_id
WHERE NOT EXISTS (
  SELECT 1 FROM league_members k
  WHERE k.league_id = lm.keeper_id AND k.user_id = m.user_id);

UPDATE league_members
SET role = 'commissioner'
WHERE role <> 'commissioner'
  AND EXISTS (
    SELECT 1 FROM league_members m
    JOIN _league_merge lm ON lm.loser_id = m.league_id
    WHERE lm.keeper_id = league_members.league_id
      AND m.user_id = league_members.user_id
      AND m.role = 'commissioner');

UPDATE league_members
SET external_username = (
    SELECT m.external_username FROM league_members m
    JOIN _league_merge lm ON lm.loser_id = m.league_id
    WHERE lm.keeper_id = league_members.league_id
      AND m.user_id = league_members.user_id
      AND m.external_username IS NOT NULL
    LIMIT 1)
WHERE external_username IS NULL
  AND league_id IN (SELECT keeper_id FROM _league_merge);

DELETE FROM leagues WHERE id IN (SELECT loser_id FROM _league_merge);

DROP TABLE _league_merge;

-- 3. Enforce both identities. Every sync path now creates rows through
--    services/teamIdentity.ts insertPlatformTeam (ON CONFLICT DO NOTHING), so
--    a concurrent or repeated sync can no longer produce a second row.
CREATE UNIQUE INDEX leagues_platform_external_unique
  ON leagues(platform, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX teams_league_external_team_unique
  ON teams(league_id, external_team_id)
  WHERE external_team_id IS NOT NULL;
