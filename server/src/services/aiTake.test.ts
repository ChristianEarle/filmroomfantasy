import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  fingerprintInputs,
  shouldRegenerate,
  describeBasis,
  buildDataBlock,
  REGENERATE_FLOOR_MS,
  type AiTakeInputs,
} from './aiTake';

function inputs(over: Partial<AiTakeInputs> = {}): AiTakeInputs {
  return {
    season: 2026,
    week: 3,
    player: { name: 'Justin Jefferson', position: 'WR', team: 'MIN', status: 'questionable', injuryNote: 'Hamstring', age: 27, yearsExp: 6, depthChartOrder: 1, byeWeek: 6 },
    seasonLine: '2 games, 41.2 PPR pts (20.6/gm)',
    lastWeeks: [{ week: 1, opp: 'CHI', pts: 22.4 }, { week: 2, opp: '@ATL', pts: 18.8 }],
    latestStatsWeek: 2,
    projection: { points: 19.4, low: 12.1, high: 27.3, source: 'props', scoringFormat: 'ppr' },
    props: [{ market: 'reception_yds', line: 84.5, price: -114 }, { market: 'receptions', line: 6.5, price: -120 }, { market: 'anytime_td', line: null, price: 145 }],
    usage: [{ week: 2, opponent: 'ATL', targets: 11, targetShare: 0.3235, airYardsShare: 0.45, wopr: 0.8, carries: 0, recEpa: 5.68, rushEpa: null, passEpa: null, snapPct: 91.2 }],
    practice: { reportStatus: 'Questionable', practiceStatus: 'Limited Participation in Practice', primaryInjury: 'Hamstring' },
    matchup: { opponent: 'CIN', home: true, spread: -3.5, total: 48.5, impliedTotal: 26, kickoff: 'Sun 1:00 PM ET', homeMoneyline: -180, awayMoneyline: 150 },
    environment: { roof: 'dome', surface: 'fieldturf', temp: null, wind: null },
    dvp: { grade: 'B+', label: 'Good', avgAllowed: 38.2, leagueAvg: 34.1, ratio: 1.12, gamesAnalyzed: 5 },
    news: ['Jefferson limited Wednesday with hamstring tightness'],
    ...over,
  };
}

describe('fingerprintInputs', () => {
  it('is stable across key order and changes when a value changes', async () => {
    const a = inputs();
    const b = inputs();
    // Same content, different insertion order on a nested object.
    b.projection = { scoringFormat: 'ppr', source: 'props', high: 27.3, low: 12.1, points: 19.4 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(await fingerprintInputs(a)).toBe(await fingerprintInputs(b));

    const moved = inputs({ projection: { points: 21.0, low: 12.1, high: 27.3, source: 'props', scoringFormat: 'ppr' } });
    expect(await fingerprintInputs(moved)).not.toBe(await fingerprintInputs(a));

    const cleared = inputs({ practice: { reportStatus: null, practiceStatus: 'Full Participation in Practice', primaryInjury: 'Hamstring' } });
    expect(await fingerprintInputs(cleared)).not.toBe(await fingerprintInputs(a));
  });

  it('produces a 64-char hex digest', async () => {
    expect(await fingerprintInputs(inputs())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('shouldRegenerate', () => {
  const now = new Date('2026-09-18T15:00:00Z');
  const fresh = new Date(now.getTime() - 5 * 60 * 1000);
  const old = new Date(now.getTime() - REGENERATE_FLOOR_MS);

  it('generates when nothing is cached', () => {
    expect(shouldRegenerate({ cached: null, hash: 'h1', now, refresh: false })).toEqual({ regenerate: true, reason: 'no_cached_take' });
  });

  it('serves the cache when the inputs have not changed, even on request', () => {
    const cached = { inputsHash: 'h1', updatedAt: old, createdAt: old };
    expect(shouldRegenerate({ cached, hash: 'h1', now, refresh: true }).regenerate).toBe(false);
  });

  it('regenerates a changed take once it is past the floor, or immediately on request', () => {
    expect(shouldRegenerate({ cached: { inputsHash: 'h1', updatedAt: old, createdAt: old }, hash: 'h2', now, refresh: false }))
      .toEqual({ regenerate: true, reason: 'inputs_changed' });
    expect(shouldRegenerate({ cached: { inputsHash: 'h1', updatedAt: fresh, createdAt: fresh }, hash: 'h2', now, refresh: false }))
      .toEqual({ regenerate: false, reason: 'inputs_changed_recently' });
    expect(shouldRegenerate({ cached: { inputsHash: 'h1', updatedAt: fresh, createdAt: fresh }, hash: 'h2', now, refresh: true }))
      .toEqual({ regenerate: true, reason: 'requested' });
  });

  it('treats rows from before fingerprints existed as changed and uses createdAt for their age', () => {
    expect(shouldRegenerate({ cached: { inputsHash: null, updatedAt: null, createdAt: old }, hash: 'h2', now, refresh: false }).regenerate).toBe(true);
    expect(shouldRegenerate({ cached: { inputsHash: null, updatedAt: null, createdAt: fresh }, hash: 'h2', now, refresh: false }).regenerate).toBe(false);
  });
});

describe('describeBasis', () => {
  it('names the projection, prop lines, stats cutoff, practice report and matchup grade', () => {
    expect(describeBasis(inputs())).toBe(
      'Week 3 projection 19.4 (from prop lines) · 3 prop lines · stats through Week 2 · practice report: Questionable, limited practice · CIN matchup B+',
    );
  });

  it('says what is missing instead of omitting it', () => {
    expect(describeBasis(inputs({ projection: null, props: [], latestStatsWeek: null, practice: null, dvp: null })))
      .toBe('no Week 3 projection yet · no games played yet');
  });
});

describe('buildDataBlock', () => {
  it('includes every input section with the numbers the model should cite', () => {
    const block = buildDataBlock(inputs());
    expect(block).toContain('Name: Justin Jefferson');
    expect(block).toContain('Depth chart: WR1');
    expect(block).toContain('Practice report this week: game status Questionable, limited practice, (Hamstring)');
    expect(block).toContain('Wk2 ATL: 11 tgt (32% share), air-yards share 45%, WOPR 0.80, rec EPA 5.7, 91% snaps');
    expect(block).toContain('19.4 PPR pts (derived from sportsbook prop lines, range 12.1-27.3)');
    expect(block).toContain('rec yds O/U 84.5 (-114), receptions O/U 6.5 (-120), anytime TD (+145)');
    expect(block).toContain('Matchup: Week 3 vs CIN (Sun 1:00 PM ET)');
    expect(block).toContain('Defense vs WR: B+ (Good) — CIN allows 38.2 PPR pts/game to WRs over its last 5 games vs league avg 34.1');
    expect(block).toContain('MIN spread -3.5, game total 48.5, implied MIN team total 26, moneyline -180');
    expect(block).toContain('Game environment: dome roof, fieldturf');
    expect(block).toContain('- Jefferson limited Wednesday with hamstring tightness');
  });

  it('acknowledges gaps rather than dropping the section', () => {
    const block = buildDataBlock(inputs({ projection: null, props: [], usage: [], practice: null, matchup: null, environment: null, dvp: null, news: [] }));
    expect(block).toContain("This week's projection: (none available)");
    expect(block).toContain('Prop lines: (no prop lines posted yet)');
    expect(block).toContain('(no usage data yet)');
    expect(block).toContain("Practice report this week: (not on this week's report)");
    expect(block).toContain('Vegas: No Vegas line available.');
    expect(block).toContain('Game environment: (unknown)');
    expect(block).toContain('(no recent news)');
  });
});
