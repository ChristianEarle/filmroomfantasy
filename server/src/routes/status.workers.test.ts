import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';
import { dbNow, setOwner, writeHeartbeat } from '../ingest/ledger';
import worker from '../index';
import { statusRoutes } from './status';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const JOB_FIELDS = ['ageSeconds', 'group', 'key', 'lastStatus', 'lastSuccessAt', 'nextRunAt', 'owner', 'quarantinedUntil'];

const orm = drizzle(env.DB, { schema });
const app = mountWithDb(statusRoutes);

type NewJob = typeof schema.ingestJobs.$inferInsert;

interface Freshness {
  jobs: Array<Record<string, unknown>>;
  dispatcher: { lastHeartbeatAt: number | null; ageSeconds: number | null };
}

async function addJob(key: string, fields: Partial<NewJob> = {}): Promise<void> {
  await orm.insert(schema.ingestJobs).values({
    key, kind: 'test-kind', groupName: 'odds', nextRunAt: 0, createdAt: 0, updatedAt: 0, ...fields,
  });
}

function freshness() {
  return app.request('/freshness', {}, env);
}

describe('GET /api/status/freshness (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ingest_jobs'),
      env.DB.prepare('DELETE FROM ingest_heartbeat'),
      env.DB.prepare("UPDATE ingest_owner SET owner = 'legacy'"),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports each job's freshness and the dispatcher's last tick, cacheable for a minute", async () => {
    const now = await dbNow(env.DB);
    await setOwner(env.DB, 'odds', 'ingest');
    await addJob('odds:lines', { lastSuccessAt: now - 90_000, lastStatus: 'ok', nextRunAt: now + 4 * HOUR });
    await addJob('stats:week', { groupName: 'stats', lastStatus: 'failed', attempts: 5, disabledUntil: now + 6 * HOUR, nextRunAt: now + HOUR });
    await addJob('stats:old-quarantine', { groupName: 'stats', lastSuccessAt: now - 2 * HOUR, lastStatus: 'ok', disabledUntil: now - HOUR });
    await writeHeartbeat(env.DB, 'dispatcher', { leased: 1, reaped: 0, released: 0, sendFailures: 0 });

    const res = await freshness();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    const body = await res.json() as Freshness;
    expect(body.jobs).toEqual([
      {
        key: 'odds:lines', group: 'odds', owner: 'ingest', lastSuccessAt: now - 90_000, ageSeconds: expect.any(Number),
        lastStatus: 'ok', nextRunAt: now + 4 * HOUR, quarantinedUntil: null,
      },
      {
        key: 'stats:old-quarantine', group: 'stats', owner: 'legacy', lastSuccessAt: now - 2 * HOUR, ageSeconds: expect.any(Number),
        lastStatus: 'ok', nextRunAt: 0, quarantinedUntil: null,
      },
      {
        key: 'stats:week', group: 'stats', owner: 'legacy', lastSuccessAt: null, ageSeconds: null,
        lastStatus: 'failed', nextRunAt: now + HOUR, quarantinedUntil: now + 6 * HOUR,
      },
    ]);
    expect(body.jobs[0].ageSeconds).toBeGreaterThanOrEqual(90);
    expect(body.jobs[0].ageSeconds).toBeLessThan(120);
    expect(body.jobs[1].ageSeconds).toBeGreaterThanOrEqual(7200);
    expect(body.dispatcher.lastHeartbeatAt).toBeGreaterThanOrEqual(now);
    expect(body.dispatcher.ageSeconds).toBeLessThan(30);
  });

  it('reports a dispatcher that has never ticked', async () => {
    const body = await (await freshness()).json() as Freshness;

    expect(body).toEqual({ jobs: [], dispatcher: { lastHeartbeatAt: null, ageSeconds: null } });
  });

  it('never exposes job params, lease tokens or error text', async () => {
    await addJob('odds:lines', {
      params: JSON.stringify({ apiKey: 'param-secret-value' }),
      dispatchToken: 'lease-token-value',
      currentRunId: 'run-id-value',
      lastStatus: 'failed',
      lastError: 'Failed to fetch current odds: 401 for https://api.the-odds-api.com/v4/?apiKey=error-secret-value',
    });

    const res = await freshness();
    const text = await res.text();

    for (const secret of ['param-secret-value', 'lease-token-value', 'run-id-value', 'error-secret-value', 'the-odds-api.com']) {
      expect(text).not.toContain(secret);
    }
    const { jobs } = JSON.parse(text) as Freshness;
    expect(Object.keys(jobs[0]).sort()).toEqual(JOB_FIELDS);
  });

  it('is public and rate limited on the API Worker', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await worker.fetch(new Request('http://localhost/api/status/freshness'), env);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(await res.json()).toHaveProperty('dispatcher');
  });
});
