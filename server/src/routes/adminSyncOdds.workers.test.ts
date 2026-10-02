import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { adminRoutes } from './admin';
import * as schema from '../db/schema';
import type { Env, Variables } from '../index';

const SEASON = 2097;
const KICKOFF = '2097-10-04T20:25:00Z';
const STARTED_KICKOFF = '2020-09-13T17:00:00Z';

function oddsFeed(homeSpread: number) {
  const book = (home: string, away: string, spread: number, commence: string) => ({
    key: 'draftkings',
    title: 'DraftKings',
    last_update: commence,
    markets: [
      { key: 'spreads', last_update: commence, outcomes: [
        { name: home, price: -110, point: spread },
        { name: away, price: -110, point: -spread },
      ] },
      { key: 'totals', last_update: commence, outcomes: [
        { name: 'Over', price: -110, point: 44.5 },
        { name: 'Under', price: -110, point: 44.5 },
      ] },
      { key: 'h2h', last_update: commence, outcomes: [
        { name: home, price: -180 },
        { name: away, price: 150 },
      ] },
    ],
  });
  return [
    {
      id: 'evt-kc-den', sport_key: 'americanfootball_nfl', sport_title: 'NFL', commence_time: KICKOFF,
      home_team: 'Denver Broncos', away_team: 'Kansas City Chiefs',
      bookmakers: [book('Denver Broncos', 'Kansas City Chiefs', homeSpread, KICKOFF)],
    },
    {
      id: 'evt-mia-buf', sport_key: 'americanfootball_nfl', sport_title: 'NFL', commence_time: STARTED_KICKOFF,
      home_team: 'Buffalo Bills', away_team: 'Miami Dolphins',
      bookmakers: [book('Buffalo Bills', 'Miami Dolphins', -6.5, STARTED_KICKOFF)],
    },
  ];
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

function storedSpread(id: string, homePoint: number, snapshotTime: string) {
  return {
    id, gameId: 'odds-test-game-current', homeTeam: 'DEN', awayTeam: 'KC', commenceTime: KICKOFF,
    bookmaker: 'draftkings', market: 'spreads', homePoint, awayPoint: -homePoint, homePrice: -110, awayPrice: -110,
    snapshotTime, season: SEASON, week: 4,
  };
}

describe('POST /api/admin/sync-odds (workers pool)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes only changed lines, from three books, onto this season\'s unstarted game', async () => {
    const db = drizzle(env.DB, { schema });

    await db.batch([
      db.insert(schema.nflGames).values({
        id: 'odds-test-game-current', week: 4, seasonYear: SEASON, seasonType: 'regular',
        homeTeam: 'DEN', awayTeam: 'KC', gameTime: new Date(KICKOFF),
      }),
      // The same pairing a season earlier must not receive this season's odds.
      db.insert(schema.nflGames).values({
        id: 'odds-test-game-previous', week: 9, seasonYear: SEASON - 1, seasonType: 'regular',
        homeTeam: 'DEN', awayTeam: 'KC', gameTime: new Date('2096-11-02T21:25:00Z'),
      }),
      // Kicked off already: the feed's line for it is a live line.
      db.insert(schema.nflGames).values({
        id: 'odds-test-game-started', week: 1, seasonYear: SEASON, seasonType: 'regular',
        homeTeam: 'BUF', awayTeam: 'MIA', gameTime: new Date(STARTED_KICKOFF),
      }),
      // Existing history: the newest DraftKings spread already equals the incoming one.
      db.insert(schema.gameOdds).values(storedSpread('odds-test-old-1', -1, daysAgo(2))),
      db.insert(schema.gameOdds).values(storedSpread('odds-test-old-2', -3.5, daysAgo(1))),
      // Same total as the feed, but older than the lookback, so it isn't the baseline.
      db.insert(schema.gameOdds).values({
        id: 'odds-test-old-total', gameId: 'odds-test-game-current', homeTeam: 'DEN', awayTeam: 'KC', commenceTime: KICKOFF,
        bookmaker: 'draftkings', market: 'totals', overPoint: 44.5, underPoint: 44.5, overPrice: -110, underPrice: -110,
        snapshotTime: daysAgo(30), season: SEASON, week: 4,
      }),
    ] as any);

    let payload = oddsFeed(-3.5);
    const requestedUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', async (c, next) => {
      c.set('db', db as any);
      await next();
    });
    app.route('/', adminRoutes);
    const sync = async () => {
      const res = await app.request('/sync-odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test-sync-secret-for-vitest-only' },
        body: JSON.stringify({ season: SEASON }),
      }, { ...env, ODDS_API_KEY: 'test-odds-key' });
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 5));
      return res.json() as Promise<{ inserted: number; unchanged: number; skipped: number }>;
    };

    // Spread matches the newest stored row; totals and moneyline are new; the started game is skipped.
    expect(await sync()).toMatchObject({ inserted: 2, unchanged: 1, skipped: 3 });

    const url = new URL(requestedUrls[0]);
    expect(url.searchParams.get('bookmakers')).toBe('draftkings,fanduel,betmgm');
    expect(url.searchParams.has('regions')).toBe(false);

    const current = await db.query.gameOdds.findMany({ where: eq(schema.gameOdds.gameId, 'odds-test-game-current') });
    expect(current).toHaveLength(5);
    expect(current.every((row) => row.season === SEASON && row.week === 4)).toBe(true);
    for (const gameId of ['odds-test-game-previous', 'odds-test-game-started']) {
      expect(await db.query.gameOdds.findMany({ where: eq(schema.gameOdds.gameId, gameId) })).toHaveLength(0);
    }

    expect(await sync()).toMatchObject({ inserted: 0, unchanged: 3 });

    payload = oddsFeed(-4.5);
    expect(await sync()).toMatchObject({ inserted: 1, unchanged: 2 });

    // The line just written is now the one later runs compare against.
    expect(await sync()).toMatchObject({ inserted: 0, unchanged: 3 });

    const spreads = await db.query.gameOdds.findMany({ where: eq(schema.gameOdds.market, 'spreads') });
    expect(spreads.map((row) => row.homePoint ?? 0).sort((a, b) => a - b)).toEqual([-4.5, -3.5, -1]);
  }, 30_000);
});
