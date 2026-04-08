/**
 * Historical trade ingestion (Feature 3).
 *
 * Pulls executed trades from the Sleeper transactions API and idempotently
 * upserts them into the `trades` and `trade_items` tables. Also provides
 * `reconstructRosterAt(teamId, asOfTs)` which walks transactions backward
 * from the current roster to rebuild a team's players as of any date.
 *
 * Both helpers are pure DB/I-O — no AI calls, no valuation logic.
 */

import { eq, and, inArray, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const SLEEPER_BASE = 'https://api.sleeper.app/v1';

interface SleeperTransaction {
  type: string;
  status: string;
  transaction_id: string;
  created: number; // ms
  roster_ids: number[];
  adds?: Record<string, number> | null; // playerId -> rosterId
  drops?: Record<string, number> | null;
  draft_picks?: Array<{
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }>;
  leg?: number; // week
}

export interface IngestStats {
  fetched: number;
  trades: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  /** Detailed reason breakdown so missing trades can be diagnosed */
  skipReasons: Record<string, number>;
  /** Distinct Sleeper roster_ids that we couldn't map to a local team —
   *  if this is non-empty after a sync, some trades are being silently
   *  dropped because a roster has no corresponding team row. */
  unmappedRosterIds: number[];
}

function recordSkip(stats: IngestStats, reason: string) {
  stats.skipped++;
  stats.skipReasons[reason] = (stats.skipReasons[reason] ?? 0) + 1;
}

/**
 * Fetch transactions for a single Sleeper week with retries.
 */
async function fetchWeek(
  externalLeagueId: string,
  week: number
): Promise<SleeperTransaction[]> {
  const url = `${SLEEPER_BASE}/league/${externalLeagueId}/transactions/${week}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data as SleeperTransaction[];
  } catch (err) {
    console.error(`[tradeIngest] Failed to fetch week ${week}:`, err);
    return [];
  }
}

/**
 * Ingest all trades for a Sleeper league. Safe to call repeatedly — the
 * unique index on (league_id, source, external_id) guarantees idempotency.
 */
export async function ingestSleeperTrades(
  db: DB,
  leagueId: string
): Promise<IngestStats> {
  const stats: IngestStats = {
    fetched: 0,
    trades: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    skipReasons: {},
    unmappedRosterIds: [],
  };

  // 1. Load league, teams, and existing ingested trades
  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
  });
  if (!league || league.platform !== 'sleeper' || !league.externalId) {
    return stats;
  }

  const teams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });

  // Map Sleeper roster_id (1..N) -> our team.id. Sleeper transactions
  // reference roster_ids, not user_ids. Historically this has been the
  // #1 source of silently-dropped trades: if a team has null
  // externalOwnerId, or belongs to a co-managed/orphaned roster, or
  // was renamed after ingest, the mapping misses and we skip the
  // trade entirely.
  //
  // Robust strategy: build the mapping via MULTIPLE fallbacks and only
  // give up on a roster id if none of them hit.
  const rosterIdToTeamId = new Map<number, string>();
  const seenRosterIds: number[] = [];
  let sleeperRosters: Array<{
    roster_id: number;
    owner_id?: string | null;
    co_owners?: string[] | null;
    settings?: { team_name?: string } | null;
  }> = [];

  try {
    const rosterRes = await fetch(
      `${SLEEPER_BASE}/league/${league.externalId}/rosters`
    );
    if (rosterRes.ok) {
      sleeperRosters = (await rosterRes.json()) as typeof sleeperRosters;
    }
  } catch (err) {
    console.error('[tradeIngest] Failed to fetch rosters for mapping:', err);
  }

  // Also pull the users endpoint so we can fall back to team-name matches
  // for cases where the owner_id mapping is off (co-managers, orphan
  // teams adopted by a new Sleeper user, etc.).
  let sleeperUsers: Array<{
    user_id: string;
    display_name?: string;
    metadata?: { team_name?: string };
  }> = [];
  try {
    const usersRes = await fetch(
      `${SLEEPER_BASE}/league/${league.externalId}/users`
    );
    if (usersRes.ok) {
      sleeperUsers = (await usersRes.json()) as typeof sleeperUsers;
    }
  } catch (err) {
    console.error('[tradeIngest] Failed to fetch users for mapping:', err);
  }
  const userById = new Map(sleeperUsers.map((u) => [u.user_id, u]));

  const normalizeName = (name: string | null | undefined): string =>
    (name || '').trim().toLowerCase();
  const teamsByExternalOwnerId = new Map(
    teams
      .filter((t) => t.externalOwnerId)
      .map((t) => [t.externalOwnerId as string, t])
  );
  const teamsByName = new Map<string, typeof teams[number]>();
  for (const t of teams) {
    teamsByName.set(normalizeName(t.name), t);
  }

  for (const r of sleeperRosters) {
    seenRosterIds.push(r.roster_id);
    // 1. Primary: owner_id -> externalOwnerId match
    if (r.owner_id) {
      const team = teamsByExternalOwnerId.get(r.owner_id);
      if (team) {
        rosterIdToTeamId.set(r.roster_id, team.id);
        continue;
      }
    }
    // 2. Fallback: co-owners
    if (r.co_owners && r.co_owners.length > 0) {
      let matched = false;
      for (const coId of r.co_owners) {
        const team = teamsByExternalOwnerId.get(coId);
        if (team) {
          rosterIdToTeamId.set(r.roster_id, team.id);
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }
    // 3. Fallback: match by Sleeper team name or display name
    const sleeperTeamName =
      r.settings?.team_name ||
      (r.owner_id ? userById.get(r.owner_id)?.metadata?.team_name : undefined) ||
      (r.owner_id ? userById.get(r.owner_id)?.display_name : undefined);
    if (sleeperTeamName) {
      const byName = teamsByName.get(normalizeName(sleeperTeamName));
      if (byName) {
        rosterIdToTeamId.set(r.roster_id, byName.id);
        continue;
      }
    }
    // 4. Give up for this roster — record it so the caller can see
    //    which specific roster was unmapped.
    stats.unmappedRosterIds.push(r.roster_id);
  }

  if (rosterIdToTeamId.size === 0) {
    console.warn(
      `[tradeIngest] No rosters could be mapped for league ${leagueId} — ` +
        `all trades will be skipped. seenRosterIds=${seenRosterIds.join(',')}`
    );
    return stats;
  }

  if (stats.unmappedRosterIds.length > 0) {
    console.warn(
      `[tradeIngest] ${stats.unmappedRosterIds.length} roster(s) could not be ` +
        `mapped for league ${leagueId}: ${stats.unmappedRosterIds.join(',')}. ` +
        `Trades involving these rosters will be skipped.`
    );
  }

  // Pre-fetch existing trades for this league+source to enable updates
  const existing = await db.query.trades.findMany({
    where: and(
      eq(schema.trades.leagueId, leagueId),
      eq(schema.trades.source, 'sleeper')
    ),
  });
  const existingByExtId = new Map(
    existing
      .filter((t) => t.externalId != null)
      .map((t) => [t.externalId as string, t])
  );

  // 2. Fetch all weeks 1-18 unconditionally.
  //
  // We used to cap at (currentWeek + 1) which meant that a mid-season
  // sync would never see trades from weeks after the current one (rare
  // but possible if a bulk ingest ran late) AND — more importantly —
  // a sync against an ARCHIVED past season (where currentWeek is stale
  // or reset to 1) would silently skip half the year. Sleeper's
  // /transactions/:week endpoint is cheap; just fetch everything.
  const maxWeek = 18;

  // Fetch in parallel but throttled
  const weeksToFetch = Array.from({ length: maxWeek }, (_, i) => i + 1);
  const allTx: Array<{ tx: SleeperTransaction; week: number }> = [];
  const CHUNK = 5;
  for (let i = 0; i < weeksToFetch.length; i += CHUNK) {
    const chunk = weeksToFetch.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map((w) => fetchWeek(league.externalId!, w)));
    results.forEach((txs, j) => {
      const week = chunk[j];
      for (const tx of txs) {
        allTx.push({ tx, week });
      }
    });
  }

  stats.fetched = allTx.length;

  // 3. Filter to completed trades
  const tradeTxs = allTx.filter(
    ({ tx }) => tx.type === 'trade' && tx.status === 'complete'
  );
  stats.trades = tradeTxs.length;

  if (tradeTxs.length === 0) return stats;

  // 4. Resolve player IDs. Collect all external player ids from adds+drops.
  const allExternalPlayerIds = new Set<string>();
  for (const { tx } of tradeTxs) {
    if (tx.adds) for (const pid of Object.keys(tx.adds)) allExternalPlayerIds.add(pid);
    if (tx.drops) for (const pid of Object.keys(tx.drops)) allExternalPlayerIds.add(pid);
  }

  const externalIdArray = Array.from(allExternalPlayerIds);
  const externalIdToPlayerId = new Map<string, string>();
  if (externalIdArray.length > 0) {
    for (let i = 0; i < externalIdArray.length; i += 50) {
      const chunk = externalIdArray.slice(i, i + 50);
      const found = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.externalId, chunk),
        columns: { id: true, externalId: true },
      });
      for (const p of found) {
        if (p.externalId) externalIdToPlayerId.set(p.externalId, p.id);
      }
    }
  }

  // 5. Upsert each trade
  for (const { tx, week } of tradeTxs) {
    try {
      // A Sleeper trade has a single `adds` map (player_id -> roster_id that RECEIVED them)
      // and `drops` (player_id -> roster_id that SENT them). We derive pairs from `adds`.
      const fromRosterIds = new Set<number>();
      const toRosterIds = new Set<number>();
      const items: Array<{
        playerId: string | null;
        fromTeamId: string;
        toTeamId: string;
        draftPickYear: number | null;
        draftPickRound: number | null;
      }> = [];

      // Track whether we encountered mapping misses inside THIS trade
      // so the skip reason is accurate ("some items failed to map"
      // vs "trade had no items to begin with").
      let sawMappingMiss = false;

      if (tx.adds) {
        for (const [sleeperPlayerId, toRosterId] of Object.entries(tx.adds)) {
          // Find the corresponding drop (who sent them)
          const fromRosterId = tx.drops?.[sleeperPlayerId];
          if (fromRosterId == null) continue;
          const fromTeamId = rosterIdToTeamId.get(fromRosterId);
          const toTeamId = rosterIdToTeamId.get(toRosterId);
          if (!fromTeamId || !toTeamId) {
            sawMappingMiss = true;
            continue;
          }
          fromRosterIds.add(fromRosterId);
          toRosterIds.add(toRosterId);
          items.push({
            playerId: externalIdToPlayerId.get(sleeperPlayerId) || null,
            fromTeamId,
            toTeamId,
            draftPickYear: null,
            draftPickRound: null,
          });
        }
      }

      if (tx.draft_picks) {
        for (const pick of tx.draft_picks) {
          const fromTeamId = rosterIdToTeamId.get(pick.previous_owner_id);
          const toTeamId = rosterIdToTeamId.get(pick.owner_id);
          if (!fromTeamId || !toTeamId) {
            sawMappingMiss = true;
            continue;
          }
          items.push({
            playerId: null,
            fromTeamId,
            toTeamId,
            draftPickYear: parseInt(pick.season, 10) || null,
            draftPickRound: pick.round,
          });
        }
      }

      if (items.length === 0) {
        if (sawMappingMiss) {
          recordSkip(stats, 'unmapped_roster_ids');
          console.warn(
            `[tradeIngest] Skipping trade ${tx.transaction_id} (week ${week}): ` +
              `all items reference roster_ids with no team mapping.`
          );
        } else if (
          (!tx.adds || Object.keys(tx.adds).length === 0) &&
          (!tx.draft_picks || tx.draft_picks.length === 0)
        ) {
          recordSkip(stats, 'empty_trade_payload');
        } else {
          recordSkip(stats, 'items_empty_unknown');
        }
        continue;
      }

      // For the proposing/receiving team fields, pick the first pair of
      // distinct teams from items.
      const teamPairs = [
        ...new Set(
          items.flatMap((i) => [i.fromTeamId, i.toTeamId])
        ),
      ];
      const proposingTeamId = teamPairs[0];
      const receivingTeamId = teamPairs[1] || teamPairs[0];

      const executedAtDate = new Date(tx.created);
      const existingTrade = existingByExtId.get(tx.transaction_id);

      if (existingTrade) {
        // Update lightweight fields only (don't nuke AI grade)
        await db
          .update(schema.trades)
          .set({
            executedAt: executedAtDate,
            weekExecuted: week,
            seasonYear: league.seasonYear,
            status: 'executed',
          })
          .where(eq(schema.trades.id, existingTrade.id));
        stats.updated++;
      } else {
        const tradeId = crypto.randomUUID();
        await db.insert(schema.trades).values({
          id: tradeId,
          leagueId,
          proposingTeamId,
          receivingTeamId,
          status: 'executed',
          source: 'sleeper',
          externalId: tx.transaction_id,
          executedAt: executedAtDate,
          seasonYear: league.seasonYear,
          weekExecuted: week,
        });

        // Insert items in a batch
        for (const item of items) {
          await db.insert(schema.tradeItems).values({
            id: crypto.randomUUID(),
            tradeId,
            fromTeamId: item.fromTeamId,
            toTeamId: item.toTeamId,
            playerId: item.playerId,
            draftPickYear: item.draftPickYear,
            draftPickRound: item.draftPickRound,
          });
        }
        stats.inserted++;
      }
    } catch (err) {
      console.error('[tradeIngest] Failed to upsert trade:', err);
      stats.errors++;
    }
  }

  return stats;
}

// ── Roster Reconstruction ────────────────────────────────────────────

export interface ReconstructedRoster {
  teamId: string;
  asOf: string; // ISO
  playerIds: string[];
  includedTradeCount: number;
}

/**
 * Rebuild a team's roster as of a given timestamp by taking the current
 * roster and walking trade history BACKWARD. For every trade executed AFTER
 * asOf where this team was involved, we undo it: add back players this team
 * SENT in that trade, and remove players this team RECEIVED.
 *
 * This only accounts for trades — not waivers/adds/drops — which is
 * sufficient for retroactive trade grading since we're asking "what was
 * their roster when they made this trade".
 */
export async function reconstructRosterAt(
  db: DB,
  teamId: string,
  asOf: Date
): Promise<ReconstructedRoster> {
  // Current roster
  const currentRoster = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, teamId),
    columns: { playerId: true },
  });
  const playerIds = new Set(currentRoster.map((r) => r.playerId));

  // All trades involving this team executed AFTER asOf
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });
  if (!team) {
    return { teamId, asOf: asOf.toISOString(), playerIds: [], includedTradeCount: 0 };
  }

  const laterTrades = await db.query.trades.findMany({
    where: and(
      eq(schema.trades.leagueId, team.leagueId),
      gt(schema.trades.executedAt, asOf)
    ),
  });

  let includedTradeCount = 0;
  for (const t of laterTrades) {
    const items = await db.query.tradeItems.findMany({
      where: eq(schema.tradeItems.tradeId, t.id),
    });

    let touched = false;
    for (const item of items) {
      if (!item.playerId) continue;
      if (item.toTeamId === teamId) {
        // Team received this player AFTER asOf — they didn't have them yet
        playerIds.delete(item.playerId);
        touched = true;
      } else if (item.fromTeamId === teamId) {
        // Team sent this player AFTER asOf — they still had them
        playerIds.add(item.playerId);
        touched = true;
      }
    }
    if (touched) includedTradeCount++;
  }

  return {
    teamId,
    asOf: asOf.toISOString(),
    playerIds: Array.from(playerIds),
    includedTradeCount,
  };
}
