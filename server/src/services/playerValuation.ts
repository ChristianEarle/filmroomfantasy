/**
 * playerValuation — deterministic "rest of season" value model.
 *
 * Separation of concerns:
 *  - tradeContext gives us FACTS (no judgment).
 *  - playerValuation turns those facts into a single COMPARABLE NUMBER
 *    plus a structured breakdown, used ONLY by the pre-filter / matcher.
 *  - Claude still does the final qualitative analysis that reaches the user.
 *
 * This value is never shown to the user. It exists so the matcher can:
 *   a) rank players within a position
 *   b) compare totals across candidates of different sizes
 *   c) enforce a value-balance tolerance per trade
 *
 * Design principles:
 *  - Pure function of PlayerFacts + LeagueSettings + currentWeek.
 *  - Returns null-safe numbers (missing data → 0 so sorts are stable).
 *  - No calls to AI, no database access.
 *  - Keep formulas LEGIBLE — reviewers should be able to eyeball the
 *    output and say "yeah, that seems right".
 */

import type { PlayerFacts, LeagueSettings } from './tradeContext';

export type PlayerTier =
  | 'elite'   // position rank 1-5 (or top-5 by pts when rank missing)
  | 'high'    // 6-12
  | 'mid'     // 13-24
  | 'depth'   // 25-36
  | 'stash';  // 37+ or unknown with low volume

export interface PlayerValuation {
  playerId: string;
  position: string;

  /** Per-game projected output in the league's scoring format */
  perGamePoints: number;
  /** Best guess at remaining games (bye-unadjusted) */
  gamesRemaining: number;
  /** perGamePoints × gamesRemaining */
  baseValue: number;

  /** Position-scarcity multiplier (league-aware: superflex, TE premium) */
  scarcityFactor: number;
  /** Playoff-schedule multiplier, centered on 1.0 */
  scheduleFactor: number;
  /** Injury availability discount (0-1) */
  injuryFactor: number;

  /** baseValue * scarcityFactor * scheduleFactor * injuryFactor */
  finalValue: number;

  /** Internal tier label used by the matcher to group players */
  tier: PlayerTier;

  /** Human-readable 1-line explanation — purely for debugging / logs */
  debug: string;
}

// ── Scarcity ─────────────────────────────────────────────────────────

function scarcityFactor(
  position: string,
  settings: LeagueSettings
): number {
  const pos = position.toUpperCase();
  switch (pos) {
    case 'QB':
      // QBs are cheap in 1-QB leagues, premium in superflex.
      return settings.superflex ? 1.18 : 0.82;
    case 'RB':
      // RBs are the scarcest position in typical PPR; slight bump.
      return 1.08;
    case 'WR':
      return 1.0;
    case 'TE':
      return settings.tePremium ? 1.22 : 0.95;
    case 'K':
    case 'DEF':
    case 'DST':
      // Finder ignores these anyway, but keep a low factor for safety.
      return 0.25;
    default:
      return 1.0;
  }
}

// ── Injury discount ──────────────────────────────────────────────────

function injuryFactor(status: string): number {
  switch (status) {
    case 'out':
    case 'injured_reserve':
    case 'ir':
      return 0.25;
    case 'doubtful':
      return 0.55;
    case 'questionable':
      return 0.85;
    default:
      return 1.0;
  }
}

// ── Playoff-schedule multiplier ─────────────────────────────────────
//
// Uses the implied totals for weeks 15-17 when available. Higher team
// implied total = easier / higher-scoring playoff matchup.
//
// Centered on 1.0. Capped to [0.92, 1.08] so schedule can never dominate
// actual value — it's a tiebreaker, not the core signal.

function scheduleFactor(p: PlayerFacts): number {
  const weeks = p.schedule?.playoffWeeks ?? [];
  const implieds = weeks
    .map((w) => w.impliedTotal)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  if (implieds.length === 0) return 1.0;

  const avg = implieds.reduce((a, b) => a + b, 0) / implieds.length;
  // League-average implied total is ~22.5. Map to a narrow band.
  const normalized = (avg - 22.5) / 22.5; // -0.5 .. +0.5 roughly
  const factor = 1.0 + normalized * 0.16;
  return Math.max(0.92, Math.min(1.08, factor));
}

// ── Per-game & games-remaining estimation ───────────────────────────

