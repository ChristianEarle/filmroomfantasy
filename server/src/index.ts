import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

// Import utilities
import { cleanupExpiredRateLimits } from './middleware/rateLimit';

// Import routes
import { authRoutes } from './routes/auth';
import { leagueRoutes } from './routes/leagues';
import { teamRoutes } from './routes/teams';
import { playerRoutes } from './routes/players';
import { matchupRoutes } from './routes/matchups';
import { gameRoutes } from './routes/games';
import { adminRoutes } from './routes/admin';
import { feedbackRoutes } from './routes/feedback';
import { yahooRoutes } from './routes/yahoo';
import { billingRoutes } from './routes/billing';
import { adminStatsRoutes } from './routes/admin-stats';
import { tradesRoutes } from './routes/trades';
import { rostersRoutes } from './routes/rosters';
import { tradeHistoryRoutes } from './routes/tradeHistory';
import { analyticsRoutes } from './routes/analytics';
import { articleRoutes } from './routes/articles';
import { draftRankingsRoutes } from './routes/draftRankings';
import { watchlistRoutes } from './routes/watchlist';
import { platformProxyRoutes } from './routes/platformProxy';

// Types
export type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  SYNC_SECRET?: string; // Optional: required for POST /api/admin/sync-players
  ODDS_API_KEY?: string; // Optional: The Odds API key for fetching NFL odds
  TWITTER_RSS_URLS?: string; // Comma-separated RSS URLs, e.g. https://nitter.net/AdamSchefter/rss
  OPENAI_API_KEY?: string; // Deprecated: was used for news filtering, now uses ANTHROPIC_API_KEY
  ANTHROPIC_API_KEY?: string; // For AI trade analysis and news relevance filtering (Claude API)
  GOOGLE_CLIENT_ID?: string; // Google OAuth client ID — get from https://console.cloud.google.com/apis/credentials
  YAHOO_CLIENT_ID?: string; // Yahoo OAuth client ID — get from https://developer.yahoo.com/apps/
  YAHOO_CLIENT_SECRET?: string; // Yahoo OAuth client secret
  // Optional explicit redirect_uri. Set this when the worker is reachable on
  // multiple hostnames (custom domain + workers.dev) but Yahoo's OAuth app only
  // whitelists one. If unset, the callback URL is derived from the incoming
  // request, which works fine in single-host deploys.
  YAHOO_REDIRECT_URI?: string;
  RESEND_API_KEY?: string; // Optional: Resend API key for password reset emails — get from https://resend.com
  APP_URL?: string; // Frontend URL for password reset links (defaults to http://localhost:5173)
  FEEDBACK_EMAIL?: string; // Optional: Email address to receive feedback notifications via Resend
  STRIPE_SECRET_KEY?: string; // Optional: Stripe secret key for billing
  STRIPE_WEBHOOK_SECRET?: string; // Optional: Stripe webhook signing secret
  ANALYTICS_SALT?: string; // Optional: per-deploy salt for cookieless visitor hashing in /analytics/pageview
};

export type Variables = {
  db: ReturnType<typeof drizzle<typeof schema>>;
  user?: schema.User;
  requestId: string;
};

// Create app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', logger());

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  if (c.env.ENVIRONMENT !== 'production') {
    console.log(`[${requestId}] ${c.req.method} ${c.req.path}`);
  }
  await next();
});

