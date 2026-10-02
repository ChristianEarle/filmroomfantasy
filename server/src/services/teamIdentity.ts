/**
 * Team identity for synced (Sleeper / ESPN / Yahoo / MFL) leagues.
 *
 * The rule: one platform team = one `teams` row, keyed on
 * `teams.external_team_id` (Sleeper roster_id, ESPN team id, Yahoo team id,
 * MFL franchise id) and enforced by the unique index
 * `teams_league_external_team_unique` (migration 0050).
 *
 * Why this exists. Before 0050 nothing in the database said two rows were
 * the same team, and each platform sync decided identity on its own:
 *   - Sleeper rows were keyed on the manager's Sleeper user id, which
 *     changes when a roster changes hands and aliases when two app accounts
 *     resolve to one Sleeper user. Either way a second row appeared and the
 *     first was stranded with an old record and roster.
 *   - Connecting or joining an imported league created an unlinked
 *     placeholder row. A sync with no acting user (the cron) never claimed
 *     it, so the league ended up with one team too many.
 * Every league-wide view (League Analyzer, standings, power rankings,
 * playoff odds) then counted the ghosts. On 2026-10-02 eleven production
 * leagues had an extra placeholder team and Skeetsters had three stranded
 * 2025 rows ranked as its strongest teams.
 *
 * Every platform sync now calls `reconcileLeagueTeams` once with the full
 * list of platform teams before writing rows, and creates rows only through
 * `insertPlatformTeam`. Reconcile maps each existing row to at most one
 * platform team, merges rows that map to the same one, stamps the platform
 * key on the survivor, and deletes unreferenced rows that map to nothing.
 */

import { and, eq, inArray, or } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;
export type TeamRow = typeof schema.teams.$inferSelect;
type NewTeam = typeof schema.teams.$inferInsert;

/** One team as the platform reports it. */
export interface PlatformTeam {
  /** The platform's stable team key (Sleeper roster_id, ESPN/Yahoo team id, MFL franchise id). */
  externalTeamId: string;
  /**
   * The value legacy rows stored in `external_owner_id` for this team: the
   * current manager's Sleeper user id for Sleeper, the team id itself for
   * ESPN/Yahoo/MFL. Used once, to adopt rows written before 0050.
   */
  legacyOwnerKey: string | null;
  /** App user this team belongs to, when known. Lets the team claim that user's unlinked placeholder row. */
  appUserId?: string | null;
}

export interface MergedGroup {
  externalTeamId: string;
  keptTeamId: string;
  removedTeamIds: string[];
}

export interface ReconcileResult {
  /** The surviving row for every platform team that already had one, with `externalTeamId` stamped. */
  teamsByExternalTeamId: Map<string, TeamRow>;
  merged: MergedGroup[];
  /** Rows matching no platform team and referenced by nothing, now deleted. */
  pruned: string[];
  /** Rows matching no platform team but referenced by history (trades, matchups…), left in place. */
  keptOrphans: string[];
}

// ── Pure decisions (unit tested) ──────────────────────────────────────────

/**
 * Assign each existing row to at most one platform team.
 *   1. `external_team_id` equals the platform key.
 *   2. A row with no platform key whose `external_owner_id` equals the
 *      platform team's legacy key (rows written before 0050).
 *   3. An unlinked placeholder (no keys at all) owned by the app user the
 *      platform team belongs to.
 * Rows matching nothing are returned as orphans.
 */
