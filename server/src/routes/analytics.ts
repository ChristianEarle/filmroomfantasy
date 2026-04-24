import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import type { Env, Variables } from '../index';

export const analyticsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Central Time helpers ────────────────────────────────────────────────────
/** Returns the current US Central Time UTC offset in seconds (-6h CST or -5h CDT). */
function getCentralOffsetSec(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  // CDT starts 2nd Sunday of March at 2 AM CST (08:00 UTC)
  const mar1Day = new Date(Date.UTC(year, 2, 1)).getUTCDay();
  const marFirstSun = mar1Day === 0 ? 1 : 1 + (7 - mar1Day);
  const marSecondSun = marFirstSun + 7;
  const cdtStart = Date.UTC(year, 2, marSecondSun, 8, 0, 0); // 2AM CST = 8AM UTC
  // CST resumes 1st Sunday of November at 2 AM CDT (07:00 UTC)
  const nov1Day = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const novFirstSun = nov1Day === 0 ? 1 : 1 + (7 - nov1Day);
  const cstStart = Date.UTC(year, 10, novFirstSun, 7, 0, 0); // 2AM CDT = 7AM UTC
  const ts = now.getTime();
  const isDST = ts >= cdtStart && ts < cstStart;
  return isDST ? -5 * 3600 : -6 * 3600;
}

/** Returns the unix timestamp (seconds) for the start of "today" in Central Time. */
function getCentralTodayStartSec(): number {
  const offsetSec = getCentralOffsetSec();
  const nowSec = Math.floor(Date.now() / 1000);
  // Current time in CT seconds since epoch
  const ctNowSec = nowSec + offsetSec;
  // Start of CT day, then convert back to UTC
  const ctDayStartSec = ctNowSec - (ctNowSec % 86400);
  return ctDayStartSec - offsetSec;
}

// Derive a stable, daily-rotating visitor hash from IP + UA + salt.
// Cookieless and non-persistent: the same visitor on the same UTC day produces
// the same hash; on the next day they get a new one (rolling unique count).
async function deriveVisitorHash(ip: string, ua: string, salt: string): Promise<string> {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const data = new TextEncoder().encode(`${dateKey}|${salt}|${ip}|${ua}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return `v_${hex.slice(0, 32)}`;
}

// ─── Public: record a page view ───────────────────────────────────────────────
analyticsRoutes.post('/pageview', async (c) => {
  const db = c.env.DB;

  try {
    const body = await c.req.json<{
      path: string;
      referrer?: string;
      sessionId?: string;
      device?: string;
      browser?: string;
    }>();

    if (!body.path) {
      return c.json({ error: 'path is required' }, 400);
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

    // Visitor identity: prefer the client-supplied sessionId if present, else
    // derive a cookieless hash of (IP + UA + UTC day + salt). This lets us
    // count unique visitors without setting any client-side identifier — so
    // the metric works whether or not the user has consented to cookies.
    let sessionId = body.sessionId?.trim() || '';
    if (!sessionId) {
      const ip =
        c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        '0.0.0.0';
      const salt = c.env.ANALYTICS_SALT || 'fr-default-analytics-salt';
      sessionId = await deriveVisitorHash(ip, userAgent || '', salt);
    }

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
      sessionId,
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
    const centralOffsetSec = getCentralOffsetSec();
    const todayStartSec = getCentralTodayStartSec();
    const sevenDaysAgoSec = nowSec - 7 * 86400;
    const thirtyDaysAgoSec = nowSec - 30 * 86400;
    // SQLite offset string for Central Time (e.g. "-5 hours" or "-6 hours")
    const ctOffsetHours = centralOffsetSec / 3600;
    const sqlCtOffset = `${ctOffsetHours} hours`;

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

      // Views by day (last 30 days, Central Time)
      db.prepare(`
        SELECT DATE(created_at, 'unixepoch', '${sqlCtOffset}') as date,
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

      // Hourly breakdown today (Central Time)
      db.prepare(`
        SELECT CAST(strftime('%H', created_at, 'unixepoch', '${sqlCtOffset}') AS INTEGER) as hour,
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
