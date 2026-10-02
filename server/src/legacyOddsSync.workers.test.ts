import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { setOwner } from './ingest/ledger';
import worker, { runLegacyOddsSync } from './index';
import type { Env } from './index';
import { clearNflStateCache } from './services/nflState';

const WEEK = 5;
const SEASON = 2026;
const SYNC_ODDS = ['/api/admin/sync-odds', { week: WEEK, season: SEASON }];

/** A Tuesday in week 5 of the 2026 regular season, when the 4-hour cron syncs odds. */
const IN_SEASON = Date.UTC(2026, 9, 6, 12);
const FOUR_HOURLY_CRON = '0 */4 * * *';
const ODDS_API_HOST = 'api.the-odds-api.com';
const GAME_ODDS_BOOKMAKERS = 'draftkings,fanduel,betmgm';

async function restoreOddsOwner(): Promise<void> {
  await env.DB.prepare("INSERT OR REPLACE INTO ingest_owner (group_name, owner, updated_at) VALUES ('odds', 'legacy', 0)").run();
}

async function oddsSyncCalls(db: D1Database = env.DB): Promise<unknown[][]> {
  const callSync = vi.fn(async (_path: string, _body?: object) => true);
  await runLegacyOddsSync(db, callSync, WEEK, SEASON);
  return callSync.mock.calls;
}

/**
 * Runs the API Worker's real 4-hour cron in season and returns the game-odds
 * requests (what sync-odds fetches) it made. The Odds API answers with no
 * events and every other upstream with 404, so no step fails into the cron's
 * 2 s retry.
 */
async function gameOddsRequestsFromCron(): Promise<URL[]> {
  const requests: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    return url.hostname === ODDS_API_HOST ? Response.json([]) : new Response('not found', { status: 404 });
  });
  clearNflStateCache();
  const ctx = createExecutionContext();

  await worker.scheduled(
    { cron: FOUR_HOURLY_CRON, scheduledTime: IN_SEASON } as unknown as ScheduledEvent,
    { ...env, ODDS_API_KEY: 'test-odds-key' } as unknown as Env,
    ctx,
  );
  await waitOnExecutionContext(ctx);

  return requests.filter((url) => url.hostname === ODDS_API_HOST && url.searchParams.get('bookmakers') === GAME_ODDS_BOOKMAKERS);
}

describe("the 4-hour cron's odds step (workers pool)", () => {
  beforeEach(async () => {
    await restoreOddsOwner();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await restoreOddsOwner();
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearNflStateCache();
  });

  it('calls sync-odds for the week and season while the legacy cron owns odds', async () => {
    expect(await oddsSyncCalls()).toEqual([SYNC_ODDS]);
  });

  it('skips sync-odds once odds is cut over to the ingest Worker, and resumes after a rollback', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    expect(await oddsSyncCalls()).toEqual([]);

    await setOwner(env.DB, 'odds', 'legacy');
    expect(await oddsSyncCalls()).toEqual([SYNC_ODDS]);
  });

  it('calls sync-odds when the odds owner row is missing', async () => {
    await env.DB.prepare("DELETE FROM ingest_owner WHERE group_name = 'odds'").run();

    expect(await oddsSyncCalls()).toEqual([SYNC_ODDS]);
  });

  it('calls sync-odds when the owner cannot be read', async () => {
    const missingTable = {
      prepare: () => {
        throw new Error('D1_ERROR: no such table: ingest_owner: SQLITE_ERROR');
      },
    } as unknown as D1Database;

    expect(await oddsSyncCalls(missingTable)).toEqual([SYNC_ODDS]);
  });

  it('is the step the scheduled handler runs: the real cron fetches game odds only while the legacy cron owns odds', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: IN_SEASON });

    await setOwner(env.DB, 'odds', 'ingest');
    expect(await gameOddsRequestsFromCron()).toEqual([]);

    await setOwner(env.DB, 'odds', 'legacy');
    expect(await gameOddsRequestsFromCron()).toHaveLength(1);
  });
});