export function assignRowsToPlatformTeams<T extends Pick<TeamRow, 'id' | 'ownerId' | 'externalOwnerId' | 'externalTeamId'>>(
  rows: T[],
  platformTeams: PlatformTeam[],
): { groups: Map<string, T[]>; orphans: T[] } {
  const byTeamId = new Map(platformTeams.map((p) => [p.externalTeamId, p]));
  const byLegacyKey = new Map<string, PlatformTeam>();
  const byAppUser = new Map<string, PlatformTeam>();
  for (const p of platformTeams) {
    if (p.legacyOwnerKey && !byLegacyKey.has(p.legacyOwnerKey)) byLegacyKey.set(p.legacyOwnerKey, p);
    if (p.appUserId && !byAppUser.has(p.appUserId)) byAppUser.set(p.appUserId, p);
  }

  const groups = new Map<string, T[]>();
  const orphans: T[] = [];
  const add = (key: string, row: T) => {
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  };

  for (const row of rows) {
    if (row.externalTeamId) {
      if (byTeamId.has(row.externalTeamId)) add(row.externalTeamId, row);
      else orphans.push(row);
      continue;
    }
    if (row.externalOwnerId) {
      const p = byLegacyKey.get(row.externalOwnerId);
      if (p) add(p.externalTeamId, row);
      else orphans.push(row);
      continue;
    }
    const p = byAppUser.get(row.ownerId);
    if (p) add(p.externalTeamId, row);
    else orphans.push(row);
  }
  return { groups, orphans };
}

/**
 * The survivor of rows mapped to one platform team: the row already carrying
 * the platform key, then a linked row over an unlinked placeholder, then the
 * most recently synced, then the oldest, then by id so the choice is stable.
 * Losing rows' references are repointed and the sync rewrites the survivor's
 * record and roster right after, so no team data is lost either way.
 */
