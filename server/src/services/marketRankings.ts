/**
 * Deterministic "Market" (sportsbook-implied) season projection + VORP
 * ranking math. Pure functions only — no DB access, no fetch — so this
 * module is unit-testable without D1/Miniflare.
 *
 * Two projection tiers feed into this:
 *  - Tier A ('season_props'): built from season-long prop lines via
 *    services/seasonProps.ts's buildSeasonProjectionsFromSeasonProps.
 *  - Tier B ('weekly_extrapolation'): a played-points-so-far + remaining-
 *    games extrapolation from the latest weekly prop-based projection, for
 *    players without season prop coverage.
 *
 * routes/admin.ts's POST /sync-market-projections wires these together
 * against real data and writes player_market_projections rows.
 */

export type ScoringFormat = 'ppr' | 'half-ppr' | 'standard';

// ── Remaining games ──────────────────────────────────────────────────────

export interface RemainingGamesInput {
  /** Every week the player's team is scheduled to play this season (1-18ish), bye included. */
  teamScheduleWeeks: number[];
  /** Weeks the player has already played (has a finalized stat row for). */
  playedWeeks: number[];
  byeWeek: number | null;
  asOfWeek: number;
}

/**
 * Count of scheduled weeks strictly after `asOfWeek` that haven't already
 * been played, excluding the bye week. Guards against double-counting a
 * week that appears in both `teamScheduleWeeks` and `playedWeeks`.
 */
export function computeRemainingGames(input: RemainingGamesInput): number {
  const playedSet = new Set(input.playedWeeks);
  const remaining = new Set<number>();
  for (const week of input.teamScheduleWeeks) {
    if (week <= input.asOfWeek) continue;
    if (input.byeWeek != null && week === input.byeWeek) continue;
    if (playedSet.has(week)) continue;
    remaining.add(week);
  }
  return remaining.size;
}

// ── Tier A: season props adapter ────────────────────────────────────────

export interface SeasonPropsPoints {
  ppr: number;
  halfPpr: number;
  standard: number;
}

/** Thin adapter over #305's buildSeasonProjectionsFromSeasonProps output. */
export function seasonPointsFromSeasonProps(proj: SeasonPropsPoints, format: ScoringFormat): number {
  if (format === 'ppr') return proj.ppr;
  if (format === 'half-ppr') return proj.halfPpr;
  return proj.standard;
}

// ── Tier B: weekly-rate extrapolation ───────────────────────────────────

export interface WeeklyRateInput {
  /** Points already scored in played weeks (actuals), in the target scoring format. */
  playedPoints: number;
  /** Per-game rate implied by the latest weekly prop-based projection. */
  weeklyRate: number;
  /** Position-average per-game rate, used to shrink noisy small-sample rates. */
  posAvgRate: number;
  /** How many weeks of played history back the weeklyRate figure. */
  weeksOfHistory: number;
  remainingGames: number;
}

/**
 * Season points = already-played points + a blended per-game rate applied
 * to the remaining schedule. With fewer than 3 weeks of history the rate is
 * shrunk 80/20 toward the position average to reduce small-sample noise;
 * from 3 weeks on the raw rate is used as-is.
 */
export function seasonPointsFromWeeklyRate(input: WeeklyRateInput): number {
  const blendedRate = input.weeksOfHistory < 3
    ? input.weeklyRate * 0.8 + input.posAvgRate * 0.2
    : input.weeklyRate;
  return input.playedPoints + blendedRate * input.remainingGames;
}

// ── Tier B week selection ───────────────────────────────────────────────

/**
 * Which week's 'props'-sourced weekly player_projections rows Tier B should
 * read from. `asOfWeek` is the last COMPLETED week (0 pre-Week-1), so the
 * upcoming week — the one still worth extrapolating from — is
 * `asOfWeek + 1`. When that exact week has no props coverage yet (e.g. the
 * book hasn't posted week-N lines), fall back to the latest available week
 * at or before it, so the sync still finds something rather than nothing.
 * Returns null when no available week qualifies (no props data at all, or
 * only weeks after the upcoming one).
 */
export function pickTierBWeek(asOfWeek: number, availableWeeks: number[]): number | null {
  const targetWeek = asOfWeek + 1;
  if (availableWeeks.includes(targetWeek)) return targetWeek;
  const eligible = availableWeeks.filter((week) => week <= targetWeek);
  if (eligible.length === 0) return null;
  return Math.max(...eligible);
}

