import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { requireTier, resolveEffectiveTier } from '../middleware/tier';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import { buildCachedSystemBlocks, sanitizePromptInput } from '../utils/prompt';
import {
  EFFORT_QUICK,
  EFFORT_REASONING,
  describeResponse,
  firstText,
  maxTokensWithThinking,
  parseJsonObject,
  type AnthropicTextResponse,
} from '../utils/aiOutput';
import { resolveLeagueWeek } from '../services/nflState';
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

/**
 * Lineup groups the positional breakdown reports, in display order. Starters
 * are grouped by the lineup SLOT they fill, not their natural position, so a
 * running back in a FLEX slot counts toward FLEX. SFLEX (superflex) is kept
 * apart from FLEX because it is usually filled by a quarterback; it only
 * appears in leagues that have the slot. IDP slots are not graded.
 */
export const BREAKDOWN_GROUPS = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SFLEX', 'K', 'DEF'] as const;
export type BreakdownGroup = (typeof BREAKDOWN_GROUPS)[number];
const NATURAL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
// No bare 'S': the Sleeper quick sync labels unknown starter slots S1, S2…,
// which must fall back to the player's position, and no platform emits 'S'.
const IDP_SLOTS = new Set(['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'IDP']);
const SUPERFLEX_SLOTS = new Set(['SUPER_FLEX', 'SUPERFLEX', 'SF', 'OP', 'Q/W/R/T']);
const FLEX_SLOTS = new Set(['W/R/T', 'W/R', 'W/T', 'R/T', 'RB/WR', 'WR/TE', 'RB/WR/TE']);

/**
 * Map a starter's lineup slot to its breakdown group. Slot labels come from
 * every platform's sync: Sleeper numbers repeats (RB1, FLEX2, SUPER_FLEX1) and
 * uses REC_FLEX / WRRB_FLEX / IDP_FLEX; ESPN uses QB/RB/WR/TE/FLEX/K/DEF;
 * Yahoo uses W/R/T and Q/W/R/T. An unknown label falls back to the player's
 * natural position. Returns null for slots that aren't graded (IDP).
 */
export function slotGroup(slot: string | null | undefined, naturalPosition: string | null | undefined): BreakdownGroup | null {
  const s = (slot || '').toUpperCase().trim().replace(/\d+$/, '');
  if (s.startsWith('IDP') || IDP_SLOTS.has(s)) return null;
  if (SUPERFLEX_SLOTS.has(s)) return 'SFLEX';
  if (s.includes('FLEX') || FLEX_SLOTS.has(s)) return 'FLEX';
  if (s === 'QB' || s === 'RB' || s === 'WR' || s === 'TE' || s === 'K') return s;
  if (s === 'DEF' || s === 'DST' || s === 'D/ST' || s === 'D') return 'DEF';
  const n = (naturalPosition || '').toUpperCase();
  if (n === 'DST' || n === 'D/ST') return 'DEF';
  return NATURAL_POSITIONS.has(n) ? (n as BreakdownGroup) : null;
}

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
  /** Lineup group (see BREAKDOWN_GROUPS) — the slot filled, not the player's position. */
  position: BreakdownGroup;
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
  /**
   * This team's league rank at the slot by average points per starter (1 =
   * best; ties share a rank). Null when the team has no starter there.
   */
  rank: number | null;
  /** How many teams are ranked at the slot (teams with a starter there). */
  rankOf: number;
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

export interface ScoredMatchup {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  isComplete: boolean;
  isPlayoff: boolean;
}

/**
 * Sync flags a matchup complete only when it runs after the week rolls over,
 * but the synced team records (from the platform) already include the newest
 * finished week. Without this the all-play record, recent form and history
 * skip the latest week until the next sync. Weeks before the live week are
 * done regardless of the stored flag.
 */
export function withLiveCompletion<T extends { week: number; isComplete: boolean }>(
  matchups: T[],
  liveWeek: number,
): T[] {
  return matchups.map((m) => (m.isComplete || m.week >= liveWeek ? m : { ...m, isComplete: true }));
}

export interface AllPlayRecord {
  wins: number;
  losses: number;
  ties: number;
  /** Share of all-play games won (ties count half), 0–1. Null before any completed week. */
  winPct: number | null;
}

/**
 * All-play record: every completed regular-season week, each team "plays"
 * every other team's score that week. It measures how good a team's scores
 * were independent of which opponent the schedule handed them; the gap to
 * the real win rate is schedule luck.
 */
export function computeAllPlay(matchups: ScoredMatchup[], teamIds: string[]): Map<string, AllPlayRecord> {
  const byWeek = new Map<number, Map<string, number>>();
  for (const m of matchups) {
    if (!m.isComplete || m.isPlayoff || m.homeScore == null || m.awayScore == null) continue;
    const scores = byWeek.get(m.week) || new Map<string, number>();
    scores.set(m.homeTeamId, m.homeScore);
    scores.set(m.awayTeamId, m.awayScore);
    byWeek.set(m.week, scores);
  }
  const result = new Map<string, AllPlayRecord>();
  for (const id of teamIds) result.set(id, { wins: 0, losses: 0, ties: 0, winPct: null });
  for (const scores of byWeek.values()) {
    for (const [id, score] of scores) {
      const rec = result.get(id);
      if (!rec) continue;
      for (const [otherId, other] of scores) {
        if (otherId === id) continue;
        if (score > other) rec.wins++;
        else if (score < other) rec.losses++;
        else rec.ties++;
      }
    }
  }
  for (const rec of result.values()) {
    const games = rec.wins + rec.losses + rec.ties;
    rec.winPct = games > 0 ? (rec.wins + rec.ties / 2) / games : null;
  }
  return result;
}

export interface HistoryTeamWeek {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  /** Win-loss standings rank after this week (wins, then points-for tiebreak). */
  standingsRank: number;
  /** Rank by points per game after this week. */
  scoringRank: number;
  /** Monte Carlo playoff odds as they stood after this week, 0-100. */
  playoffOdds: number;
}

export interface HistoryWeek {
  week: number;
  teams: HistoryTeamWeek[];
}

/**
 * Replays the regular season week by week from the matchup scores: after each
 * completed week, every team's record, standings and scoring rank, and the
 * playoff odds the same Monte Carlo model would have given at that point
 * (that week's records against the schedule still to come). Needs no stored
 * snapshots, so a league gets its full history the first time it's viewed.
 *
 * - A game counts as played when it has scores and is flagged complete, or
 *   when a later week has completed games (a sync that never flagged it must
 *   not drop the week or leave both teams a game short from then on).
 * - A week counts once every regular-season game in it has been played.
 * - `medianGames`: leagues with a weekly "vs. median" game give every team an
 *   extra result per week (top half of scores win). The synced records the
 *   headline numbers use include them, so the replay must too.
 * - Same simulation count as the headline odds, so the latest point matches.
 */
export function computeLeagueHistory(
  teamIds: string[],
  matchups: Array<ScoredMatchup & { id: string }>,
  playoffSpots: number,
  opts: { numSims?: number; medianGames?: boolean } = {},
): HistoryWeek[] {
  const numSims = opts.numSims ?? NUM_SIMULATIONS;
  const regular = matchups.filter((m) => !m.isPlayoff);
  const weeks = [...new Set(regular.map((m) => m.week))].sort((a, b) => a - b);
  const lastFlaggedWeek = Math.max(0, ...regular.filter((m) => m.isComplete).map((m) => m.week));
  const done = (m: ScoredMatchup) =>
    m.homeScore != null && m.awayScore != null && (m.isComplete || m.week < lastFlaggedWeek);
  const completedWeeks = weeks.filter((w) => {
    const games = regular.filter((m) => m.week === w);
    return games.length > 0 && games.every(done);
  });

  const history: HistoryWeek[] = [];
  for (const week of completedWeeks) {
    const rec = new Map(teamIds.map((id) => [id, { wins: 0, losses: 0, ties: 0, pointsFor: 0 }]));
    const scoresByWeek = new Map<number, Array<[string, number]>>();
    for (const m of regular) {
      if (m.week > week || !done(m)) continue;
      const h = rec.get(m.homeTeamId);
      const a = rec.get(m.awayTeamId);
      if (!h || !a) continue;
      const hs = m.homeScore as number;
      const as = m.awayScore as number;
      h.pointsFor += hs;
      a.pointsFor += as;
      if (hs > as) { h.wins++; a.losses++; } else if (as > hs) { a.wins++; h.losses++; } else { h.ties++; a.ties++; }
      const list = scoresByWeek.get(m.week) || [];
      list.push([m.homeTeamId, hs], [m.awayTeamId, as]);
      scoresByWeek.set(m.week, list);
    }
    if (opts.medianGames) {
      for (const scores of scoresByWeek.values()) {
        const sorted = scores.map(([, s]) => s).sort((x, y) => x - y);
        const mid = sorted.length / 2;
        const median = sorted.length % 2 === 1 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
        for (const [id, s] of scores) {
          const r = rec.get(id)!;
          if (s > median) r.wins++;
          else if (s < median) r.losses++;
          else r.ties++;
        }
      }
    }
    const standings: StandingInput[] = teamIds.map((id) => ({ teamId: id, ...rec.get(id)! }));
    const remaining: RemainingMatchup[] = regular
      .filter((m) => m.week > week)
      .map((m) => ({ id: m.id, team1Id: m.homeTeamId, team2Id: m.awayTeamId }));
    const odds = runMonteCarlo(standings, remaining, playoffSpots, numSims);

    const byRecord = [...standings].sort((a, b) =>
      b.wins !== a.wins ? b.wins - a.wins : b.pointsFor - a.pointsFor,
    );
    const ppg = (s: StandingInput) => {
      const gp = s.wins + s.losses + s.ties;
      return gp > 0 ? s.pointsFor / gp : 0;
    };
    const byScoring = [...standings].sort((a, b) => ppg(b) - ppg(a));
    const standingsRank = new Map(byRecord.map((s, i) => [s.teamId, i + 1]));
    const scoringRank = new Map(byScoring.map((s, i) => [s.teamId, i + 1]));

    history.push({
      week,
      teams: standings.map((s) => ({
        teamId: s.teamId,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        pointsFor: round1(s.pointsFor),
        standingsRank: standingsRank.get(s.teamId)!,
        scoringRank: scoringRank.get(s.teamId)!,
        playoffOdds: odds.get(s.teamId)?.playoffPct ?? 0,
      })),
    });
  }
  return history;
}

/** One team's game-by-game results from completed matchups, oldest first. */
export interface WeeklyResult {
  week: number;
  opponentId: string;
  score: number;
  opponentScore: number;
  result: 'W' | 'L' | 'T';
  isPlayoff: boolean;
}

export function weeklyResultsFor(teamId: string, matchups: ScoredMatchup[]): WeeklyResult[] {
  const out: WeeklyResult[] = [];
  for (const m of matchups) {
    if (!m.isComplete || m.homeScore == null || m.awayScore == null) continue;
    const isHome = m.homeTeamId === teamId;
    if (!isHome && m.awayTeamId !== teamId) continue;
    const score = isHome ? m.homeScore : m.awayScore;
    const opponentScore = isHome ? m.awayScore : m.homeScore;
    out.push({
      week: m.week,
      opponentId: isHome ? m.awayTeamId : m.homeTeamId,
      score,
      opponentScore,
      result: score > opponentScore ? 'W' : score < opponentScore ? 'L' : 'T',
      isPlayoff: m.isPlayoff,
    });
  }
  return out.sort((a, b) => a.week - b.week);
}

/** Current streak from the most recent result backwards, e.g. "W3"; null before any game. */
export function currentStreak(results: WeeklyResult[]): string | null {
  if (results.length === 0) return null;
  const last = results[results.length - 1].result;
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i].result === last; i--) n++;
  return `${last}${n}`;
}

