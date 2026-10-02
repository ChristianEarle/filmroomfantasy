import { Hono } from 'hono';
import { rateLimit } from '../middleware/rateLimit';
import { dbNow, listJobs, readHeartbeat } from '../ingest/ledger';
import type { JobRow } from '../ingest/ledger';
import type { Env, Variables } from '../index';

export const statusRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Public: 60 requests per minute per IP, like the other public read routes.
statusRoutes.use('*', rateLimit(60, 60 * 1000));

function ageSeconds(now: number, at: number | null): number | null {
  return at === null ? null : Math.max(0, Math.floor((now - at) / 1000));
}

// Only schedule fields leave here: params, lease tokens and error text stay
// behind the admin endpoints.
function jobFreshness(job: JobRow, now: number) {
  return {
    key: job.key,
    group: job.group,
    owner: job.owner,
    lastSuccessAt: job.lastSuccessAt,
    ageSeconds: ageSeconds(now, job.lastSuccessAt),
    lastStatus: job.lastStatus,
    nextRunAt: job.nextRunAt,
    quarantinedUntil: job.disabledUntil !== null && job.disabledUntil > now ? job.disabledUntil : null,
  };
}

/**
 * GET /api/status/freshness
 * How fresh each ingest job's data is and when the ingest dispatcher last
 * ticked. Times are ms since epoch on D1's clock; ages are in seconds.
 */
statusRoutes.get('/freshness', async (c) => {
  const db = c.env.DB;
  const [now, jobs, heartbeat] = await Promise.all([dbNow(db), listJobs(db), readHeartbeat(db, 'dispatcher')]);
  const lastHeartbeatAt = heartbeat?.at ?? null;

  c.header('Cache-Control', 'public, max-age=60');
  return c.json({
    jobs: jobs.map((job) => jobFreshness(job, now)),
    dispatcher: { lastHeartbeatAt, ageSeconds: ageSeconds(now, lastHeartbeatAt) },
  });
});