// ── Stat-level season/weekly merge (Tier A + Tier B blending) ────────────

export type SeasonStatKey =
  | 'passYds'
  | 'passTds'
  | 'rushYds'
  | 'rushTds'
  | 'receptions'
  | 'recYds'
  | 'recTds'
  | 'interceptions';

export type SeasonStatVector = Record<SeasonStatKey, number>;

export type StatSource = 'season' | 'weekly' | 'missing';

export type MarketConfidence = 'season_props' | 'blended' | 'weekly_extrapolation';

const ALL_STAT_KEYS: SeasonStatKey[] = [
  'passYds',
  'passTds',
  'rushYds',
  'rushTds',
  'receptions',
  'recYds',
  'recTds',
  'interceptions',
];

export const EMPTY_SEASON_STAT_VECTOR: SeasonStatVector = {
  passYds: 0,
  passTds: 0,
  rushYds: 0,
  rushTds: 0,
  receptions: 0,
  recYds: 0,
  recTds: 0,
  interceptions: 0,
};

/**
 * Stats that gate confidence for a position: ALL of these must come from a
 * season-long prop line for the player to be 'season_props' confidence,
 * and NONE of them coming from season lines means 'weekly_extrapolation'.
 * Anything in between (some core stats from season lines, the rest filled
 * from weekly extrapolation or left at 0 because neither source has them)
 * is 'blended'.
 */
const CORE_STATS_BY_POSITION: Partial<Record<string, SeasonStatKey[]>> = {
  QB: ['passYds', 'passTds', 'rushYds', 'rushTds'],
  RB: ['rushYds', 'rushTds', 'receptions', 'recYds', 'recTds'],
  WR: ['receptions', 'recYds', 'recTds'],
  TE: ['receptions', 'recYds', 'recTds'],
};

/**
 * Stats that are merged in when available but don't gate confidence — a
 * missing optional stat never by itself prevents 'season_props' (e.g. most
 * WRs never get a rush_yds prop line at all; that's not "incomplete
 * coverage", it's just not a market for them).
 */
const OPTIONAL_STATS_BY_POSITION: Partial<Record<string, SeasonStatKey[]>> = {
  QB: ['interceptions'],
  RB: [],
  WR: ['rushYds'],
  TE: ['rushYds'],
};

export interface MergeSeasonStatVectorInput {
  /** Season-long stat totals from season prop lines (buildSeasonProjectionsFromSeasonProps's `.stats`). Missing stats should be 0. */
  seasonLines: Partial<SeasonStatVector>;
  /** Which stat keys actually had a season-prop line — distinguishes "0 because no line" from "0 because the line's value was 0". */
  seasonStatsPresent: ReadonlySet<SeasonStatKey>;
  /** Per-stat values from the latest weekly 'props'-sourced player_projections row (a single week's projection, not a rate). Missing/undefined = no weekly coverage for that stat. */
  weeklyStats: Partial<SeasonStatVector>;
  /**
   * Per-stat totals already accrued in played weeks (weeks 1..asOfWeek),
   * e.g. summed from player_weekly_stats. Missing stats default to 0
   * (pre-season / no played weeks behaves exactly as before). Used to make
   * weekly-sourced stats full-season totals — see the 'weekly' branch below.
   */
  playedStatTotals?: Partial<SeasonStatVector>;
  /** Games remaining in the season (see computeRemainingGames) — weekly stats are extrapolated as playedStatTotals[stat] + weeklyStats[stat] * remainingGames. */
  remainingGames: number;
  position: string;
}

export interface MergeSeasonStatVectorResult {
  stats: SeasonStatVector;
  sourcesByStat: Record<SeasonStatKey, StatSource>;
  confidence: MarketConfidence;
}

/**
 * Build a player's full season stat vector by merging season-prop lines
 * (Tier A) with weekly-projection extrapolation (Tier B) at the individual
 * stat level, so a player with partial season-prop coverage (e.g. an RB
 * with only a rush_yds season line) doesn't get scored as if their
 * un-covered stats (receptions, rec_yds, rec_tds) are zero for the season.
 *
 * For each stat relevant to `position` (core + optional):
 *  - present in seasonStatsPresent -> use the season-line total as-is.
 *  - else, weeklyStats has a value for it -> extrapolate weeklyStats * remainingGames.
 *  - else -> 0 (no source at all).
 * Stats not relevant to the position are left at 0 and excluded from
 * confidence gating.
 */
