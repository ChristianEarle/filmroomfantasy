/**
 * Trade outcomes (Feature 3) — pure SQL + arithmetic, no AI.
 *
 * `computeOutcome(tradeId)` sums weekly fantasy points scored by players
 * SENT vs RECEIVED by each side of a trade, starting at the week after the
 * trade was executed. The result is a points differential that tells you
 * (without any judgment calls) whether the trade "worked out" so far.
 *
 * `computeRecordImpact(leagueId, userTeamId)` rebuilds each weekly matchup
 * with the user's hypothetical "never traded" starting lineup and compares
 * to the actual historical result. Returns a week-by-week delta + a
 * summary record (e.g. "flipped 2 losses into wins").
 */

import { eq, and, gte, inArray, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { reconstructRosterAt } from './tradeIngest';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export interface PlayerSideOutcome {
  playerId: string;
  playerName: string;
  position: string;
  weeklyPoints: Array<{ week: number; points: number }>;
  totalPoints: number;
}

export interface TradeOutcome {
  tradeId: string;
  executedAt: string | null;
  weekExecuted: number | null;
  sides: Array<{
    teamId: string;
    teamName: string;
    sent: PlayerSideOutcome[];
    received: PlayerSideOutcome[];
    sentTotal: number;
    receivedTotal: number;
    differential: number; // received - sent
  }>;
}

export async function computeOutcome(
  db: DB,
  tradeId: string
): Promise<TradeOutcome | null> {
  const trade = await db.query.trades.findFirst({
    where: eq(schema.trades.id, tradeId),
  });
  if (!trade) return null;

  const items = await db.query.tradeItems.findMany({
    where: eq(schema.tradeItems.tradeId, tradeId),
  });
  if (items.length === 0) return null;

  // Collect team ids + player ids
  const teamIds = new Set<string>();
  const playerIds = new Set<string>();
  for (const i of items) {
    teamIds.add(i.fromTeamId);
    teamIds.add(i.toTeamId);
    if (i.playerId) playerIds.add(i.playerId);
  }

  // Fetch team names + player names
  const [teams, players] = await Promise.all([
    db.query.teams.findMany({
      where: inArray(schema.teams.id, Array.from(teamIds)),
    }),
    playerIds.size > 0
      ? db.query.nflPlayers.findMany({
          where: inArray(schema.nflPlayers.id, Array.from(playerIds)),
          columns: { id: true, name: true, position: true },
        })
      : Promise.resolve([]),
  ]);

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const playerInfoById = new Map(
    players.map((p) => [p.id, { name: p.name, position: p.position }])
  );

  // Fetch weekly stats for all traded players for the relevant season,
  // from the week after the trade onward.
  const weekCutoff = trade.weekExecuted ?? 0;
  const seasonYear = trade.seasonYear ?? new Date().getFullYear();

  const weeklyStats =
    playerIds.size > 0
      ? await db.query.playerWeeklyStats.findMany({
          where: and(
            inArray(schema.playerWeeklyStats.playerId, Array.from(playerIds)),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear),
            gte(schema.playerWeeklyStats.week, weekCutoff + 1)
          ),
        })
      : [];

  const pointsByPlayer = new Map<
    string,
    Array<{ week: number; points: number }>
  >();
  for (const s of weeklyStats) {
    const list = pointsByPlayer.get(s.playerId) || [];
    list.push({
      week: s.week,
      points: Math.round(Number(s.fantasyPointsPPR ?? 0) * 10) / 10,
    });
    pointsByPlayer.set(s.playerId, list);
  }

  // Build per-team side outcomes
  const sides: TradeOutcome['sides'] = [];
  for (const teamId of teamIds) {
    const sentPlayers = items.filter(
      (i) => i.fromTeamId === teamId && i.playerId
    );
    const receivedPlayers = items.filter(
      (i) => i.toTeamId === teamId && i.playerId
    );

    const makeSide = (
      itemList: typeof items
    ): PlayerSideOutcome[] =>
      itemList.map((i) => {
        const info = playerInfoById.get(i.playerId!) || {
          name: 'Unknown',
          position: 'UNK',
        };
        const weekly = (pointsByPlayer.get(i.playerId!) || []).sort(
          (a, b) => a.week - b.week
        );
        const totalPoints =
          Math.round(weekly.reduce((sum, w) => sum + w.points, 0) * 10) / 10;
        return {
          playerId: i.playerId!,
          playerName: info.name,
          position: info.position,
          weeklyPoints: weekly,
          totalPoints,
        };
      });

    const sent = makeSide(sentPlayers);
    const received = makeSide(receivedPlayers);
    const sentTotal = Math.round(
      sent.reduce((s, p) => s + p.totalPoints, 0) * 10
    ) / 10;
    const receivedTotal = Math.round(
      received.reduce((s, p) => s + p.totalPoints, 0) * 10
    ) / 10;

    sides.push({
      teamId,
      teamName: teamNameById.get(teamId) || 'Unknown',
      sent,
      received,
      sentTotal,
      receivedTotal,
      differential: Math.round((receivedTotal - sentTotal) * 10) / 10,
    });
  }

  return {
    tradeId: trade.id,
    executedAt: trade.executedAt ? trade.executedAt.toISOString() : null,
    weekExecuted: trade.weekExecuted,
    sides,
  };
}

// ── Record Impact ───────────────────────────────────────────────────

export interface RecordImpact {
  leagueId: string;
  teamId: string;
  seasonYear: number;
  actualRecord: { wins: number; losses: number; ties: number };
  hypotheticalRecord: { wins: number; losses: number; ties: number };
  flippedWeeks: Array<{
    week: number;
    actualResult: 'W' | 'L' | 'T';
    hypotheticalResult: 'W' | 'L' | 'T';
    actualScore: number;
    hypotheticalScore: number;
    opponentScore: number;
  }>;
  totalPointDifferential: number;
}