function perGameEstimate(p: PlayerFacts): number {
  // Prefer next-week projection (we already matched the scoring format
  // when pulling from D1). Fall back to recent-form average. Never
  // invent a number; return 0 if we have nothing.
  const projected = p.projection?.nextWeek?.projectedPoints;
  if (typeof projected === 'number' && projected > 0) return projected;

  const recent = p.recentVolume?.seasonFantasyPointsAvg;
  if (typeof recent === 'number' && recent > 0) return recent;

  return 0;
}

function gamesRemainingEstimate(
  currentWeek: number,
  hasProjection: boolean
): number {
  // Regular-season through W17, championship W17 or W18 depending on league.
  // We use 18 as the soft cap. Offseason (currentWeek <= 0) → full season.
  if (currentWeek <= 0 || !hasProjection) return 17;
  // Keep at least 1 so finalValue never zeroes out in the last week.
  return Math.max(1, 18 - currentWeek);
}

// ── Tier assignment ──────────────────────────────────────────────────

function assignTier(p: PlayerFacts, perGame: number): PlayerTier {
  const rank = p.projection?.nextWeek?.positionRank ?? null;
  if (rank != null) {
    if (rank <= 5) return 'elite';
    if (rank <= 12) return 'high';
    if (rank <= 24) return 'mid';
    if (rank <= 36) return 'depth';
    return 'stash';
  }
  // No positionRank: use per-game pts as a crude proxy.
  // Thresholds tuned to rough PPR averages at each position tier.
  if (perGame >= 18) return 'elite';
  if (perGame >= 13) return 'high';
  if (perGame >= 9) return 'mid';
  if (perGame >= 5) return 'depth';
  return 'stash';
}

// ── Main entry point ────────────────────────────────────────────────

export function valuePlayer(
  p: PlayerFacts,
  settings: LeagueSettings,
  currentWeek: number
): PlayerValuation {
  const perGame = perGameEstimate(p);
  const hasProjection = !!p.projection?.nextWeek;
  const gamesRemaining = gamesRemainingEstimate(currentWeek, hasProjection);
  const baseValue = perGame * gamesRemaining;

  const scarcity = scarcityFactor(p.position, settings);
  const schedule = scheduleFactor(p);
  const injury = injuryFactor(p.identity.status || 'active');

  const finalValue = baseValue * scarcity * schedule * injury;

  const tier = assignTier(p, perGame);

  return {
    playerId: p.id,
    position: p.position,
    perGamePoints: Math.round(perGame * 10) / 10,
    gamesRemaining,
    baseValue: Math.round(baseValue * 10) / 10,
    scarcityFactor: Math.round(scarcity * 100) / 100,
    scheduleFactor: Math.round(schedule * 100) / 100,
    injuryFactor: Math.round(injury * 100) / 100,
    finalValue: Math.round(finalValue * 10) / 10,
    tier,
    debug:
      `${p.name} ${p.position}: ` +
      `${perGame.toFixed(1)} ppg × ${gamesRemaining}gr ` +
      `× scar ${scarcity.toFixed(2)} ` +
      `× sched ${schedule.toFixed(2)} ` +
      `× inj ${injury.toFixed(2)} = ${finalValue.toFixed(1)} [${tier}]`,
  };
}

/**
 * Convenience: compute valuations for every player in a TradeContext
 * and return them as a Map<playerId, PlayerValuation>.
 */
export function buildValuationMap(
  players: PlayerFacts[],
  settings: LeagueSettings,
  currentWeek: number
): Map<string, PlayerValuation> {
  const out = new Map<string, PlayerValuation>();
  for (const p of players) {
    out.set(p.id, valuePlayer(p, settings, currentWeek));
  }
  return out;
}

/**
 * Sum the finalValue of a list of player ids. Missing ids are treated as 0.
 */
export function sumValue(
  ids: string[],
  valuations: Map<string, PlayerValuation>
): number {
  let total = 0;
  for (const id of ids) {
    const v = valuations.get(id);
    if (v) total += v.finalValue;
  }
  return total;
}

/**
 * Signed value delta of a package (received - sent) as a percentage of
 * the larger side. Range roughly [-1, 1]. Useful for enforcing a
 * "within 25% of balanced" rule in the matcher.
 */
export function valueImbalancePct(
  sentIds: string[],
  receivedIds: string[],
  valuations: Map<string, PlayerValuation>
): number {
  const sent = sumValue(sentIds, valuations);
  const received = sumValue(receivedIds, valuations);
  const max = Math.max(sent, received);
  if (max === 0) return 0;
  return (received - sent) / max;
}
