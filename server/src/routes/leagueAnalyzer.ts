import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// League Analyzer — deterministic league-wide analysis computed entirely from
// already-synced data (teams, roster_spots, players, player_weekly_stats,
// player_projections, matchups). No AI calls; the per-team narrative is built
// from template sentences over the computed facts.
// ─────────────────────────────────────────────────────────────────────────────

const analyzerRateLimit = rateLimit(60, 60 * 1000);

export const leagueAnalyzerRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

leagueAnalyzerRoutes.use('*', analyzerRateLimit);

/** Positions we grade. UNK / IDP positions are ignored. */
const GRADED_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
type GradedPosition = (typeof GRADED_POSITIONS)[number];

/** Monte Carlo settings — mirrors the client-side PlayoffPredictor engine. */
const NUM_SIMULATIONS = 5000;
const WIN_PROB_FLOOR = 0.15;
const WIN_PROB_CEILING = 0.85;

/** D1 bound-parameter safety: chunk size for inArray batches. */
const CHUNK = 50;

type ScoringFormat = 'ppr' | 'half-ppr' | 'standard';

/** Normalize the league's stored scoring format ('half_ppr' / 'half-ppr' / …). */
function normalizeFormat(format: string | null | undefined): ScoringFormat {
  const f = (format || 'ppr').toLowerCase();
  if (f.includes('half')) return 'half-ppr';
  if (f === 'standard' || f === 'std') return 'standard';
  return 'ppr';
}

