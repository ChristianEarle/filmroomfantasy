import { Context, Next } from 'hono';
import { timingSafeEqual } from '../utils/crypto';
import type { Env, Variables } from '../index';

/**
 * Admin authentication middleware — dual auth support:
 * 1. JWT auth: If the request has a valid Bearer token AND the user's role is 'admin'
 * 2. X-Admin-Key: If the request has X-Admin-Key matching SYNC_SECRET (for the local dashboard)
 *
 * At least one must pass. This lets the app's UI use JWT-based admin,
 * while the standalone dashboard keeps working with the shared key.
 */
export const adminAuthMiddleware = async (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) => {
  // Path 1: X-Admin-Key (shared secret — for dashboard and cron jobs)
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey && c.env.SYNC_SECRET && timingSafeEqual(adminKey, c.env.SYNC_SECRET)) {
    await next();
    return;
  }

  // Path 2: JWT — user must be logged in AND have role === 'admin'
  const user = c.get('user');
  if (user && user.role === 'admin') {
    await next();
    return;
  }

  return c.json({ error: 'Unauthorized — admin access required' }, 403);
};
