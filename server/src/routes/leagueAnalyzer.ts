import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireTier } from '../middleware/tier';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import { buildCachedSystemBlocks, sanitizePromptInput } from '../utils/prompt';
import type { Env, Variables } from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// League Analyzer — league-wide analysis computed entirely from already-synced
// data (teams, roster_spots, players, player_weekly_stats, player_projections,
// matchups): grades, positional surplus/deficit, ROS schedule difficulty, and
// Monte Carlo playoff odds. The per-team and league-wide AI narratives (below)
// layer real Anthropic-generated analysis on top of those computed facts.
// ─────────────────────────────────────────────────────────────────────────────

const analyzerRateLimit = rateLimit(60, 60 * 1000);
const aiRateLimit = rateLimit(10, 60 * 1000); // AI calls are more expensive than the deterministic endpoint

export const leagueAnalyzerRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

leagueAnalyzerRoutes.use('*', analyzerRateLimit);

const AI_MODEL = 'claude-sonnet-5'; // same model as the per-player analysis + trades follow-up calls

// Carries an HTTP status alongside the message so a shared/deduped generation
// (see below) can surface the right response to every waiter, not just a
// generic 500.
class RouteError extends Error {
  constructor(public status: 404 | 503, message: string) {
    super(message);
    this.name = 'RouteError';
  }
}

// In-flight request coalescing: if two viewers hit an uncached narrative/pulse
// for the same cache key at the same time, only the first triggers an
// Anthropic call — the rest await that same promise instead of firing their
// own (duplicate, billable) request. Keyed by the same (id, season, week)
// tuple used for the DB cache row; entries are removed in `finally` so a
// later cache miss (new week, cache cleared) always starts a fresh call.
const narrativeInFlight = new Map<string, Promise<{ narrative: string; generatedAt: string }>>();
const pulseInFlight = new Map<string, Promise<{ narrative: string; ranking: string[] | null; generatedAt: string }>>();

type Db = ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>;
type LeagueRow = typeof schema.leagues.$inferSelect;
type MembershipRow = typeof schema.leagueMembers.$inferSelect;

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
  /** Percent of this team's total starter point production coming from this position. */
  pointShare: number;
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

/** Shared membership + league lookup used by every route below. */
async function loadLeagueForUser(db: Db, userId: string, leagueId: string) {
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, userId),
      eq(schema.leagueMembers.leagueId, leagueId),
    ),
  });
  if (!membership) return { error: 'Not a member of this league' as const, status: 403 as const };

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
  });
  if (!league) return { error: 'League not found' as const, status: 404 as const };

  return { membership, league };
}

/**
 * Computes the full deterministic league analysis (grades, positional
 * surplus/deficit, ROS schedule difficulty, Monte Carlo playoff odds, and a
 * template-sentence narrative per team) from already-synced data. Shared by
 * the main analysis route and the AI narrative routes below, which use the
 * same computed facts as the data block fed to Anthropic.
 */