/** Overall strength grade from PPG relative to league-average PPG. */
function gradeFromRatio(ratio: number): string {
  if (ratio >= 1.12) return 'A+';
  if (ratio >= 1.07) return 'A';
  if (ratio >= 1.03) return 'A-';
  if (ratio >= 1.0) return 'B+';
  if (ratio >= 0.97) return 'B';
  if (ratio >= 0.93) return 'B-';
  if (ratio >= 0.9) return 'C+';
  if (ratio >= 0.85) return 'C';
  return 'D';
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface PositionBreakdown {
  position: GradedPosition;
  starterCount: number;
  /** Average per-game points across this team's starters at the position. */
  avgPoints: number;
  /** League-wide average of the per-team averages at this position. */
  leagueAvg: number;
  /** Percent above/below the league average (0 when no baseline). */
  deltaPct: number;
  status: 'surplus' | 'balanced' | 'deficit';
}

interface StandingInput {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
}

interface RemainingMatchup {
  id: string;
  team1Id: string;
  team2Id: string;
}

/**
 * Sanity-filter "remaining" matchups against the regular-season length.
 * When completed games weren't flagged complete during sync, incomplete rows
 * linger for weeks that were already played; cap each team's remaining games
 * at (seasonLength − gamesPlayed) so those stale rows don't inflate the
 * simulation or the ROS schedule.
 */
function filterRemainingMatchups(
  standings: StandingInput[],
  remainingMatchups: RemainingMatchup[],
  seasonLength: number,
): RemainingMatchup[] {
  if (seasonLength <= 0) return remainingMatchups;

  const gamesPlayed = new Map<string, number>();
  for (const s of standings) gamesPlayed.set(s.teamId, s.wins + s.losses + s.ties);

  const capPerTeam = new Map<string, number>();
  for (const s of standings) {
    capPerTeam.set(s.teamId, Math.max(0, seasonLength - (gamesPlayed.get(s.teamId) || 0)));
  }

  const allowed = new Map<string, number>();
  return remainingMatchups.filter((m) => {
    const t1Ok = (allowed.get(m.team1Id) || 0) < (capPerTeam.get(m.team1Id) ?? Infinity);
    const t2Ok = (allowed.get(m.team2Id) || 0) < (capPerTeam.get(m.team2Id) ?? Infinity);
    if (t1Ok && t2Ok) {
      allowed.set(m.team1Id, (allowed.get(m.team1Id) || 0) + 1);
      allowed.set(m.team2Id, (allowed.get(m.team2Id) || 0) + 1);
      return true;
    }
    return false;
  });
}

/**
 * PPG-based Monte Carlo playoff simulation — the same approach as
 * src/components/PlayoffPredictorView.tsx, run server-side. Win probability
 * per matchup is ppg1/(ppg1+ppg2) clamped to [0.15, 0.85]; top-N by wins
 * (PF tiebreak) make the playoffs. Callers should pre-filter the remaining
 * matchups via filterRemainingMatchups().
 */
function runMonteCarlo(
  standings: StandingInput[],
  remainingMatchups: RemainingMatchup[],
  playoffSpots: number,
  numSims = NUM_SIMULATIONS,
): Map<string, { playoffPct: number; avgProjectedWins: number }> {
  const results = new Map<string, { playoffPct: number; avgProjectedWins: number }>();
  if (standings.length === 0) return results;

  // Team strength = points per game; teams without games use the league average.
  const teamPpg = new Map<string, number>();
  let leagueAvgPpg = 0;
  let teamsWithGames = 0;
  for (const s of standings) {
    const gp = s.wins + s.losses + s.ties;
    if (gp > 0) {
      const ppg = s.pointsFor / gp;
      teamPpg.set(s.teamId, ppg);
      leagueAvgPpg += ppg;
      teamsWithGames++;
    }
  }
  leagueAvgPpg = teamsWithGames > 0 ? leagueAvgPpg / teamsWithGames : 100;
  for (const s of standings) {
    if (!teamPpg.has(s.teamId)) teamPpg.set(s.teamId, leagueAvgPpg);
  }

  // No games left → standings are final and deterministic.
  if (remainingMatchups.length === 0) {
    const sorted = [...standings].sort((a, b) =>
      b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor,
    );
    sorted.forEach((s, i) => {
      results.set(s.teamId, { playoffPct: i < playoffSpots ? 100 : 0, avgProjectedWins: s.wins });
    });
    return results;
  }

  // Pre-compute clamped win probabilities.
  const matchupProbs = remainingMatchups.map((m) => {
    const ppg1 = teamPpg.get(m.team1Id) || leagueAvgPpg;
    const ppg2 = teamPpg.get(m.team2Id) || leagueAvgPpg;
    const raw = ppg1 + ppg2 > 0 ? ppg1 / (ppg1 + ppg2) : 0.5;
    return {
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      p1: Math.min(WIN_PROB_CEILING, Math.max(WIN_PROB_FLOOR, raw)),
    };
  });

  const playoffCount: Record<string, number> = {};
  const totalWins: Record<string, number> = {};
  for (const s of standings) {
    playoffCount[s.teamId] = 0;
    totalWins[s.teamId] = 0;
  }

  for (let sim = 0; sim < numSims; sim++) {
    const simWins: Record<string, number> = {};
    for (const s of standings) simWins[s.teamId] = s.wins;

    for (const mp of matchupProbs) {
      if (Math.random() < mp.p1) simWins[mp.team1Id]++;
      else simWins[mp.team2Id]++;
    }

    const simStandings = standings
      .map((s) => ({ id: s.teamId, w: simWins[s.teamId], pf: s.pointsFor }))
      .sort((a, b) => (b.w !== a.w ? b.w - a.w : b.pf - a.pf));

    for (let i = 0; i < simStandings.length; i++) {
      if (i < playoffSpots) playoffCount[simStandings[i].id]++;
      totalWins[simStandings[i].id] += simStandings[i].w;
    }
  }

  for (const s of standings) {
    results.set(s.teamId, {
      playoffPct: Math.round((playoffCount[s.teamId] / numSims) * 100),
      avgProjectedWins: round1(totalWins[s.teamId] / numSims),
    });
  }
  return results;
}

const formatRecord = (w: number, l: number, t: number) => (t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`);

/** Deterministic per-team narrative assembled from computed facts. */
function buildNarrative(input: {
  name: string;
  rank: number;
  teamCount: number;
  grade: string;
  wins: number;
  losses: number;
  ties: number;
  ppg: number;
  positions: PositionBreakdown[];
  scheduleLabel: 'tough' | 'average' | 'easy' | null;
  avgOpponentPpg: number | null;
  remainingGames: number;
  playoffPct: number;
  hasGames: boolean;
}): string {
  const {
    name, rank, teamCount, grade, wins, losses, ties, ppg,
    positions, scheduleLabel, avgOpponentPpg, remainingGames, playoffPct, hasGames,
  } = input;

  const sentences: string[] = [];

  if (!hasGames) {
    sentences.push(
      `${name} hasn't logged any completed games yet, so overall strength can't be graded — check back once the season is underway.`,
    );
  } else {
    sentences.push(
      `${name} ranks #${rank} of ${teamCount} in overall strength with a ${grade} grade, averaging ${round1(ppg)} points per game on a ${formatRecord(wins, losses, ties)} record.`,
    );
  }

  const rated = positions.filter((p) => p.starterCount > 0 && p.leagueAvg > 0);
  const best = rated.length > 0 ? rated.reduce((a, b) => (b.deltaPct > a.deltaPct ? b : a)) : null;
  const worst = rated.length > 0 ? rated.reduce((a, b) => (b.deltaPct < a.deltaPct ? b : a)) : null;

  if (best && best.deltaPct > 0) {
    sentences.push(
      `Their biggest strength is ${best.position}, where the starters average ${round1(best.avgPoints)} points per game — ${round1(best.deltaPct)}% above the league average.`,
    );
  }

  if (worst && worst.deltaPct < 0) {
    sentences.push(
      `The clearest hole is ${worst.position} (${round1(Math.abs(worst.deltaPct))}% below league average) — that's the position to target in trades or on waivers.`,
    );
  } else if (rated.length > 0) {
    sentences.push(`There's no glaring positional hole — balanced production is this roster's best asset.`);
  }

  if (remainingGames > 0 && scheduleLabel && avgOpponentPpg != null) {
    const schedulePhrase =
      scheduleLabel === 'tough' ? 'a tough' : scheduleLabel === 'easy' ? 'an easy' : 'an average';
    sentences.push(
      `With ${schedulePhrase} remaining schedule (opponents averaging ${round1(avgOpponentPpg)} PPG over ${remainingGames} game${remainingGames === 1 ? '' : 's'}), their playoff odds sit at ${playoffPct}%.`,
    );
  } else if (hasGames) {
    sentences.push(
      playoffPct === 100
        ? `The regular season is complete — they finished in a playoff spot.`
        : `The regular season is complete — they finished outside the playoff picture.`,
    );
  }

  return sentences.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /:leagueId — full league analysis