const allowedOrigins = [
  'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173',
  'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173',
];
app.use('*', cors({
  origin: (origin, _c) => {
    if (!origin) return allowedOrigins[0];
    if (allowedOrigins.includes(origin)) return origin;
    try {
      const { hostname } = new URL(origin);
      // Allow Cloudflare Pages/Workers domains (base domain + subdomains)
      if (
        hostname === 'filmroomfantasy.pages.dev' ||
        hostname.endsWith('.filmroomfantasy.pages.dev') ||
        hostname === 'filmroomfantasy.workers.dev' ||
        hostname.endsWith('.filmroomfantasy.workers.dev')
      ) return origin;
      // Allow custom production domains
      if (
        hostname === 'filmroomfantasy.com' ||
        hostname === 'www.filmroomfantasy.com' ||
        hostname === 'filmroom.app' ||
        hostname === 'www.filmroom.app'
      ) return origin;
    } catch {
      // Invalid URL — fall through to deny
    }
    return null as unknown as string;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  credentials: true,
}));

// Prevent CORS cache poisoning — always vary on Origin
app.use('*', async (c, next) => {
  await next();
  c.header('Vary', 'Origin');
});

// Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (c.env.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // Content Security Policy (report-only to identify violations before enforcing)
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://analytics.tiktok.com 'nonce-${nonce}'`,
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self' https://filmroom-api.earle2001.workers.dev https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com https://analytics.tiktok.com",
    "img-src 'self' data: https:",
    "frame-src https://googleads.g.doubleclick.net https://td.doubleclick.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  c.header('Content-Security-Policy-Report-Only', cspDirectives.join('; '));
});

// Environment validation middleware — warn on missing critical config
app.use('*', async (c, next) => {
  // Log warnings once per isolate for missing config (non-blocking)
  if (!(globalThis as any).__envChecked) {
    (globalThis as any).__envChecked = true;
    if (!c.env.JWT_SECRET) console.error('[startup] CRITICAL: JWT_SECRET not set — auth will fail');
    if (!c.env.DB) console.error('[startup] CRITICAL: DB (D1 binding) not configured');
    if (!c.env.SYNC_SECRET) console.warn('[startup] WARNING: SYNC_SECRET not set — admin endpoints unprotected');
    // APP_URL is used as postMessage targetOrigin for Yahoo OAuth callback.
    // If it's missing the popup falls back to '*' which works but is noisy in
    // browser security audits; if it's set to the wrong origin the message is
    // silently dropped and OAuth appears to hang.
    if (c.env.ENVIRONMENT === 'production' && !c.env.APP_URL) {
      console.warn('[startup] WARNING: APP_URL not set — Yahoo OAuth postMessage will target "*"');
    }
    if (c.env.APP_URL) {
      try {
        new URL(c.env.APP_URL);
      } catch {
        console.error('[startup] CRITICAL: APP_URL is not a valid URL:', c.env.APP_URL);
      }
    }
  }
  await next();
});

// Database middleware - attach drizzle instance to context
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set('db', db);
  await next();
});

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    name: 'FilmRoom Fantasy API',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/leagues', leagueRoutes);
app.route('/api/teams', teamRoutes);
app.route('/api/players', playerRoutes);
app.route('/api/matchups', matchupRoutes);
app.route('/api/games', gameRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/feedback', feedbackRoutes);
app.route('/api/yahoo', yahooRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/trades', tradesRoutes);
app.route('/api/trade-history', tradeHistoryRoutes);
app.route('/api/rosters', rostersRoutes);
app.route('/api/admin', adminStatsRoutes);
app.route('/api/analytics', analyticsRoutes);
app.route('/api/articles', articleRoutes);
app.route('/api/draft-rankings', draftRankingsRoutes);
app.route('/api/watchlist', watchlistRoutes);
// Proxy for external fantasy platform read APIs (Sleeper/ESPN/MFL).
// Routes browser-originated lookups through our own origin to avoid CORS,
// ad-blockers, and policy changes on upstream platforms.
app.route('/api', platformProxyRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404);
});

// Error handler — structured logging with endpoint context
app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  const endpoint = `${c.req.method} ${c.req.path}`;
  console.error(`[${requestId}] Unhandled error on ${endpoint}:`, err.message, err.stack);
  return c.json({
    error: 'Internal server error',
    requestId,
    message: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
  }, 500);
});

