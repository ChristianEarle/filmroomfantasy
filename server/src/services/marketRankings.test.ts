import { describe, it, expect } from 'vitest';
import {
  computeRemainingGames,
  seasonPointsFromSeasonProps,
  seasonPointsFromWeeklyRate,
  computeReplacementLevels,
  rankByVORP,
  computeRosPoints,
  pickTierBWeek,
  mergeSeasonStatVector,
  EMPTY_SEASON_STAT_VECTOR,
  type VORPInputPlayer,
  type SeasonStatKey,
} from './marketRankings';

describe('computeRemainingGames', () => {
  it('counts scheduled weeks after asOfWeek, excluding the bye week', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      playedWeeks: [1, 2, 3, 4, 5],
      byeWeek: 7,
      asOfWeek: 5,
    });
    // weeks after 5: 6,7,8,9,10 minus bye(7) => 6,8,9,10
    expect(result).toBe(4);
  });

  it('excludes already-played weeks even if they appear after asOfWeek (guards double counting)', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: [1, 2, 3, 4, 5, 6],
      playedWeeks: [1, 2, 3, 4, 5, 6], // all played somehow, despite asOfWeek being lower
      byeWeek: null,
      asOfWeek: 3,
    });
    expect(result).toBe(0);
  });

  it('returns 0 remaining when asOfWeek is at the end of the schedule', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: Array.from({ length: 17 }, (_, i) => i + 1),
      playedWeeks: Array.from({ length: 17 }, (_, i) => i + 1),
      byeWeek: 9,
      asOfWeek: 17,
    });
    expect(result).toBe(0);
  });

  it('handles a null bye week without filtering anything extra', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: [1, 2, 3],
      playedWeeks: [1],
      byeWeek: null,
      asOfWeek: 1,
    });
    expect(result).toBe(2);
  });

  // asOfWeek is defined as "last COMPLETED week" (see admin.ts's
  // sync-market-projections: asOfWeek = currentWeek - 1, floored at 0
  // before Week 1) — these pin down that semantics at the boundaries.

  it('pre-season (asOfWeek 0) counts the full season as remaining, bye included in the schedule input', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: Array.from({ length: 18 }, (_, i) => i + 1), // full 18-week calendar
      playedWeeks: [],
      byeWeek: 7,
      asOfWeek: 0,
    });
    // 18 calendar weeks minus the bye week => 17 remaining, nothing played yet.
    expect(result).toBe(17);
  });

  it('mid-season with 3 completed weeks and a later bye counts remaining weeks minus the bye', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: Array.from({ length: 17 }, (_, i) => i + 1), // weeks 1-17
      playedWeeks: [1, 2, 3],
      byeWeek: 10, // after asOfWeek — still ahead, should be excluded
      asOfWeek: 3,
    });
    // Weeks 4-17 = 14 weeks, minus the bye (10) => 13 remaining.
    expect(result).toBe(13);
  });

  it('does not double-remove a bye week that already fell on or before asOfWeek', () => {
    const result = computeRemainingGames({
      teamScheduleWeeks: Array.from({ length: 18 }, (_, i) => i + 1),
      playedWeeks: [1, 3, 4], // team didn't play its own bye week (2)
      byeWeek: 2,
      asOfWeek: 4,
    });
    // Weeks 5-18 = 14 weeks. The bye (2) is already <= asOfWeek and would
    // never reach the bye check, so it must not also be subtracted here.
    expect(result).toBe(14);
  });
});

describe('computeRosPoints', () => {
  it('does not double count games already played (Tier B: seasonPoints already includes playedPoints)', () => {
    // playedPoints=80 over weeks so far, seasonPoints=250 for the full year
    // (i.e. 170 still to come), 10 games remaining.
    const result = computeRosPoints(250, 80, 10);
    expect(result.rosPoints).toBe(170);
    expect(result.perGameRate).toBeCloseTo(17, 5);
  });

  it('pre-season (no games played yet) treats rosPoints as the full season total', () => {
    const result = computeRosPoints(340, 0, 17);
    expect(result.rosPoints).toBe(340);
    expect(result.perGameRate).toBeCloseTo(340 / 17, 5);
  });

  it('floors rosPoints at 0 when seasonPoints undershoots playedPoints', () => {
    const result = computeRosPoints(100, 120, 5);
    expect(result.rosPoints).toBe(0);
    expect(result.perGameRate).toBe(0);
  });

  it('returns a null perGameRate once no games remain', () => {
    const result = computeRosPoints(250, 250, 0);
    expect(result.rosPoints).toBe(0);
    expect(result.perGameRate).toBeNull();
  });
});

