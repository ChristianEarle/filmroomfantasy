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

// ── Deterministic Grading ────────────────────────────────────────────
//
// Grading a COMPLETED trade is a math problem, not a judgment call. We
// already know exactly what the traded players scored after the trade
// executed — there's nothing for Claude to "decide". These helpers
// produce the grade directly from the outcome data.
//
// Two levels:
//   computeDeterministicGrade(outcome)
//     Works for ANY trade in the league (including league-mates'). Uses
//     raw sent-vs-received point totals from computeOutcome. Suitable
//     for the History page.
//
//   computeLineupImpact(db, tradeId, userTeamId)
//     Only for trades the CALLER was in. Optimizes a starting lineup
//     from the caller's actual roster vs (actual - received + sent)
//     week by week. Accounts for bench-buffer — if the sent player
//     would've been benched anyway, the trade cost nothing at that
//     slot. This is the grade the user sees on the Trade History page.

/** Standard lineup used for optimal-lineup grading. K/DEF intentionally
 *  omitted — they're rarely traded and would add noise. */
const LINEUP_REQUIREMENTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1, // any of RB/WR/TE
};

const FLEX_ELIGIBLE = new Set(['RB', 'WR', 'TE']);

export type GradeStatus = 'graded' | 'pending';

export interface DeterministicGrade {
  status: GradeStatus;
  /** Why the trade isn't graded yet (only set when status='pending') */
  pendingReason?: string;
  /** Per-side letter grade (each side of the trade gets a grade) */
  sides: Array<{
    teamId: string;
    teamName: string;
    grade: string; // 'A+' .. 'F' or 'PENDING'
    fairnessScore: number; // 0-100, 50 = wash
    differential: number; // received - sent points
    sentTotal: number;
    receivedTotal: number;
  }>;
  /** Flags for context — populated regardless of status */
  hasDraftPicks: boolean;
  pickAssets: Array<{
    fromTeamId: string;
    toTeamId: string;
    year: number;
    round: number;
  }>;
  weeksEvaluated: number;
}

export interface LineupImpact {
  status: GradeStatus;
  pendingReason?: string;
  teamId: string;
  teamName: string;
  weeksEvaluated: number;
  withTradePoints: number;
  withoutTradePoints: number;
  delta: number; // positive = trade helped this team
  deltaPerWeek: number;
  grade: string;
  fairnessScore: number;
  weeklyBreakdown: Array<{
    week: number;
    withPoints: number;
    withoutPoints: number;
    delta: number;
  }>;
  hasDraftPicks: boolean;
}

// ── Grade thresholds ────────────────────────────────────────────────
//
// For DeterministicGrade (raw sent vs received), we use a ratio-based
// score that's symmetric around 1.0. For LineupImpact, we use a
// per-week point delta which normalizes across trade recency.

function gradeFromFairnessScore(score: number): string {
  if (score >= 92) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 84) return 'A-';
  if (score >= 78) return 'B+';
  if (score >= 72) return 'B';
  if (score >= 66) return 'B-';
  if (score >= 58) return 'C+';
  if (score >= 42) return 'C';
  if (score >= 34) return 'C-';
  if (score >= 28) return 'D+';
  if (score >= 22) return 'D';
  if (score >= 16) return 'D-';
  return 'F';
}

function fairnessScoreFromRatio(
  received: number,
  sent: number
): number {
  if (received <= 0 && sent <= 0) return 50;
  // Asymmetric edge: (received - sent) / (received + sent) in [-1, 1]
  const sum = received + sent;
  if (sum <= 0) return 50;
  const edge = (received - sent) / sum;
  return Math.round(50 + 50 * edge);
}

function fairnessScoreFromLineupDelta(
  deltaPerWeek: number
): number {
  // ±10 pts/week is a huge swing; ±2 is noise.
  // Map deltaPerWeek to fairness score via a soft clamp.
  const clamped = Math.max(-12, Math.min(12, deltaPerWeek));
  return Math.round(50 + (clamped / 12) * 50);
}

// ── computeDeterministicGrade ────────────────────────────────────────

