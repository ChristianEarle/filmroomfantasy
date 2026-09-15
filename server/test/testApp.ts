import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../src/db/schema';
import type { Env, Variables } from '../src/index';

/**
 * Mounts a router under a bare Hono app that attaches the same `db` Variable
 * the real app (src/index.ts) sets up via top-level middleware. Route
 * handlers call `c.get('db')`, so exercising a router's `.request()` in
 * isolation (as the workers-pool tests below do) needs this same wiring —
 * without it every DB-backed handler would throw on an undefined `db`.
 */
export function mountWithDb(
  routes: Hono<{ Bindings: Env; Variables: Variables }>
): Hono<{ Bindings: Env; Variables: Variables }> {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('db', drizzle(c.env.DB, { schema }));
    await next();
  });
  app.route('/', routes);
  return app;
}