/** Population standard deviation; null for fewer than two values. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/** Everything the AI pieces get about one rostered player. */
export interface AiRosterPlayer {
  name: string;
  position: string;
  nflTeam: string;
  slot: string;
  isStarter: boolean;
  /** Fantasy points per game in games played this season (league scoring). */
  seasonPpg: number | null;
  gamesPlayed: number;
  /** Points per game over the player's last three games played. */
  last3Ppg: number | null;
  projectedThisWeek: number | null;
  status: string;
  injuryNote: string | null;
  byeWeek: number | null;
}

/** Per-team detail only the AI pieces use (not sent to the page). */
export interface TeamAiDetail {
  weeklyResults: Array<WeeklyResult & { opponentName: string }>;
  highScore: number | null;
  lowScore: number | null;
  scoreStdDev: number | null;
  streak: string | null;
  remainingSchedule: Array<{ week: number; opponentName: string; opponentPpg: number }>;
  roster: AiRosterPlayer[];
}

/**
 * Rank every team at each lineup slot by average points per starter, in
 * place. Only teams with a starter at the slot are ranked; equal averages
 * share a rank ("1, 2, 2, 4").
 */
export function assignPositionRanks(teams: Array<{ positions: PositionBreakdown[] }>): void {
  for (const group of BREAKDOWN_GROUPS) {
    const entries = teams
      .map((t) => t.positions.find((p) => p.position === group))
      .filter((p): p is PositionBreakdown => !!p && p.starterCount > 0)
      .sort((a, b) => b.avgPoints - a.avgPoints);
    entries.forEach((p, i) => {
      p.rank = i > 0 && entries[i - 1].avgPoints === p.avgPoints ? entries[i - 1].rank : i + 1;
      p.rankOf = entries.length;
    });
  }
}