export function pickKeeperTeam<T extends Pick<TeamRow, 'id' | 'externalTeamId' | 'externalOwnerId' | 'updatedAt' | 'createdAt'>>(
  rows: T[],
  externalTeamId?: string,
): T {
  if (rows.length === 0) throw new Error('pickKeeperTeam: empty group');
  const rank = (r: T) => (externalTeamId && r.externalTeamId === externalTeamId ? 2 : r.externalOwnerId ? 1 : 0);
  return [...rows].sort((a, b) => {
    const byRank = rank(b) - rank(a);
    if (byRank !== 0) return byRank;
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

// ── Database operations ───────────────────────────────────────────────────

/**
 * Fold `loserIds` into `keeperId`: repoint every reference, then delete the
 * losers (roster spots, leftover draft picks and AI narratives cascade).
 * Respects the two uniqueness rules a blind repoint would break:
 * `matchup_unique (league, week, home_team_id)` and the draft-pick identity
 * `(league, year, round, original_owner_id)` — where the keeper already has
 * the row, the loser's copy is the duplicate and is dropped.
 */
export async function mergeTeamsInto(db: DB, leagueId: string, keeperId: string, loserIds: string[]): Promise<void> {
  if (loserIds.length === 0) return;
  const losers = new Set(loserIds);

  // Matchups.
  const matchups = await db.query.matchups.findMany({
    where: and(
      eq(schema.matchups.leagueId, leagueId),
      or(
        inArray(schema.matchups.homeTeamId, [keeperId, ...loserIds]),
        inArray(schema.matchups.awayTeamId, [keeperId, ...loserIds]),
      ),
    ),
    columns: { id: true, week: true, homeTeamId: true, awayTeamId: true },
  });
  const keeperHomeWeeks = new Set(matchups.filter((m) => m.homeTeamId === keeperId).map((m) => m.week));
  const drop: string[] = [];
  for (const m of matchups) {
    const homeIsLoser = losers.has(m.homeTeamId);
    const awayIsLoser = losers.has(m.awayTeamId);
    if (!homeIsLoser && !awayIsLoser) continue;
    const home = homeIsLoser ? keeperId : m.homeTeamId;
    const away = awayIsLoser ? keeperId : m.awayTeamId;
    if (home === away || (homeIsLoser && keeperHomeWeeks.has(m.week))) {
      drop.push(m.id);
      continue;
    }
    await db.update(schema.matchups).set({ homeTeamId: home, awayTeamId: away }).where(eq(schema.matchups.id, m.id));
    if (homeIsLoser) keeperHomeWeeks.add(m.week);
  }
  for (let i = 0; i < drop.length; i += 50) {
    await db.delete(schema.matchups).where(inArray(schema.matchups.id, drop.slice(i, i + 50)));
  }

  // Plain repoints: no uniqueness involved.
  await db.update(schema.transactions).set({ addTeamId: keeperId }).where(inArray(schema.transactions.addTeamId, loserIds));
  await db.update(schema.transactions).set({ dropTeamId: keeperId }).where(inArray(schema.transactions.dropTeamId, loserIds));
  await db.update(schema.trades).set({ proposingTeamId: keeperId }).where(inArray(schema.trades.proposingTeamId, loserIds));
  await db.update(schema.trades).set({ receivingTeamId: keeperId }).where(inArray(schema.trades.receivingTeamId, loserIds));
  await db.update(schema.tradeItems).set({ fromTeamId: keeperId }).where(inArray(schema.tradeItems.fromTeamId, loserIds));
  await db.update(schema.tradeItems).set({ toTeamId: keeperId }).where(inArray(schema.tradeItems.toTeamId, loserIds));

  // Draft picks: current owner is a plain repoint; the original owner is part of the pick identity.
  await db.update(schema.teamDraftPicks).set({ ownerId: keeperId }).where(inArray(schema.teamDraftPicks.ownerId, loserIds));
  const keeperPicks = await db.query.teamDraftPicks.findMany({
    where: eq(schema.teamDraftPicks.originalOwnerId, keeperId),
    columns: { draftYear: true, draftRound: true },
  });
  const held = new Set(keeperPicks.map((p) => `${p.draftYear}:${p.draftRound}`));
  const loserPicks = await db.query.teamDraftPicks.findMany({
    where: inArray(schema.teamDraftPicks.originalOwnerId, loserIds),
    columns: { id: true, draftYear: true, draftRound: true },
  });
  for (const p of loserPicks) {
    const key = `${p.draftYear}:${p.draftRound}`;
    if (held.has(key)) continue;
    await db.update(schema.teamDraftPicks).set({ originalOwnerId: keeperId }).where(eq(schema.teamDraftPicks.id, p.id));
    held.add(key);
  }

  await db.delete(schema.teams).where(inArray(schema.teams.id, loserIds));
}

/** Teams in `teamIds` that some history row still points at (roster spots and narratives don't count: they cascade). */
async function referencedTeamIds(db: DB, leagueId: string, teamIds: string[]): Promise<Set<string>> {
  const refs = new Set<string>();
  if (teamIds.length === 0) return refs;
  const ids = new Set(teamIds);
  const note = (...vals: (string | null | undefined)[]) => {
    for (const v of vals) if (v && ids.has(v)) refs.add(v);
  };

  const [matchups, transactions, trades, picks] = await Promise.all([
    db.query.matchups.findMany({
      where: and(eq(schema.matchups.leagueId, leagueId), or(inArray(schema.matchups.homeTeamId, teamIds), inArray(schema.matchups.awayTeamId, teamIds))),
      columns: { homeTeamId: true, awayTeamId: true },
    }),
    db.query.transactions.findMany({
      where: and(eq(schema.transactions.leagueId, leagueId), or(inArray(schema.transactions.addTeamId, teamIds), inArray(schema.transactions.dropTeamId, teamIds))),
      columns: { addTeamId: true, dropTeamId: true },
    }),
    db.query.trades.findMany({
      where: and(eq(schema.trades.leagueId, leagueId), or(inArray(schema.trades.proposingTeamId, teamIds), inArray(schema.trades.receivingTeamId, teamIds))),
      columns: { proposingTeamId: true, receivingTeamId: true },
    }),
    db.query.teamDraftPicks.findMany({
      where: and(eq(schema.teamDraftPicks.leagueId, leagueId), or(inArray(schema.teamDraftPicks.ownerId, teamIds), inArray(schema.teamDraftPicks.originalOwnerId, teamIds))),
      columns: { ownerId: true, originalOwnerId: true },
    }),
  ]);
  for (const m of matchups) note(m.homeTeamId, m.awayTeamId);
  for (const t of transactions) note(t.addTeamId, t.dropTeamId);
  for (const t of trades) note(t.proposingTeamId, t.receivingTeamId);
  for (const p of picks) note(p.ownerId, p.originalOwnerId);

  // trade_items has no league column; only check what's still unreferenced.
  const unknown = teamIds.filter((id) => !refs.has(id));
  if (unknown.length > 0) {
    const items = await db.query.tradeItems.findMany({
      where: or(inArray(schema.tradeItems.fromTeamId, unknown), inArray(schema.tradeItems.toTeamId, unknown)),
      columns: { fromTeamId: true, toTeamId: true },
    });
    for (const i of items) note(i.fromTeamId, i.toTeamId);
  }
  return refs;
}

/**
 * Make the league's rows agree with the platform's team list. Call once per
 * sync, after fetching the platform's teams and before writing any team row.
 * Does nothing to orphans when `platformTeams` is empty (a failed or partial
 * fetch must never read as "every team left the league").
 */
export async function reconcileLeagueTeams(db: DB, leagueId: string, platformTeams: PlatformTeam[]): Promise<ReconcileResult> {
  const result: ReconcileResult = { teamsByExternalTeamId: new Map(), merged: [], pruned: [], keptOrphans: [] };
  const rows = await db.query.teams.findMany({ where: eq(schema.teams.leagueId, leagueId) });
  const { groups, orphans } = assignRowsToPlatformTeams(rows, platformTeams);

  for (const [externalTeamId, group] of groups) {
    const keeper = pickKeeperTeam(group, externalTeamId);
    const loserIds = group.filter((r) => r.id !== keeper.id).map((r) => r.id);
    if (loserIds.length > 0) {
      await mergeTeamsInto(db, leagueId, keeper.id, loserIds);
      result.merged.push({ externalTeamId, keptTeamId: keeper.id, removedTeamIds: loserIds });
      console.log(`[team identity] league ${leagueId}: merged ${loserIds.join(', ')} into ${keeper.id} (platform team ${externalTeamId})`);
    }
    if (keeper.externalTeamId !== externalTeamId) {
      await db.update(schema.teams).set({ externalTeamId }).where(eq(schema.teams.id, keeper.id));
    }
    result.teamsByExternalTeamId.set(externalTeamId, { ...keeper, externalTeamId });
  }

  if (platformTeams.length > 0 && orphans.length > 0) {
    const orphanIds = orphans.map((o) => o.id);
    const referenced = await referencedTeamIds(db, leagueId, orphanIds);
    const prune = orphanIds.filter((id) => !referenced.has(id));
    for (let i = 0; i < prune.length; i += 50) {
      await db.delete(schema.teams).where(inArray(schema.teams.id, prune.slice(i, i + 50)));
    }
    result.pruned = prune;
    result.keptOrphans = orphanIds.filter((id) => referenced.has(id));
    if (prune.length > 0) console.log(`[team identity] league ${leagueId}: pruned ${prune.length} team row(s) matching no platform team: ${prune.join(', ')}`);
    if (result.keptOrphans.length > 0) console.warn(`[team identity] league ${leagueId}: ${result.keptOrphans.length} team row(s) match no platform team but have history, kept: ${result.keptOrphans.join(', ')}`);
  }

  return result;
}

/**
 * Create the row for a platform team that has none. Idempotent under
 * concurrent syncs: a second insert for the same (league, external_team_id)
 * is a no-op and both callers get the one row's id.
 */
export async function insertPlatformTeam(db: DB, values: NewTeam & { externalTeamId: string }): Promise<string> {
  await db.insert(schema.teams).values(values).onConflictDoNothing();
  const row = await db.query.teams.findFirst({
    where: and(eq(schema.teams.leagueId, values.leagueId), eq(schema.teams.externalTeamId, values.externalTeamId)),
    columns: { id: true },
  });
  if (!row) throw new Error(`insertPlatformTeam: no row for league ${values.leagueId} team ${values.externalTeamId} after insert`);
  return row.id;
}
