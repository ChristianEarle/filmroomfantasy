import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { ODDS_API_PROVIDER } from '../services/gameOddsSync';
import { clearNflStateCache, resolveWeekFromCalendar } from '../services/nflState';
import { createJobContext } from './consumer';
import { getHandler } from './handlers';
import { oddsLinesHandler } from './handlers/oddsLines';
import type { IngestEnv, IngestMessage } from './types';

const SEASON = 2093;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const REGULAR_SEASON = Date.UTC(2093, 9, 1, 12);
const PRESEASON = Date.UTC(2093, 7, 15, 12);
const POSTSEASON = Date.UTC(2094, 0, 25, 12);
const OFFSEASON = Date.UTC(2094, 4, 1, 12);

const USAGE_HEADERS = { 'x-requests-remaining': '19412', 'x-requests-used': '588', 'x-requests-last': '3' };

const orm = drizzle(env.DB, { schema });
const unusedQueue = { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue<IngestMessage>;

function ingestEnv(overrides: Partial<IngestEnv> = {}): IngestEnv {
  return {
    DB: env.DB, INGEST_QUEUE: unusedQueue, INGEST_INTERACTIVE_QUEUE: unusedQueue, ENVIRONMENT: 'test',
    ODDS_API_KEY: 'test-odds-key', ...overrides,
  };
}

async function addGame(
  id: string,
  kickoff: number,
  { home = 'DEN', away = 'KC', week = 5, season = SEASON, seasonType = 'regular' } = {},
): Promise<void> {
  await orm.insert(schema.nflGames).values({
    id, week, seasonYear: season, seasonType, homeTeam: home, awayTeam: away, gameTime: new Date(kickoff),
  });
}

/** The featured-odds payload for one DraftKings book on KC at DEN. */
function oddsFeed(kickoff: number, homeSpread = -3.5) {
  const at = new Date(kickoff).toISOString();
  return [{
    id: 'evt-kc-den', sport_key: 'americanfootball_nfl', sport_title: 'NFL', commence_time: at,
    home_team: 'Denver Broncos', away_team: 'Kansas City Chiefs',
    bookmakers: [{
      key: 'draftkings', title: 'DraftKings', last_update: at,
      markets: [
        { key: 'spreads', last_update: at, outcomes: [
          { name: 'Denver Broncos', price: -110, point: homeSpread },
          { name: 'Kansas City Chiefs', price: -110, point: -homeSpread },
        ] },
        { key: 'totals', last_update: at, outcomes: [
          { name: 'Over', price: -110, point: 44.5 },
          { name: 'Under', price: -110, point: 44.5 },
        ] },
        { key: 'h2h', last_update: at, outcomes: [
          { name: 'Denver Broncos', price: -180 },
          { name: 'Kansas City Chiefs', price: 150 },
        ] },
      ],
    }],
  }];
}

/** Serves `payload` to Odds API requests and 404s anything else (ESPN), recording the Odds API calls. */
function mockOddsApi(payload: unknown, headers: Record<string, string> = USAGE_HEADERS) {
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== 'api.the-odds-api.com') return new Response('not found', { status: 404 });
    calls.push({ url, init });
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });
  });
  return calls;
}

async function runAt(now: number, ingest: IngestEnv = ingestEnv()) {
  const { ctx, dispose } = createJobContext(ingest, { softDeadlineMs: oddsLinesHandler.softDeadlineMs, now });
  try {
    return { result: await oddsLinesHandler.run(ctx, {}), ctx };
  } finally {
    dispose();
  }
}

async function storedLines(gameId: string) {
  return orm.query.gameOdds.findMany({ where: eq(schema.gameOdds.gameId, gameId) });
}

async function oddsApiState() {
  return orm.query.providerState.findFirst({ where: eq(schema.providerState.provider, ODDS_API_PROVIDER) });
}

