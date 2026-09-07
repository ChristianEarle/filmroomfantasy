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