async function computeLeagueAnalysis(db: Db, league: LeagueRow, membership: MembershipRow) {
  const format = normalizeFormat(league.scoringFormat);
  const seasonYear = league.seasonYear;
  const currentWeek = league.currentWeek || 1;

  // ── Batch load everything up-front (no per-team queries) ────────────────
  const teams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, league.id),
    with: { owner: { columns: { username: true } } },
  });

  if (teams.length === 0) {
    return {
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
    };
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
      where: eq(schema.matchups.leagueId, league.id),
      columns: {
        id: true,
        week: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
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

    // Forward-looking per-player value for "projected PPG": prefer this
    // week's projection (a real look-ahead signal) over season-to-date PPG.
    // Falls back to playerValue for players with no projection (byes, etc.)
    // so a gap doesn't zero out the team's projected total.
    const playerProjectedValue = new Map<string, number>();
    for (const pid of playerIds) {
      const projs = projByPlayer.get(pid) || [];
      const preferred = projs.find((p) => normalizeFormat(p.format) === format) || projs[0];
      playerProjectedValue.set(pid, preferred ? preferred.points : playerValue.get(pid) || 0);
    }

    // ── Team-level aggregates ────────────────────────────────────────────────
    const spotsByTeam = new Map<string, typeof allSpots>();
    for (const spot of allSpots) {
      const list = spotsByTeam.get(spot.teamId) || [];
      list.push(spot);
      spotsByTeam.set(spot.teamId, list);
    }

    // Positional average + total of starters per team, plus the team's
    // forward-looking projected PPG (sum of starters' projectedValue) — both
    // computed fresh from current roster_spots on every request, so a roster
    // change (trade, waiver add) is reflected immediately, no caching lag.
    const teamPositionAvg = new Map<string, Map<GradedPosition, { avg: number; count: number; sum: number }>>();
    const teamProjectedPpg = new Map<string, number>();
    for (const team of teams) {
      const posMap = new Map<GradedPosition, { avg: number; count: number; sum: number }>();
      const starters = (spotsByTeam.get(team.id) || []).filter((s) => s.isStarter);
      const byPos = new Map<GradedPosition, number[]>();
      let projectedTotal = 0;
      for (const spot of starters) {
        projectedTotal += playerProjectedValue.get(spot.playerId) || 0;
        const player = playersById.get(spot.playerId);
        if (!player) continue;
        const pos = player.position as GradedPosition;
        if (!GRADED_POSITIONS.includes(pos)) continue;
        const list = byPos.get(pos) || [];
        list.push(playerValue.get(spot.playerId) || 0);
        byPos.set(pos, list);
      }
      for (const [pos, values] of byPos) {
        const sum = values.reduce((s, v) => s + v, 0);
        posMap.set(pos, { avg: sum / values.length, count: values.length, sum });
      }
      teamPositionAvg.set(team.id, posMap);
      teamProjectedPpg.set(team.id, projectedTotal);
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

    // Recent form: each team's average score over its last 3 completed games,
    // compared to its season PPG. This is the momentum signal the AI power
    // ranking uses to weigh "hot/cold" teams — raw season PPG alone just
    // reproduces the standings.
    const recentFormByTeam = new Map<string, { recentPpg: number | null; trend: 'up' | 'down' | 'steady' }>();
    for (const team of teams) {
      const recentGames = leagueMatchups
        .filter((m) => m.isComplete && (m.homeTeamId === team.id || m.awayTeamId === team.id))
        .map((m) => (m.homeTeamId === team.id ? { week: m.week, score: m.homeScore } : { week: m.week, score: m.awayScore }))
        .filter((g): g is { week: number; score: number } => g.score != null)
        .sort((a, b) => b.week - a.week)
        .slice(0, 3);

      if (recentGames.length === 0) {
        recentFormByTeam.set(team.id, { recentPpg: null, trend: 'steady' });
        continue;
      }
      const recentPpg = recentGames.reduce((sum, g) => sum + g.score, 0) / recentGames.length;
      const seasonPpg = teamPpg.get(team.id) || 0;
      const deltaPct = seasonPpg > 0 ? ((recentPpg - seasonPpg) / seasonPpg) * 100 : 0;
      const trend: 'up' | 'down' | 'steady' = deltaPct >= 5 ? 'up' : deltaPct <= -5 ? 'down' : 'steady';
      recentFormByTeam.set(team.id, { recentPpg: round1(recentPpg), trend });
    }

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

    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

    // ── Assemble per-team results ────────────────────────────────────────────
    const unranked = teams.map((team) => {
      const gp = team.wins + team.losses + team.ties;
      const ppg = teamPpg.get(team.id) || 0;
      const ratio = leagueAvgPpg > 0 && gp > 0 ? ppg / leagueAvgPpg : 1;
      const grade = leagueAvgPpg > 0 && gp > 0 ? gradeFromRatio(ratio) : 'B';

      const posMap = teamPositionAvg.get(team.id) || new Map();
      const totalStarterSum = Array.from(posMap.values()).reduce((s, e) => s + e.sum, 0);
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
          pointShare: totalStarterSum > 0 ? round1(((entry?.sum ?? 0) / totalStarterSum) * 100) : 0,
        };
      });

      // Biggest remaining swing game: the closest-PPG opponent left on the
      // schedule is the most uncertain, highest-leverage remaining result.
      const ownPpg = ppg;
      const remainingOpponents = remainingRegularSeason
        .filter((m) => m.team1Id === team.id || m.team2Id === team.id)
        .map((m) => {
          const oppId = m.team1Id === team.id ? m.team2Id : m.team1Id;
          const opponentPpg = teamPpg.get(oppId) ?? leagueAvgPpg;
          return { week: leagueMatchups.find((lm) => lm.id === m.id)?.week ?? 0, oppId, opponentPpg };
        });
      const biggestSwingGame = remainingOpponents.length > 0
        ? remainingOpponents.reduce((closest, cur) =>
            Math.abs(cur.opponentPpg - ownPpg) < Math.abs(closest.opponentPpg - ownPpg) ? cur : closest,
          )
        : null;

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

      const form = recentFormByTeam.get(team.id) || { recentPpg: null, trend: 'steady' as const };
      const projectedPpg = round1(teamProjectedPpg.get(team.id) || 0);

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
        recentFormPpg: form.recentPpg,
        trend: form.trend,
        projectedPpg,
        projectedPpgDelta: round1(projectedPpg - ppg),
        biggestSwingGame: biggestSwingGame && biggestSwingGame.week > 0
          ? {
              week: biggestSwingGame.week,
              opponentId: biggestSwingGame.oppId,
              opponentName: teamNameById.get(biggestSwingGame.oppId) || 'Unknown',
              opponentPpg: round1(biggestSwingGame.opponentPpg),
            }
          : null,
      };
    });

    // Rank by strength (PPG ratio), tiebreak wins then points for
    const ranked = [...unranked].sort((a, b) => {
      if (b.strengthScore !== a.strengthScore) return b.strengthScore - a.strengthScore;
      if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
      return b.pointsFor - a.pointsFor;
    });

    // Real win-loss standings order (independent of the strength/PPG-ratio
    // rank above) — the gap between the two is the "contender vs lucky
    // record" signal: a team ranked much better by record than by strength
    // is overachieving (regression risk); the reverse is underachieving
    // (a buy-low candidate before the market catches up).
    const recordOrder = [...unranked].sort((a, b) => {
      if (b.record.wins !== a.record.wins) return b.record.wins - a.record.wins;
      return b.pointsFor - a.pointsFor;
    });
    const recordRankById = new Map(recordOrder.map((t, i) => [t.id, i + 1]));

    const analyzedTeams = ranked.map((team, index) => {
      const rank = index + 1;
      const recordRank = recordRankById.get(team.id) ?? rank;
      const rankGap = recordRank - rank;
      const recordVsStrength: 'overachieving' | 'underachieving' | 'aligned' =
        team.gamesPlayed === 0 ? 'aligned' : rankGap <= -2 ? 'overachieving' : rankGap >= 2 ? 'underachieving' : 'aligned';
      return {
        ...team,
        recordRank,
        recordVsStrength,
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

    return {
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
    };
}

type LeagueAnalysis = Awaited<ReturnType<typeof computeLeagueAnalysis>>;
type AnalyzedTeam = LeagueAnalysis['teams'][number];

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

  const loaded = await loadLeagueForUser(db, user.id, leagueId);
  if ('error' in loaded) {
    return c.json({ error: loaded.error }, loaded.status);
  }

  try {
    const result = await computeLeagueAnalysis(db, loaded.league, loaded.membership);
    return c.json(result);
  } catch (error) {
    console.error('League analyzer error:', error);
    return c.json({ error: 'Failed to analyze league' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI narratives — real Anthropic-generated analysis layered on the computed
// facts above. Cached per (team|league, season, week) so every viewer of the
// same league shares one generation.
// ─────────────────────────────────────────────────────────────────────────────

/** Renders one team's computed facts as a data-block section for AI prompts. */
function formatTeamFacts(team: AnalyzedTeam, leagueAvgPpg: number, teamCount: number): string {
  // Team/owner names are user-controlled (renamed via league settings), so
  // sanitize before interpolating into the prompt to defuse prompt-injection
  // attempts hiding in a team or owner name.
  const safeName = sanitizePromptInput(team.name, 80);
  const safeOwnerName = sanitizePromptInput(team.ownerName, 80);

  const positionLines = team.positions
    .filter((p) => p.starterCount > 0)
    .map(
      (p) =>
        `  ${p.position}: ${p.avgPoints.toFixed(1)} PPG vs league avg ${p.leagueAvg.toFixed(1)} (${p.deltaPct > 0 ? '+' : ''}${p.deltaPct.toFixed(1)}%, ${p.status})`,
    )
    .join('\n');

  const scheduleLine =
    team.scheduleDifficulty.remainingGames > 0 && team.scheduleDifficulty.label
      ? `${team.scheduleDifficulty.label} ROS — opponents average ${team.scheduleDifficulty.avgOpponentPpg?.toFixed(1)} PPG over ${team.scheduleDifficulty.remainingGames} remaining games`
      : 'Regular season complete';

  const formLine = team.recentFormPpg != null
    ? `${team.recentFormPpg.toFixed(1)} PPG over last 3 games (trending ${team.trend} vs season average)`
    : 'no completed games yet';

  return `${safeName} (owner: ${safeOwnerName}) [id: ${team.id}]
Standings rank #${team.rank} of ${teamCount} by season PPG | Grade: ${team.grade} | Record: ${formatRecord(team.record.wins, team.record.losses, team.record.ties)} | Season PPG: ${team.ppg.toFixed(1)} (league avg ${leagueAvgPpg.toFixed(1)})
Recent form: ${formLine}
Points for: ${team.pointsFor.toFixed(1)} | Points against: ${team.pointsAgainst.toFixed(1)}
Positional breakdown (starters):
${positionLines || '  (no starter data yet)'}
Remaining schedule: ${scheduleLine}
Playoff odds: ${team.playoffOdds}% | Projected wins: ${team.projectedWins.toFixed(1)}`;
}

const TEAM_NARRATIVE_SYSTEM_PROMPT = `You are FilmRoom's fantasy football analyst writing a scouting report on one team in a fantasy league, for that team's manager and their league-mates.

You will receive a data block with the team's rank and grade relative to the league, record, points per game, a positional breakdown (starter average vs league average at each position), remaining schedule difficulty, Monte Carlo playoff odds, and current starting lineup.

Write 2-4 short paragraphs (under 180 words total) covering: the team's biggest strength and clearest weakness by position, what their remaining schedule and playoff odds mean for the rest of the season, and one concrete recommendation (a trade target position, a lineup consideration, or a storyline to watch).

Rules:
- Use ONLY the facts in the data block. Do not invent stats, injuries, or news not present in the data.
- Reference specific numbers from the data block.
- Respond in plain text — no markdown, no headings, no bullet lists.`;

// GET /:leagueId/teams/:teamId/narrative — cached per (team, season, week).
leagueAnalyzerRoutes.get(
  '/:leagueId/teams/:teamId/narrative',
  authMiddleware,
  requireTier('pro', 'AI team scouting report'),
  aiRateLimit,
  async (c) => {
    const user = c.get('user');
    const db = c.get('db');
    const anthropicKey = c.env.ANTHROPIC_API_KEY;
    const leagueId = c.req.param('leagueId');
    const teamId = c.req.param('teamId');

    if (!user) return c.json({ error: 'Not authenticated' }, 401);
    if (!anthropicKey) {
      return c.json({ error: 'AI analysis is not configured. Missing API key.' }, 503);
    }

    const loaded = await loadLeagueForUser(db, user.id, leagueId);
    if ('error' in loaded) {
      return c.json({ error: loaded.error }, loaded.status);
    }
    const { league, membership } = loaded;
    const seasonYear = league.seasonYear;
    const week = league.currentWeek || 1;

    try {
      // Cross-league IDOR guard: team_ai_narratives is keyed by (teamId,
      // seasonYear, week) only — it has no leagueId column — so a teamId from
      // a DIFFERENT league that happens to share the same season/week would
      // otherwise serve that other league's cached narrative to a caller who
      // is only verified as a member of `leagueId`. Verify team ownership
      // BEFORE any cache lookup so both the cached and uncached paths share
      // this guard.
      const teamInLeague = await db.query.teams.findFirst({
        where: and(eq(schema.teams.id, teamId), eq(schema.teams.leagueId, leagueId)),
        columns: { id: true },
      });
      if (!teamInLeague) {
        return c.json({ error: 'Team not found in this league' }, 404);
      }

      const cachedRow = await db.query.teamAiNarratives.findFirst({
        where: and(
          eq(schema.teamAiNarratives.teamId, teamId),
          eq(schema.teamAiNarratives.seasonYear, seasonYear),
          eq(schema.teamAiNarratives.week, week),
        ),
      });
      if (cachedRow) {
        return c.json({
          narrative: cachedRow.narrative,
          cached: true,
          generatedAt: cachedRow.createdAt,
          season: seasonYear,
          week,
        });
      }

      const cacheKey = `${teamId}:${seasonYear}:${week}`;
      let generation = narrativeInFlight.get(cacheKey);
      if (!generation) {
        generation = (async () => {
          const analysis = await computeLeagueAnalysis(db, league, membership);
          const team = analysis.teams.find((t) => t.id === teamId);
          if (!team) throw new RouteError(404, 'Team not found in this league');

          const starterSpots = await db.query.rosterSpots.findMany({
            where: and(eq(schema.rosterSpots.teamId, teamId), eq(schema.rosterSpots.isStarter, true)),
            columns: { playerId: true },
          });
          const starterIds = starterSpots.map((s: { playerId: string }) => s.playerId);
          const starters = starterIds.length > 0
            ? await db.query.nflPlayers.findMany({
                where: inArray(schema.nflPlayers.id, starterIds),
                columns: { name: true, position: true },
              })
            : [];
          const starterLine = starters.length > 0
            ? starters.map((p: { name: string; position: string }) => `${p.name} (${p.position})`).join(', ')
            : '(no roster synced yet)';

          const dataBlock = `TEAM DATA (season ${seasonYear}, week ${week}):
${formatTeamFacts(team, analysis.leagueAvgPpg, analysis.teams.length)}
Current starters: ${starterLine}`;

          let narrative: string;
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 500,
                system: buildCachedSystemBlocks(TEAM_NARRATIVE_SYSTEM_PROMPT),
                messages: [{ role: 'user', content: dataBlock }],
              }),
              signal: AbortSignal.timeout(30000),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              console.error('[league-analyzer/narrative] Anthropic error:', res.status, errText);
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            const data = (await res.json()) as { content?: { type: string; text?: string }[] };
            const text = data.content?.find((b) => b.type === 'text')?.text?.trim();
            if (!text) {
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            narrative = text;
          } catch (err) {
            if (err instanceof RouteError) throw err;
            console.error('[league-analyzer/narrative] AI call failed:', err);
            throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
          }

          try {
            await db
              .insert(schema.teamAiNarratives)
              .values({ id: generateId(), teamId, seasonYear, week, narrative, model: AI_MODEL })
              .onConflictDoNothing();
          } catch (err) {
            console.error('[league-analyzer/narrative] failed to cache narrative:', err);
          }

          return { narrative, generatedAt: new Date().toISOString() };
        })();
        narrativeInFlight.set(cacheKey, generation);
        generation.finally(() => narrativeInFlight.delete(cacheKey));
      }

      const result = await generation;
      return c.json({ narrative: result.narrative, cached: false, generatedAt: result.generatedAt, season: seasonYear, week });
    } catch (error) {
      if (error instanceof RouteError) {
        return c.json({ error: error.message }, error.status);
      }
      console.error('Team AI narrative error:', error);
      return c.json({ error: 'Failed to generate team narrative' }, 500);
    }
  },
);

const LEAGUE_PULSE_SYSTEM_PROMPT = `You are FilmRoom's fantasy football analyst producing a weekly "power ranking" and pulse briefing for a fantasy league, shared with every manager.

You will receive a data block listing every team's id, season-long standings rank, grade, record, points per game, recent form (last 3 games vs season average — the momentum signal), positional surpluses/deficits, remaining schedule difficulty, and Monte Carlo playoff odds.

A power ranking is NOT the same as the standings — it's your holistic judgment of which team is actually playing best right now. Weigh recent form heavily: a team with a losing record but a hot last 3 games can rank above a team coasting on an early-season winning record. Also weigh positional strength/weakness, remaining schedule, and playoff odds. Ties in the data should be broken by which team you'd rather own going forward.

Respond with ONLY valid JSON (no markdown fences, no other text), in this exact shape:
{"ranking": ["<team id>", "<team id>", ...], "narrative": "<3-5 short paragraphs, under 220 words>"}

Rules for "ranking":
- Must contain every team id from the data block EXACTLY as given, each exactly once, ordered from most to least powerful.
- Use the exact id strings from the data block's "[id: ...]" tags — do not alter, guess, or invent ids.

Rules for "narrative":
- Cover: the biggest mover(s) between the power ranking and the raw standings and why, the tightest part of the playoff race, any position that's scarce or abundant league-wide (a trade-market observation), and one storyline to watch.
- Use ONLY the facts in the data block. Do not invent stats, injuries, or news not present in the data.
- Keep the tone analytical, not mean-spirited — this is read by every manager in the league, including whoever you're describing.
- Plain text within the JSON string — no markdown, no headings, no bullet lists.`;

/** Validates the model's ranking is exactly a permutation of the league's team ids. */
function isValidRanking(ranking: unknown, teamIds: string[]): ranking is string[] {
  if (!Array.isArray(ranking) || ranking.length !== teamIds.length) return false;
  const idSet = new Set(teamIds);
  const seen = new Set<string>();
  for (const id of ranking) {
    if (typeof id !== 'string' || !idSet.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

// GET /:leagueId/pulse — league-wide AI narrative, cached per (league, season, week).
leagueAnalyzerRoutes.get(
  '/:leagueId/pulse',
  authMiddleware,
  requireTier('pro', 'AI league pulse'),
  aiRateLimit,
  async (c) => {
    const user = c.get('user');
    const db = c.get('db');
    const anthropicKey = c.env.ANTHROPIC_API_KEY;
    const leagueId = c.req.param('leagueId');

    if (!user) return c.json({ error: 'Not authenticated' }, 401);
    if (!anthropicKey) {
      return c.json({ error: 'AI analysis is not configured. Missing API key.' }, 503);
    }

    const loaded = await loadLeagueForUser(db, user.id, leagueId);
    if ('error' in loaded) {
      return c.json({ error: loaded.error }, loaded.status);
    }
    const { league, membership } = loaded;
    const seasonYear = league.seasonYear;
    const week = league.currentWeek || 1;

    try {
      const cachedRow = await db.query.leagueAiPulses.findFirst({
        where: and(
          eq(schema.leagueAiPulses.leagueId, leagueId),
          eq(schema.leagueAiPulses.seasonYear, seasonYear),
          eq(schema.leagueAiPulses.week, week),
        ),
      });
      if (cachedRow) {
        // Degrade gracefully like the generation path below: a corrupted or
        // unexpectedly-shaped cached ranking shouldn't 500 the whole request —
        // the narrative still ships, the client falls back to standings order.
        let cachedRanking: string[] | null = null;
        if (cachedRow.rankingJson) {
          try {
            cachedRanking = JSON.parse(cachedRow.rankingJson);
          } catch (err) {
            console.error('[league-analyzer/pulse] failed to parse cached ranking JSON:', err);
            cachedRanking = null;
          }
        }
        return c.json({
          narrative: cachedRow.narrative,
          ranking: cachedRanking,
          cached: true,
          generatedAt: cachedRow.createdAt,
          season: seasonYear,
          week,
        });
      }

      const cacheKey = `${leagueId}:${seasonYear}:${week}`;
      let generation = pulseInFlight.get(cacheKey);
      if (!generation) {
        generation = (async () => {
          const analysis = await computeLeagueAnalysis(db, league, membership);
          if (analysis.teams.length === 0) {
            throw new RouteError(404, 'No teams found for this league yet.');
          }
          const teamIds = analysis.teams.map((t) => t.id);

          const teamBlocks = analysis.teams
            .map((t) => formatTeamFacts(t, analysis.leagueAvgPpg, analysis.teams.length))
            .join('\n\n');
          const safeLeagueName = sanitizePromptInput(analysis.league.name, 80);
          const dataBlock = `LEAGUE DATA (${safeLeagueName}, season ${seasonYear}, week ${week}, ${analysis.teams.length} teams, top ${analysis.league.playoffTeams} make playoffs):

${teamBlocks}`;

          let narrative: string;
          let ranking: string[] | null;
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 900,
                system: buildCachedSystemBlocks(LEAGUE_PULSE_SYSTEM_PROMPT),
                messages: [{ role: 'user', content: dataBlock }],
              }),
              signal: AbortSignal.timeout(30000),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              console.error('[league-analyzer/pulse] Anthropic error:', res.status, errText);
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            const data = (await res.json()) as { content?: { type: string; text?: string }[] };
            const text = data.content?.find((b) => b.type === 'text')?.text?.trim();
            if (!text) {
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }

            const jsonStr = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
            let parsed: { ranking?: unknown; narrative?: unknown };
            try {
              parsed = JSON.parse(jsonStr);
            } catch {
              console.error('[league-analyzer/pulse] non-JSON response:', text.slice(0, 300));
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            if (typeof parsed.narrative !== 'string' || !parsed.narrative.trim()) {
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            narrative = parsed.narrative.trim();
            // A malformed ranking degrades gracefully — the narrative still ships,
            // the client just falls back to the deterministic standings order.
            ranking = isValidRanking(parsed.ranking, teamIds) ? parsed.ranking : null;
            if (!ranking) {
              console.error('[league-analyzer/pulse] model returned an invalid ranking permutation');
            }
          } catch (err) {
            if (err instanceof RouteError) throw err;
            console.error('[league-analyzer/pulse] AI call failed:', err);
            throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
          }

          try {
            await db
              .insert(schema.leagueAiPulses)
              .values({
                id: generateId(),
                leagueId,
                seasonYear,
                week,
                narrative,
                rankingJson: ranking ? JSON.stringify(ranking) : null,
                model: AI_MODEL,
              })
              .onConflictDoNothing();
          } catch (err) {
            console.error('[league-analyzer/pulse] failed to cache pulse:', err);
          }

          return { narrative, ranking, generatedAt: new Date().toISOString() };
        })();
        pulseInFlight.set(cacheKey, generation);
        generation.finally(() => pulseInFlight.delete(cacheKey));
      }

      const result = await generation;
      return c.json({ narrative: result.narrative, ranking: result.ranking, cached: false, generatedAt: result.generatedAt, season: seasonYear, week });
    } catch (error) {
      if (error instanceof RouteError) {
        return c.json({ error: error.message }, error.status);
      }
      console.error('League AI pulse error:', error);
      return c.json({ error: 'Failed to generate league pulse' }, 500);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /:leagueId/ai-cache/invalidate — clear this week's cached AI pulse +
// team narratives so a roster change (trade, waiver move) doesn't leave every
// viewer looking at a stale take until the weekly cache key rolls over. Called
// by the client right after a successful league sync. Not tier-gated — any
// member re-syncing should refresh the shared cache, regardless of their own
// subscription. Deterministic stats (grades, positions, projected PPG, etc.)
// need no invalidation — computeLeagueAnalysis always reads current data.
// ─────────────────────────────────────────────────────────────────────────────
leagueAnalyzerRoutes.post('/:leagueId/ai-cache/invalidate', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');

  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const loaded = await loadLeagueForUser(db, user.id, leagueId);
  if ('error' in loaded) {
    return c.json({ error: loaded.error }, loaded.status);
  }
  const { league } = loaded;
  const seasonYear = league.seasonYear;
  const week = league.currentWeek || 1;

  try {
    const leagueTeams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, leagueId),
      columns: { id: true },
    });
    const teamIds = leagueTeams.map((t: { id: string }) => t.id);

    await db
      .delete(schema.leagueAiPulses)
      .where(and(
        eq(schema.leagueAiPulses.leagueId, leagueId),
        eq(schema.leagueAiPulses.seasonYear, seasonYear),
        eq(schema.leagueAiPulses.week, week),
      ));

    if (teamIds.length > 0) {
      await db
        .delete(schema.teamAiNarratives)
        .where(and(
          inArray(schema.teamAiNarratives.teamId, teamIds),
          eq(schema.teamAiNarratives.seasonYear, seasonYear),
          eq(schema.teamAiNarratives.week, week),
        ));
    }

    return c.json({ invalidated: true });
  } catch (error) {
    console.error('League AI cache invalidation error:', error);
    return c.json({ error: 'Failed to invalidate AI cache' }, 500);
  }
});