describe('seasonPointsFromSeasonProps', () => {
  const proj = { ppr: 300, halfPpr: 270, standard: 240 };

  it('selects ppr', () => {
    expect(seasonPointsFromSeasonProps(proj, 'ppr')).toBe(300);
  });

  it('selects half-ppr', () => {
    expect(seasonPointsFromSeasonProps(proj, 'half-ppr')).toBe(270);
  });

  it('selects standard', () => {
    expect(seasonPointsFromSeasonProps(proj, 'standard')).toBe(240);
  });
});

describe('seasonPointsFromWeeklyRate', () => {
  it('shrinks the rate toward the position average with fewer than 3 weeks of history', () => {
    const result = seasonPointsFromWeeklyRate({
      playedPoints: 20,
      weeklyRate: 20,
      posAvgRate: 10,
      weeksOfHistory: 2,
      remainingGames: 10,
    });
    // blended = 20*0.8 + 10*0.2 = 18
    expect(result).toBeCloseTo(20 + 18 * 10, 5);
  });

  it('uses the raw rate with no shrinkage at 3+ weeks of history', () => {
    const result = seasonPointsFromWeeklyRate({
      playedPoints: 45,
      weeklyRate: 15,
      posAvgRate: 5,
      weeksOfHistory: 3,
      remainingGames: 10,
    });
    expect(result).toBeCloseTo(45 + 15 * 10, 5);
  });

  it('returns just the played points when no games remain', () => {
    const result = seasonPointsFromWeeklyRate({
      playedPoints: 200,
      weeklyRate: 12,
      posAvgRate: 8,
      weeksOfHistory: 1,
      remainingGames: 0,
    });
    expect(result).toBe(200);
  });
});

describe('computeReplacementLevels', () => {
  it('uses 1-QB replacement levels by default', () => {
    expect(computeReplacementLevels({ superflex: false })).toEqual({
      QB: 12,
      RB: 30,
      WR: 42,
      TE: 12,
    });
  });

  it('doubles QB replacement level in superflex', () => {
    expect(computeReplacementLevels({ superflex: true })).toEqual({
      QB: 24,
      RB: 30,
      WR: 42,
      TE: 12,
    });
  });
});