export async function computeDeterministicGrade(
  db: DB,
  tradeId: string
): Promise<DeterministicGrade | null> {
  const trade = await db.query.trades.findFirst({
    where: eq(schema.trades.id, tradeId),
  });
  if (!trade) return null;

  const items = await db.query.tradeItems.findMany({
    where: eq(schema.tradeItems.tradeId, tradeId),
  });
  if (items.length === 0) return null;

  const playerItems = items.filter((i) => i.playerId != null);
  const pickItems = items.filter((i) => i.draftPickRound != null);
  const hasDraftPicks = pickItems.length > 0;
  const pickAssets = pickItems.map((i) => ({
    fromTeamId: i.fromTeamId,
    toTeamId: i.toTeamId,
    year: i.draftPickYear!,
    round: i.draftPickRound!,
  }));

  // Gather team names for output
  const teamIds = Array.from(
    new Set([
      ...items.map((i) => i.fromTeamId),
      ...items.map((i) => i.toTeamId),
    ])
  );
  const teams = await db.query.teams.findMany({
    where: inArray(schema.teams.id, teamIds),
  });
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  // Pure pick trade → pending (no scoring data to grade against)
  if (playerItems.length === 0) {
    return {
      status: 'pending',
      pendingReason:
        'Pure draft-pick trade — no scoring data to grade against.',
      sides: teamIds.map((id) => ({
        teamId: id,
        teamName: teamNameById.get(id) || 'Unknown',
        grade: 'PENDING',
        fairnessScore: 50,
        differential: 0,
        sentTotal: 0,
        receivedTotal: 0,
      })),
      hasDraftPicks,
      pickAssets,
      weeksEvaluated: 0,
    };
  }

  // Fetch post-trade weekly stats for every player in the trade
  const playerIds = playerItems.map((i) => i.playerId!);
  const weekCutoff = trade.weekExecuted ?? 0;
  const seasonYear = trade.seasonYear ?? new Date().getFullYear();
  const weeklyStats = await db.query.playerWeeklyStats.findMany({
    where: and(
      inArray(schema.playerWeeklyStats.playerId, playerIds),
      eq(schema.playerWeeklyStats.seasonYear, seasonYear),
      gte(schema.playerWeeklyStats.week, weekCutoff + 1)
    ),
  });

  const weeksEvaluated = new Set(weeklyStats.map((s) => s.week)).size;

  // Pending: no post-trade stats yet (offseason, same-week, too-recent)
  if (weeklyStats.length === 0) {
    return {
      status: 'pending',
      pendingReason:
        trade.weekExecuted == null
          ? 'Trade executed in the offseason — no games played yet.'
          : `No games played since Week ${trade.weekExecuted} — check back after the next slate.`,
      sides: teamIds.map((id) => ({
        teamId: id,
        teamName: teamNameById.get(id) || 'Unknown',
        grade: 'PENDING',
        fairnessScore: 50,
        differential: 0,
        sentTotal: 0,
        receivedTotal: 0,
      })),
      hasDraftPicks,
      pickAssets,
      weeksEvaluated: 0,
    };
  }

  // Index weekly stats by playerId
  const pointsByPlayer = new Map<string, number>();
  for (const s of weeklyStats) {
    pointsByPlayer.set(
      s.playerId,
      (pointsByPlayer.get(s.playerId) || 0) +
        Number(s.fantasyPointsPPR ?? 0)
    );
  }

  // Build per-side totals
  const sides: DeterministicGrade['sides'] = [];
  for (const teamId of teamIds) {
    const sent = playerItems
      .filter((i) => i.fromTeamId === teamId)
      .reduce(
        (sum, i) => sum + (pointsByPlayer.get(i.playerId!) ?? 0),
        0
      );
    const received = playerItems
      .filter((i) => i.toTeamId === teamId)
      .reduce(
        (sum, i) => sum + (pointsByPlayer.get(i.playerId!) ?? 0),
        0
      );
    const fairnessScore = fairnessScoreFromRatio(received, sent);
    sides.push({
      teamId,
      teamName: teamNameById.get(teamId) || 'Unknown',
      grade: gradeFromFairnessScore(fairnessScore),
      fairnessScore,
      differential: Math.round((received - sent) * 10) / 10,
      sentTotal: Math.round(sent * 10) / 10,
      receivedTotal: Math.round(received * 10) / 10,
    });
  }

  return {
    status: 'graded',
    sides,
    hasDraftPicks,
    pickAssets,
    weeksEvaluated,
  };
}

// ── computeLineupImpact ──────────────────────────────────────────────

interface WeeklyPlayerPoints {
  playerId: string;
  position: string;
  points: number;
}

/** Optimize a starting lineup from a set of weekly stats. Returns the
 *  total points the best lineup would have scored. K/DEF are ignored. */
