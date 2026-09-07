import { describe, it, expect } from 'vitest';
import { assemblePlayerCard } from './playerCard';

const basePlayer = {
  id: 'p1',
  name: 'Puka Nacua',
  position: 'WR',
  team: 'LAR',
  status: 'active',
  injuryNote: null,
  depthChartOrder: 1,
  byeWeek: 6,
  age: 23,
  yearsExp: 2,
};

describe('assemblePlayerCard', () => {
  it('returns season: null and last3: [] when the player has no stat rows yet', () => {
    const card = assemblePlayerCard({ player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [] });
    expect(card.season).toBeNull();
    expect(card.last3).toEqual([]);
    expect(card.id).toBe('p1');
    expect(card.name).toBe('Puka Nacua');
  });

  it('aggregates season totals and rounds ppg/points to 1 decimal in the requested scoring format', () => {
    const weeklyStats = [
      { week: 1, opponent: 'SF', fantasyPointsPPR: 20, fantasyPointsHalf: 17, fantasyPointsStd: 14, receptions: 8, receivingYards: 100, receivingTDs: 1, targets: 10 },
      { week: 2, opponent: 'ARI', fantasyPointsPPR: 15, fantasyPointsHalf: 13, fantasyPointsStd: 11, receptions: 6, receivingYards: 80, receivingTDs: 0, targets: 9 },
    ];
    const cardPpr = assemblePlayerCard({ player: basePlayer, week: 3, scoringFormat: 'ppr', weeklyStats });
    expect(cardPpr.season).toEqual({
      games: 2,
      points: 35,
      ppg: 17.5,
      totals: {
        passYards: 0, passTDs: 0, rushYards: 0, rushTDs: 0,
        receptions: 14, receivingYards: 180, receivingTDs: 1, targets: 19,
      },
    });

    const cardHalf = assemblePlayerCard({ player: basePlayer, week: 3, scoringFormat: 'half-ppr', weeklyStats });
    expect(cardHalf.season?.points).toBe(30);
    expect(cardHalf.season?.ppg).toBe(15);
  });

  it('caps last3 to the 3 most recent weeks strictly before the requested week', () => {
    const weeklyStats = [1, 2, 3, 4].map((week) => ({
      week, opponent: `OPP${week}`, fantasyPointsPPR: week * 10,
    }));
    const card = assemblePlayerCard({ player: basePlayer, week: 5, scoringFormat: 'ppr', weeklyStats });
    expect(card.last3).toEqual([
      { week: 2, opp: 'OPP2', pts: 20 },
      { week: 3, opp: 'OPP3', pts: 30 },
      { week: 4, opp: 'OPP4', pts: 40 },
    ]);
  });

  it('excludes weeks at or after the requested week from last3 (no lookahead)', () => {
    const weeklyStats = [
      { week: 4, opponent: 'A', fantasyPointsPPR: 10 },
      { week: 5, opponent: 'B', fantasyPointsPPR: 99 }, // the current week itself — must not leak into "recent form"
    ];
    const card = assemblePlayerCard({ player: basePlayer, week: 5, scoringFormat: 'ppr', weeklyStats });
    expect(card.last3).toEqual([{ week: 4, opp: 'A', pts: 10 }]);
  });

  it('computes thisWeek matchup + implied team total from game odds (favorite gets the higher implied total)', () => {
    const game = { id: 'g1', homeTeam: 'LAR', awayTeam: 'SF', gameTime: new Date('2026-09-14T20:00:00Z'), spread: null, overUnder: null };
    const oddsRows = [
      { gameId: 'g1', homePoint: -3.5, awayPoint: 3.5, overPoint: 47, snapshotTime: '2026-09-13T00:00:00Z' },
    ];
    const projRow = { projectedPoints: 18.42 };
    const card = assemblePlayerCard({
      player: basePlayer, week: 2, scoringFormat: 'ppr', weeklyStats: [], projRow, game, oddsRows,
    });
    expect(card.thisWeek).toEqual({
      proj: 18.4,
      opponent: 'SF',
      home: true,
      spread: -3.5,
      total: 47,
      impliedTotal: 25.3, // 47/2 - (-3.5)/2 = 23.5 + 1.75 = 25.25, rounded to 1 decimal
      kickoff: '2026-09-14T20:00:00.000Z',
    });
  });

  it('falls back to the game row spread/total when no gameOdds rows exist', () => {
    const game = { id: 'g2', homeTeam: 'SF', awayTeam: 'LAR', gameTime: new Date('2026-09-14T20:00:00Z'), spread: -3.5, overUnder: 47 };
    const card = assemblePlayerCard({
      player: { ...basePlayer, team: 'SF' }, week: 2, scoringFormat: 'ppr', weeklyStats: [], game, oddsRows: [],
    });
    expect(card.thisWeek?.spread).toBe(-3.5);
    expect(card.thisWeek?.total).toBe(47);
  });

  it('picks the most recent gameOdds snapshot when multiple exist', () => {
    const game = { id: 'g3', homeTeam: 'LAR', awayTeam: 'SF', gameTime: new Date(), spread: null, overUnder: null };
    const oddsRows = [
      { gameId: 'g3', homePoint: -1, awayPoint: 1, overPoint: 44, snapshotTime: '2026-09-01T00:00:00Z' },
      { gameId: 'g3', homePoint: -3.5, awayPoint: 3.5, overPoint: 47, snapshotTime: '2026-09-13T00:00:00Z' },
    ];
    const card = assemblePlayerCard({ player: basePlayer, week: 2, scoringFormat: 'ppr', weeklyStats: [], game, oddsRows });
    expect(card.thisWeek?.spread).toBe(-3.5);
    expect(card.thisWeek?.total).toBe(47);
  });

  it('returns thisWeek: null when there is no projection and no game', () => {
    const card = assemblePlayerCard({ player: basePlayer, week: 2, scoringFormat: 'ppr', weeklyStats: [] });
    expect(card.thisWeek).toBeNull();
  });

  it('maps market and draft rows when present, and null when absent', () => {
    const withRows = assemblePlayerCard({
      player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [],
      marketRow: { seasonPoints: 280.5, rosPoints: 210.2, marketRank: 12, confidence: 'season_props' },
      draftRow: { overallRank: 15, tier: 2, adp: 18.3 },
    });
    expect(withRows.market).toEqual({ seasonPoints: 280.5, rosPoints: 210.2, marketRank: 12, confidence: 'season_props' });
    expect(withRows.draft).toEqual({ overallRank: 15, tier: 2, adp: 18.3 });

    const withoutRows = assemblePlayerCard({ player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [] });
    expect(withoutRows.market).toBeNull();
    expect(withoutRows.draft).toBeNull();
  });

  it('treats a market row with no seasonPoints as no market projection (matches players.ts hasMarketProjection)', () => {
    // A market_projections row can exist (e.g. rosPoints/marketRank populated
    // from a partial sync) without a usable seasonPoints figure — players.ts
    // only calls it a "market" projection when seasonPoints != null, so the
    // card must not surface a market object the client would otherwise show.
    const card = assemblePlayerCard({
      player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [],
      marketRow: { seasonPoints: null, rosPoints: 210.2, marketRank: 12, confidence: 'season_props' },
    });
    expect(card.market).toBeNull();
  });

  it('caps news to 3 items and computes ageHours from the injectable `now`', () => {
    const now = new Date('2026-09-15T00:00:00Z').getTime();
    const newsRows = [
      { headline: 'A', impactLevel: 'high', publishedAt: new Date('2026-09-14T12:00:00Z') },
      { headline: 'B', impactLevel: 'medium', publishedAt: new Date('2026-09-13T00:00:00Z') },
      { headline: 'C', impactLevel: 'low', publishedAt: new Date('2026-09-12T00:00:00Z') },
      { headline: 'D', impactLevel: 'low', publishedAt: new Date('2026-09-11T00:00:00Z') },
    ];
    const card = assemblePlayerCard({ player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [], newsRows, now });
    expect(card.news).toHaveLength(3);
    expect(card.news[0]).toEqual({ headline: 'A', impact: 'high', ageHours: 12 });
    expect(card.news.map((n) => n.headline)).toEqual(['A', 'B', 'C']);
  });

  it('truncates a cached AI take to 300 characters', () => {
    const longText = 'x'.repeat(500);
    const card = assemblePlayerCard({
      player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [],
      aiRow: { analysis: longText },
    });
    expect(card.aiTake).toHaveLength(300);
  });

  it('returns aiTake: null when there is no cached analysis', () => {
    const card = assemblePlayerCard({ player: basePlayer, week: 1, scoringFormat: 'ppr', weeklyStats: [] });
    expect(card.aiTake).toBeNull();
  });
});
