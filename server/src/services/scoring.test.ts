import { describe, it, expect } from 'vitest';
import {
  calculatePPRPoints,
  calculateHalfPPRPoints,
  calculateStandardPoints,
  calculateAllFormats,
  getPositionRankColor,
  calculateRosterProjectedPoints,
} from './scoring';

describe('calculatePPRPoints', () => {
  it('scores a typical WR statline', () => {
    // 100 rec yds (10) + 1 rec TD (6) + 6 receptions (6) = 22
    const points = calculatePPRPoints({
      receivingYards: 100,
      receivingTDs: 1,
      receptions: 6,
    });
    expect(points).toBe(22);
  });

  it('scores a typical QB statline including an interception', () => {
    // 300 pass yds (12) + 2 pass TDs (8) + 1 INT (-1) = 19
    const points = calculatePPRPoints({
      passYards: 300,
      passTDs: 2,
      passInterceptions: 1,
    });
    expect(points).toBe(19);
  });

  it('applies the D/ST points-allowed tiers', () => {
    expect(calculatePPRPoints({ pointsAllowed: 0 })).toBe(10);
    expect(calculatePPRPoints({ pointsAllowed: 6 })).toBe(7);
    expect(calculatePPRPoints({ pointsAllowed: 13 })).toBe(4);
    expect(calculatePPRPoints({ pointsAllowed: 20 })).toBe(1);
    expect(calculatePPRPoints({ pointsAllowed: 27 })).toBe(0);
    expect(calculatePPRPoints({ pointsAllowed: 34 })).toBe(-1);
    expect(calculatePPRPoints({ pointsAllowed: 35 })).toBe(-4);
  });

  it('ignores points-allowed scoring when the field is absent', () => {
    expect(calculatePPRPoints({ passYards: 100 })).toBe(4);
  });

  it('treats missing stat fields as zero and returns 0 for an empty statline', () => {
    expect(calculatePPRPoints({})).toBe(0);
  });

  it('penalizes fumbles lost', () => {
    expect(calculatePPRPoints({ fumbles: 2 })).toBe(-4);
  });
});

describe('calculateHalfPPRPoints / calculateStandardPoints', () => {
  it('subtracts 0.5 per reception from the PPR total for half-PPR', () => {
    const stats = { receptions: 6, receivingYards: 60 };
    expect(calculateHalfPPRPoints(stats)).toBe(calculatePPRPoints(stats) - 3);
  });

  it('subtracts 1 per reception from the PPR total for standard', () => {
    const stats = { receptions: 6, receivingYards: 60 };
    expect(calculateStandardPoints(stats)).toBe(calculatePPRPoints(stats) - 6);
  });

  it('is a no-op adjustment when there are no receptions', () => {
    const stats = { rushYards: 80, rushTDs: 1 };
    const ppr = calculatePPRPoints(stats);
    expect(calculateHalfPPRPoints(stats)).toBe(ppr);
    expect(calculateStandardPoints(stats)).toBe(ppr);
  });
});

describe('calculateAllFormats', () => {
  it('returns all three formats consistently derived from the same statline', () => {
    const stats = { receptions: 4, receivingYards: 40, receivingTDs: 1 };
    const result = calculateAllFormats(stats);
    expect(result).toEqual({
      ppr: calculatePPRPoints(stats),
      halfPpr: calculateHalfPPRPoints(stats),
      standard: calculateStandardPoints(stats),
    });
    expect(result.ppr).toBeGreaterThan(result.halfPpr);
    expect(result.halfPpr).toBeGreaterThan(result.standard);
  });
});

describe('getPositionRankColor', () => {
  it('buckets ranks into elite/good/average/bad tiers', () => {
    expect(getPositionRankColor(1)).toBe('elite');
    expect(getPositionRankColor(5)).toBe('elite');
    expect(getPositionRankColor(6)).toBe('good');
    expect(getPositionRankColor(12)).toBe('good');
    expect(getPositionRankColor(13)).toBe('average');
    expect(getPositionRankColor(24)).toBe('average');
    expect(getPositionRankColor(25)).toBe('bad');
  });
});

describe('calculateRosterProjectedPoints', () => {
  it('sums only starters', () => {
    const total = calculateRosterProjectedPoints([
      { playerId: 'a', projectedPoints: 20, isStarter: true },
      { playerId: 'b', projectedPoints: 15, isStarter: true },
      { playerId: 'c', projectedPoints: 30, isStarter: false },
    ]);
    expect(total).toBe(35);
  });

  it('returns 0 for an empty roster', () => {
    expect(calculateRosterProjectedPoints([])).toBe(0);
  });
});