function optimizeLineup(players: WeeklyPlayerPoints[]): number {
  const byPos: Record<string, WeeklyPlayerPoints[]> = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };
  for (const p of players) {
    if (byPos[p.position]) byPos[p.position].push(p);
  }
  for (const pos of Object.keys(byPos)) {
    byPos[pos].sort((a, b) => b.points - a.points);
  }

  let total = 0;
  // QB
  for (let i = 0; i < LINEUP_REQUIREMENTS.QB; i++) {
    if (byPos.QB[i]) total += byPos.QB[i].points;
  }
  // RB
  for (let i = 0; i < LINEUP_REQUIREMENTS.RB; i++) {
    if (byPos.RB[i]) total += byPos.RB[i].points;
  }
  // WR
  for (let i = 0; i < LINEUP_REQUIREMENTS.WR; i++) {
    if (byPos.WR[i]) total += byPos.WR[i].points;
  }
  // TE
  for (let i = 0; i < LINEUP_REQUIREMENTS.TE; i++) {
    if (byPos.TE[i]) total += byPos.TE[i].points;
  }
  // FLEX — best leftover from RB/WR/TE
  const flexCandidates: WeeklyPlayerPoints[] = [];
  const rbLeftover = byPos.RB[LINEUP_REQUIREMENTS.RB];
  const wrLeftover = byPos.WR[LINEUP_REQUIREMENTS.WR];
  const teLeftover = byPos.TE[LINEUP_REQUIREMENTS.TE];
  if (rbLeftover) flexCandidates.push(rbLeftover);
  if (wrLeftover) flexCandidates.push(wrLeftover);
  if (teLeftover) flexCandidates.push(teLeftover);
  if (flexCandidates.length > 0) {
    flexCandidates.sort((a, b) => b.points - a.points);
    total += flexCandidates[0].points;
  }

  return Math.round(total * 10) / 10;
}

/**
 * Compare the caller's optimal lineup each week WITH the trade vs
 * WITHOUT it. The "without" roster is (current roster - received + sent).
 * This accounts for bench buffer — a sent player who would've been
 * benched anyway costs the team nothing.
 *
 * Approximations (documented because they bite):
 *  - Uses CURRENT roster as the proxy for each post-trade week. Waivers
 *    and subsequent transactions are not modeled.
 *  - Lineup is the standard 1 QB / 2 RB / 2 WR / 1 TE / 1 FLEX. K/DEF
 *    are ignored.
 *  - Only considers players with weekly stats in our DB.
 */
