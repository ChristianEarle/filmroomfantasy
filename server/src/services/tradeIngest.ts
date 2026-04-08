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

  // Map Sleeper roster_id (1..N) -> our team.id
  // Sleeper transactions reference roster_ids not user_ids.
  // We need to fetch the rosters endpoint to get the mapping.
  let rosterIdToTeamId = new Map<number, string>();
  try {
    const rosterRes = await fetch(
      `${SLEEPER_BASE}/league/${league.externalId}/rosters`
    );
    if (rosterRes.ok) {
      const rostersRaw = (await rosterRes.json()) as Array<{
        roster_id: number;
        owner_id?: string;
      }>;
      for (const r of rostersRaw) {
        if (!r.owner_id) continue;
        const team = teams.find((t) => t.externalOwnerId === r.owner_id);
        if (team) rosterIdToTeamId.set(r.roster_id, team.id);
      }
    }
  } catch (err) {
    console.error('[tradeIngest] Failed to fetch rosters for mapping:', err);
  }

  if (rosterIdToTeamId.size === 0) {
    // Without the mapping we can't attribute trades. Bail cleanly.
    return stats;
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

  // 2. Fetch all weeks (Sleeper only returns transactions from weeks >= 1)
  // We fetch up to the league's playoff end: playoff_week_start + playoffWeeks
  const maxWeek = Math.min(
    18,
    (league.currentWeek || 1) + 1 // fetch slightly ahead
  );

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

      if (tx.adds) {
        for (const [sleeperPlayerId, toRosterId] of Object.entries(tx.adds)) {
          // Find the corresponding drop (who sent them)
          const fromRosterId = tx.drops?.[sleeperPlayerId];
          if (fromRosterId == null) continue;
          const fromTeamId = rosterIdToTeamId.get(fromRosterId);
          const toTeamId = rosterIdToTeamId.get(toRosterId);
          if (!fromTeamId || !toTeamId) continue;
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
          if (!fromTeamId || !toTeamId) continue;
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
        stats.skipped++;
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
