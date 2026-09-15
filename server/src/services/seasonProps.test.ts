import { describe, it, expect } from 'vitest';
import {
  parseSeasonPropsInput,
  matchSeasonPropsToPlayers,
  buildSeasonProjectionsFromSeasonProps,
  type MatchablePlayer,
  type SeasonPropRow,
  type ResolvedSeasonPropRow,
} from './seasonProps';

const CSV_HEADER = 'playerName,team,position,market,line,overOdds,underOdds,book,sourceUrl,capturedAt';

describe('parseSeasonPropsInput', () => {
  it('parses CSV rows, including quoted names with embedded commas/periods', () => {
    const csv = [
      CSV_HEADER,
      '"Amon-Ra St. Brown",DET,WR,rec_yds,1150.5,-115,-105,DraftKings,https://example.com/a,2026-08-20',
      'Josh Allen,BUF,QB,pass_yds,4300,-110,-110,FanDuel,,2026-08-21',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      playerName: 'Amon-Ra St. Brown',
      team: 'DET',
      position: 'WR',
      stat: 'rec_yds',
      line: 1150.5,
      overPrice: -115,
      underPrice: -105,
      book: 'DraftKings',
      sourceUrl: 'https://example.com/a',
      capturedAt: '2026-08-20',
    });
    expect(rows[1]).toMatchObject({
      playerName: 'Josh Allen',
      stat: 'pass_yds',
      line: 4300,
      sourceUrl: null,
    });
  });

  it('parses a JSON array using the same field names as the CSV header', () => {
    const json = JSON.stringify([
      { playerName: 'Christian McCaffrey', team: 'SF', position: 'RB', market: 'rush_yds', line: 1200, book: 'FanDuel', capturedAt: '2026-08-22' },
    ]);

    const { rows, errors } = parseSeasonPropsInput(json);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerName: 'Christian McCaffrey', stat: 'rush_yds', line: 1200 });
  });

  it('parses a JSON array of objects passed directly (not as a string)', () => {
    const { rows, errors } = parseSeasonPropsInput([
      { playerName: 'Justin Jefferson', team: 'MIN', position: 'WR', market: 'receptions', line: 95.5, book: 'BetMGM', capturedAt: '2026-08-23' },
    ]);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].stat).toBe('receptions');
  });

  it('defaults capturedAt to today when omitted', () => {
    const { rows, errors } = parseSeasonPropsInput([
      { playerName: 'Travis Kelce', position: 'TE', market: 'rec_yds', line: 800, book: 'Caesars' },
    ]);

    expect(errors).toHaveLength(0);
    expect(rows[0].capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('collects validation errors without throwing, and skips the bad rows', () => {
    const csv = [
      CSV_HEADER,
      'No Market Player,KC,QB,,4000,,,DraftKings,,2026-08-20',
      'Bad Stat Player,KC,QB,not_a_real_stat,4000,,,DraftKings,,2026-08-20',
      'No Line Player,KC,QB,pass_yds,,,,DraftKings,,2026-08-20',
      'No Book Player,KC,QB,pass_yds,4000,,,,,2026-08-20',
      ',KC,QB,pass_yds,4000,,,DraftKings,,2026-08-20',
      'Bad Date Player,KC,QB,pass_yds,4000,,,DraftKings,,08/20/2026',
      'Good Player,KC,QB,pass_yds,4000,-110,-110,DraftKings,,2026-08-20',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0].playerName).toBe('Good Player');
    expect(errors).toHaveLength(6);
    expect(errors.map((e) => e.row)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(errors[1].message).toMatch(/not_a_real_stat/);
  });

  it('returns an error for invalid JSON text instead of throwing', () => {
    const { rows, errors } = parseSeasonPropsInput('[{ this is not json');
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/invalid json/i);
  });

  it('returns empty results for blank input', () => {
    expect(parseSeasonPropsInput('')).toEqual({ rows: [], errors: [] });
    expect(parseSeasonPropsInput('   ')).toEqual({ rows: [], errors: [] });
  });

  it('matches CSV headers case-insensitively', () => {
    const csv = [
      'PLAYERNAME,TEAM,POSITION,MARKET,LINE,OVERODDS,UNDERODDS,BOOK,SOURCEURL,CAPTUREDAT',
      'Josh Allen,BUF,QB,pass_yds,4300,-110,-110,FanDuel,,2026-08-21',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerName: 'Josh Allen', stat: 'pass_yds', line: 4300 });
  });

  it('accepts aliased header names (player/stat/odds_over/odds_under/sportsbook/url/date/pos)', () => {
    const csv = [
      'player,team,pos,stat,line,odds_over,odds_under,sportsbook,url,date',
      'Josh Allen,BUF,QB,pass_yds,4300,-110,-110,FanDuel,https://example.com,2026-08-21',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerName: 'Josh Allen',
      position: 'QB',
      stat: 'pass_yds',
      line: 4300,
      overPrice: -110,
      underPrice: -110,
      book: 'FanDuel',
      sourceUrl: 'https://example.com',
      capturedAt: '2026-08-21',
    });
  });

  it('accepts the alternate "name"/"over"/"under"/"source" aliases too', () => {
    const csv = [
      'name,team,position,market,line,over,under,book,source,captured',
      'Josh Allen,BUF,QB,pass_yds,4300,-110,-110,FanDuel,https://example.com,2026-08-21',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerName: 'Josh Allen', overPrice: -110, underPrice: -110, sourceUrl: 'https://example.com' });
  });

  it('returns a single clear error when a required column is missing after aliasing, instead of per-row errors', () => {
    const csv = [
      'playerName,team,position,line,book',
      'Josh Allen,BUF,QB,4300,FanDuel',
      'Patrick Mahomes,KC,QB,4500,DraftKings',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('missing required column(s): market');
  });

  it('reports every missing required column in one error', () => {
    const csv = ['team,position,book', 'BUF,QB,FanDuel'].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('missing required column(s): playerName, market, line');
  });

  it('strips thousands separators and a leading "+" before parsing numeric fields', () => {
    const csv = [
      CSV_HEADER,
      'Josh Allen,BUF,QB,pass_yds,"3,950.5",+120,-110,FanDuel,,2026-08-21',
    ].join('\n');

    const { rows, errors } = parseSeasonPropsInput(csv);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(3950.5);
    expect(rows[0].overPrice).toBe(120);
  });
});

