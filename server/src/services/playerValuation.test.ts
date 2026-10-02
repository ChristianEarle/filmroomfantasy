import { describe, it, expect } from 'vitest';
import {
  valuePlayer,
  sumValue,
  valueImbalancePct,
  estimatePickValue,
  sumPickValues,
} from './playerValuation';
import type { PlayerFacts, LeagueSettings } from './tradeContext';

function makeSettings(overrides: Partial<LeagueSettings> = {}): LeagueSettings {
  return {
    scoringFormat: 'ppr',
    superflex: false,
    tePremium: false,
    teamCount: 12,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<PlayerFacts> = {}): PlayerFacts {
  return {
    id: 'p1',
    name: 'Test Player',
    position: 'WR',
    nflTeam: 'KC',
    identity: {
      age: 25,
      yearsExp: 3,
      status: 'active',
      injuryNote: null,
      injuryBodyPart: null,
      depthChartOrder: 1,
      byeWeek: 10,
      tenure: { draftClass: 2022, rookieStatus: 'veteran', tenureLabel: '3rd year' } as PlayerFacts['identity']['tenure'],
    },
    recentVolume: null,
    projection: {
      dataSource: 'currentWeek',
      nextWeek: { week: 5, projectedPoints: 15, weekRank: 8, positionRank: 8 },
      seasonTotal: null,
    },
    marketSignal: null,
    schedule: { nextFour: [], playoffWeeks: [] },
    recentNews: null,
    ...overrides,
  };
}

describe('valuePlayer', () => {
  it('assigns elite tier and scarcity for a top-5 positionRank RB', () => {
    const p = makePlayer({
      position: 'RB',
      projection: {
        dataSource: 'currentWeek',
        nextWeek: { week: 5, projectedPoints: 20, weekRank: 2, positionRank: 3 },
        seasonTotal: null,
      },
    });
    const v = valuePlayer(p, makeSettings(), 5);
    expect(v.tier).toBe('elite');
    expect(v.scarcityFactor).toBeCloseTo(1.08, 5);
    expect(v.finalValue).toBeGreaterThan(0);
  });

  it('falls back to per-game points to assign tier when positionRank is missing', () => {
    const p = makePlayer({
      projection: {
        dataSource: 'currentWeek',
        nextWeek: null,
        seasonTotal: null,
      },
      recentVolume: {
        dataSource: 'currentSeason',
        games: [],
        seasonGamesPlayed: 4,
        seasonFantasyPointsTotal: 40,
        seasonFantasyPointsAvg: 10, // -> 'mid' tier (9-13 band)
      },
    });
    const v = valuePlayer(p, makeSettings(), 5);
    expect(v.tier).toBe('mid');
    expect(v.perGamePoints).toBe(10);
  });

  it('applies the superflex QB scarcity bump vs a 1-QB league', () => {
    const p = makePlayer({ position: 'QB' });
    const oneQb = valuePlayer(p, makeSettings({ superflex: false }), 5);
    const superflex = valuePlayer(p, makeSettings({ superflex: true }), 5);
    expect(oneQb.scarcityFactor).toBeCloseTo(0.82, 5);
    expect(superflex.scarcityFactor).toBeCloseTo(1.18, 5);
    expect(superflex.finalValue).toBeGreaterThan(oneQb.finalValue);
  });

  it('discounts finalValue for an "out" injury status vs active', () => {
    const active = makePlayer({ identity: { ...makePlayer().identity, status: 'active' } });
    const out = makePlayer({ identity: { ...makePlayer().identity, status: 'out' } });
    const vActive = valuePlayer(active, makeSettings(), 5);
    const vOut = valuePlayer(out, makeSettings(), 5);
    expect(vOut.injuryFactor).toBeCloseTo(0.25, 5);
    expect(vOut.finalValue).toBeLessThan(vActive.finalValue);
  });

  it('returns zero finalValue when there is no projection or recent volume at all', () => {
    const p = makePlayer({ projection: null, recentVolume: null });
    const v = valuePlayer(p, makeSettings(), 5);
    expect(v.perGamePoints).toBe(0);
    expect(v.finalValue).toBe(0);
    expect(v.tier).toBe('stash');
  });
});

describe('sumValue / valueImbalancePct', () => {
  it('sums finalValue for known ids (ignoring unknown ids) and computes a balanced/empty imbalance pct', () => {
    const p1 = makePlayer({ id: 'a' });
    const p2 = makePlayer({ id: 'b' });
    const valuations = new Map([
      ['a', valuePlayer(p1, makeSettings(), 5)],
      ['b', valuePlayer(p2, makeSettings(), 5)],
    ]);
    const total = sumValue(['a', 'b', 'missing'], valuations);
    expect(total).toBeCloseTo(valuations.get('a')!.finalValue + valuations.get('b')!.finalValue, 5);

    // Identical players on both sides -> perfectly balanced
    expect(valueImbalancePct(['a'], ['b'], valuations)).toBeCloseTo(0, 5);
    // Nothing sent or received -> 0, not NaN/Infinity
    expect(valueImbalancePct([], [], valuations)).toBe(0);
  });
});

describe('estimatePickValue / sumPickValues', () => {
  it('values redraft picks at half of dynasty, and discounts future-year picks 20%/year', () => {
    const dynasty = estimatePickValue({ year: 2026, round: 1 }, 'dynasty', 2026);
    const redraft = estimatePickValue({ year: 2026, round: 1 }, 'redraft', 2026);
    expect(redraft).toBe(Math.round(dynasty * 0.5));

    const nextYear = estimatePickValue({ year: 2027, round: 1 }, 'dynasty', 2026);
    expect(nextYear).toBe(Math.round(dynasty * 0.8));
  });

  it('sums a list of picks and returns 0 for an empty/undefined list', () => {
    const picks = [{ year: 2026, round: 1 }, { year: 2026, round: 2 }];
    const total = sumPickValues(picks, 'dynasty', 2026);
    expect(total).toBe(
      estimatePickValue(picks[0], 'dynasty', 2026) + estimatePickValue(picks[1], 'dynasty', 2026)
    );
    expect(sumPickValues(undefined, 'dynasty', 2026)).toBe(0);
    expect(sumPickValues([], 'dynasty', 2026)).toBe(0);
  });
});
