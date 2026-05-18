// Backend proxy for external fantasy platform APIs (Sleeper, ESPN, MFL).
//
// Why: prior to this, the frontend hit api.sleeper.app, lm-api-reads.fantasy.espn.com,
// and api.myfantasyleague.com directly from the browser. Any CORS policy change,
// ad-blocker false positive, browser extension, or mixed-content issue surfaced
// as a generic "Failed to fetch" — and we had no way to investigate or recover.
// Routing through our own origin removes that whole class of failures.
//
// Each route is a thin pass-through: auth-gated + rate-limited, 10s upstream
// timeout, transparent status code translation. No response caching yet —
// add when usage justifies it.

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

// 30 req/min per IP across all platform proxy endpoints. Generous enough for
// the normal connect flow (lookup → list leagues → fetch league details) but
// caps abuse if someone treats this as a free Sleeper proxy.
const platformRateLimit = rateLimit(30, 60 * 1000);

export const platformProxyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
platformProxyRoutes.use('*', platformRateLimit, authMiddleware);

const UPSTREAM_TIMEOUT_MS = 10_000;

// Map an upstream HTTP status to the status we return to the browser.
// 404 → 404, anything 5xx (including network errors) → 502 so the client
// can distinguish "doesn't exist" from "platform is down".
function mapUpstreamStatus(status: number): number {
  if (status === 404) return 404;
  if (status === 401 || status === 403) return status;
  if (status >= 500) return 502;
  if (status >= 400) return 502; // upstream client errors aren't user-actionable
  return status;
}

async function fetchUpstream(url: string): Promise<{ ok: true; data: unknown } | { ok: false; status: number; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'filmroomfantasy/1.0' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: mapUpstreamStatus(res.status), message: body.slice(0, 200) || `Upstream returned ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      status: isAbort ? 504 : 502,
      message: isAbort ? 'Upstream timed out' : (err instanceof Error ? err.message : 'Upstream fetch failed'),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Limits keep path params from being abused as SSRF vectors. Sleeper user_ids
// are numeric strings, usernames are short alphanumeric; ESPN/MFL league IDs
// are numeric. 64 chars is generous enough for any legitimate value.
// `..` is rejected explicitly: the WHATWG URL constructor normalizes `..`
// segments when fetch parses the URL, so an input like ".." would silently
// rewrite the upstream path. Not a security hole (base URLs are hardcoded,
// upstream is public read-only), but it surfaces as confusing 404s.
function isSafeIdent(s: string | undefined, maxLen = 64): s is string {
  if (!s || s.length === 0 || s.length > maxLen) return false;
  if (s.includes('..')) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(s);
}

// ============================================
// SLEEPER
// ============================================

// Look up a Sleeper user by username.
platformProxyRoutes.get('/sleeper/user/:username', async (c) => {
  const username = c.req.param('username');
  if (!isSafeIdent(username, 32)) return c.json({ error: 'Invalid username' }, 400);

  const result = await fetchUpstream(`https://api.sleeper.app/v1/user/${encodeURIComponent(username)}`);
  if (!result.ok) {
    if (result.status === 404) return c.json({ error: 'User not found' }, 404);
    return c.json({ error: `Sleeper unavailable: ${result.message}` }, result.status as 502 | 504);
  }
  return c.json(result.data);
});

// Fetch all NFL leagues for a Sleeper user across the last 3 seasons. Combined
// server-side so the browser makes one request instead of three. Per-season
// failures are tolerated as long as at least one season returns data — the
// caller sees "no leagues" only when every season legitimately had none.
platformProxyRoutes.get('/sleeper/user/:userId/leagues', async (c) => {
  const userId = c.req.param('userId');
  if (!isSafeIdent(userId, 32)) return c.json({ error: 'Invalid user id' }, 400);

  const currentYear = new Date().getFullYear();
  const seasons = [currentYear, currentYear - 1, currentYear - 2];

  const results = await Promise.allSettled(
    seasons.map(s => fetchUpstream(`https://api.sleeper.app/v1/user/${encodeURIComponent(userId)}/leagues/nfl/${s}`))
  );

  const successes: unknown[] = [];
  let allFailed = true;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) {
      allFailed = false;
      const arr = Array.isArray(r.value.data) ? r.value.data : [];
      successes.push(...arr);
    } else if (r.status === 'fulfilled' && !r.value.ok && r.value.status === 404) {
      // 404 on a season means no leagues that year — that's a successful "empty" response.
      allFailed = false;
    }
  }

  if (allFailed) {
    return c.json({ error: 'Sleeper unavailable for all seasons' }, 502);
  }

  // Dedupe by league_id in case Sleeper returns the same league across years.
  const seen = new Set<string>();
  const leagues = [];
  for (const l of successes as any[]) {
    const id = l?.league_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    leagues.push(l);
  }
  return c.json(leagues);
});

// Look up a single Sleeper league by ID.
platformProxyRoutes.get('/sleeper/league/:leagueId', async (c) => {
  const leagueId = c.req.param('leagueId');
  if (!isSafeIdent(leagueId, 32)) return c.json({ error: 'Invalid league id' }, 400);

  const result = await fetchUpstream(`https://api.sleeper.app/v1/league/${encodeURIComponent(leagueId)}`);
  if (!result.ok) {
    if (result.status === 404) return c.json({ error: 'League not found' }, 404);
    return c.json({ error: `Sleeper unavailable: ${result.message}` }, result.status as 502 | 504);
  }
  return c.json(result.data);
});

// ============================================
// ESPN
// ============================================

// Public-league read. Private leagues (which require SWID + ESPN_S2 cookies)
// surface as 401/403 — pass through so the UI can show the right error.
platformProxyRoutes.get('/espn/league/:leagueId', async (c) => {
  const leagueId = c.req.param('leagueId');
  if (!isSafeIdent(leagueId, 32)) return c.json({ error: 'Invalid league id' }, 400);

  const yearParam = c.req.query('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return c.json({ error: 'Invalid year' }, 400);
  }

  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${encodeURIComponent(leagueId)}?view=mSettings`;
  const result = await fetchUpstream(url);
  if (!result.ok) {
    if (result.status === 404) return c.json({ error: 'League not found' }, 404);
    if (result.status === 401 || result.status === 403) {
      return c.json({ error: 'ESPN league is private. Make it public in ESPN settings.', code: 'ESPN_PRIVATE' }, 403);
    }
    return c.json({ error: `ESPN unavailable: ${result.message}` }, result.status as 502 | 504);
  }
  return c.json(result.data);
});

// ============================================
// MFL
// ============================================

platformProxyRoutes.get('/mfl/league/:leagueId', async (c) => {
  const leagueId = c.req.param('leagueId');
  if (!isSafeIdent(leagueId, 32)) return c.json({ error: 'Invalid league id' }, 400);

  const yearParam = c.req.query('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return c.json({ error: 'Invalid year' }, 400);
  }

  const url = `https://api.myfantasyleague.com/${year}/export?TYPE=league&L=${encodeURIComponent(leagueId)}&JSON=1`;
  const result = await fetchUpstream(url);
  if (!result.ok) {
    if (result.status === 404) return c.json({ error: 'League not found' }, 404);
    return c.json({ error: `MFL unavailable: ${result.message}` }, result.status as 502 | 504);
  }
  return c.json(result.data);
});
