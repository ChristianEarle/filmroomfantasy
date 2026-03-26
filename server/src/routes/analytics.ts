import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import type { Env, Variables } from '../index';

export const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Public: record a page view ───────────────────────────────────────────────
analyticsRoutes.post('/pageview', async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json<{
      path: string;
      referrer?: string;
      sessionId: string;
      device?: string;
      browser?: string;
    }>();

    if (!body.path || !body.sessionId) {
      return c.json({ error: 'path and sessionId are required' }, 400);
    }

    // Try to extract userId from JWT if present (optional — don't block on auth failure)
    let userId: string | null = null;
    try {
      const { getCookie } = await import('hono/cookie');
      const cookieToken = getCookie(c, 'auth_token');
      const authHeader = c.req.header('Authorization');
      const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
      if (token) {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(c.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
        userId = (payload.sub as string) || null;
      }
    } catch {
      // Not logged in — that's fine
    }

    // Get country from Cloudflare headers if available
    const country = c.req.header('cf-ipcountry') || null;
    const userAgent = c.req.header('user-agent') || null;

    const id = crypto.randomUUID();
    const nowSec = Math.floor(Date.now() / 1000);

    await db.prepare(`
      INSERT INTO page_views (id, path, referrer, user_id, session_id, user_agent, country, device, browser, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.path,
      body.referrer || null,
      userId,
      body.sessionId,
      userAgent,
      country,
      body.device || null,
      body.browser || null,
      nowSec,
    ).run();

    return c.json({ ok: true });
  } catch (err) {
    console.error('Analytics pageview error:', err);
    // Never block the user experience on analytics failures
    return c.json({ ok: true });
  }
});

// ─── Admin: get analytics data ────────────────────────────────────────────────

// Apply admin auth to all /analytics/admin/* routes
analyticsRoutes.use('/admin/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  // Try JWT auth first
  const { getCookie } = await import('hono/cookie');
  const cookieToken = getCookie(c, 'auth_token');
  const authHeader = c.req.header('Authorization');
  const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (token) {
    try {
      const { jwtVerify } = await import('jose');
      const { eq } = await import('drizzle-orm');
      const schema = await import('../db/schema');
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      if (payload.sub) {
        const db = c.get('db');
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, payload.sub as string),
        });
        if (user) c.set('user', user);
      }
    } catch {
      // Fall through to adminAuthMiddleware
    }
  }

  await adminAuthMiddleware(c, next);
});

analyticsRoutes.get('/admin/overview', async (c) => {
  const db = c.env.DB;

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const todayStartSec = Math.floor(new Date(new Date().toISOString().split('T')[0]).getTime() / 1000);
    const sevenDaysAgoSec = nowSec - 7 * 86400;
    const thirtyDaysAgoSec = nowSec - 30 * 86400;

    // Run all queries in parallel
    const [
      todayViews,
      sevenDayViews,
      thirtyDayViews,
      todayUnique,
      sevenDayUnique,
      thirtyDayUnique,
      viewsByDay,
      topPages,
      topReferrers,
      deviceBreakdown,
      browserBreakdown,
      countryBreakdown,
      recentPageViews,
      hourlyToday,
    ] = await Promise.all([
      // Total views today
      db.prepare(
        'SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?'
      ).bind(todayStartSec).first<{ count: number }>(),

      // Total views 7 days
      db.prepare(
        'SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?'
      ).bind(sevenDaysAgoSec).first<{ count: number }>(),

      // Total views 30 days
      db.prepare(
        'SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?'
      ).bind(thirtyDaysAgoSec).first<{ count: number }>(),

      // Unique visitors today
      db.prepare(
        'SELECT COUNT(DISTINCT session_id) as count FROM page_views WHERE created_at >= ?'
      ).bind(todayStartSec).first<{ count: number }>(),

      // Unique visitors 7 days
      db.prepare(
        'SELECT COUNT(DISTINCT session_id) as count FROM page_views WHERE created_at >= ?'
      ).bind(sevenDaysAgoSec).first<{ count: number }>(),

      // Unique visitors 30 days
      db.prepare(
        'SELECT COUNT(DISTINCT session_id) as count FROM page_views WHERE created_at >= ?'
      ).bind(thirtyDaysAgoSec).first<{ count: number }>(),

      // Views by day (last 30 days)
      db.prepare(`
        SELECT DATE(created_at, 'unixepoch') as date,
               COUNT(*) as views,
               COUNT(DISTINCT session_id) as visitors
        FROM page_views
        WHERE created_at >= ?
        GROUP BY date
        ORDER BY date ASC
      `).bind(thirtyDaysAgoSec).all(),

      // Top pages (last 30 days)
      db.prepare(`
        SELECT path, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors
        FROM page_views
        WHERE created_at >= ?
        GROUP BY path
        ORDER BY views DESC
        LIMIT 15
      `).bind(thirtyDaysAgoSec).all(),

      // Top referrers (last 30 days, exclude empty)
      db.prepare(`
        SELECT referrer, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors
        FROM page_views
        WHERE created_at >= ? AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer
        ORDER BY views DESC
        LIMIT 10
      `).bind(thirtyDaysAgoSec).all(),

      // Device breakdown (last 30 days)
      db.prepare(`
        SELECT COALESCE(device, 'unknown') as device, COUNT(*) as count
        FROM page_views
        WHERE created_at >= ?
        GROUP BY device
        ORDER BY count DESC
      `).bind(thirtyDaysAgoSec).all(),

      // Browser breakdown (last 30 days)
      db.prepare(`
        SELECT COALESCE(browser, 'unknown') as browser, COUNT(*) as count
        FROM page_views
        WHERE created_at >= ?
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 8
      `).bind(thirtyDaysAgoSec).all(),

      // Country breakdown (last 30 days)
      db.prepare(`
        SELECT COALESCE(country, 'unknown') as country, COUNT(*) as count
        FROM page_views
        WHERE created_at >= ?
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `).bind(thirtyDaysAgoSec).all(),

      // Recent page views (last 50)
      db.prepare(`
        SELECT pv.path, pv.referrer, pv.device, pv.browser, pv.country, pv.created_at,
               u.username
        FROM page_views pv
        LEFT JOIN users u ON pv.user_id = u.id
        ORDER BY pv.created_at DESC
        LIMIT 50
      `).all(),

      // Hourly breakdown today
      db.prepare(`
        SELECT CAST(strftime('%H', created_at, 'unixepoch') AS INTEGER) as hour,
               COUNT(*) as views
        FROM page_views
        WHERE created_at >= ?
        GROUP BY hour
        ORDER BY hour ASC
      `).bind(todayStartSec).all(),
    ]);

    return c.json({
      summary: {
        today: { views: todayViews?.count ?? 0, visitors: todayUnique?.count ?? 0 },
        sevenDay: { views: sevenDayViews?.count ?? 0, visitors: sevenDayUnique?.count ?? 0 },
        thirtyDay: { views: thirtyDayViews?.count ?? 0, visitors: thirtyDayUnique?.count ?? 0 },
      },
      viewsByDay: viewsByDay?.results ?? [],
      topPages: topPages?.results ?? [],
      topReferrers: topReferrers?.results ?? [],
      deviceBreakdown: deviceBreakdown?.results ?? [],
      browserBreakdown: browserBreakdown?.results ?? [],
      countryBreakdown: countryBreakdown?.results ?? [],
      recentPageViews: recentPageViews?.results ?? [],
      hourlyToday: hourlyToday?.results ?? [],
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    return c.json(
      { error: 'Failed to fetch analytics', message: err instanceof Error ? err.message : 'Unknown error' },
      500
    );
  }
});