export function mergeSeasonStatVector(input: MergeSeasonStatVectorInput): MergeSeasonStatVectorResult {
  const { seasonLines, seasonStatsPresent, weeklyStats, playedStatTotals, remainingGames, position } = input;
  const core = CORE_STATS_BY_POSITION[position] ?? [];
  const optional = OPTIONAL_STATS_BY_POSITION[position] ?? [];
  const relevant = new Set<SeasonStatKey>([...core, ...optional]);

  const stats: SeasonStatVector = { ...EMPTY_SEASON_STAT_VECTOR };
  const sourcesByStat = {} as Record<SeasonStatKey, StatSource>;

  for (const key of ALL_STAT_KEYS) {
    if (!relevant.has(key)) {
      sourcesByStat[key] = 'missing';
      continue;
    }
    if (seasonStatsPresent.has(key)) {
      stats[key] = seasonLines[key] ?? 0;
      sourcesByStat[key] = 'season';
      continue;
    }
    const weeklyValue = weeklyStats[key];
    if (weeklyValue != null) {
      // Season lines are whole-season totals, so weekly-sourced stats must
      // be full-season too: already-played production plus the projected
      // rate applied to the remaining schedule. Without the played total,
      // a mid-season blended vector would omit production already on the
      // books for this stat (see computeRosPoints, which subtracts played
      // points from this season total to get rest-of-season points).
      const played = playedStatTotals?.[key] ?? 0;
      stats[key] = played + weeklyValue * remainingGames;
      sourcesByStat[key] = 'weekly';
      continue;
    }
    sourcesByStat[key] = 'missing';
  }

  let confidence: MarketConfidence;
  if (core.length === 0) {
    // No core stats defined for this position (e.g. K/DEF) — this function
    // isn't meant to be used for them, but degrade gracefully rather than throw.
    confidence = 'weekly_extrapolation';
  } else {
    const coreSources = core.map((key) => sourcesByStat[key]);
    const allSeason = coreSources.every((s) => s === 'season');
    const noneSeason = coreSources.every((s) => s !== 'season');
    confidence = allSeason ? 'season_props' : noneSeason ? 'weekly_extrapolation' : 'blended';
  }

  return { stats, sourcesByStat, confidence };
}

// ── Rest-of-season points ────────────────────────────────────────────────

export interface RosPointsResult {
  rosPoints: number;
  perGameRate: number | null;
}

/**
 * Rest-of-season points still to come, plus the implied per-game rate.
 *
 * `seasonPoints` already includes `playedPoints`: Tier B builds its season
 * total as playedPoints + rate*remaining (see seasonPointsFromWeeklyRate),
 * and Tier A's season-prop total is a whole-season number that inherently
 * covers weeks already played. So rosPoints must *subtract* playedPoints,
 * not add it — adding would double-count games already played. Floored at
 * 0 for the rare case seasonPoints undershoots actual playedPoints (e.g. a
 * stale/lower market line after a big game).
 *
 * perGameRate is rosPoints spread evenly over the remaining games, or null
 * once there are no games left to spread it over (rather than a stale/
 * misleading season-long average).
 */
export function computeRosPoints(seasonPoints: number, playedPoints: number, remaining: number): RosPointsResult {
  const rosPoints = Math.max(0, seasonPoints - playedPoints);
  const perGameRate = remaining > 0 ? rosPoints / remaining : null;
  return { rosPoints, perGameRate };
}

// ── Replacement levels ──────────────────────────────────────────────────

export type RankedPosition = 'QB' | 'RB' | 'WR' | 'TE';

/**
 * Replacement-level rank (the Nth-best player at a position who's still
 * "on the wire" in a standard 12-team league: 2 RB / 3 WR / 1 TE / 1 FLEX).
 * QB replacement doubles in superflex leagues since a second starting QB
 * slot pulls a QB2 into every flex-eligible spot too.
 */
