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
import { chunkedInArrayFetch, DEFAULT_ID_CHUNK } from '../utils/chunked';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export interface PlayerSideOutcome {
  playerId: string;
  playerName: string;
  position: string;
  weeklyPoints: Array<{ week: number; points: number }>;
  totalPoints: number;
  /** Points scored only in weeks the player was in the starting lineup.
   *  Null when lineup data isn't available (pre-migration). */
  startedPoints: number | null;
  /** Number of weeks the player was in the starting lineup post-trade. */
  starterWeeks: number | null;
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
    differential: number; // received - sent (raw, all points)
    /** Lineup-adjusted differential: only counts points from weeks
     *  the player was actually started. Null when lineup data isn't
     *  available. */
    lineupDifferential: number | null;
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

  // Fetch matchup starters for lineup-aware outcome scoring.
  // Each matchup stores JSON arrays of internal player IDs for
  // each team's starting lineup. When available, we compute a
  // lineup-adjusted differential that only counts weeks a player
  // was actually started (not riding the bench).
  const leagueId = trade.leagueId;
  const matchupsForStarters = await db.query.matchups.findMany({
    where: and(
      eq(schema.matchups.leagueId, leagueId),
      eq(schema.matchups.isComplete, true),
      gte(schema.matchups.week, weekCutoff + 1)
    ),
  });

  // Build per-team-per-week starter sets
  const startersByTeamWeek = new Map<string, Set<string>>();
  let hasAnyStarterData = false;
  for (const m of matchupsForStarters) {
    if (m.homeStartersJson) {
      try {
        startersByTeamWeek.set(
          `${m.homeTeamId}_${m.week}`,
          new Set(JSON.parse(m.homeStartersJson) as string[])
        );
        hasAnyStarterData = true;
      } catch { /* ignore */ }
    }
    if (m.awayStartersJson) {
      try {
        startersByTeamWeek.set(
          `${m.awayTeamId}_${m.week}`,
          new Set(JSON.parse(m.awayStartersJson) as string[])
        );
        hasAnyStarterData = true;
      } catch { /* ignore */ }
    }
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
      itemList: typeof items,
      sideTeamId: string
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

        // Compute started-only points when lineup data is available
        let startedPoints: number | null = null;
        let starterWeeks: number | null = null;
        if (hasAnyStarterData) {
          let sp = 0;
          let sw = 0;
          for (const w of weekly) {
            const starters = startersByTeamWeek.get(`${sideTeamId}_${w.week}`);
            if (starters && starters.has(i.playerId!)) {
              sp += w.points;
              sw++;
            } else if (!starters) {
              // No starter data for this week — count the points
              // to avoid understating when data is partially available
              sp += w.points;
              sw++;
            }
          }
          startedPoints = Math.round(sp * 10) / 10;
          starterWeeks = sw;
        }

        return {
          playerId: i.playerId!,
          playerName: info.name,
          position: info.position,
          weeklyPoints: weekly,
          totalPoints,
          startedPoints,
          starterWeeks,
        };
      });

    // For received players, use this team's starters. For sent players,
    // use the team they went TO (their new team's starters).
    const received = makeSide(receivedPlayers, teamId);

    // Sent players: compute on the destination team. Each sent item has
    // toTeamId = the team that received the player.
    const sent: PlayerSideOutcome[] = sentPlayers.map((i) => {
      const info = playerInfoById.get(i.playerId!) || {
        name: 'Unknown',
        position: 'UNK',
      };
      const weekly = (pointsByPlayer.get(i.playerId!) || []).sort(
        (a, b) => a.week - b.week
      );
      const totalPoints =
        Math.round(weekly.reduce((sum, w) => sum + w.points, 0) * 10) / 10;

      let startedPoints: number | null = null;
      let starterWeeks: number | null = null;
      if (hasAnyStarterData) {
        let sp = 0;
        let sw = 0;
        // Check if the player was started by their NEW team
        const destTeamId = i.toTeamId;
        for (const w of weekly) {
          const starters = startersByTeamWeek.get(`${destTeamId}_${w.week}`);
          if (starters && starters.has(i.playerId!)) {
            sp += w.points;
            sw++;
          } else if (!starters) {
            sp += w.points;
            sw++;
          }
        }
        startedPoints = Math.round(sp * 10) / 10;
        starterWeeks = sw;
      }

      return {
        playerId: i.playerId!,
        playerName: info.name,
        position: info.position,
        weeklyPoints: weekly,
        totalPoints,
        startedPoints,
        starterWeeks,
      };
    });

    const sentTotal = Math.round(
      sent.reduce((s, p) => s + p.totalPoints, 0) * 10
    ) / 10;
    const receivedTotal = Math.round(
      received.reduce((s, p) => s + p.totalPoints, 0) * 10
    ) / 10;

    // Lineup-adjusted: only count points from started weeks
    let lineupDifferential: number | null = null;
    if (hasAnyStarterData) {
      const receivedStarted = received.reduce((s, p) => s + (p.startedPoints ?? p.totalPoints), 0);
      const sentStarted = sent.reduce((s, p) => s + (p.startedPoints ?? p.totalPoints), 0);
      lineupDifferential = Math.round((receivedStarted - sentStarted) * 10) / 10;
    }

    sides.push({
      teamId,
      teamName: teamNameById.get(teamId) || 'Unknown',
      sent,
      received,
      sentTotal,
      receivedTotal,
      differential: Math.round((receivedTotal - sentTotal) * 10) / 10,
      lineupDifferential,
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
    isPlayoff: boolean;
    opponentName: string | null;
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
 *
 * @param seasonYearOverride If provided, computes impact for this season
 *   instead of the league's current season. Lets dynasty leagues fetch
 *   per-season history.
 * @param extraTeamIds Additional team ids in this league that also
 *   represent the caller (for legacy duplicate-team-row scenarios).
 *   Trades attributed to any of these team ids count toward the
 *   user's record impact.
 */
export async function computeRecordImpact(
  db: DB,
  leagueId: string,
  teamId: string,
  seasonYearOverride?: number,
  extraTeamIds: string[] = []
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

  // The full set of team ids that represent this user in this league.
  // Always includes the primary team; may include duplicates.
  const callerTeamIdSet = new Set<string>([teamId, ...extraTeamIds]);

  // Team name lookup for opponent labels in flipped weeks
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });
  const teamNameMap = new Map(allTeams.map((t) => [t.id, t.name]));

  const seasonYear = seasonYearOverride ?? league.seasonYear;

  // 1. User's completed matchups this season. Match against the FULL
  //    set of caller team ids — duplicate team rows in the same league
  //    might have matchups attributed to either id.
  const matchups = await db.query.matchups.findMany({
    where: and(
      eq(schema.matchups.leagueId, leagueId),
      eq(schema.matchups.isComplete, true)
    ),
    orderBy: [desc(schema.matchups.week)],
  });
  const userMatchups = matchups.filter(
    (m) =>
      callerTeamIdSet.has(m.homeTeamId) || callerTeamIdSet.has(m.awayTeamId)
  );

  // 2. User's executed trades in this league for the target season.
  //    When seasonYear matches the league's stored seasonYear, we also
  //    include trades that predate the seasonYear column (null) for
  //    backwards compatibility with pre-migration data.
  const trades = await db.query.trades.findMany({
    where: and(
      eq(schema.trades.leagueId, leagueId),
      eq(schema.trades.status, 'executed')
    ),
  });
  const tradesForSeason = trades.filter(
    (t) =>
      t.seasonYear === seasonYear ||
      (t.seasonYear == null && seasonYear === league.seasonYear)
  );

  if (tradesForSeason.length === 0) {
    // No trades → the two records are identical, no flips, zero diff.
    return {
      leagueId,
      teamId,
      seasonYear,
      actualRecord: { wins: team.wins, losses: team.losses, ties: team.ties },
      hypotheticalRecord: {
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
      },
      flippedWeeks: [],
      totalPointDifferential: 0,
    };
  }

  // Chunked lookup of trade items — one league can have hundreds of
  // trades in a long-running dynasty, well past D1's parameter limit.
  const tradeIds = tradesForSeason.map((t) => t.id);
  const tradeItems = await chunkedInArrayFetch(
    tradeIds,
    DEFAULT_ID_CHUNK,
    (chunk) =>
      db.query.tradeItems.findMany({
        where: inArray(schema.tradeItems.tradeId, chunk),
      })
  );

  const userTrades = tradesForSeason.filter((t) =>
    tradeItems.some(
      (i) =>
        i.tradeId === t.id &&
        (callerTeamIdSet.has(i.fromTeamId) ||
          callerTeamIdSet.has(i.toTeamId))
    )
  );

  // For each user trade, collect weeklyPoints of players received / sent
  // from the week AFTER the trade onward.
  const playerIdsToFetch = Array.from(
    new Set(tradeItems.map((i) => i.playerId).filter((id): id is string => !!id))
  );
  const weeklyStats = await chunkedInArrayFetch(
    playerIdsToFetch,
    DEFAULT_ID_CHUNK,
    (chunk) =>
      db.query.playerWeeklyStats.findMany({
        where: and(
          inArray(schema.playerWeeklyStats.playerId, chunk),
          eq(schema.playerWeeklyStats.seasonYear, seasonYear)
        ),
      })
  );

  const pointsByPlayerWeek = new Map<string, number>();
  for (const s of weeklyStats) {
    pointsByPlayerWeek.set(
      `${s.playerId}_${s.week}`,
      Number(s.fantasyPointsPPR ?? 0)
    );
  }

  // Build a lookup of which players were starters for the user's team
  // each week, so we only adjust for players who actually affected the
  // lineup score (not bench riders). Falls back to the old "count all
  // traded players" behaviour when starter data isn't available.
  const startersByWeek = new Map<number, Set<string>>();
  for (const m of userMatchups) {
    const isHome = callerTeamIdSet.has(m.homeTeamId);
    const startersJson = isHome ? m.homeStartersJson : m.awayStartersJson;
    if (startersJson) {
      try {
        const ids: string[] = JSON.parse(startersJson);
        startersByWeek.set(m.week, new Set(ids));
      } catch { /* ignore malformed JSON */ }
    }
  }

  // For each completed matchup, compute the net adjustment:
  //   Only adjust for players who were actually in a starting lineup:
  //   - Received player in user's starters → their pts are in the actual
  //     score, so subtract them for the hypothetical.
  //   - Sent player who was in user's starters pre-trade → they would
  //     have contributed to the hypothetical score, so add them back.
  //     When we don't have pre-trade lineup data, we use the sent
  //     player's new team's starters as a proxy — if they were good
  //     enough to start there, they'd likely have started here.
  //   Falls back to counting all traded players when no starter data
  //   exists (pre-migration matchups).
  const flippedWeeks: RecordImpact['flippedWeeks'] = [];
  let actualWins = 0;
  let actualLosses = 0;
  let actualTies = 0;
  let hypoWins = 0;
  let hypoLosses = 0;
  let hypoTies = 0;
  let totalPointDifferential = 0;

  // Also collect the OTHER teams' starters for the "sent player" proxy.
  // We need to check all matchups, not just the user's, because the sent
  // player is now on another team.
  const startersByTeamWeek = new Map<string, Set<string>>();
  for (const m of matchups) {
    if (m.homeStartersJson) {
      try {
        startersByTeamWeek.set(
          `${m.homeTeamId}_${m.week}`,
          new Set(JSON.parse(m.homeStartersJson) as string[])
        );
      } catch { /* ignore */ }
    }
    if (m.awayStartersJson) {
      try {
        startersByTeamWeek.set(
          `${m.awayTeamId}_${m.week}`,
          new Set(JSON.parse(m.awayStartersJson) as string[])
        );
      } catch { /* ignore */ }
    }
  }

  for (const m of userMatchups) {
    const isHome = callerTeamIdSet.has(m.homeTeamId);
    const myScore = (isHome ? m.homeScore : m.awayScore) ?? 0;
    const oppScore = (isHome ? m.awayScore : m.homeScore) ?? 0;

    const myStarters = startersByWeek.get(m.week);

    let adjustment = 0;
    for (const t of userTrades) {
      const tradeWeek = t.weekExecuted ?? 0;
      if (tradeWeek >= m.week) continue; // trade not yet made as of this matchup
      const items = tradeItems.filter((i) => i.tradeId === t.id);
      for (const item of items) {
        if (!item.playerId) continue;
        const pts = pointsByPlayerWeek.get(`${item.playerId}_${m.week}`) || 0;
        if (callerTeamIdSet.has(item.toTeamId)) {
          // Received this player → only subtract if they were in our
          // starting lineup (their pts are in our actual score).
          // If no starter data, fall back to counting all.
          if (!myStarters || myStarters.has(item.playerId)) {
            adjustment -= pts;
          }
        } else if (callerTeamIdSet.has(item.fromTeamId)) {
          // Sent this player → only add back if they would have started.
          // Proxy: if they started on their new team, they were
          // start-worthy. If no starter data, fall back to counting all.
          const newTeamId = item.toTeamId;
          const newTeamStarters = startersByTeamWeek.get(`${newTeamId}_${m.week}`);
          if (!newTeamStarters || newTeamStarters.has(item.playerId)) {
            adjustment += pts;
          }
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
      const oppTeamId = isHome ? m.awayTeamId : m.homeTeamId;
      flippedWeeks.push({
        week: m.week,
        actualResult,
        hypotheticalResult: hypoResult,
        actualScore: Math.round(myScore * 10) / 10,
        hypotheticalScore: Math.round(hypoScore * 10) / 10,
        opponentScore: Math.round(oppScore * 10) / 10,
        isPlayoff: m.isPlayoff ?? false,
        opponentName: teamNameMap.get(oppTeamId) ?? null,
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