/** Reader-facing name for a lineup group: flex slots aren't positions. */
function groupPhrase(group: BreakdownGroup): string {
  if (group === 'FLEX') return 'the FLEX spot';
  if (group === 'SFLEX') return 'the superflex spot';
  return group;
}

/** Lineup display order for a starter: group order, then the slot's number (RB1 before RB2). */
export function lineupOrder(slot: string, position: string): [number, number] {
  const group = slotGroup(slot, position);
  const groupIdx = group ? BREAKDOWN_GROUPS.indexOf(group) : BREAKDOWN_GROUPS.length;
  const n = Number(/(\d+)$/.exec(slot)?.[1] ?? 0);
  return [groupIdx, n];
}

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
      `Their biggest strength is ${groupPhrase(best.position)}, where the starters average ${round1(best.avgPoints)} points per game — ${round1(best.deltaPct)}% above the league average.`,
    );
  }

  if (worst && worst.deltaPct < 0) {
    sentences.push(
      `The clearest hole is ${groupPhrase(worst.position)} (${round1(Math.abs(worst.deltaPct))}% below league average) — that's the spot to upgrade in trades or on waivers.`,
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
 * same computed facts as the data block fed to Anthropic. `withAiDetail`
 * additionally returns per-team rosters and game logs for the AI fact sheet
 * (left off the page payload).
 */
export async function computeLeagueAnalysis(
  db: Db,
  league: LeagueRow,
  membership: MembershipRow,
  opts: { withAiDetail?: boolean } = {},
) {
  const format = normalizeFormat(league.scoringFormat);
  const seasonYear = league.seasonYear;
  const currentWeek = (await resolveLeagueWeek(db, league)).week;

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
      aiDetail: undefined as Record<string, TeamAiDetail> | undefined,
    };
  }

    const teamIds = teams.map((t) => t.id);

    // Roster spots for every team in one query (≤32 team ids)
    const allSpots = await db.query.rosterSpots.findMany({
      where: inArray(schema.rosterSpots.teamId, teamIds),
      columns: { teamId: true, playerId: true, isStarter: true, slot: true },
    });

    const playerIds = Array.from(new Set(allSpots.map((s) => s.playerId)));

    // Players, weekly stats, and current-week projections — chunked batches
    const playersById = new Map<string, {
      id: string; name: string; position: string; team: string;
      status: string; injuryNote: string | null; byeWeek: number | null;
    }>();
    const statsByPlayer = new Map<string, { week: number; points: number; played: boolean }[]>();
    const projByPlayer = new Map<string, { points: number; format: string }[]>();

    for (let i = 0; i < playerIds.length; i += CHUNK) {
      const chunk = playerIds.slice(i, i + CHUNK);

      const [players, stats, projections] = await Promise.all([
        db.query.nflPlayers.findMany({
          where: inArray(schema.nflPlayers.id, chunk),
          columns: { id: true, name: true, position: true, team: true, status: true, injuryNote: true, byeWeek: true },
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
        list.push({ week: s.week, points, played });
        statsByPlayer.set(s.playerId, list);
      }
      for (const pr of projections) {
        const list = projByPlayer.get(pr.playerId) || [];
        list.push({ points: pr.projectedPoints, format: pr.scoringFormat });
        projByPlayer.set(pr.playerId, list);
      }
    }

    // All league matchups in one query
    const liveWeek = (await resolveLeagueWeek(db, league)).week;
    const leagueMatchups = withLiveCompletion(
      await db.query.matchups.findMany({
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
      }),
      liveWeek,
    );

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
    const teamPositionAvg = new Map<string, Map<BreakdownGroup, { avg: number; count: number; sum: number }>>();
    const teamProjectedPpg = new Map<string, number>();
    for (const team of teams) {
      const posMap = new Map<BreakdownGroup, { avg: number; count: number; sum: number }>();
      const starters = (spotsByTeam.get(team.id) || []).filter((s) => s.isStarter);
      const byPos = new Map<BreakdownGroup, number[]>();
      let projectedTotal = 0;
      for (const spot of starters) {
        projectedTotal += playerProjectedValue.get(spot.playerId) || 0;
        const player = playersById.get(spot.playerId);
        if (!player) continue;
        // Grouped by the lineup slot filled (FLEX, SFLEX…), not the player's position.
        const pos = slotGroup(spot.slot, player.position);
        if (!pos) continue;
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

    // League average per lineup group (mean of per-team averages, teams with starters in that group)
    const positionAverages: Record<string, number> = {};
    for (const pos of BREAKDOWN_GROUPS) {
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
    const allPlayById = computeAllPlay(leagueMatchups, teamIds);

    // ── Assemble per-team results ────────────────────────────────────────────
    const unranked = teams.map((team) => {
      const gp = team.wins + team.losses + team.ties;
      const allPlay = allPlayById.get(team.id) ?? { wins: 0, losses: 0, ties: 0, winPct: null };
      const actualWinPct = gp > 0 ? (team.wins + team.ties / 2) / gp : null;
      const ppg = teamPpg.get(team.id) || 0;
      const ratio = leagueAvgPpg > 0 && gp > 0 ? ppg / leagueAvgPpg : 1;
      const grade = leagueAvgPpg > 0 && gp > 0 ? gradeFromRatio(ratio) : 'B';

      const posMap = teamPositionAvg.get(team.id) || new Map();
      const totalStarterSum = Array.from(posMap.values()).reduce((s, e) => s + e.sum, 0);
      const positions: PositionBreakdown[] = BREAKDOWN_GROUPS.filter(
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
          rank: null,
          rankOf: 0,
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
      // Trade targets are positions you can actually acquire, so the flex
      // slot rows (filled by players of several positions) don't qualify.
      const rated = positions.filter((p) => p.starterCount > 0 && p.leagueAvg > 0 && p.position !== 'FLEX' && p.position !== 'SFLEX');
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
        /** Record if this team had played every other team every completed week. */
        allPlay: {
          wins: allPlay.wins,
          losses: allPlay.losses,
          ties: allPlay.ties,
          winPct: allPlay.winPct != null ? round1(allPlay.winPct * 100) : null,
        },
        /** Actual win % minus all-play win %, in points: positive = the schedule has been kind. */
        luck: actualWinPct != null && allPlay.winPct != null ? round1((actualWinPct - allPlay.winPct) * 100) : null,
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

    assignPositionRanks(unranked);

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

    // ── Per-team rosters and game logs for the AI fact sheet ─────────────────
    let aiDetail: Record<string, TeamAiDetail> | undefined;
    if (opts.withAiDetail) {
      aiDetail = {};
      const weekOfMatchup = new Map(leagueMatchups.map((m) => [m.id, m.week]));
      for (const team of teams) {
        const results = weeklyResultsFor(team.id, leagueMatchups).map((r) => ({
          ...r,
          opponentName: teamNameById.get(r.opponentId) || 'Unknown',
        }));
        const regularScores = results.filter((r) => !r.isPlayoff).map((r) => r.score);
        const remainingSchedule = remainingRegularSeason
          .filter((m) => m.team1Id === team.id || m.team2Id === team.id)
          .map((m) => {
            const oppId = m.team1Id === team.id ? m.team2Id : m.team1Id;
            return {
              week: weekOfMatchup.get(m.id) ?? 0,
              opponentName: teamNameById.get(oppId) || 'Unknown',
              opponentPpg: round1(teamPpg.get(oppId) || leagueAvgPpg),
            };
          })
          .sort((a, b) => a.week - b.week);

        const roster: AiRosterPlayer[] = (spotsByTeam.get(team.id) || [])
          .map((spot) => {
            const player = playersById.get(spot.playerId);
            const played = (statsByPlayer.get(spot.playerId) || [])
              .filter((r) => r.played)
              .sort((a, b) => b.week - a.week);
            const last3 = played.slice(0, 3);
            const projs = projByPlayer.get(spot.playerId) || [];
            const proj = projs.find((p) => normalizeFormat(p.format) === format) || projs[0];
            return {
              name: player?.name || 'Unknown player',
              position: player?.position || '?',
              nflTeam: player?.team || 'FA',
              slot: spot.slot,
              isStarter: spot.isStarter,
              seasonPpg: played.length > 0 ? round1(played.reduce((s, r) => s + r.points, 0) / played.length) : null,
              gamesPlayed: played.length,
              last3Ppg: last3.length > 0 ? round1(last3.reduce((s, r) => s + r.points, 0) / last3.length) : null,
              projectedThisWeek: proj ? round1(proj.points) : null,
              status: player?.status || 'active',
              injuryNote: player?.injuryNote ?? null,
              byeWeek: player?.byeWeek ?? null,
            };
          })
          // Starters first in slot order, then bench by value.
          .sort((a, b) => {
            if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
            if (a.isStarter) {
              const [ga, na] = lineupOrder(a.slot, a.position);
              const [gb, nb] = lineupOrder(b.slot, b.position);
              return ga !== gb ? ga - gb : na - nb;
            }
            return (b.seasonPpg ?? b.projectedThisWeek ?? 0) - (a.seasonPpg ?? a.projectedThisWeek ?? 0);
          });

        const sd = stdDev(regularScores);
        aiDetail[team.id] = {
          weeklyResults: results,
          highScore: regularScores.length > 0 ? round1(Math.max(...regularScores)) : null,
          lowScore: regularScores.length > 0 ? round1(Math.min(...regularScores)) : null,
          scoreStdDev: sd != null ? round1(sd) : null,
          streak: currentStreak(results.filter((r) => !r.isPlayoff)),
          remainingSchedule,
          roster,
        };
      }
    }

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
      aiDetail,
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
// GET /:leagueId/history — week-by-week trends (playoff odds, standings,
// scoring rank), plus the AI power ranking for weeks where one was generated
// (Pro/Elite only, like the pulse itself).
// ─────────────────────────────────────────────────────────────────────────────
leagueAnalyzerRoutes.get('/:leagueId/history', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const loaded = await loadLeagueForUser(db, user.id, leagueId);
  if ('error' in loaded) return c.json({ error: loaded.error }, loaded.status);
  const { league } = loaded;

  try {
    const [teams, storedMatchups, liveWeek] = await Promise.all([
      db.query.teams.findMany({
        where: eq(schema.teams.leagueId, leagueId),
        columns: { id: true, name: true, wins: true, losses: true, ties: true },
      }),
      db.query.matchups.findMany({
        where: eq(schema.matchups.leagueId, leagueId),
        columns: { id: true, week: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, isComplete: true, isPlayoff: true },
      }),
      resolveLeagueWeek(db, league).then((r) => r.week),
    ]);
    const matchups = withLiveCompletion(storedMatchups, liveWeek);
    const teamRecords = teams;
    // Median-game leagues: the synced records (what the headline numbers use)
    // carry about two results per played week — one head-to-head, one vs. the
    // median — so team games come to roughly twice the completed matchup slots.
    const completedTeamGames = 2 * matchups.filter((m) => !m.isPlayoff && m.isComplete).length;
    const recordedTeamGames = teamRecords.reduce((s, t) => s + t.wins + t.losses + t.ties, 0);
    const medianGames = completedTeamGames > 0 && recordedTeamGames >= completedTeamGames * 1.75;
    const weeks = computeLeagueHistory(teams.map((t) => t.id), matchups, league.playoffTeams || 6, { medianGames });

    let urlHostname: string | null = null;
    try { urlHostname = new URL(c.req.url).hostname; } catch { urlHostname = null; }
    const { tier } = resolveEffectiveTier(user, c.env, c.req.header('host'), urlHostname);
    let aiPowerRankings: Array<{ week: number; ranking: string[] }> | null = null;
    if (tier === 'pro' || tier === 'elite') {
      const teamIdSet = new Set(teams.map((t) => t.id));
      const pulses = await db.query.leagueAiPulses.findMany({
        where: and(eq(schema.leagueAiPulses.leagueId, leagueId), eq(schema.leagueAiPulses.seasonYear, league.seasonYear)),
        columns: { week: true, rankingJson: true },
      });
      aiPowerRankings = [];
      for (const p of pulses) {
        if (!p.rankingJson) continue;
        try {
          const ranking = JSON.parse(p.rankingJson) as unknown;
          // Keep only the current team ids (a merged or removed team drops out).
          // A pulse is stored under the week in progress when it was generated,
          // so it reflects results through the week before — plot it there, in
          // line with the other trend lines ("Wk N" = after week N).
          const reflectsWeek = p.week - 1;
          if (Array.isArray(ranking) && reflectsWeek >= 1) {
            aiPowerRankings.push({ week: reflectsWeek, ranking: ranking.filter((id): id is string => typeof id === 'string' && teamIdSet.has(id)) });
          }
        } catch {
          // A corrupted cache row just leaves that week out.
        }
      }
      aiPowerRankings.sort((a, b) => a.week - b.week);
    }

    return c.json({
      seasonYear: league.seasonYear,
      playoffTeams: league.playoffTeams || 6,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      weeks,
      aiPowerRankings,
    });
  } catch (error) {
    console.error('League history error:', error);
    return c.json({ error: 'Failed to load league history' }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI narratives — real Anthropic-generated analysis layered on the computed
// facts above. Cached per (team|league, season, week) so every viewer of the
// same league shares one generation.
// ─────────────────────────────────────────────────────────────────────────────

const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
const orDash = (n: number | null | undefined, digits = 1) => (n == null ? '—' : n.toFixed(digits));

/** Display labels for lineup groups in the AI fact sheet. */
const GROUP_LABEL: Record<BreakdownGroup, string> = {
  QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', FLEX: 'FLEX', SFLEX: 'SUPERFLEX', K: 'K', DEF: 'DEF',
};

/** League-wide context that precedes the team sheets in every AI prompt. */
export function formatLeagueContext(analysis: LeagueAnalysis, league: Pick<LeagueRow, 'leagueType' | 'hasSuperflex' | 'hasTePremium'>, week: number): string {
  const safeLeagueName = sanitizePromptInput(analysis.league.name, 80);
  const groupAverages = BREAKDOWN_GROUPS
    .filter((g) => analysis.positionAverages[g] != null)
    .map((g) => `${GROUP_LABEL[g]} ${analysis.positionAverages[g].toFixed(1)}`)
    .join(' | ');
  const format = [
    analysis.league.scoringFormat.toUpperCase(),
    league.leagueType ? `${league.leagueType}` : null,
    league.hasSuperflex ? 'superflex' : null,
    league.hasTePremium ? 'TE premium' : null,
  ].filter(Boolean).join(', ');
  return `LEAGUE: ${safeLeagueName} — season ${analysis.league.seasonYear}, week ${week}
Format: ${format} | ${analysis.league.teamCount} teams | top ${analysis.league.playoffTeams} make the playoffs
League average: ${analysis.leagueAvgPpg.toFixed(1)} points per game per team
League average starter points per game by lineup slot: ${groupAverages || '(no starter data yet)'}`;
}

/** One rostered player as a single fact-sheet line. */
function formatRosterLine(p: AiRosterPlayer): string {
  const slot = p.isStarter ? p.slot : p.slot.startsWith('IR') ? 'IR' : p.slot.startsWith('TAXI') ? 'TAXI' : 'BN';
  const injury = p.status && p.status !== 'active'
    ? ` | ${p.status}${p.injuryNote ? `: ${sanitizePromptInput(p.injuryNote, 60)}` : ''}`
    : '';
  const stats = p.gamesPlayed > 0
    ? `${orDash(p.seasonPpg)} PPG in ${p.gamesPlayed} games, last 3 ${orDash(p.last3Ppg)}`
    : 'no games played yet';
  return `    ${slot}: ${sanitizePromptInput(p.name, 60)} (${p.position}, ${p.nflTeam}) — ${stats} | proj this week ${orDash(p.projectedThisWeek)}${p.byeWeek ? ` | bye wk ${p.byeWeek}` : ''}${injury}`;
}

/**
 * Renders one team's facts as a data-block section for the AI prompts.
 * Without `detail` it is the compact summary; with it, the full sheet: game
 * log, scoring range, remaining opponents and the whole roster with each
 * player's production, projection, bye and injury status.
 */
export function formatTeamFacts(team: AnalyzedTeam, analysis: LeagueAnalysis, detail?: TeamAiDetail): string {
  // Team/owner names are user-controlled (renamed via league settings), so
  // sanitize before interpolating into the prompt to defuse prompt-injection
  // attempts hiding in a team or owner name.
  const safeName = sanitizePromptInput(team.name, 80);
  const safeOwnerName = sanitizePromptInput(team.ownerName, 80);
  const teamCount = analysis.teams.length;
  const gp = team.gamesPlayed;

  const positionLines = team.positions
    .filter((p) => p.starterCount > 0)
    .map(
      (p) =>
        `  ${GROUP_LABEL[p.position]} (${p.starterCount} starter${p.starterCount === 1 ? '' : 's'}): ${p.avgPoints.toFixed(1)} PPG per starter vs league ${p.leagueAvg.toFixed(1)} (${signed(p.deltaPct)}%, ${p.status})${p.rank != null ? `, ranked #${p.rank} of ${p.rankOf} in the league` : ''} — ${p.pointShare.toFixed(0)}% of the lineup's points`,
    )
    .join('\n');

  const allPlayLine = team.allPlay.winPct != null
    ? `${formatRecord(team.allPlay.wins, team.allPlay.losses, team.allPlay.ties)} (${team.allPlay.winPct.toFixed(1)}%)${team.luck != null ? ` | Schedule luck: ${signed(team.luck)} win-% points (actual win % minus all-play win %; positive = lucky)` : ''}`
    : 'no completed weeks yet';

  const formLine = team.recentFormPpg != null
    ? `${team.recentFormPpg.toFixed(1)} PPG over the last 3 games (trending ${team.trend} vs season average)`
    : 'no completed games yet';

  const scheduleLine =
    team.scheduleDifficulty.remainingGames > 0 && team.scheduleDifficulty.label
      ? `${team.scheduleDifficulty.label} — opponents average ${team.scheduleDifficulty.avgOpponentPpg?.toFixed(1)} PPG over ${team.scheduleDifficulty.remainingGames} remaining games`
      : 'regular season complete';

  const lines = [
    `TEAM: ${safeName} (manager: ${safeOwnerName}) [id: ${team.id}]`,
    `Standings rank (by record): #${team.recordRank} of ${teamCount} | Power-by-scoring rank (by PPG): #${team.rank} of ${teamCount} | Grade: ${team.grade}`,
    `Record: ${formatRecord(team.record.wins, team.record.losses, team.record.ties)} | All-play record: ${allPlayLine}`,
    `Scoring: ${team.ppg.toFixed(1)} PPG (league ${analysis.leagueAvgPpg.toFixed(1)}) | Points against per game: ${gp > 0 ? (team.pointsAgainst / gp).toFixed(1) : '—'} | Total PF ${team.pointsFor.toFixed(1)}, PA ${team.pointsAgainst.toFixed(1)}`,
  ];
  if (detail) {
    lines.push(`Range: high ${orDash(detail.highScore)}, low ${orDash(detail.lowScore)}, week-to-week std dev ${orDash(detail.scoreStdDev)} | Streak: ${detail.streak ?? '—'}`);
  }
  lines.push(
    `Recent form: ${formLine}`,
    `This week's lineup projects ${team.projectedPpg.toFixed(1)} points (${signed(team.projectedPpgDelta)} vs season PPG)`,
    `Positional breakdown by lineup slot (each starter's season PPG; FLEX and SUPERFLEX are the players filling those slots):`,
    positionLines || '  (no starter data yet)',
    `Remaining schedule: ${scheduleLine}`,
    `Playoff odds: ${team.playoffOdds}% (5,000-run simulation) | Projected final wins: ${team.projectedWins.toFixed(1)}`,
  );
  if (detail) {
    if (detail.weeklyResults.length > 0) {
      lines.push('Game log:');
      for (const r of detail.weeklyResults) {
        lines.push(`    Wk ${r.week}${r.isPlayoff ? ' (playoffs)' : ''}: ${r.result} ${r.score.toFixed(1)}-${r.opponentScore.toFixed(1)} vs ${sanitizePromptInput(r.opponentName, 80)}`);
      }
    }
    if (detail.remainingSchedule.length > 0) {
      lines.push(`Remaining opponents: ${detail.remainingSchedule
        .map((s) => `Wk ${s.week} ${sanitizePromptInput(s.opponentName, 80)} (${s.opponentPpg.toFixed(1)} PPG)`)
        .join('; ')}`);
    }
    if (detail.roster.length > 0) {
      lines.push('Roster (starters in lineup order, then bench):');
      for (const p of detail.roster) lines.push(formatRosterLine(p));
    } else {
      lines.push('Roster: (not synced yet)');
    }
  }
  return lines.join('\n');
}

const TEAM_NARRATIVE_SYSTEM_PROMPT = `You are FilmRoom's fantasy football analyst writing a scouting report on one team in a fantasy league, for that team's manager and their league-mates.

You will receive:
- League context: scoring format, size, playoff spots, and league-average points per game by lineup slot.
- A full sheet for the team to scout: standings rank (by record) and power-by-scoring rank (by points per game), record and all-play record (how it would have fared against every team every week) with schedule luck, scoring average, range and consistency, streak, recent form, this week's projection, a positional breakdown by lineup slot (QB, RB, WR, TE, FLEX, SUPERFLEX, K, DEF — each slot's starters vs the league average for that slot), game log, remaining opponents, playoff odds, and the whole roster: every starter and bench player with season points per game, games played, last-3 average, this week's projection, bye week and injury status.
- Summary sheets for every other team, for comparison.

Write 3-5 short paragraphs (under 260 words total) covering:
- Who this team really is: record vs all-play record and luck, and whether the scoring backs up the standings.
- The biggest strength and clearest weakness by lineup slot, naming the specific players driving each (including bench depth, injuries and upcoming byes that matter).
- What the remaining schedule and playoff odds mean, with the opponents that matter most.
- One or two concrete recommendations: a trade target slot (and which rival teams have surplus there), a lineup or bench move, or a storyline to watch.

Rules:
- Use ONLY the facts in the data block. Do not invent stats, injuries, or news not present in the data.
- Reference specific numbers and player names from the data block.
- "Standings rank" means the win-loss standings; "power-by-scoring rank" is a different ordering by points per game. Don't confuse them.
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
    const week = (await resolveLeagueWeek(db, league)).week;

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
          const analysis = await computeLeagueAnalysis(db, league, membership, { withAiDetail: true });
          const team = analysis.teams.find((t) => t.id === teamId);
          if (!team) throw new RouteError(404, 'Team not found in this league');

          // The team's full sheet, then a compact sheet for every rival so the
          // report can compare against the rest of the league.
          const rivals = analysis.teams
            .filter((t) => t.id !== teamId)
            .map((t) => formatTeamFacts(t, analysis))
            .join('\n\n');
          const dataBlock = `${formatLeagueContext(analysis, league, week)}

=== TEAM TO SCOUT ===
${formatTeamFacts(team, analysis, analysis.aiDetail?.[teamId])}

=== REST OF THE LEAGUE (summaries, for comparison) ===
${rivals || '(no other teams)'}`;

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
                // ~260 words of visible output plus thinking headroom — see utils/aiOutput.ts.
                max_tokens: maxTokensWithThinking(900),
                output_config: EFFORT_QUICK,
                system: buildCachedSystemBlocks(TEAM_NARRATIVE_SYSTEM_PROMPT),
                messages: [{ role: 'user', content: dataBlock }],
              }),
              signal: AbortSignal.timeout(45000),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              console.error('[league-analyzer/narrative] Anthropic error:', res.status, errText);
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            const data = (await res.json()) as AnthropicTextResponse;
            const text = firstText(data);
            if (!text) {
              console.error(`[league-analyzer/narrative] no text block (${describeResponse(data)})`);
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
        // .finally() returns a new promise that rejects with the generation's
        // error; swallow it here (the awaiting request handles the error) so a
        // failed generation doesn't also surface as an unhandled rejection.
        generation.finally(() => narrativeInFlight.delete(cacheKey)).catch(() => {});
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

You will receive league context (scoring format, size, playoff spots, league-average points per game by lineup slot) and a full sheet for every team: its id, standings rank (by record), power-by-scoring rank (by points per game), grade, record, all-play record (how it would have fared against every team every week) and schedule luck, scoring average, range and consistency, streak, recent form (last 3 games vs season average — the momentum signal), this week's projection, a positional breakdown by lineup slot (QB, RB, WR, TE, FLEX, SUPERFLEX, K, DEF), game log, remaining opponents, Monte Carlo playoff odds, and the whole roster with each player's production, projection, bye week and injury status.

A power ranking is NOT the same as the standings — it's your holistic judgment of which team is actually best right now and going forward. All-play record is the cleanest measure of true strength; recent form is the momentum signal; roster quality, depth, injuries and byes say what comes next. A team with a losing record but a strong all-play record and a hot last 3 games can rank above a team coasting on a lucky early-season record. Also weigh remaining schedule and playoff odds. Break ties by which team you'd rather own going forward.

Respond with ONLY valid JSON (no markdown fences, no other text), in this exact shape:
{"ranking": ["<team id>", "<team id>", ...], "narrative": "<4-6 short paragraphs, under 350 words>"}

Rules for "ranking":
- Must contain every team id from the data block EXACTLY as given, each exactly once, ordered from most to least powerful.
- Use the exact id strings from the data block's "[id: ...]" tags — do not alter, guess, or invent ids.

Rules for "narrative":
- Cover: the biggest mover(s) between the power ranking and the win-loss standings and why (cite all-play records and luck), the luckiest and unluckiest teams, the tightest part of the playoff race, which lineup slots are scarce or abundant league-wide and which teams could trade from surplus to fill a need (name players), injury or bye-week trouble that changes a team's outlook, and one storyline to watch.
- Name specific players and numbers from the data block.
- "Standings rank" means the win-loss standings; "power-by-scoring rank" is a different ordering by points per game. Don't confuse them.
- Use ONLY the facts in the data block. Do not invent stats, injuries, or news not present in the data.
- Separate paragraphs with a blank line (two newline characters) — the page shows the text exactly as written.
- Keep the tone analytical, not mean-spirited — this is read by every manager in the league, including whoever you're describing.
- Plain text within the JSON string — no markdown, no headings, no bullet lists.`;

/**
 * Structured-outputs schema for the pulse reply. Guarantees parseable JSON:
 * without it, a multi-paragraph narrative sometimes came back with raw line
 * breaks inside the JSON string, which no JSON parser accepts (seen in the
 * 2026-10-02 live probe with the full-roster fact sheet).
 */
const PULSE_OUTPUT_FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      ranking: { type: 'array', items: { type: 'string' } },
      narrative: { type: 'string' },
    },
    required: ['ranking', 'narrative'],
    additionalProperties: false,
  },
} as const;

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
    const week = (await resolveLeagueWeek(db, league)).week;

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
          const analysis = await computeLeagueAnalysis(db, league, membership, { withAiDetail: true });
          if (analysis.teams.length === 0) {
            throw new RouteError(404, 'No teams found for this league yet.');
          }
          const teamIds = analysis.teams.map((t) => t.id);

          // Teams in win-loss standings order, each with its full sheet.
          const teamBlocks = [...analysis.teams]
            .sort((a, b) => a.recordRank - b.recordRank)
            .map((t) => formatTeamFacts(t, analysis, analysis.aiDetail?.[t.id]))
            .join('\n\n');
          const dataBlock = `${formatLeagueContext(analysis, league, week)}

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
                // ~350 words + the ranking array of visible output plus thinking
                // headroom — see utils/aiOutput.ts. The full-roster data block
                // is large, so allow a longer timeout than the other AI calls.
                max_tokens: maxTokensWithThinking(1600),
                output_config: { ...EFFORT_REASONING, format: PULSE_OUTPUT_FORMAT },
                system: buildCachedSystemBlocks(LEAGUE_PULSE_SYSTEM_PROMPT),
                messages: [{ role: 'user', content: dataBlock }],
              }),
              signal: AbortSignal.timeout(75000),
            });

            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              console.error('[league-analyzer/pulse] Anthropic error:', res.status, errText);
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }
            const data = (await res.json()) as AnthropicTextResponse;
            const text = firstText(data);
            if (!text) {
              console.error(`[league-analyzer/pulse] no text block (${describeResponse(data)})`);
              throw new RouteError(503, 'AI analysis is temporarily unavailable. Please try again shortly.');
            }

            const parsed = parseJsonObject<{ ranking?: unknown; narrative?: unknown }>(text);
            if (!parsed) {
              console.error(`[league-analyzer/pulse] non-JSON response (${describeResponse(data)}):`, text.slice(0, 300));
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
        generation.finally(() => pulseInFlight.delete(cacheKey)).catch(() => {}); // see the narrative route
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
  const week = (await resolveLeagueWeek(db, league)).week;

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