export function computeReplacementLevels({ superflex }: { superflex: boolean }): Record<RankedPosition, number> {
  return {
    QB: superflex ? 24 : 12,
    RB: 30,
    WR: 42,
    TE: 12,
  };
}

// ── VORP ranking + tiering ──────────────────────────────────────────────

const RANKED_POSITIONS: ReadonlySet<string> = new Set(['QB', 'RB', 'WR', 'TE']);

/** Max VORP drop allowed within a tier, as a fraction of the tier's running average VORP. */
const TIER_BREAK_FRACTION = 0.15;
const MAX_TIERS = 8;

export interface VORPInputPlayer {
  playerId: string;
  name: string;
  position: string;
  seasonPoints: number;
}

export interface VORPRankedPlayer extends VORPInputPlayer {
  overallRank: number | null;
  positionRank: number | null;
  tier: number | null;
  vorp: number | null;
}

/**
 * Rank players by Value Over Replacement Player: for each rankable position
 * (QB/RB/WR/TE), the replacement level's seasonPoints becomes that
 * position's baseline, and every ranked player's VORP is seasonPoints minus
 * that baseline. Overall rank is by descending VORP across all rankable
 * positions, tie-broken deterministically by name. K/DEF (and anything
 * else outside QB/RB/WR/TE) are excluded from ranking/VORP/tiering — they
 * come back with seasonPoints preserved and rank/vorp/tier all null.
 *
 * Tiers: a new tier starts whenever the VORP drop from the previous player
 * to this one exceeds 15% of the current tier's running-average VORP,
 * capped at 8 tiers total (the 8th tier absorbs everyone after).
 */
export function rankByVORP(
  players: VORPInputPlayer[],
  replacement: Record<RankedPosition, number>
): VORPRankedPlayer[] {
  const byNameTieBreak = (a: VORPInputPlayer, b: VORPInputPlayer) =>
    b.seasonPoints - a.seasonPoints || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);

  const ranked = players.filter((p) => RANKED_POSITIONS.has(p.position));
  const unranked = players.filter((p) => !RANKED_POSITIONS.has(p.position));

  // Replacement baseline per position: the seasonPoints of the player at
  // the replacement rank (1-indexed), clamped to the pool size.
  const byPosition = new Map<string, VORPInputPlayer[]>();
  for (const p of ranked) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }

  const replacementPointsByPosition = new Map<string, number>();
  for (const [position, list] of byPosition) {
    const sorted = [...list].sort(byNameTieBreak);
    const level = replacement[position as RankedPosition] ?? sorted.length;
    const idx = Math.min(Math.max(level, 1), sorted.length) - 1;
    replacementPointsByPosition.set(position, sorted[idx]?.seasonPoints ?? 0);
  }

  const withVorp = ranked.map((p) => ({
    ...p,
    vorp: p.seasonPoints - (replacementPointsByPosition.get(p.position) ?? 0),
  }));

  const sortedOverall = [...withVorp].sort(
    (a, b) => b.vorp - a.vorp || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId)
  );

  const result: VORPRankedPlayer[] = [];
  let tier = 1;
  let tierSum = 0;
  let tierCount = 0;
  let prevVorp: number | null = null;

  for (const p of sortedOverall) {
    if (prevVorp !== null && tierCount > 0 && tier < MAX_TIERS) {
      const tierAvg = tierSum / tierCount;
      const drop = prevVorp - p.vorp;
      const threshold = Math.abs(tierAvg) * TIER_BREAK_FRACTION;
      if (drop > threshold) {
        tier++;
        tierSum = 0;
        tierCount = 0;
      }
    }
    tierSum += p.vorp;
    tierCount++;
    prevVorp = p.vorp;
    result.push({ ...p, overallRank: null, positionRank: null, tier, vorp: p.vorp });
  }

  result.forEach((p, i) => {
    p.overallRank = i + 1;
  });

  const posCounters = new Map<string, number>();
  for (const p of result) {
    const next = (posCounters.get(p.position) ?? 0) + 1;
    posCounters.set(p.position, next);
    p.positionRank = next;
  }

  const unrankedResult: VORPRankedPlayer[] = [...unranked]
    .sort(byNameTieBreak)
    .map((p) => ({ ...p, overallRank: null, positionRank: null, tier: null, vorp: null }));

  return [...result, ...unrankedResult];
}
