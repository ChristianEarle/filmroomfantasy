import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { resolveSessionUser } from '../utils/sessionUser';
import type { Env, Variables } from '../index';

export const adminStatsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── Central Time helpers ────────────────────────────────────────────────────
/** Returns the current US Central Time UTC offset in seconds (-6h CST or -5h CDT). */
function getCentralOffsetSec(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const mar1Day = new Date(Date.UTC(year, 2, 1)).getUTCDay();
  const marFirstSun = mar1Day === 0 ? 1 : 1 + (7 - mar1Day);
  const marSecondSun = marFirstSun + 7;
  const cdtStart = Date.UTC(year, 2, marSecondSun, 8, 0, 0);
  const nov1Day = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const novFirstSun = nov1Day === 0 ? 1 : 1 + (7 - nov1Day);
  const cstStart = Date.UTC(year, 10, novFirstSun, 7, 0, 0);
  const ts = now.getTime();
  const isDST = ts >= cdtStart && ts < cstStart;
  return isDST ? -5 * 3600 : -6 * 3600;
}

/** Returns the unix timestamp (seconds) for the start of "today" in Central Time. */
function getCentralTodayStartSec(): number {
  const offsetSec = getCentralOffsetSec();
  const nowSec = Math.floor(Date.now() / 1000);
  const ctNowSec = nowSec + offsetSec;
  const ctDayStartSec = ctNowSec - (ctNowSec % 86400);
  return ctDayStartSec - offsetSec;
}

// CORS middleware for admin stats — restrict to known admin dashboard origins
adminStatsRoutes.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  // Only reflect origin for trusted admin dashboard origins; deny others
  const allowedAdminOrigins = [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173',
    'https://filmroomfantasy.com', 'https://www.filmroomfantasy.com',
  ];
  const allowedOrigin = origin && allowedAdminOrigins.includes(origin) ? origin : allowedAdminOrigins[0];
  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// Dual auth: X-Admin-Key (dashboard) or JWT admin user (app UI)
adminStatsRoutes.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  // Try to extract user from JWT if present
  const { getCookie } = await import('hono/cookie');
  const cookieToken = getCookie(c, 'auth_token');
  const authHeader = c.req.header('Authorization');
  const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  if (token) {
    // Verify JWT *and* the session row so revoked sessions lose admin access.
    const user = await resolveSessionUser(token, c.get('db'), c.env.JWT_SECRET);
    if (user) c.set('user', user);
  }

  await adminAuthMiddleware(c, next);
});

adminStatsRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    const totalUsers = await db.prepare('SELECT COUNT(*) as count FROM users').first();

    const nowMs = Date.now();
    const startOfTodaySec = getCentralTodayStartSec();
    const ctOffsetHours = getCentralOffsetSec() / 3600;
    const sqlCtOffset = `${ctOffsetHours} hours`;

    const todaySignups = await db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= ?"
    ).bind(startOfTodaySec).first();

    const fourteenDaysAgoSec = Math.floor((nowMs - 14 * 86400000) / 1000);
    const signupsByDay = await db.prepare(`
      SELECT DATE(created_at, 'unixepoch', '${sqlCtOffset}') as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ?
      GROUP BY DATE(created_at, 'unixepoch', '${sqlCtOffset}')
      ORDER BY date ASC
    `).bind(fourteenDaysAgoSec).all();

    const authBreakdown = await db.prepare(`
      SELECT
        SUM(CASE WHEN google_id IS NOT NULL THEN 1 ELSE 0 END) as google,
        SUM(CASE WHEN yahoo_access_token IS NOT NULL THEN 1 ELSE 0 END) as yahoo,
        SUM(CASE WHEN google_id IS NULL AND yahoo_access_token IS NULL THEN 1 ELSE 0 END) as email
      FROM users
    `).first();

    const tiers = await db.prepare(`
      SELECT subscription_tier, COUNT(*) as count
      FROM users
      GROUP BY subscription_tier
    `).all();

    const leagues = await db.prepare('SELECT COUNT(*) as count FROM league_members').first();

    const recentUsers = await db.prepare(`
      SELECT u.id, u.username, u.subscription_tier, u.created_at,
        CASE WHEN u.google_id IS NOT NULL THEN 1 ELSE 0 END as hasGoogle,
        CASE WHEN u.yahoo_access_token IS NOT NULL THEN 1 ELSE 0 END as hasYahoo,
        (SELECT COUNT(*) FROM league_members lm WHERE lm.user_id = u.id) as leagueCount
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 25
    `).all();

    return c.json({
      totalUsers: totalUsers?.count || 0,
      todaySignups: todaySignups?.count || 0,
      signupsByDay: signupsByDay?.results || [],
      authBreakdown: authBreakdown || { email: 0, google: 0, yahoo: 0 },
      tiers: tiers?.results || [],
      totalLeagues: leagues?.count || 0,
      recentUsers: recentUsers?.results || []
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return c.json(
      {
        error: 'Failed to fetch stats',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});
