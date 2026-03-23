import { Hono } from 'hono';
import type { Env, Variables } from '../index';

export const adminStatsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Admin auth middleware — requires SYNC_SECRET
adminStatsRoutes.use('*', async (c, next) => {
  const syncSecret = c.env.SYNC_SECRET;
  if (!syncSecret) {
    return c.json({ error: 'SYNC_SECRET not configured' }, 500);
  }
  const adminKey = c.req.header('X-Admin-Key');
  if (adminKey !== syncSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

adminStatsRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    const totalUsers = await db.prepare('SELECT COUNT(*) as count FROM users').first();

    const nowMs = Date.now();
    const startOfTodayMs = new Date(new Date().toISOString().split('T')[0]).getTime();
    const startOfTodaySec = Math.floor(startOfTodayMs / 1000);

    const todaySignups = await db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= ?"
    ).bind(startOfTodaySec).first();

    const fourteenDaysAgoSec = Math.floor((nowMs - 14 * 86400000) / 1000);
    const signupsByDay = await db.prepare(`
      SELECT DATE(created_at, 'unixepoch') as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ?
      GROUP BY DATE(created_at, 'unixepoch')
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
      SELECT u.id, u.username, u.email, u.subscription_tier, u.created_at,
        u.google_id, u.yahoo_access_token,
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
