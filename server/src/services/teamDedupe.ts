/**
 * Duplicate team-row repair for synced leagues.
 *
 * A Sleeper roster is identified by its owner's Sleeper `user_id`, stored on
 * `teams.externalOwnerId`. Historically the sync could end up with two rows
 * for the same owner in the same league: the "acting user's team" lookup
 * matched on the app-level `teams.ownerId` before the Sleeper id, so when
 * two app accounts resolved to one Sleeper user (or placeholder ownership
 * stamped opponents' rows with the sync runner) it could claim the wrong row
 * and strand the original. The stranded row kept last season's record,
 * while this season's record, roster and matchups were split between the
 * two — the League Analyzer then ranked the ghost (8-6, ~1,900 points) as
 * the strongest team in a league three games old.
 *
 * `mergeDuplicateTeams` folds every duplicate group in a league into one
 * row: the most recently synced row survives, everything that references
 * the others (matchups, transactions, trades, draft picks) is repointed at
 * it, and the stale rows are deleted (roster_spots, draft picks and AI
 * narratives cascade). It runs at the start of every Sleeper sync so the
 * data self-heals, and is safe to call on a clean league (no-op).
 */

import { eq, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
type TeamRow = typeof schema.teams.$inferSelect;

export interface MergedGroup {
  externalOwnerId: string;
  keptTeamId: string;
  removedTeamIds: string[];
}

export interface MergeDuplicateTeamsResult {
  merged: MergedGroup[];
  /** Every team id that no longer exists after the merge. */
  removedTeamIds: Set<string>;
}

/**
 * The survivor of a duplicate group: the row the sync most recently wrote
 * to, since that is the one carrying this season's record and roster. Ties
 * fall to the oldest row so the choice is deterministic.
 */
export function pickKeeperTeam<T extends Pick<TeamRow, 'id' | 'updatedAt' | 'createdAt'>>(rows: T[]): T {
  if (rows.length === 0) throw new Error('pickKeeperTeam: empty group');
  return [...rows].sort((a, b) => {
    const byUpdated = toMs(b.updatedAt) - toMs(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    const byCreated = toMs(a.createdAt) - toMs(b.createdAt);
    if (byCreated !== 0) return byCreated;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

function toMs(d: Date | number | null | undefined): number {
  if (d instanceof Date) return d.getTime();
  return typeof d === 'number' ? d : 0;
}

/** Group a league's teams by Sleeper owner; only groups with 2+ rows are returned. */
export function findDuplicateTeamGroups<T extends Pick<TeamRow, 'externalOwnerId'>>(teams: T[]): Map<string, T[]> {
  const byOwner = new Map<string, T[]>();
  for (const t of teams) {
    if (!t.externalOwnerId) continue;
    const list = byOwner.get(t.externalOwnerId) || [];
    list.push(t);
    byOwner.set(t.externalOwnerId, list);
  }
  for (const [owner, rows] of byOwner) {
    if (rows.length < 2) byOwner.delete(owner);
  }
  return byOwner;
}

export async function mergeDuplicateTeams(db: DB, leagueId: string): Promise<MergeDuplicateTeamsResult> {
  const teams = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
  const groups = findDuplicateTeamGroups(teams);
  const result: MergeDuplicateTeamsResult = { merged: [], removedTeamIds: new Set() };
  if (groups.size === 0) return result;

  const matchups = await db.query.matchups.findMany({
    where: eq(schema.matchups.leagueId, leagueId),
    columns: { id: true, week: true, homeTeamId: true, awayTeamId: true },
  });

  for (const [externalOwnerId, rows] of groups) {
    const keeper = pickKeeperTeam(rows);
    const losers = rows.filter((r) => r.id !== keeper.id);
    const loserIds = losers.map((l) => l.id);
    const loserIdSet = new Set(loserIds);

    // ── Matchups ─────────────────────────────────────────────────────────
    // (league, week, home_team_id) is unique, so a loser's home game can
    // only move to the keeper when the keeper has no home game that week;
    // otherwise the loser's row is the stale duplicate and is dropped. A
    // pairing that would leave the keeper playing itself is dropped too.
    const keeperHomeWeeks = new Set(
      matchups.filter((m) => m.homeTeamId === keeper.id).map((m) => m.week),
    );
    const matchupDeletes: string[] = [];
    for (const m of matchups) {
      const homeIsLoser = loserIdSet.has(m.homeTeamId);
      const awayIsLoser = loserIdSet.has(m.awayTeamId);
      if (!homeIsLoser && !awayIsLoser) continue;

      const newHome = homeIsLoser ? keeper.id : m.homeTeamId;
      const newAway = awayIsLoser ? keeper.id : m.awayTeamId;
      if (newHome === newAway || (homeIsLoser && keeperHomeWeeks.has(m.week))) {
        matchupDeletes.push(m.id);
        continue;
      }
      await db
        .update(schema.matchups)
        .set({ homeTeamId: newHome, awayTeamId: newAway })
        .where(eq(schema.matchups.id, m.id));
      if (homeIsLoser) keeperHomeWeeks.add(m.week);
      m.homeTeamId = newHome;
      m.awayTeamId = newAway;
    }
    for (let i = 0; i < matchupDeletes.length; i += 50) {
      await db.delete(schema.matchups).where(inArray(schema.matchups.id, matchupDeletes.slice(i, i + 50)));
    }

    // ── Transactions / trades: plain repoints, no uniqueness involved ─────
    await db.update(schema.transactions).set({ addTeamId: keeper.id }).where(inArray(schema.transactions.addTeamId, loserIds));
    await db.update(schema.transactions).set({ dropTeamId: keeper.id }).where(inArray(schema.transactions.dropTeamId, loserIds));
    await db.update(schema.trades).set({ proposingTeamId: keeper.id }).where(inArray(schema.trades.proposingTeamId, loserIds));
    await db.update(schema.trades).set({ receivingTeamId: keeper.id }).where(inArray(schema.trades.receivingTeamId, loserIds));
    await db.update(schema.tradeItems).set({ fromTeamId: keeper.id }).where(inArray(schema.tradeItems.fromTeamId, loserIds));
    await db.update(schema.tradeItems).set({ toTeamId: keeper.id }).where(inArray(schema.tradeItems.toTeamId, loserIds));

    // ── Draft picks ───────────────────────────────────────────────────────
    // ownerId has no uniqueness; originalOwnerId is part of the pick identity
    // (league, year, round, original owner), so a loser's pick moves only
    // when the keeper does not already have that identity — otherwise the
    // loser's copy is the duplicate and cascades away with the row.
    await db.update(schema.teamDraftPicks).set({ ownerId: keeper.id }).where(inArray(schema.teamDraftPicks.ownerId, loserIds));
    const keeperPicks = await db.query.teamDraftPicks.findMany({
      where: eq(schema.teamDraftPicks.originalOwnerId, keeper.id),
      columns: { draftYear: true, draftRound: true },
    });
    const keeperIdentities = new Set(keeperPicks.map((p) => `${p.draftYear}:${p.draftRound}`));
    const loserPicks = await db.query.teamDraftPicks.findMany({
      where: inArray(schema.teamDraftPicks.originalOwnerId, loserIds),
      columns: { id: true, draftYear: true, draftRound: true },
    });
    for (const p of loserPicks) {
      const identity = `${p.draftYear}:${p.draftRound}`;
      if (keeperIdentities.has(identity)) continue;
      await db.update(schema.teamDraftPicks).set({ originalOwnerId: keeper.id }).where(eq(schema.teamDraftPicks.id, p.id));
      keeperIdentities.add(identity);
    }

    // ── Remove the stale rows (roster_spots, remaining picks, narratives cascade)
    await db.delete(schema.teams).where(inArray(schema.teams.id, loserIds));

    console.log(
      `[team dedupe] league ${leagueId}: merged ${loserIds.length} duplicate row(s) for Sleeper owner ${externalOwnerId} into team ${keeper.id} (removed ${loserIds.join(', ')})`,
    );
    result.merged.push({ externalOwnerId, keptTeamId: keeper.id, removedTeamIds: loserIds });
    for (const id of loserIds) result.removedTeamIds.add(id);
  }

  return result;
}

/**
 * Which existing row is the acting user's own team. Exported for unit tests.
 *
 * Match on the Sleeper id first — it is the roster's real identity. App-level
 * ownership (`teams.ownerId`) is only trusted for a row that has never been
 * linked to a Sleeper roster (a manually created, pre-sync team): linked rows
 * owned by the acting user may be opponents' placeholder-owned rows, and
 * claiming one of those is exactly how duplicate rows were created.
 */
export function resolveActingUserTeam<T extends Pick<TeamRow, 'id' | 'ownerId' | 'externalOwnerId'>>(
  teams: T[],
  actingUserId: string | null | undefined,
  actingUserSleeperId: string | null | undefined,
): T | undefined {
  if (!actingUserId) return undefined;
  if (actingUserSleeperId) {
    const linked = teams.find((t) => t.externalOwnerId === actingUserSleeperId);
    if (linked) return linked;
  }
  return teams.find((t) => t.ownerId === actingUserId && !t.externalOwnerId);
}
