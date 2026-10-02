import { describe, expect, it } from 'vitest';
import { computeLeagueHistory, type ScoredMatchup } from './leagueAnalyzer';

type M = ScoredMatchup & { id: string };
let n = 0;
const game = (week: number, home: string, away: string, hs: number | null, as: number | null, opts: Partial<M> = {}): M => ({
  id: `m${n++}`, week, homeTeamId: home, awayTeamId: away, homeScore: hs, awayScore: as, isComplete: hs != null, isPlayoff: false, ...opts,
});

/** Four teams, 3-week regular season + a playoff week. "a" wins everything, "d" loses everything. */
function season(weeksPlayed: number): M[] {
  const pairings: Array<[string, string, string, string]> = [['a', 'd', 'b', 'c'], ['a', 'c', 'b', 'd'], ['a', 'b', 'c', 'd']];
  const out: M[] = [];
  pairings.forEach(([h1, a1, h2, a2], i) => {
    const week = i + 1;
    const played = week <= weeksPlayed;
    // Higher team letter wins less: a beats everyone, b beats c and d, c beats d.
    const score = (t: string) => ({ a: 130, b: 115, c: 100, d: 85 } as Record<string, number>)[t];
    out.push(game(week, h1, a1, played ? score(h1) : null, played ? score(a1) : null));
    out.push(game(week, h2, a2, played ? score(h2) : null, played ? score(a2) : null));
  });
  out.push(game(4, 'a', 'b', null, null, { isPlayoff: true }));
  return out;
}

describe('computeLeagueHistory', () => {
  it('has one entry per completed regular-season week, with cumulative records', () => {
    const h = computeLeagueHistory(['a', 'b', 'c', 'd'], season(2), 2, 500);
    expect(h.map((w) => w.week)).toEqual([1, 2]);
    const wk2 = new Map(h[1].teams.map((t) => [t.teamId, t]));
    expect(wk2.get('a')).toMatchObject({ wins: 2, losses: 0, pointsFor: 260, standingsRank: 1, scoringRank: 1 });
    expect(wk2.get('d')).toMatchObject({ wins: 0, losses: 2, standingsRank: 4, scoringRank: 4 });
  });

  it('gives final odds once the regular season is over and ignores the playoff bracket', () => {
    const h = computeLeagueHistory(['a', 'b', 'c', 'd'], season(3), 2, 500);
    expect(h.map((w) => w.week)).toEqual([1, 2, 3]);
    const final = new Map(h[2].teams.map((t) => [t.teamId, t.playoffOdds]));
    expect(final.get('a')).toBe(100);
    expect(final.get('b')).toBe(100);
    expect(final.get('c')).toBe(0);
    expect(final.get('d')).toBe(0);
  });

  it('shows real uncertainty mid-season', () => {
    const h = computeLeagueHistory(['a', 'b', 'c', 'd'], season(1), 2, 2000);
    const odds = h[0].teams.map((t) => t.playoffOdds);
    expect(odds.some((o) => o > 0 && o < 100)).toBe(true);
    // Two playoff spots: the odds sum to about 200.
    const total = odds.reduce((s, o) => s + o, 0);
    expect(total).toBeGreaterThan(195);
    expect(total).toBeLessThan(205);
  });

  it('skips a week that is only partly played', () => {
    // Week 2 in progress: one game final, the other still live.
    const games = season(2).map((g) =>
      g.week === 2 && g.homeTeamId === 'b' ? { ...g, isComplete: false } : g,
    );
    const h = computeLeagueHistory(['a', 'b', 'c', 'd'], games, 2, 200);
    expect(h.map((w) => w.week)).toEqual([1]);
  });

  it('returns nothing before any week is complete', () => {
    expect(computeLeagueHistory(['a', 'b', 'c', 'd'], season(0), 2, 100)).toEqual([]);
  });
});