// Scheduled handler for Cloudflare Cron Triggers
// Uses app.fetch() to call existing admin endpoints internally
async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const baseUrl = 'http://localhost';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.SYNC_SECRET) headers['X-Admin-Key'] = env.SYNC_SECRET;

  const callSync = async (path: string, body?: object, retries = 1): Promise<boolean> => {
    const init: RequestInit = { method: 'POST', headers };
    if (body) init.body = JSON.stringify(body);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[cron] Retry ${attempt}/${retries} for ${path}`);
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
        const res = await app.fetch(new Request(`${baseUrl}${path}`, init), env, ctx);
        const data = await res.json() as Record<string, unknown>;
        if (res.ok) {
          console.log(`[cron] ${path}: ${data.message || 'done'}`);
          return true;
        }
        console.error(`[cron] ${path} returned ${res.status}: ${data.error || 'unknown error'}`);
      } catch (err) {
        console.error(`[cron] ${path} failed (attempt ${attempt + 1}):`, err);
      }
    }
    console.error(`[cron] ${path} FAILED after ${retries + 1} attempts — data may be stale`);
    return false;
  };

  // Clean up expired rate limit entries and revoked sessions on every cron run
  try {
    const deleted = await cleanupExpiredRateLimits(env.DB);
    if (deleted > 0) console.log(`[cron] Cleaned up ${deleted} expired rate limit entries`);

    // Clean up expired sessions. expires_at is stored as Unix seconds (Drizzle's
    // { mode: 'timestamp' }), so compare against seconds — NOT Date.now() which
    // returns milliseconds and would match every row, wiping all active sessions.
    const sessionResult = await env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at <= ?1'
    ).bind(Math.floor(Date.now() / 1000)).run();
    const sessionsDeleted = sessionResult.meta.changes ?? 0;
    if (sessionsDeleted > 0) console.log(`[cron] Cleaned up ${sessionsDeleted} expired sessions`);
  } catch (err) {
    console.error('[cron] Cleanup failed:', err);
  }

  if (event.cron === '0 12 * * *') {
    // Daily 6 AM CT (12 PM UTC): sync players, injury news, games
    await callSync('/api/admin/sync-players');
    await callSync('/api/admin/sync-news');
    await callSync('/api/admin/sync-games');
  } else if (event.cron === '0 */4 * * *') {
    // Every 4 hours: sync stats, projections, and odds for current week only (not all 18)
    // This keeps us within subrequest limits while keeping data fresh
    const db = drizzle(env.DB, { schema });
    const anyLeague = await db.query.leagues.findFirst({
      columns: { currentWeek: true },
      orderBy: (leagues, { desc }) => [desc(leagues.updatedAt)],
    });
    const currentWeek = anyLeague?.currentWeek || 1;

    // Sync stats for current week + previous week (for late-breaking plays)
    const previousWeek = Math.max(1, currentWeek - 1);
    const weeksToSync = currentWeek === previousWeek ? [currentWeek] : [previousWeek, currentWeek];

    await callSync('/api/admin/sync-stats', { weeks: weeksToSync });
    await callSync('/api/admin/sync-projections', { week: currentWeek });

    // Sync current odds during NFL season
    if (currentWeek <= 18) {
      await callSync('/api/admin/sync-odds');
    }
  } else if (event.cron === '0 */6 * * *') {
    // Every 6 hours: sync all news sources
    await callSync('/api/admin/sync-twitter-news');
    await callSync('/api/admin/sync-espn-news');
    await callSync('/api/admin/sync-rotowire-news');
  } else if (event.cron === '0 13 * * 1') {
    // Weekly Monday 8 AM EST (13:00 UTC): submit an Anthropic batch per
    // variant. Each single-variant submission runs in its own worker
    // invocation so it stays within CPU limits (building player contexts +
    // a 20k-token prompt for 4 variants in one shot exceeds the 30s CPU
    // cap). Batch pricing still applies (50% off) regardless of variant
    // count per batch.
    await callSync('/api/admin/generate-draft-rankings', { type: 'redraft', scoring: 'ppr' });
    await callSync('/api/admin/generate-draft-rankings', { type: 'redraft', scoring: 'half-ppr' });
    await callSync('/api/admin/generate-draft-rankings', { type: 'dynasty_rookie', scoring: 'ppr' });
    await callSync('/api/admin/generate-draft-rankings', { type: 'dynasty_rookie', scoring: 'half-ppr' });
  } else if (event.cron === '15 * * * *') {
    // Hourly: drain any ranking batches that have ended. Cheap no-op when
    // there are no pending batches.
    await callSync('/api/admin/process-ranking-batches');
  }
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
