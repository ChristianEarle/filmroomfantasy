import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';
import { dbNow, dispatchTick, listJobs, listOwners, setOwner, upsertJobsNow } from '../ingest/ledger';
import { legacyOwns } from '../ingest/ownership';
import worker from '../index';
import { adminIngestRoutes } from './adminIngest';
import { authRoutes } from './auth';

const ADMIN_KEY = 'test-sync-secret-for-vitest-only';
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const GROUP_COUNT = 11;

const orm = drizzle(env.DB, { schema });
const app = mountWithDb(adminIngestRoutes);

interface CallOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Replaces the default X-Admin-Key header. */
  headers?: Record<string, string>;
}

function call(path: string, { method = 'GET', body, headers = { 'X-Admin-Key': ADMIN_KEY } }: CallOptions = {}) {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
  }, env);
}

async function json<T>(response: Response | Promise<Response>): Promise<T> {
  return (await response).json() as Promise<T>;
}

/** Registers a user, gives it `role`, and returns its session token. */
async function sessionToken(username: string, role: 'admin' | 'user'): Promise<string> {
  const res = await mountWithDb(authRoutes).request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${username}@example.com`, password: 'correct-horse-battery-staple', username }),
  }, env);
  expect(res.status).toBe(201);
  const { token, user } = await res.json() as { token: string; user: { id: string } };
  await orm.update(schema.users).set({ role }).where(eq(schema.users.id, user.id));
  return token;
}

async function addJob(key: string, group = 'odds', nextRunAt = 0): Promise<void> {
  await upsertJobsNow(env.DB, [{ key, kind: 'test-kind', group, nextRunAt }]);
}

/** Inserts runs `${jobKey}-1` … `${jobKey}-${count}`, started at 1 … count. */
async function addRuns(jobKey: string, count: number): Promise<void> {
  await env.DB.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?2)
    INSERT INTO ingest_runs (id, job_key, kind, started_at, status)
    SELECT ?1 || '-' || i, ?1, 'test-kind', i, 'ok' FROM n`).bind(jobKey, count).run();
}

async function leasedKeys(): Promise<string[]> {
  return (await dispatchTick(env.DB, { maxQueued: 8 })).leased.map(({ key }) => key);
}

async function allLegacy(): Promise<boolean> {
  return (await listOwners(env.DB)).every(({ owner }) => owner === 'legacy');
}