describe('odds-lines job (workers pool)', () => {
  beforeEach(async () => {
    clearNflStateCache();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM game_odds WHERE season = ?1').bind(SEASON),
      env.DB.prepare('DELETE FROM nfl_games WHERE season_year IN (?1, ?2)').bind(SEASON, SEASON + 1),
      env.DB.prepare('DELETE FROM provider_state'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is the registered handler for the seeded odds:lines job', async () => {
    expect(getHandler('odds-lines')).toBe(oddsLinesHandler);
    expect(oddsLinesHandler).toMatchObject({ group: 'odds', resourceClass: 'light', softDeadlineMs: 60_000 });
    const seeded = await env.DB.prepare("SELECT kind, group_name AS 'group' FROM ingest_jobs WHERE key = 'odds:lines'").first();
    expect(seeded).toEqual({ kind: oddsLinesHandler.kind, group: oddsLinesHandler.group });
  });

  it('writes the lines onto this season\'s game, reports the credits and records the Odds API usage', async () => {
    const kickoff = REGULAR_SEASON + 30 * HOUR;
    await addGame('ol-kc-den', kickoff);
    const calls = mockOddsApi(oddsFeed(kickoff));

    const { result, ctx } = await runAt(REGULAR_SEASON);

    expect(result).toEqual({
      status: 'ok',
      nextRunAt: REGULAR_SEASON + 4 * HOUR,
      changed: true,
      detail: { season: SEASON, week: 5, inserted: 3, unchanged: 0, skipped: 0, total: 3, nextKickoffAt: kickoff },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url.searchParams.get('bookmakers')).toBe('draftkings,fanduel,betmgm');
    expect(calls[0].url.searchParams.get('apiKey')).toBe('test-odds-key');
    expect(calls[0].init?.signal).toBe(ctx.signal);
    expect(ctx.meter).toMatchObject({ upstreamCalls: 1, creditsUsed: 3 });

    const lines = await storedLines('ol-kc-den');
    expect(lines.map((line) => line.market).sort()).toEqual(['h2h', 'spreads', 'totals']);
    expect(lines.every((line) => line.season === SEASON && line.week === 5)).toBe(true);
    expect(lines.every((line) => line.snapshotTime === new Date(REGULAR_SEASON).toISOString())).toBe(true);

    expect(await oddsApiState()).toEqual({
      provider: ODDS_API_PROVIDER, quotaUsed: 588, quotaRemaining: 19412, lastCost: 3, observedAt: REGULAR_SEASON,
      blockedReason: null, blockedSince: null,
    });
  });

  it('writes only the lines that moved since the last run', async () => {
    const kickoff = REGULAR_SEASON + 30 * HOUR;
    await addGame('ol-kc-den', kickoff);

    mockOddsApi(oddsFeed(kickoff, -3.5));
    expect((await runAt(REGULAR_SEASON)).result).toMatchObject({ changed: true, detail: { inserted: 3, unchanged: 0 } });
    expect((await runAt(REGULAR_SEASON + HOUR)).result).toMatchObject({ changed: false, detail: { inserted: 0, unchanged: 3 } });

    vi.restoreAllMocks();
    mockOddsApi(oddsFeed(kickoff, -4.5));
    expect((await runAt(REGULAR_SEASON + 2 * HOUR)).result).toMatchObject({ changed: true, detail: { inserted: 1, unchanged: 2 } });

    const spreads = (await storedLines('ol-kc-den')).filter((line) => line.market === 'spreads');
    expect(spreads.map((line) => line.homePoint ?? 0).sort((a, b) => a - b)).toEqual([-4.5, -3.5]);
  });

  it('overwrites the usage counters on every call and leaves a provider block alone', async () => {
    const kickoff = REGULAR_SEASON + 30 * HOUR;
    await addGame('ol-kc-den', kickoff);
    await orm.insert(schema.providerState).values({ provider: ODDS_API_PROVIDER, blockedReason: 'OUT_OF_USAGE_CREDITS', blockedSince: 1 });

    mockOddsApi(oddsFeed(kickoff));
    await runAt(REGULAR_SEASON);
    vi.restoreAllMocks();
    mockOddsApi(oddsFeed(kickoff), { 'x-requests-remaining': '19409', 'x-requests-used': '591', 'x-requests-last': '3' });
    await runAt(REGULAR_SEASON + HOUR);

    expect(await oddsApiState()).toEqual({
      provider: ODDS_API_PROVIDER, quotaUsed: 591, quotaRemaining: 19409, lastCost: 3, observedAt: REGULAR_SEASON + HOUR,
      blockedReason: 'OUT_OF_USAGE_CREDITS', blockedSince: 1,
    });
  });

  it('records nothing in provider_state, and reports no credits, when the response has no usage headers', async () => {
    const kickoff = REGULAR_SEASON + 30 * HOUR;
    await addGame('ol-kc-den', kickoff);
    mockOddsApi(oddsFeed(kickoff), {});

    const { result, ctx } = await runAt(REGULAR_SEASON);

    expect(result).toMatchObject({ status: 'ok', detail: { inserted: 3 } });
    expect(ctx.meter).toMatchObject({ upstreamCalls: 1, creditsUsed: 0 });
    expect(await oddsApiState()).toBeUndefined();
  });

  it.each([
    { hours: 72, cadence: 12 },
    { hours: 48.5, cadence: 12 },
    { hours: 48, cadence: 4 },
    { hours: 6, cadence: 4 },
    { hours: 5.5, cadence: 1 },
    { hours: 0.25, cadence: 1 },
  ])('runs again in $cadence h when the nearest unstarted kickoff is $hours h away', async ({ hours, cadence }) => {
    await addGame('ol-next', REGULAR_SEASON + hours * HOUR);
    await addGame('ol-started', REGULAR_SEASON - 2 * HOUR, { home: 'BUF', away: 'MIA', week: 4 });
    mockOddsApi([]);

    const { result } = await runAt(REGULAR_SEASON);

    expect(result).toMatchObject({ status: 'ok', nextRunAt: REGULAR_SEASON + cadence * HOUR, changed: false });
  });

  it('runs again in 24 h when no regular-season game of this season is still to kick off', async () => {
    await addGame('ol-started', REGULAR_SEASON - 2 * HOUR, { home: 'BUF', away: 'MIA', week: 4 });
    await addGame('ol-next-season', REGULAR_SEASON + HOUR, { season: SEASON + 1 });
    await addGame('ol-not-regular', REGULAR_SEASON + HOUR, { seasonType: 'postseason', week: 19 });
    mockOddsApi([]);

    const { result } = await runAt(REGULAR_SEASON);

    expect(result).toMatchObject({ status: 'ok', nextRunAt: REGULAR_SEASON + DAY, detail: { nextKickoffAt: null } });
  });

  it('syncs in the preseason', async () => {
    expect(resolveWeekFromCalendar(new Date(PRESEASON)).seasonType).toBe('preseason');
    const kickoff = PRESEASON + 72 * HOUR;
    await addGame('ol-kc-den', kickoff);
    mockOddsApi(oddsFeed(kickoff));

    const { result } = await runAt(PRESEASON);

    expect(result).toMatchObject({ status: 'ok', nextRunAt: PRESEASON + 12 * HOUR, detail: { inserted: 3 } });
  });

  it.each([
    { seasonType: 'postseason', now: POSTSEASON },
    { seasonType: 'offseason', now: OFFSEASON },
  ])('skips the $seasonType for a day without calling the Odds API', async ({ seasonType, now }) => {
    expect(resolveWeekFromCalendar(new Date(now)).seasonType).toBe(seasonType);
    const calls = mockOddsApi(oddsFeed(now + DAY));

    const { result, ctx } = await runAt(now);

    expect(result).toEqual({ status: 'skipped', nextRunAt: now + DAY, detail: { seasonType } });
    expect(calls).toEqual([]);
    expect(ctx.meter.upstreamCalls).toBe(0);
  });

  it('fails without an Odds API key, before calling the API', async () => {
    await addGame('ol-kc-den', REGULAR_SEASON + 30 * HOUR);
    const calls = mockOddsApi(oddsFeed(REGULAR_SEASON + 30 * HOUR));

    await expect(runAt(REGULAR_SEASON, ingestEnv({ ODDS_API_KEY: undefined }))).rejects.toThrow('ODDS_API_KEY not set');
    expect(calls).toEqual([]);
  });
});