describe('rankByVORP', () => {
  const replacement = computeReplacementLevels({ superflex: false });

  function player(id: string, position: string, seasonPoints: number): VORPInputPlayer {
    return { playerId: id, name: id, position, seasonPoints };
  }

  it('computes VORP as seasonPoints minus the replacement-rank player at that position', () => {
    // 2 RBs only, replacement level RB=30 clamps to pool size (2) -> replacement is the 2nd (worst) RB.
    const players = [player('rb1', 'RB', 200), player('rb2', 'RB', 100)];
    const result = rankByVORP(players, replacement);
    const rb1 = result.find((r) => r.playerId === 'rb1')!;
    const rb2 = result.find((r) => r.playerId === 'rb2')!;
    expect(rb2.vorp).toBe(0); // rb2 IS the replacement level
    expect(rb1.vorp).toBe(100); // 200 - 100
  });

  it('assigns overallRank and positionRank correctly across positions', () => {
    const players = [
      player('qb1', 'QB', 300),
      player('rb1', 'RB', 250),
      player('rb2', 'RB', 150),
      player('wr1', 'WR', 220),
    ];
    const result = rankByVORP(players, replacement);
    // Sorted by VORP desc; ranks assigned 1..n
    const ranks = result.map((r) => r.overallRank);
    expect(ranks).toEqual([1, 2, 3, 4]);
    const rbRanks = result.filter((r) => r.position === 'RB').map((r) => r.positionRank);
    expect(rbRanks.sort()).toEqual([1, 2]);
  });

  it('creates a new tier when the VORP drop exceeds 15% of the running tier average', () => {
    // Clear stair-step: 100, 95, 90 (tight cluster) then a big cliff to 20.
    const players = [
      player('a', 'WR', 200), // vorp baseline before replacement subtraction; use only WRs so no cross-position noise
      player('b', 'WR', 195),
      player('c', 'WR', 190),
      player('d', 'WR', 40),
      player('e', 'WR', 10), // WR replacement level (42nd) — pool has only 5, clamps to worst (e)
    ];
    const result = rankByVORP(players, replacement);
    const byId = new Map(result.map((r) => [r.playerId, r]));
    // a, b, c should stay in tier 1 (small drops relative to running avg)
    expect(byId.get('a')!.tier).toBe(1);
    expect(byId.get('b')!.tier).toBe(1);
    expect(byId.get('c')!.tier).toBe(1);
    // d has a big cliff from c -> new tier
    expect(byId.get('d')!.tier).toBeGreaterThan(byId.get('c')!.tier!);
  });

  it('never produces more than 8 tiers', () => {
    // 20 WRs each with a huge cliff between them to try to force >8 tier breaks.
    const players = Array.from({ length: 20 }, (_, i) => player(`wr${i}`, 'WR', (20 - i) * 1000));
    const result = rankByVORP(players, replacement);
    const maxTier = Math.max(...result.map((r) => r.tier ?? 0));
    expect(maxTier).toBeLessThanOrEqual(8);
  });

  it('excludes K and DEF from ranking, keeping seasonPoints only with null rank/vorp/tier', () => {
    const players = [
      player('qb1', 'QB', 300),
      player('k1', 'K', 130),
      player('def1', 'DEF', 120),
    ];
    const result = rankByVORP(players, replacement);
    const k = result.find((r) => r.playerId === 'k1')!;
    const def = result.find((r) => r.playerId === 'def1')!;
    expect(k.overallRank).toBeNull();
    expect(k.positionRank).toBeNull();
    expect(k.tier).toBeNull();
    expect(k.vorp).toBeNull();
    expect(k.seasonPoints).toBe(130);
    expect(def.overallRank).toBeNull();
    expect(def.seasonPoints).toBe(120);
  });

  it('breaks exact ties deterministically by name', () => {
    const players = [
      player('zeta', 'WR', 150),
      player('alpha', 'WR', 150),
      player('mike', 'WR', 150),
    ];
    const result = rankByVORP(players, replacement);
    const orderedNames = [...result].sort((a, b) => (a.overallRank ?? 0) - (b.overallRank ?? 0)).map((r) => r.name);
    expect(orderedNames).toEqual(['alpha', 'mike', 'zeta']);
  });

  it('is deterministic across repeated calls with the same input', () => {
    const players = [
      player('a', 'RB', 123.456),
      player('b', 'RB', 123.456),
      player('c', 'WR', 99.9),
    ];
    const run1 = rankByVORP(players, replacement);
    const run2 = rankByVORP(players, replacement);
    expect(run1).toEqual(run2);
  });

  it('handles an empty player list', () => {
    expect(rankByVORP([], replacement)).toEqual([]);
  });

  it('handles a pool smaller than the replacement level by clamping to the worst player', () => {
    const players = [player('te1', 'TE', 80), player('te2', 'TE', 40)];
    // TE replacement level is 12, but pool only has 2 — should clamp to the 2nd (worst).
    const result = rankByVORP(players, replacement);
    const te2 = result.find((r) => r.playerId === 'te2')!;
    expect(te2.vorp).toBe(0);
  });
});

describe('pickTierBWeek', () => {
  it('picks the upcoming week (asOfWeek + 1) when it has props coverage', () => {
    expect(pickTierBWeek(3, [1, 2, 3, 4, 5])).toBe(4);
  });

  it('pre-season (asOfWeek 0) picks week 1 when available', () => {
    expect(pickTierBWeek(0, [1, 2, 3])).toBe(1);
  });

  it('falls back to the latest available week at or before the upcoming week', () => {
    // Upcoming week (5) has no props yet — fall back to the latest week <= 5.
    expect(pickTierBWeek(4, [1, 2, 3])).toBe(3);
  });

  it('returns null when no available week qualifies (nothing at or before the upcoming week)', () => {
    expect(pickTierBWeek(0, [3, 4, 5])).toBeNull();
  });

  it('returns null with no available weeks at all', () => {
    expect(pickTierBWeek(2, [])).toBeNull();
  });

  it('prefers the exact upcoming week over an earlier fallback candidate', () => {
    expect(pickTierBWeek(2, [1, 2, 3])).toBe(3);
  });
});

