import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { optionalAuthMiddleware } from '../middleware/auth';
import { listJobs, listOwners, listRuns, markDueNow, setOwner, unquarantineJob } from '../ingest/ledger';
import type { IngestOwner } from '../ingest/types';
import type { Env, Variables } from '../index';

export const adminIngestRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const OWNERS: readonly IngestOwner[] = ['legacy', 'ingest'];
const DEFAULT_RUNS_LIMIT = 50;
const MAX_RUNS_LIMIT = 200;

// X-Admin-Key, or the session of a user whose role is admin.
adminIngestRoutes.use('/ingest/*', optionalAuthMiddleware, adminAuthMiddleware);

function isOwner(value: unknown): value is IngestOwner {
  return OWNERS.includes(value as IngestOwner);
}

function runsLimit(raw: string | undefined): number {
  const limit = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(limit) || limit < 1) return DEFAULT_RUNS_LIMIT;
  return Math.min(limit, MAX_RUNS_LIMIT);
}

/**
 * GET /api/admin/ingest/jobs
 * Every ingest job with its schedule, lease and quarantine state and its group's owner.
 */
adminIngestRoutes.get('/ingest/jobs', async (c) => {
  return c.json({ jobs: await listJobs(c.env.DB) });
});

/**
 * GET /api/admin/ingest/runs?job=<key>&limit=50
 * Newest runs first, optionally for one job. `limit` is capped at 200.
 */
adminIngestRoutes.get('/ingest/runs', async (c) => {
  const job = c.req.query('job') || null;
  return c.json({ runs: await listRuns(c.env.DB, job, runsLimit(c.req.query('limit'))) });
});

/**
 * GET /api/admin/ingest/owner
 * Which scheduler owns each job group: 'legacy' (the API's cron) or 'ingest'.
 */
adminIngestRoutes.get('/ingest/owner', async (c) => {
  return c.json({ owners: await listOwners(c.env.DB) });
});

/**
 * POST /api/admin/ingest/owner
 * Body: { group, owner: 'legacy' | 'ingest' }. Cuts a group over to the
 * ingest Worker, or back (the rollback). Both schedulers read the owner at
 * run time, so it takes effect on their next tick.
 */
adminIngestRoutes.post('/ingest/owner', async (c) => {
  const body = await c.req.json<{ group?: unknown; owner?: unknown }>().catch(() => null);
  const group = body?.group;
  const owner = body?.owner;
  if (typeof group !== 'string' || !isOwner(owner)) {
    return c.json({ error: `Body must be { group, owner } with owner one of: ${OWNERS.join(', ')}` }, 400);
  }
  if (!(await setOwner(c.env.DB, group, owner))) {
    return c.json({ error: `Unknown group: ${group}` }, 400);
  }
  return c.json({ success: true, group, owner });
});

/**
 * POST /api/admin/ingest/jobs/:key/due
 * Makes the job due now; the dispatcher picks it up on its next tick
 * (within 5 minutes) if its group is owned by 'ingest'.
 */
adminIngestRoutes.post('/ingest/jobs/:key/due', async (c) => {
  const key = c.req.param('key');
  if ((await markDueNow(c.env.DB, [key])) === 0) {
    return c.json({ error: `Unknown job: ${key}` }, 404);
  }
  return c.json({ success: true, key });
});

/**
 * POST /api/admin/ingest/jobs/:key/unquarantine
 * Clears the job's quarantine and its consecutive-failure count.
 */
adminIngestRoutes.post('/ingest/jobs/:key/unquarantine', async (c) => {
  const key = c.req.param('key');
  if (!(await unquarantineJob(c.env.DB, key))) {
    return c.json({ error: `Unknown job: ${key}` }, 404);
  }
  return c.json({ success: true, key });
});