describe('matchSeasonPropsToPlayers', () => {
  const players: MatchablePlayer[] = [
    { id: 'p-mahomes', name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
    { id: 'p-mike-williams-lac', name: 'Mike Williams', position: 'WR', team: 'LAC' },
    { id: 'p-mike-williams-nyj', name: 'Mike Williams', position: 'WR', team: 'NYJ' },
    { id: 'p-brian-robinson', name: 'Brian Robinson', position: 'RB', team: 'WAS' },
  ];

  function row(overrides: Partial<SeasonPropRow>): SeasonPropRow {
    return {
      playerName: 'Patrick Mahomes',
      team: null,
      position: null,
      stat: 'pass_yds',
      line: 4500,
      overPrice: null,
      underPrice: null,
      book: 'DraftKings',
      sourceUrl: null,
      capturedAt: '2026-08-20',
      ...overrides,
    };
  }

  it('matches a unique normalized name directly', () => {
    const { matched, unmatched } = matchSeasonPropsToPlayers([row({})], players);
    expect(unmatched).toHaveLength(0);
    expect(matched).toHaveLength(1);
    expect(matched[0].playerId).toBe('p-mahomes');
  });

  it('normalizes punctuation/suffixes so name variants still match (Odds-style formatting)', () => {
    const { matched } = matchSeasonPropsToPlayers(
      [row({ playerName: 'Brian Robinson Jr.', stat: 'rush_yds' })],
      players
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].playerId).toBe('p-brian-robinson');
  });

  it('disambiguates a same-name collision using team when position alone is not enough', () => {
    const { matched, unmatched } = matchSeasonPropsToPlayers(
      [row({ playerName: 'Mike Williams', position: 'WR', team: 'NYJ', stat: 'rec_yds' })],
      players
    );
    expect(unmatched).toHaveLength(0);
    expect(matched).toHaveLength(1);
    expect(matched[0].playerId).toBe('p-mike-williams-nyj');
  });

  it('leaves a same-name collision unmatched when there is not enough info to disambiguate', () => {
    const { matched, unmatched } = matchSeasonPropsToPlayers(
      [row({ playerName: 'Mike Williams', position: 'WR', team: null, stat: 'rec_yds' })],
      players
    );
    expect(matched).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
  });

  it('leaves rows with no matching player unmatched', () => {
    const { matched, unmatched } = matchSeasonPropsToPlayers(
      [row({ playerName: 'Not A Real Player' })],
      players
    );
    expect(matched).toHaveLength(0);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].playerName).toBe('Not A Real Player');
  });
});