describe('mergeSeasonStatVector', () => {
  const emptyPresent = new Set<SeasonStatKey>();

  it('RB with rush-only season lines gets receptions/rec_yds/rec_tds filled from weekly x remaining, and is "blended"', () => {
    const result = mergeSeasonStatVector({
      seasonLines: { ...EMPTY_SEASON_STAT_VECTOR, rushYds: 1200, rushTds: 10 },
      seasonStatsPresent: new Set<SeasonStatKey>(['rushYds', 'rushTds']),
      weeklyStats: { receptions: 3, recYds: 25, recTds: 0.2 },
      remainingGames: 17,
      position: 'RB',
    });

    expect(result.confidence).toBe('blended');
    expect(result.sourcesByStat.rushYds).toBe('season');
    expect(result.sourcesByStat.rushTds).toBe('season');
    expect(result.sourcesByStat.receptions).toBe('weekly');
    expect(result.sourcesByStat.recYds).toBe('weekly');
    expect(result.sourcesByStat.recTds).toBe('weekly');
    expect(result.stats.rushYds).toBe(1200);
    expect(result.stats.rushTds).toBe(10);
    expect(result.stats.receptions).toBeCloseTo(3 * 17, 5);
    expect(result.stats.recYds).toBeCloseTo(25 * 17, 5);
    expect(result.stats.recTds).toBeCloseTo(0.2 * 17, 5);
  });

  it('WR with all core stats from season lines is "season_props", even without a rush_yds line (optional stat)', () => {
    const result = mergeSeasonStatVector({
      seasonLines: { ...EMPTY_SEASON_STAT_VECTOR, receptions: 90, recYds: 1100, recTds: 8 },
      seasonStatsPresent: new Set<SeasonStatKey>(['receptions', 'recYds', 'recTds']),
      weeklyStats: {},
      remainingGames: 17,
      position: 'WR',
    });

    expect(result.confidence).toBe('season_props');
    expect(result.sourcesByStat.receptions).toBe('season');
    expect(result.sourcesByStat.recYds).toBe('season');
    expect(result.sourcesByStat.recTds).toBe('season');
    // Optional stat with no season line and no weekly data — missing, but doesn't affect confidence.
    expect(result.sourcesByStat.rushYds).toBe('missing');
    expect(result.stats.receptions).toBe(90);
  });

  it('no season lines at all falls back entirely to weekly extrapolation', () => {
    const result = mergeSeasonStatVector({
      seasonLines: EMPTY_SEASON_STAT_VECTOR,
      seasonStatsPresent: emptyPresent,
      weeklyStats: { receptions: 5, recYds: 60, recTds: 0.5 },
      remainingGames: 14,
      position: 'WR',
    });

    expect(result.confidence).toBe('weekly_extrapolation');
    expect(result.sourcesByStat.receptions).toBe('weekly');
    expect(result.sourcesByStat.recYds).toBe('weekly');
    expect(result.sourcesByStat.recTds).toBe('weekly');
    expect(result.stats.receptions).toBeCloseTo(5 * 14, 5);
  });

  it('QB with all core stats from season lines is "season_props" regardless of interceptions (optional) coverage', () => {
    const withInterceptions = mergeSeasonStatVector({
      seasonLines: {
        ...EMPTY_SEASON_STAT_VECTOR,
        passYds: 4200,
        passTds: 28,
        rushYds: 300,
        rushTds: 3,
        interceptions: 11,
      },
      seasonStatsPresent: new Set<SeasonStatKey>(['passYds', 'passTds', 'rushYds', 'rushTds', 'interceptions']),
      weeklyStats: {},
      remainingGames: 17,
      position: 'QB',
    });
    expect(withInterceptions.confidence).toBe('season_props');
    expect(withInterceptions.sourcesByStat.interceptions).toBe('season');

    const withoutInterceptions = mergeSeasonStatVector({
      seasonLines: { ...EMPTY_SEASON_STAT_VECTOR, passYds: 4200, passTds: 28, rushYds: 300, rushTds: 3 },
      seasonStatsPresent: new Set<SeasonStatKey>(['passYds', 'passTds', 'rushYds', 'rushTds']),
      weeklyStats: {}, // no weekly interceptions market exists (see projections.ts)
      remainingGames: 17,
      position: 'QB',
    });
    expect(withoutInterceptions.confidence).toBe('season_props');
    expect(withoutInterceptions.sourcesByStat.interceptions).toBe('missing');
    expect(withoutInterceptions.stats.interceptions).toBe(0);
  });

  it('a QB missing one core stat from season lines, filled from weekly, is "blended"', () => {
    const result = mergeSeasonStatVector({
      seasonLines: { ...EMPTY_SEASON_STAT_VECTOR, passYds: 4200, passTds: 28 },
      seasonStatsPresent: new Set<SeasonStatKey>(['passYds', 'passTds']),
      weeklyStats: { rushYds: 15, rushTds: 0.1 },
      remainingGames: 17,
      position: 'QB',
    });
    expect(result.confidence).toBe('blended');
    expect(result.sourcesByStat.rushYds).toBe('weekly');
    expect(result.stats.rushYds).toBeCloseTo(15 * 17, 5);
  });

  // ── Regression: weekly-sourced stats must be full-season (played + rate*remaining) ──
  //
  // Before this fix, a weekly-sourced stat was computed as `weekly * remainingGames`
  // only — the played-so-far production for that stat was silently dropped from the
  // season total. Since computeRosPoints does `max(0, seasonPoints - playedPoints)`,
  // that omission deflated rest-of-season points for every mid-season "blended"
  // player once games had actually been played.
  it('mid-season blended RB: weekly-sourced receiving stats include played production, not just the remaining-games extrapolation', () => {
    const asOfWeek = 4;
    const remainingGames = 13; // e.g. 17-game season, week 4 done, no bye yet: 17 - 4 = 13

    // Full-season rush line from season props (Tier A) — unaffected by this fix.
    const seasonLines = { ...EMPTY_SEASON_STAT_VECTOR, rushYds: 900, rushTds: 7 };
    const seasonStatsPresent = new Set<SeasonStatKey>(['rushYds', 'rushTds']);

    // Tier B per-game receiving rate from the latest weekly props projection.
    const weeklyStats = { receptions: 3.5, recYds: 30, recTds: 0.25 };

    // Actual receiving production already on the books through week 4.
    const playedStatTotals = { receptions: 16, recYds: 140, recTds: 1 };

    const fixed = mergeSeasonStatVector({
      seasonLines,
      seasonStatsPresent,
      weeklyStats,
      playedStatTotals,
      remainingGames,
      position: 'RB',
    });

    expect(fixed.confidence).toBe('blended');
    expect(fixed.sourcesByStat.receptions).toBe('weekly');
    expect(fixed.stats.receptions).toBeCloseTo(16 + 3.5 * 13, 5); // 61.5
    expect(fixed.stats.recYds).toBeCloseTo(140 + 30 * 13, 5); // 530
    expect(fixed.stats.recTds).toBeCloseTo(1 + 0.25 * 13, 5); // 4.25
    // Season line stats are untouched by playedStatTotals.
    expect(fixed.stats.rushYds).toBe(900);
    expect(fixed.stats.rushTds).toBe(7);

    // The pre-fix formula (remaining-games extrapolation only, no played total).
    const preFix = mergeSeasonStatVector({
      seasonLines,
      seasonStatsPresent,
      weeklyStats,
      remainingGames,
      position: 'RB',
    });
    expect(preFix.stats.receptions).toBeCloseTo(3.5 * 13, 5); // 45.5 — missing the played 16
    expect(preFix.stats.recYds).toBeCloseTo(30 * 13, 5);
    expect(preFix.stats.recTds).toBeCloseTo(0.25 * 13, 5);

    // Season points (full-PPR: 1/reception, 0.1/yard, 6/TD) computed from each
    // vector's receiving stats must differ by exactly the played receiving
    // contribution (16 rec, 140 yds, 1 TD -> 16 + 14 + 6 = 36 points).
    const pprPoints = (receptions: number, recYds: number, recTds: number) =>
      receptions * 1 + recYds * 0.1 + recTds * 6;
    const fixedPoints = pprPoints(fixed.stats.receptions, fixed.stats.recYds, fixed.stats.recTds);
    const preFixPoints = pprPoints(preFix.stats.receptions, preFix.stats.recYds, preFix.stats.recTds);
    const playedReceivingContribution = pprPoints(16, 140, 1); // 36
    expect(fixedPoints).toBeGreaterThan(preFixPoints);
    expect(fixedPoints - preFixPoints).toBeCloseTo(playedReceivingContribution, 5);
  });

  it('pre-season (asOfWeek 0 / no games played yet) is unaffected: explicit zero playedStatTotals matches omitting it entirely', () => {
    const seasonLines = { ...EMPTY_SEASON_STAT_VECTOR, rushYds: 900, rushTds: 7 };
    const seasonStatsPresent = new Set<SeasonStatKey>(['rushYds', 'rushTds']);
    const weeklyStats = { receptions: 3.5, recYds: 30, recTds: 0.25 };
    const remainingGames = 17;

    const withoutPlayedTotals = mergeSeasonStatVector({
      seasonLines,
      seasonStatsPresent,
      weeklyStats,
      remainingGames,
      position: 'RB',
    });
    const withZeroPlayedTotals = mergeSeasonStatVector({
      seasonLines,
      seasonStatsPresent,
      weeklyStats,
      playedStatTotals: { ...EMPTY_SEASON_STAT_VECTOR },
      remainingGames,
      position: 'RB',
    });

    expect(withZeroPlayedTotals.stats).toEqual(withoutPlayedTotals.stats);
    expect(withZeroPlayedTotals.confidence).toBe(withoutPlayedTotals.confidence);
    expect(withZeroPlayedTotals.sourcesByStat).toEqual(withoutPlayedTotals.sourcesByStat);
    expect(withoutPlayedTotals.stats.receptions).toBeCloseTo(3.5 * 17, 5);
  });
});