export async function computeLineupImpact(
  db: DB,
  tradeId: string,
  userTeamId: string
): Promise<LineupImpact | null> {
  const trade = await db.query.trades.findFirst({
    where: eq(schema.trades.id, tradeId),
  });
  if (!trade) return null;

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, userTeamId),
  });
  if (!team) return null;

  const items = await db.query.tradeItems.findMany({
    where: eq(schema.tradeItems.tradeId, tradeId),
  });
  if (items.length === 0) return null;

  const hasDraftPicks = items.some((i) => i.draftPickRound != null);
  const playerItems = items.filter((i) => i.playerId != null);

  // The caller's role in this trade
  const userReceivedIds = playerItems
    .filter((i) => i.toTeamId === userTeamId)
    .map((i) => i.playerId!);
  const userSentIds = playerItems
    .filter((i) => i.fromTeamId === userTeamId)
    .map((i) => i.playerId!);

  // If the user wasn't part of this trade, bail (caller should have
  // checked this, but defense in depth)
  if (userReceivedIds.length === 0 && userSentIds.length === 0) {
    return null;
  }

  // Pure pick trade on this side → pending
  if (playerItems.length === 0) {
    return {
      status: 'pending',
      pendingReason: 'Draft-pick trade — no lineup impact to compute.',
      teamId: userTeamId,
      teamName: team.name,
      weeksEvaluated: 0,
      withTradePoints: 0,
      withoutTradePoints: 0,
      delta: 0,
      deltaPerWeek: 0,
      grade: 'PENDING',
      fairnessScore: 50,
      weeklyBreakdown: [],
      hasDraftPicks,
    };
  }

  const seasonYear = trade.seasonYear ?? new Date().getFullYear();
  const weekCutoff = trade.weekExecuted ?? 0;

  // Current roster (approximation of "roster at each post-trade week")
  const currentRosterRows = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, userTeamId),
    with: { player: true },
  });
  const actualRosterPlayers = currentRosterRows
    .filter((r) => r.player)
    .map((r) => ({
      id: r.playerId,
      position: r.player!.position,
    }));

  // "Without trade" roster = actual - received + sent
  const withoutRosterPlayers = actualRosterPlayers.filter(
    (p) => !userReceivedIds.includes(p.id)
  );
  // Add the sent players back (look up their positions)
  if (userSentIds.length > 0) {
    const sentPlayerRows = await db.query.nflPlayers.findMany({
      where: inArray(schema.nflPlayers.id, userSentIds),
      columns: { id: true, position: true },
    });
    for (const sp of sentPlayerRows) {
      withoutRosterPlayers.push({ id: sp.id, position: sp.position });
    }
  }

  const allPlayerIdsNeeded = [
    ...new Set([
      ...actualRosterPlayers.map((p) => p.id),
      ...withoutRosterPlayers.map((p) => p.id),
    ]),
  ];

  const weeklyStats =
    allPlayerIdsNeeded.length > 0
      ? await db.query.playerWeeklyStats.findMany({
          where: and(
            inArray(schema.playerWeeklyStats.playerId, allPlayerIdsNeeded),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear),
            gte(schema.playerWeeklyStats.week, weekCutoff + 1)
          ),
        })
      : [];

  // Pending: no post-trade stats exist yet
  if (weeklyStats.length === 0) {
    return {
      status: 'pending',
      pendingReason:
        trade.weekExecuted == null
          ? 'Trade executed in the offseason — no games played yet.'
          : `No post-trade games played yet — check back after the next slate.`,
      teamId: userTeamId,
      teamName: team.name,
      weeksEvaluated: 0,
      withTradePoints: 0,
      withoutTradePoints: 0,
      delta: 0,
      deltaPerWeek: 0,
      grade: 'PENDING',
      fairnessScore: 50,
      weeklyBreakdown: [],
      hasDraftPicks,
    };
  }

  // Index: (playerId, week) -> points
  const pointsByPlayerWeek = new Map<string, number>();
  for (const s of weeklyStats) {
    pointsByPlayerWeek.set(
      `${s.playerId}_${s.week}`,
      Number(s.fantasyPointsPPR ?? 0)
    );
  }

  // Position lookup for all players (we already have it for most)
  const positionByPlayer = new Map<string, string>();
  for (const p of actualRosterPlayers) positionByPlayer.set(p.id, p.position);
  for (const p of withoutRosterPlayers) positionByPlayer.set(p.id, p.position);

  // For each post-trade week, optimize both lineups
  const weeksSeen = Array.from(
    new Set(weeklyStats.map((s) => s.week))
  ).sort((a, b) => a - b);

  const weeklyBreakdown: LineupImpact['weeklyBreakdown'] = [];
  let withTotal = 0;
  let withoutTotal = 0;

  for (const week of weeksSeen) {
    const buildPoints = (
      roster: Array<{ id: string; position: string }>
    ): WeeklyPlayerPoints[] =>
      roster
        .map((r) => ({
          playerId: r.id,
          position: r.position,
          points: pointsByPlayerWeek.get(`${r.id}_${week}`) ?? 0,
        }))
        // Drop FLEX-ineligible positions we don't score
        .filter(
          (p) => FLEX_ELIGIBLE.has(p.position) || p.position === 'QB'
        );

    const withPoints = optimizeLineup(buildPoints(actualRosterPlayers));
    const withoutPoints = optimizeLineup(buildPoints(withoutRosterPlayers));
    withTotal += withPoints;
    withoutTotal += withoutPoints;
    weeklyBreakdown.push({
      week,
      withPoints,
      withoutPoints,
      delta: Math.round((withPoints - withoutPoints) * 10) / 10,
    });
  }

  const weeksEvaluated = weeklyBreakdown.length;
  const delta = Math.round((withTotal - withoutTotal) * 10) / 10;
  const deltaPerWeek = weeksEvaluated > 0 ? delta / weeksEvaluated : 0;
  const fairnessScore = fairnessScoreFromLineupDelta(deltaPerWeek);
  const grade = gradeFromFairnessScore(fairnessScore);

  return {
    status: 'graded',
    teamId: userTeamId,
    teamName: team.name,
    weeksEvaluated,
    withTradePoints: Math.round(withTotal * 10) / 10,
    withoutTradePoints: Math.round(withoutTotal * 10) / 10,
    delta,
    deltaPerWeek: Math.round(deltaPerWeek * 10) / 10,
    grade,
    fairnessScore,
    weeklyBreakdown,
    hasDraftPicks,
  };
}

// ── Existing helpers ────────────────────────────────────────────────

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
