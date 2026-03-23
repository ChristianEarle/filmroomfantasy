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

/**
 * GET /api/admin-stats/stats
 * Returns dashboard stats: user counts, signups over time, auth breakdown, tiers, recent users.
 */
adminStatsRoutes.get('/stats', async (c) => {
  const db = c.env.DB;

  try {
    const totalUsers = await db.prepare('SELECT COUNT(*) as count FROM users').first();

    const today = new Date().toISOString().split('T')[0];
    const todaySignups = await db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE DATE(createdAt) = ?"
    ).bind(today).first();

    const signupsByDay = await db.prepare(`
      SELECT DATE(createdAt) as date, COUNT(*) as count
      FROM users
      WHERE createdAt >= datetime('now', '-14 days')
      GROUP BY DATE(createdAt)
      ORDER BY date ASC
    `).all();

    const authBreakdown = await db.prepare(`
      SELECT
        SUM(CASE WHEN googleId IS NOT NULL THEN 1 ELSE 0 END) as google,
        SUM(CASE WHEN yahooAccessToken IS NOT NULL THEN 1 ELSE 0 END) as yahoo,
        SUM(CASE WHEN googleId IS NULL AND yahooAccessToken IS NULL THEN 1 ELSE 0 END) as email
      FROM users
    `).first();

    const tiers = await db.prepare(`
      SELECT subscriptionTier, COUNT(*) as count
      FROM users
      GROUP BY subscriptionTier
    `).all();

    const leagues = await db.prepare('SELECT COUNT(*) as count FROM league_members').first();

    const recentUsers = await db.prepare(`
      SELECT u.id, u.username, u.email, u.subscriptionTier, u.createdAt,
        u.googleId, u.yahooAccessToken,
        (SELECT COUNT(*) FROM league_members lm WHERE lm.userId = u.id) as leagueCount
      FROM users u
      ORDER BY u.createdAt DESC
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