/**
 * Rebuild each weekly matchup with the user's "never traded" lineup and
 * compare to the actual result. Coarse heuristic:
 *  - For each trade the user made: if they RECEIVED a player, subtract
 *    that player's weekly PPR from their actual weekly score (starting
 *    the week after the trade).
 *  - For each player they SENT: add that player's weekly PPR back.
 *
 * This is a simplification — it doesn't rebuild actual starting lineups —
 * but it's directionally correct and dirt cheap. AI grading is a separate
 * (Pro/Elite) endpoint.
 */
export async function computeRecordImpact(
  db: DB,
  leagueId: string,
  teamId: string
): Promise<RecordImpact | null> {
  const team = await db.query.teams.findFirst({
    where: and(
      eq(schema.teams.id, teamId),
      eq(schema.teams.leagueId, leagueId)
    ),
  });
  if (!team) return null;

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
  });
  if (!league) return null;

  const seasonYear = league.seasonYear;

  // 1. User's completed matchups this season
  const matchups = await db.query.matchups.findMany({
    where: and(
      eq(schema.matchups.leagueId, leagueId),
      eq(schema.matchups.isComplete, true)
    ),
    orderBy: [desc(schema.matchups.week)],
  });
  const userMatchups = matchups.filter(
    (m) => m.homeTeamId === teamId || m.awayTeamId === teamId
  );

  // 2. User's trades in this league
  const trades = await db.query.trades.findMany({
    where: and(
      eq(schema.trades.leagueId, leagueId),
      eq(schema.trades.status, 'executed')
    ),
  });

  // Filter trades the user was involved in
  const tradeItems = await db.query.tradeItems.findMany({
    where: inArray(
      schema.tradeItems.tradeId,
      trades.map((t) => t.id)
    ),
  });
  const userTrades = trades.filter((t) =>
    tradeItems.some(
      (i) => i.tradeId === t.id && (i.fromTeamId === teamId || i.toTeamId === teamId)
    )
  );

  // For each user trade, collect weeklyPoints of players received / sent
  // from the week AFTER the trade onward.
  const playerIdsToFetch = new Set<string>();
  for (const i of tradeItems) {
    if (i.playerId) playerIdsToFetch.add(i.playerId);
  }
  const weeklyStats =
    playerIdsToFetch.size > 0
      ? await db.query.playerWeeklyStats.findMany({
          where: and(
            inArray(schema.playerWeeklyStats.playerId, Array.from(playerIdsToFetch)),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear)
          ),
        })
      : [];

  const pointsByPlayerWeek = new Map<string, number>();
  for (const s of weeklyStats) {
    pointsByPlayerWeek.set(
      `${s.playerId}_${s.week}`,
      Number(s.fantasyPointsPPR ?? 0)
    );
  }

  // For each completed matchup, compute the net adjustment:
  //   adjustment = (sum of "sent" players' points) - (sum of "received" players' points)
  //   but only for trades executed BEFORE this week.
  const flippedWeeks: RecordImpact['flippedWeeks'] = [];
  let actualWins = 0;
  let actualLosses = 0;
  let actualTies = 0;
  let hypoWins = 0;
  let hypoLosses = 0;
  let hypoTies = 0;
  let totalPointDifferential = 0;

  for (const m of userMatchups) {
    const isHome = m.homeTeamId === teamId;
    const myScore = (isHome ? m.homeScore : m.awayScore) ?? 0;
    const oppScore = (isHome ? m.awayScore : m.homeScore) ?? 0;

    let adjustment = 0;
    for (const t of userTrades) {
      const tradeWeek = t.weekExecuted ?? 0;
      if (tradeWeek >= m.week) continue; // trade not yet made as of this matchup
      const items = tradeItems.filter((i) => i.tradeId === t.id);
      for (const item of items) {
        if (!item.playerId) continue;
        const pts = pointsByPlayerWeek.get(`${item.playerId}_${m.week}`) || 0;
        if (item.toTeamId === teamId) {
          // Received this player -> hypothetical lineup doesn't have them
          adjustment -= pts;
        } else if (item.fromTeamId === teamId) {
          // Sent this player -> hypothetical lineup still has them
          adjustment += pts;
        }
      }
    }

    const hypoScore = myScore + adjustment;
    totalPointDifferential += adjustment;

    const actualResult: 'W' | 'L' | 'T' =
      myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'T';
    const hypoResult: 'W' | 'L' | 'T' =
      hypoScore > oppScore ? 'W' : hypoScore < oppScore ? 'L' : 'T';

    if (actualResult === 'W') actualWins++;
    else if (actualResult === 'L') actualLosses++;
    else actualTies++;

    if (hypoResult === 'W') hypoWins++;
    else if (hypoResult === 'L') hypoLosses++;
    else hypoTies++;

    if (actualResult !== hypoResult) {
      flippedWeeks.push({
        week: m.week,
        actualResult,
        hypotheticalResult: hypoResult,
        actualScore: Math.round(myScore * 10) / 10,
        hypotheticalScore: Math.round(hypoScore * 10) / 10,
        opponentScore: Math.round(oppScore * 10) / 10,
      });
    }
  }

  return {
    leagueId,
    teamId,
    seasonYear,
    actualRecord: { wins: actualWins, losses: actualLosses, ties: actualTies },
    hypotheticalRecord: { wins: hypoWins, losses: hypoLosses, ties: hypoTies },
    flippedWeeks: flippedWeeks.sort((a, b) => a.week - b.week),
    totalPointDifferential: Math.round(totalPointDifferential * 10) / 10,
  };
}

// Re-export roster reconstruction for convenience
export { reconstructRosterAt } from './tradeIngest';