describe('admin ingest routes (workers pool)', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM ingest_jobs'),
      env.DB.prepare('DELETE FROM ingest_runs'),
      env.DB.prepare("UPDATE ingest_owner SET owner = 'legacy'"),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('auth', () => {
    it.each([
      ['GET', '/ingest/jobs'],
      ['GET', '/ingest/runs'],
      ['GET', '/ingest/owner'],
      ['POST', '/ingest/owner'],
      ['POST', '/ingest/jobs/odds:lines/due'],
      ['POST', '/ingest/jobs/odds:lines/unquarantine'],
    ] as const)('%s %s refuses a request without the admin key or an admin session', async (method, path) => {
      await addJob('odds:lines');
      const body = method === 'POST' ? { group: 'odds', owner: 'ingest' } : undefined;

      for (const headers of [{}, { 'X-Admin-Key': 'not-the-key' }]) {
        expect((await call(path, { method, body, headers })).status).toBe(403);
      }
      expect(await allLegacy()).toBe(true);
    });

    it("accepts an admin's session and refuses a non-admin's", async () => {
      const admin = await sessionToken('ingest_admin', 'admin');
      const user = await sessionToken('ingest_user', 'user');

      expect((await call('/ingest/owner', { headers: { Authorization: `Bearer ${admin}` } })).status).toBe(200);
      expect((await call('/ingest/owner', { headers: { Authorization: `Bearer ${user}` } })).status).toBe(403);
    });

    it('is mounted, behind admin auth, at /api/admin/ingest on the API Worker', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const request = (headers: Record<string, string>) =>
        worker.fetch(new Request('http://localhost/api/admin/ingest/owner', { headers }), env);

      const allowed = await request({ 'X-Admin-Key': ADMIN_KEY });
      expect(allowed.status).toBe(200);
      expect((await allowed.json() as { owners: unknown[] }).owners).toHaveLength(GROUP_COUNT);
      expect((await request({})).status).toBe(403);
    });

    it.each(['https://www.filmroom.app', 'https://preview.filmroomfantasy.pages.dev'])(
      "lets an origin the API allows (%s) read the response, which admin-stats' narrower CORS would not",
      async (origin) => {
        vi.spyOn(console, 'log').mockImplementation(() => {});

        const res = await worker.fetch(new Request('http://localhost/api/admin/ingest/owner', {
          headers: { 'X-Admin-Key': ADMIN_KEY, Origin: origin },
        }), env);

        expect(res.status).toBe(200);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      },
    );
  });

  it('lists every job with its group owner and its lease and quarantine state', async () => {
    await setOwner(env.DB, 'odds', 'ingest');
    await addJob('test:odds', 'odds');
    await addJob('test:stats', 'stats');
    const [leased] = (await dispatchTick(env.DB, { maxQueued: 8 })).leased;

    const { jobs } = await json<{ jobs: unknown[] }>(call('/ingest/jobs'));

    expect(jobs).toMatchObject([
      { key: 'test:odds', group: 'odds', owner: 'ingest', dispatchToken: leased.token, currentRunId: null, attempts: 0, disabledUntil: null },
      { key: 'test:stats', group: 'stats', owner: 'legacy', dispatchToken: null, currentRunId: null, attempts: 0, disabledUntil: null },
    ]);
  });

  it('lists runs newest first, optionally for one job, 50 by default and never more than 200', async () => {
    await addRuns('bulk', 205);
    await addRuns('other', 2);
    const runs = (query: string) => json<{ runs: Array<{ id: string; jobKey: string }> }>(call(`/ingest/runs${query}`))
      .then((body) => body.runs);

    expect((await runs('?job=bulk&limit=3')).map(({ id }) => id)).toEqual(['bulk-205', 'bulk-204', 'bulk-203']);
    expect(await runs('?job=bulk')).toHaveLength(50);
    expect(await runs('?job=bulk&limit=1000')).toHaveLength(200);
    expect(await runs('?job=bulk&limit=nope')).toHaveLength(50);
    expect((await runs('?job=other')).map(({ jobKey }) => jobKey)).toEqual(['other', 'other']);
    expect(await runs('?limit=500')).toHaveLength(200);
  });

  describe('owner', () => {
    it('cuts a group over to ingest and back, which is what the legacy cron reads', async () => {
      expect(await legacyOwns(env.DB, 'odds')).toBe(true);

      const res = await call('/ingest/owner', { method: 'POST', body: { group: 'odds', owner: 'ingest' } });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, group: 'odds', owner: 'ingest' });
      expect(await legacyOwns(env.DB, 'odds')).toBe(false);
      expect(await legacyOwns(env.DB, 'props')).toBe(true);
      const { owners } = await json<{ owners: Array<{ group: string; owner: string }> }>(call('/ingest/owner'));
      expect(owners).toHaveLength(GROUP_COUNT);
      expect(owners.filter(({ owner }) => owner === 'ingest').map(({ group }) => group)).toEqual(['odds']);

      expect((await call('/ingest/owner', { method: 'POST', body: { group: 'odds', owner: 'legacy' } })).status).toBe(200);
      expect(await legacyOwns(env.DB, 'odds')).toBe(true);
    });

    it.each([
      ['an unknown group', { group: 'weather', owner: 'ingest' }],
      ['an unknown owner', { group: 'odds', owner: 'cron' }],
      ['a missing owner', { group: 'odds' }],
      ['a missing group', { owner: 'ingest' }],
      ['a group that is not a string', { group: ['odds'], owner: 'ingest' }],
      ['a body that is not JSON', 'group=odds&owner=ingest'],
    ])('rejects %s with 400 and changes nothing', async (_, body) => {
      const res = await call('/ingest/owner', { method: 'POST', body });

      expect(res.status).toBe(400);
      expect(await res.json()).toHaveProperty('error');
      expect(await allLegacy()).toBe(true);
    });
  });

  describe('jobs/:key', () => {
    it.each(['odds:lines', 'odds%3Alines'])('due makes the job (%s) due now, so the next dispatcher tick leases it', async (pathKey) => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('odds:lines', 'odds', (await dbNow(env.DB)) + DAY);
      expect(await leasedKeys()).toEqual([]);

      const res = await call(`/ingest/jobs/${pathKey}/due`, { method: 'POST' });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, key: 'odds:lines' });
      expect(await leasedKeys()).toEqual(['odds:lines']);
    });

    it('unquarantine lifts the quarantine and resets the failure count', async () => {
      await setOwner(env.DB, 'odds', 'ingest');
      await addJob('odds:lines');
      await orm.update(schema.ingestJobs)
        .set({ attempts: 5, disabledUntil: (await dbNow(env.DB)) + 6 * HOUR })
        .where(eq(schema.ingestJobs.key, 'odds:lines'));
      expect(await leasedKeys()).toEqual([]);

      const res = await call('/ingest/jobs/odds:lines/unquarantine', { method: 'POST' });

      expect(res.status).toBe(200);
      expect((await listJobs(env.DB))[0]).toMatchObject({ key: 'odds:lines', attempts: 0, disabledUntil: null });
      expect(await leasedKeys()).toEqual(['odds:lines']);
    });

    it.each(['due', 'unquarantine'])('%s answers 404 for an unknown job', async (action) => {
      const res = await call(`/ingest/jobs/no-such-job/${action}`, { method: 'POST' });

      expect(res.status).toBe(404);
      expect(await listJobs(env.DB)).toEqual([]);
    });
  });
});
