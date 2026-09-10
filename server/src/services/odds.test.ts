import { describe, it, expect } from 'vitest';
import { parseOddsResponse, parsePlayerProps, teamNameToAbbr } from './odds';

function makeGame(overrides: Partial<Parameters<typeof parseOddsResponse>[0][0]> = {}) {
  return {
    id: 'game1',
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
    commence_time: '2026-09-14T17:00:00Z',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    bookmakers: [],
    ...overrides,
  };
}

describe('teamNameToAbbr', () => {
  it('maps known full team names to their abbreviation, and passes unknown names through unchanged', () => {
    expect(teamNameToAbbr('Kansas City Chiefs')).toBe('KC');
    expect(teamNameToAbbr('San Francisco 49ers')).toBe('SF');
    expect(teamNameToAbbr('Not A Real Team')).toBe('Not A Real Team');
  });
});

describe('parseOddsResponse', () => {
  it('parses spreads and h2h markets into home/away points and prices, using the explicit season passed in', () => {
    const games = [
      makeGame({
        bookmakers: [
          {
            key: 'fanduel',
            title: 'FanDuel',
            last_update: '2026-09-10T00:00:00Z',
            markets: [
              {
                key: 'spreads',
                last_update: '2026-09-10T00:00:00Z',
                outcomes: [
                  { name: 'Kansas City Chiefs', price: -110, point: -3.5 },
                  { name: 'Buffalo Bills', price: -110, point: 3.5 },
                ],
              },
              {
                key: 'h2h',
                last_update: '2026-09-10T00:00:00Z',
                outcomes: [
                  { name: 'Kansas City Chiefs', price: -160 },
                  { name: 'Buffalo Bills', price: 140 },
                ],
              },
            ],
          },
        ],
      }),
    ];

    const parsed = parseOddsResponse(games, 2, '2026-09-10T00:00:00Z', 2026);
    expect(parsed).toHaveLength(2);

    const spread = parsed.find((p) => p.market === 'spreads')!;
    expect(spread.home_team).toBe('KC');
    expect(spread.away_team).toBe('BUF');
    expect(spread.home_point).toBe(-3.5);
    expect(spread.away_point).toBe(3.5);
    expect(spread.season).toBe(2026);
    expect(spread.week).toBe(2);

    const h2h = parsed.find((p) => p.market === 'h2h')!;
    expect(h2h.home_price).toBe(-160);
    expect(h2h.away_price).toBe(140);
  });

  it('parses totals markets into over/under point and price', () => {
    const games = [
      makeGame({
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            last_update: '2026-09-10T00:00:00Z',
            markets: [
              {
                key: 'totals',
                last_update: '2026-09-10T00:00:00Z',
                outcomes: [
                  { name: 'Over', price: -105, point: 47.5 },
                  { name: 'Under', price: -115, point: 47.5 },
                ],
              },
            ],
          },
        ],
      }),
    ];

    const parsed = parseOddsResponse(games, 2, '2026-09-10T00:00:00Z', 2026);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].over_point).toBe(47.5);
    expect(parsed[0].over_price).toBe(-105);
    expect(parsed[0].under_point).toBe(47.5);
    expect(parsed[0].under_price).toBe(-115);
  });
});

describe('parsePlayerProps', () => {
  const propGame = {
    id: 'event1',
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
    commence_time: '2026-09-14T17:00:00Z',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    bookmakers: [
      {
        key: 'fanduel',
        title: 'FanDuel',
        last_update: '2026-09-10T00:00:00Z',
        markets: [
          {
            key: 'player_pass_yds',
            last_update: '2026-09-10T00:00:00Z',
            outcomes: [
              { name: 'Over', description: 'Patrick Mahomes', price: -110, point: 275.5 },
              { name: 'Under', description: 'Patrick Mahomes', price: -110, point: 275.5 },
            ],
          },
        ],
      },
    ],
  };

  it('groups over/under outcomes by player and prefers fanduel/draftkings/betmgm in that order', () => {
    const parsed = parsePlayerProps(propGame, 2, '2026-09-10T00:00:00Z');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].player_name).toBe('Patrick Mahomes');
    expect(parsed[0].bookmaker).toBe('fanduel');
    expect(parsed[0].over_point).toBe(275.5);
    expect(parsed[0].under_point).toBe(275.5);
  });

  it('falls back to whichever bookmaker has player_ markets when none of the big three do, and returns [] with none at all', () => {
    const gameWithOnlySmallBook = {
      ...propGame,
      bookmakers: [
        {
          key: 'someRegionalBook',
          title: 'Regional Book',
          last_update: '2026-09-10T00:00:00Z',
          markets: [
            {
              key: 'player_rush_yds',
              last_update: '2026-09-10T00:00:00Z',
              outcomes: [
                { name: 'Over', description: 'James Cook', price: -120, point: 85.5 },
              ],
            },
          ],
        },
      ],
    };
    const parsed = parsePlayerProps(gameWithOnlySmallBook, 2);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].bookmaker).toBe('someRegionalBook');
    expect(parsed[0].over_point).toBe(85.5);

    const emptyGame = { ...propGame, bookmakers: [] };
    expect(parsePlayerProps(emptyGame, 2)).toEqual([]);
  });
});
