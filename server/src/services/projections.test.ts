import { describe, it, expect } from 'vitest';
import { calculateFantasyPoints, type ProjectedStats } from './projections';

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