// ─────────────────────────────────────────────────────────────────────────────
leagueAnalyzerRoutes.get('/:leagueId', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Verify the league belongs to this user (same ownership check as routes/leagues.ts)
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId),
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
  });

  if (!league) {
    return c.json({ error: 'League not found' }, 404);
  }

  try {
    const format = normalizeFormat(league.scoringFormat);
    const seasonYear = league.seasonYear;
    const currentWeek = league.currentWeek || 1;

    // ── Batch load everything up-front (no per-team queries) ────────────────
    const teams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, leagueId),
      with: { owner: { columns: { username: true } } },
    });

    if (teams.length === 0) {
      return c.json({
        league: {
          id: league.id,
          name: league.name,
          currentWeek,
          seasonYear,
          playoffTeams: league.playoffTeams || 6,
          scoringFormat: format,
          teamCount: 0,
        },
        leagueAvgPpg: 0,
        positionAverages: {},
        teams: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const teamIds = teams.map((t) => t.id);

    // Roster spots for every team in one query (≤32 team ids)
    const allSpots = await db.query.rosterSpots.findMany({
      where: inArray(schema.rosterSpots.teamId, teamIds),
      columns: { teamId: true, playerId: true, isStarter: true },
    });

    const playerIds = Array.from(new Set(allSpots.map((s) => s.playerId)));

    // Players, weekly stats, and current-week projections — chunked batches
    const playersById = new Map<string, { id: string; name: string; position: string }>();
    const statsByPlayer = new Map<string, { points: number; played: boolean }[]>();
    const projByPlayer = new Map<string, { points: number; format: string }[]>();

    for (let i = 0; i < playerIds.length; i += CHUNK) {
      const chunk = playerIds.slice(i, i + CHUNK);

      const [players, stats, projections] = await Promise.all([
        db.query.nflPlayers.findMany({
          where: inArray(schema.nflPlayers.id, chunk),
          columns: { id: true, name: true, position: true },
        }),
        db.query.playerWeeklyStats.findMany({
          where: and(
            inArray(schema.playerWeeklyStats.playerId, chunk),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear),
          ),
          columns: {
            playerId: true,
            week: true,
            offSnaps: true,
            fantasyPointsPPR: true,
            fantasyPointsHalf: true,
            fantasyPointsStd: true,
          },
        }),
        db.query.playerProjections.findMany({
          where: and(
            inArray(schema.playerProjections.playerId, chunk),
            eq(schema.playerProjections.week, currentWeek),
            eq(schema.playerProjections.seasonYear, seasonYear),
          ),
          columns: { playerId: true, projectedPoints: true, scoringFormat: true },
        }),
      ]);

      for (const p of players) playersById.set(p.id, p);
      for (const s of stats) {
        if (s.week > currentWeek) continue;
        const points =
          format === 'half-ppr'
            ? s.fantasyPointsHalf ?? 0
            : format === 'standard'
              ? s.fantasyPointsStd ?? 0
              : s.fantasyPointsPPR ?? 0;
        const played = points !== 0 || (s.offSnaps ?? 0) > 0;
        const list = statsByPlayer.get(s.playerId) || [];
        list.push({ points, played });
        statsByPlayer.set(s.playerId, list);
      }
      for (const pr of projections) {
        const list = projByPlayer.get(pr.playerId) || [];
        list.push({ points: pr.projectedPoints, format: pr.scoringFormat });
        projByPlayer.set(pr.playerId, list);
      }
    }

    // All league matchups in one query
    const leagueMatchups = await db.query.matchups.findMany({
      where: eq(schema.matchups.leagueId, leagueId),
      columns: {
        id: true,
        week: true,
        homeTeamId: true,
        awayTeamId: true,
        isComplete: true,
        isPlayoff: true,
      },
    });

    // ── Per-player value: season PPG, falling back to this week's projection ─
    const playerValue = new Map<string, number>();
    for (const pid of playerIds) {
      const rows = statsByPlayer.get(pid) || [];
      const playedRows = rows.filter((r) => r.played);
      if (playedRows.length > 0) {
        const total = playedRows.reduce((sum, r) => sum + r.points, 0);
        playerValue.set(pid, total / playedRows.length);
        continue;
      }
      const projs = projByPlayer.get(pid) || [];
      const preferred = projs.find((p) => normalizeFormat(p.format) === format) || projs[0];
      playerValue.set(pid, preferred ? preferred.points : 0);
    }

    // ── Team-level aggregates ────────────────────────────────────────────────
    const spotsByTeam = new Map<string, typeof allSpots>();
    for (const spot of allSpots) {
      const list = spotsByTeam.get(spot.teamId) || [];
      list.push(spot);
      spotsByTeam.set(spot.teamId, list);
    }

    // Positional average of starters per team
    const teamPositionAvg = new Map<string, Map<GradedPosition, { avg: number; count: number }>>();
    for (const team of teams) {
      const posMap = new Map<GradedPosition, { avg: number; count: number }>();
      const starters = (spotsByTeam.get(team.id) || []).filter((s) => s.isStarter);
      const byPos = new Map<GradedPosition, number[]>();
      for (const spot of starters) {
        const player = playersById.get(spot.playerId);
        if (!player) continue;
        const pos = player.position as GradedPosition;
        if (!GRADED_POSITIONS.includes(pos)) continue;
        const list = byPos.get(pos) || [];
        list.push(playerValue.get(spot.playerId) || 0);
        byPos.set(pos, list);
      }
      for (const [pos, values] of byPos) {
        posMap.set(pos, {
          avg: values.reduce((s, v) => s + v, 0) / values.length,
          count: values.length,
        });
      }
      teamPositionAvg.set(team.id, posMap);
    }

    // League average per position (mean of per-team averages, teams with starters at that position)
    const positionAverages: Record<string, number> = {};
    for (const pos of GRADED_POSITIONS) {
      let sum = 0;
      let count = 0;
      for (const team of teams) {
        const entry = teamPositionAvg.get(team.id)?.get(pos);
        if (entry && entry.count > 0) {
          sum += entry.avg;
          count++;
        }
      }
      if (count > 0) positionAverages[pos] = round1(sum / count);
    }

    // League-average team PPG (teams with games played)
    let leagueAvgPpg = 0;
    let teamsWithGames = 0;
    const teamPpg = new Map<string, number>();
    for (const team of teams) {
      const gp = team.wins + team.losses + team.ties;
      if (gp > 0) {
        const ppg = team.pointsFor / gp;
        teamPpg.set(team.id, ppg);
        leagueAvgPpg += ppg;
        teamsWithGames++;
      } else {
        teamPpg.set(team.id, 0);
      }
    }
    leagueAvgPpg = teamsWithGames > 0 ? leagueAvgPpg / teamsWithGames : 0;

    // ── Remaining schedule + Monte Carlo playoff odds ────────────────────────
    const standingsInput: StandingInput[] = teams.map((t) => ({
      teamId: t.id,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      pointsFor: t.pointsFor,
    }));

    // Regular-season length = distinct non-playoff weeks in the schedule data
    const regularSeasonWeeks = new Set(
      leagueMatchups.filter((m) => !m.isPlayoff).map((m) => m.week),
    ).size;

    const remainingRegularSeason: RemainingMatchup[] = filterRemainingMatchups(
      standingsInput,
      leagueMatchups
        .filter((m) => !m.isComplete && !m.isPlayoff)
        .map((m) => ({ id: m.id, team1Id: m.homeTeamId, team2Id: m.awayTeamId })),
      regularSeasonWeeks,
    );

    const playoffSpots = league.playoffTeams || 6;
    const mcResults = runMonteCarlo(standingsInput, remainingRegularSeason, playoffSpots);

    // ROS schedule difficulty: average opponent PPG over remaining matchups
    const scheduleByTeam = new Map<string, { avgOpponentPpg: number | null; remainingGames: number }>();
    for (const team of teams) {
      const opponents = remainingRegularSeason
        .filter((m) => m.team1Id === team.id || m.team2Id === team.id)
        .map((m) => (m.team1Id === team.id ? m.team2Id : m.team1Id));
      if (opponents.length === 0) {
        scheduleByTeam.set(team.id, { avgOpponentPpg: null, remainingGames: 0 });
        continue;
      }
      const total = opponents.reduce((sum, oppId) => sum + (teamPpg.get(oppId) || leagueAvgPpg), 0);
      scheduleByTeam.set(team.id, {
        avgOpponentPpg: total / opponents.length,
        remainingGames: opponents.length,
      });
    }

    // ── Assemble per-team results ────────────────────────────────────────────
    const unranked = teams.map((team) => {
      const gp = team.wins + team.losses + team.ties;
      const ppg = teamPpg.get(team.id) || 0;
      const ratio = leagueAvgPpg > 0 && gp > 0 ? ppg / leagueAvgPpg : 1;
      const grade = leagueAvgPpg > 0 && gp > 0 ? gradeFromRatio(ratio) : 'B';

      const posMap = teamPositionAvg.get(team.id) || new Map();
      const positions: PositionBreakdown[] = GRADED_POSITIONS.filter(
        (pos) => positionAverages[pos] != null,
      ).map((pos) => {
        const entry = posMap.get(pos);
        const avg = entry?.avg ?? 0;
        const count = entry?.count ?? 0;
        const leagueAvg = positionAverages[pos];
        const deltaPct = leagueAvg > 0 ? ((avg - leagueAvg) / leagueAvg) * 100 : 0;
        const status: PositionBreakdown['status'] =
          deltaPct >= 10 ? 'surplus' : deltaPct <= -10 ? 'deficit' : 'balanced';
        return {
          position: pos,
          starterCount: count,
          avgPoints: round1(avg),
          leagueAvg,
          deltaPct: round1(deltaPct),
          status,
        };
      });

      const schedule = scheduleByTeam.get(team.id) || { avgOpponentPpg: null, remainingGames: 0 };
      const scheduleDeltaPct =
        schedule.avgOpponentPpg != null && leagueAvgPpg > 0
          ? ((schedule.avgOpponentPpg - leagueAvgPpg) / leagueAvgPpg) * 100
          : null;
      const scheduleLabel: 'tough' | 'average' | 'easy' | null =
        scheduleDeltaPct == null ? null : scheduleDeltaPct >= 3 ? 'tough' : scheduleDeltaPct <= -3 ? 'easy' : 'average';

      const mc = mcResults.get(team.id);
      const rated = positions.filter((p) => p.starterCount > 0 && p.leagueAvg > 0);
      const worst = rated.length > 0 ? rated.reduce((a, b) => (b.deltaPct < a.deltaPct ? b : a)) : null;

      // Best-effort user-team flag via the membership's stored Sleeper user id.
      // The client refines this against its own userTeam from LeagueContext.
      const isUserTeam =
        membership.externalUsername != null &&
        team.externalOwnerId != null &&
        team.externalOwnerId === membership.externalUsername;

      return {
        id: team.id,
        name: team.name,
        ownerName: team.ownerDisplayName || team.owner?.username || 'Unknown',
        isUserTeam,
        record: { wins: team.wins, losses: team.losses, ties: team.ties },
        gamesPlayed: gp,
        pointsFor: round1(team.pointsFor),
        pointsAgainst: round1(team.pointsAgainst),
        ppg: round1(ppg),
        grade,
        strengthScore: round1(ratio * 100),
        positions,
        tradeTargetPosition: worst && worst.deltaPct < 0 ? worst.position : null,
        scheduleDifficulty: {
          avgOpponentPpg: schedule.avgOpponentPpg != null ? round1(schedule.avgOpponentPpg) : null,
          deltaPct: scheduleDeltaPct != null ? round1(scheduleDeltaPct) : null,
          label: scheduleLabel,
          remainingGames: schedule.remainingGames,
        },
        playoffOdds: mc?.playoffPct ?? 0,
        projectedWins: mc?.avgProjectedWins ?? team.wins,
      };
    });

    // Rank by strength (PPG ratio), tiebreak wins then points for
    const ranked = [...unranked].sort((a, b) => {
      if (b.strengthScore !== a.strengthScore) return b.strengthScore - a.strengthScore;
      if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
      return b.pointsFor - a.pointsFor;
    });

    const analyzedTeams = ranked.map((team, index) => {
      const rank = index + 1;
      return {
        ...team,
        rank,
        narrative: buildNarrative({
          name: team.name,
          rank,
          teamCount: teams.length,
          grade: team.grade,
          wins: team.record.wins,
          losses: team.record.losses,
          ties: team.record.ties,
          ppg: team.ppg,
          positions: team.positions,
          scheduleLabel: team.scheduleDifficulty.label,
          avgOpponentPpg: team.scheduleDifficulty.avgOpponentPpg,
          remainingGames: team.scheduleDifficulty.remainingGames,
          playoffPct: team.playoffOdds,
          hasGames: team.gamesPlayed > 0,
        }),
      };
    });

    return c.json({
      league: {
        id: league.id,
        name: league.name,
        currentWeek,
        seasonYear,
        playoffTeams: playoffSpots,
        scoringFormat: format,
        teamCount: teams.length,
      },
      leagueAvgPpg: round1(leagueAvgPpg),
      positionAverages,
      teams: analyzedTeams,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('League analyzer error:', error);
    return c.json({ error: 'Failed to analyze league' }, 500);
  }
});