describe('buildSeasonProjectionsFromSeasonProps', () => {
  function resolvedRow(overrides: Partial<ResolvedSeasonPropRow>): ResolvedSeasonPropRow {
    return {
      playerId: 'p1',
      playerName: 'Test Player',
      team: null,
      position: null,
      stat: 'pass_yds',
      line: 0,
      overPrice: null,
      underPrice: null,
      book: 'DraftKings',
      sourceUrl: null,
      capturedAt: '2026-08-20',
      ...overrides,
    };
  }

  it('keeps only the latest capturedAt per (stat, book) before averaging across books', () => {
    const rows: ResolvedSeasonPropRow[] = [
      resolvedRow({ playerId: 'qb1', stat: 'pass_yds', book: 'DraftKings', line: 4000, capturedAt: '2026-08-01' }),
      // Same book, later capture — should replace the 4000 line, not average with it.
      resolvedRow({ playerId: 'qb1', stat: 'pass_yds', book: 'DraftKings', line: 4400, capturedAt: '2026-08-15' }),
      // Different book — averaged with the latest DraftKings line.
      resolvedRow({ playerId: 'qb1', stat: 'pass_yds', book: 'FanDuel', line: 4200, capturedAt: '2026-08-10' }),
    ];

    const result = buildSeasonProjectionsFromSeasonProps(rows);
    const proj = result.get('qb1')!;

    expect(proj.stats.passYds).toBeCloseTo((4400 + 4200) / 2);
    expect(proj.marketsUsed).toBe(1);
    expect(proj.books).toEqual(['DraftKings', 'FanDuel']);
  });

  it('computes ppr/half-ppr/standard season points for a QB from pass + rush lines, deducting 1 pt per projected INT', () => {
    const rowsWithInts: ResolvedSeasonPropRow[] = [
      resolvedRow({ playerId: 'qb1', stat: 'pass_yds', line: 4500, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb1', stat: 'pass_tds', line: 30, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb1', stat: 'rush_yds', line: 350, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb1', stat: 'rush_tds', line: 3, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb1', stat: 'interceptions', line: 10, book: 'DraftKings' }),
    ];

    const rowsWithoutInts: ResolvedSeasonPropRow[] = [
      resolvedRow({ playerId: 'qb2', stat: 'pass_yds', line: 4500, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb2', stat: 'pass_tds', line: 30, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb2', stat: 'rush_yds', line: 350, book: 'DraftKings' }),
      resolvedRow({ playerId: 'qb2', stat: 'rush_tds', line: 3, book: 'DraftKings' }),
    ];

    const results = buildSeasonProjectionsFromSeasonProps([...rowsWithInts, ...rowsWithoutInts]);
    const projWithInts = results.get('qb1')!;
    const projWithoutInts = results.get('qb2')!;

    // 4500 * 0.04 + 30 * 4 + 350 * 0.1 + 3 * 6 - 10 * 1 = 180 + 120 + 35 + 18 - 10 = 343
    const expectedPoints = 4500 * 0.04 + 30 * 4 + 350 * 0.1 + 3 * 6 - 10 * 1;
    expect(projWithInts.ppr).toBeCloseTo(expectedPoints);
    expect(projWithInts.halfPpr).toBeCloseTo(expectedPoints);
    expect(projWithInts.standard).toBeCloseTo(expectedPoints);
    expect(projWithInts.stats.interceptions).toBe(10);
    expect(projWithInts.marketsUsed).toBe(5);

    // 10 INTs vs 0 INTs must differ by exactly 10 points (1 pt deducted per INT) in every format.
    expect(projWithoutInts.stats.interceptions).toBe(0);
    expect(projWithoutInts.ppr - projWithInts.ppr).toBeCloseTo(10);
    expect(projWithoutInts.halfPpr - projWithInts.halfPpr).toBeCloseTo(10);
    expect(projWithoutInts.standard - projWithInts.standard).toBeCloseTo(10);
  });

  it('computes ppr/half-ppr/standard season points for a WR from receiving lines, with scoring format differences', () => {
    const rows: ResolvedSeasonPropRow[] = [
      resolvedRow({ playerId: 'wr1', stat: 'rec_yds', line: 1200, book: 'DraftKings' }),
      resolvedRow({ playerId: 'wr1', stat: 'receptions', line: 90, book: 'DraftKings' }),
      resolvedRow({ playerId: 'wr1', stat: 'rec_tds', line: 8, book: 'DraftKings' }),
    ];

    const proj = buildSeasonProjectionsFromSeasonProps(rows).get('wr1')!;

    const yardageAndTdPoints = 1200 * 0.1 + 8 * 6; // 120 + 48 = 168
    expect(proj.ppr).toBeCloseTo(yardageAndTdPoints + 90 * 1);
    expect(proj.halfPpr).toBeCloseTo(yardageAndTdPoints + 90 * 0.5);
    expect(proj.standard).toBeCloseTo(yardageAndTdPoints);
    expect(proj.marketsUsed).toBe(3);
    expect(proj.books).toEqual(['DraftKings']);
  });

  it('defaults missing stats to 0 rather than leaving gaps', () => {
    const rows: ResolvedSeasonPropRow[] = [
      resolvedRow({ playerId: 'wr2', stat: 'rec_yds', line: 500, book: 'FanDuel' }),
    ];

    const proj = buildSeasonProjectionsFromSeasonProps(rows).get('wr2')!;

    expect(proj.stats.passYds).toBe(0);
    expect(proj.stats.rushTds).toBe(0);
    expect(proj.stats.receptions).toBe(0);
    expect(proj.marketsUsed).toBe(1);
  });
});
