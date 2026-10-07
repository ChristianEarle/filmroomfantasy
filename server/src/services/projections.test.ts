import { describe, it, expect } from 'vitest';
import { buildProjectionsFromProps, calculateFantasyPoints, type ProjectedStats } from './projections';
import type { PlayerProps } from '../db/schema';

const baseStats: ProjectedStats = {
  projPassYards: 4500,
  projPassTDs: 30,
  projRushYards: 350,
  projRushTDs: 3,
  projReceptions: 0,
  projRecYards: 0,
  projRecTDs: 0,
};

describe('calculateFantasyPoints', () => {
  it('does not deduct anything for interceptions when the field is omitted (weekly prop markets never include INTs)', () => {
    const points = calculateFantasyPoints(baseStats, 'ppr');
    // 4500 * 0.04 + 30 * 4 + 350 * 0.1 + 3 * 6 = 180 + 120 + 35 + 18 = 353
    expect(points).toBeCloseTo(353);
  });

  it('deducts 1 point per interception in ppr, half-ppr, and standard formats', () => {
    const withInts: ProjectedStats = { ...baseStats, interceptions: 10 };
    const withoutInts: ProjectedStats = { ...baseStats, interceptions: 0 };

    for (const format of ['ppr', 'half-ppr', 'standard'] as const) {
      const pointsWithInts = calculateFantasyPoints(withInts, format);
      const pointsWithoutInts = calculateFantasyPoints(withoutInts, format);
      expect(pointsWithoutInts - pointsWithInts).toBeCloseTo(10);
    }
  });

  it('treats a null interceptions value the same as omitted (no deduction)', () => {
    const stats: ProjectedStats = { ...baseStats, interceptions: null };
    expect(calculateFantasyPoints(stats, 'ppr')).toBeCloseTo(353);
  });
});

describe('buildProjectionsFromProps', () => {
  const prop = (playerName: string, market: string, fields: Partial<PlayerProps>): PlayerProps =>
    ({
      playerName,
      playerExternalId: null,
      market,
      overPoint: null,
      overPrice: null,
      underPrice: null,
      yesPrice: null,
      noPrice: null,
      snapshotTime: '2026-10-07T12:00:00Z',
      ...fields,
    }) as PlayerProps;

  it('skips players whose only lines are anytime TD or receptions, leaving them to the fallback source', () => {
    const results = buildProjectionsFromProps([
      prop('Depth Receiver', 'player_anytime_td', { yesPrice: 600, noPrice: -1000 }),
      prop('Slot Guy', 'player_receptions', { overPoint: 1.5 }),
    ]);
    expect(results).toEqual([]);
  });

  it('keeps players with a yardage line', () => {
    const results = buildProjectionsFromProps([
      prop('Starter WR', 'player_reception_yds', { overPoint: 64.5 }),
      prop('Starter WR', 'player_receptions', { overPoint: 5.5 }),
      prop('Starter WR', 'player_anytime_td', { yesPrice: 150, noPrice: -190 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].points.ppr).toBeGreaterThan(10);
  });
});
