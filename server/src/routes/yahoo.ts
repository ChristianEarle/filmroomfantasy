import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

// Rate limits for Yahoo OAuth routes
const yahooAuthRateLimit = rateLimit(10, 15 * 60 * 1000); // 10 req/15min — OAuth initiation
const yahooCallbackRateLimit = rateLimit(10, 15 * 60 * 1000); // 10 req/15min — OAuth callback
const yahooReadRateLimit = rateLimit(30, 60 * 1000); // 30 req/min — API reads

export const yahooRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

// Generate a signed state parameter containing userId (stateless — no KV needed)
async function createOAuthState(userId: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: userId, purpose: 'yahoo_oauth' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

// Verify the state parameter and extract userId
async function verifyOAuthState(state: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(state, key);
  if (payload.purpose !== 'yahoo_oauth' || !payload.sub) {
    throw new Error('Invalid OAuth state');
  }
  return payload.sub;
}

// Refresh Yahoo access token using refresh token
async function refreshYahooToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yahoo token refresh failed: ${errText}`);
  }

  return res.json();
}

// Get a valid Yahoo access token for a user, refreshing if expired
async function getYahooToken(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>,
  user: schema.User,
  env: Env
): Promise<string> {
  if (!user.yahooAccessToken || !user.yahooRefreshToken) {
    throw new Error('Yahoo account not connected. Please connect your Yahoo account first.');
  }

  // Check if token is expired (with 5 minute buffer)
  const now = new Date();
  const expiresAt = user.yahooTokenExpiresAt;
  if (expiresAt && expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return user.yahooAccessToken;
  }

  if (!env.YAHOO_CLIENT_ID || !env.YAHOO_CLIENT_SECRET) {
    throw new Error('Yahoo OAuth is not configured');
  }

  // Refresh the token
  const tokens = await refreshYahooToken(
    user.yahooRefreshToken,
    env.YAHOO_CLIENT_ID,
    env.YAHOO_CLIENT_SECRET
  );

  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.update(schema.users).set({
    yahooAccessToken: tokens.access_token,
    yahooRefreshToken: tokens.refresh_token,
    yahooTokenExpiresAt: newExpiresAt,
    updatedAt: new Date(),
  }).where(eq(schema.users.id, user.id));

  return tokens.access_token;
}

// Make an authenticated Yahoo Fantasy API request
async function yahooApiFetch(accessToken: string, path: string): Promise<any> {
  const url = `${YAHOO_API_BASE}${path}${path.includes('?') ? '&' : '?'}format=json`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yahoo API error (${res.status}): ${errText}`);
  }

  return res.json();
}

// ============================================
// ROUTES
// ============================================

// Generate Yahoo OAuth authorization URL
yahooRoutes.post('/auth-url', yahooAuthRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  if (!c.env.YAHOO_CLIENT_ID || !c.env.YAHOO_CLIENT_SECRET) {
    return c.json({ error: 'Yahoo OAuth is not configured. Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET.' }, 500);
  }

  const state = await createOAuthState(user.id, c.env.JWT_SECRET);

  // Derive callback URL from the incoming request (works in any environment)
  const reqUrl = new URL(c.req.url);
  const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/yahoo/callback`;

  const params = new URLSearchParams({
    client_id: c.env.YAHOO_CLIENT_ID,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'fspt-r',
    state,
  });

  return c.json({ url: `${YAHOO_AUTH_URL}?${params.toString()}` });
});

// Handle Yahoo OAuth callback
yahooRoutes.get('/callback', yahooCallbackRateLimit, async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.html(getCallbackHtml(false, `Yahoo authorization failed: ${error}`));
  }

  if (!code || !state) {
    return c.html(getCallbackHtml(false, 'Missing authorization code or state'));
  }

  // Verify state to get userId
  let userId: string;
  try {
    userId = await verifyOAuthState(state, c.env.JWT_SECRET);
  } catch {
    return c.html(getCallbackHtml(false, 'Invalid or expired authorization state. Please try again.'));
  }

  // Exchange code for tokens — derive callback URL from the incoming request
  const reqUrl = new URL(c.req.url);
  const callbackUrl = `${reqUrl.protocol}//${reqUrl.host}/api/yahoo/callback`;

  const credentials = btoa(`${c.env.YAHOO_CLIENT_ID}:${c.env.YAHOO_CLIENT_SECRET}`);

  const tokenRes = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Yahoo token exchange failed:', errText);
    return c.html(getCallbackHtml(false, 'Failed to exchange authorization code'));
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  // Store tokens on the user
  const db = c.get('db');
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db.update(schema.users).set({
    yahooAccessToken: tokens.access_token,
    yahooRefreshToken: tokens.refresh_token,
    yahooTokenExpiresAt: expiresAt,
    updatedAt: new Date(),
  }).where(eq(schema.users.id, userId));

  return c.html(getCallbackHtml(true));
});

// Get user's Yahoo Fantasy leagues
yahooRoutes.get('/leagues', yahooReadRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const db = c.get('db');

  // Re-fetch user to get latest tokens
  const freshUser = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
  });

  if (!freshUser?.yahooAccessToken) {
    return c.json({ error: 'Yahoo account not connected' }, 400);
  }

  try {
    const accessToken = await getYahooToken(db, freshUser, c.env);

    // Fetch user's NFL fantasy leagues
    const data = await yahooApiFetch(
      accessToken,
      '/users;use_login=1/games;game_keys=nfl/leagues'
    );

    // Parse Yahoo's nested response structure
    const leagues = parseYahooLeagues(data);

    return c.json({ leagues });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch Yahoo leagues';
    console.error('Yahoo leagues fetch error:', error);
    return c.json({ error: msg }, 500);
  }
});

// Disconnect Yahoo account
yahooRoutes.post('/disconnect', yahooAuthRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const db = c.get('db');
  await db.update(schema.users).set({
    yahooAccessToken: null,
    yahooRefreshToken: null,
    yahooTokenExpiresAt: null,
    updatedAt: new Date(),
  }).where(eq(schema.users.id, user.id));

  return c.json({ success: true });
});

// ============================================
// HELPERS
// ============================================

// Parse Yahoo's deeply nested league response into flat objects
function parseYahooLeagues(data: any): Array<{
  externalId: string;
  leagueKey: string;
  name: string;
  seasonYear: number;
  teamCount: number;
  scoringFormat: string;
  currentWeek: number;
}> {
  const leagues: any[] = [];

  try {
    // Yahoo response: fantasy_content.users[0].user[1].games[0].game[].leagues[0].league[]
    const users = data?.fantasy_content?.users;
    if (!users) return leagues;

    // users can be { "0": { user: [...] }, count: 1 }
    const userObj = users['0']?.user;
    if (!userObj) return leagues;

    // user is an array: [userInfo, { games: { ... } }]
    const games = userObj[1]?.games;
    if (!games) return leagues;

    // Iterate through games (NFL seasons)
    let gameIdx = 0;
    while (games[String(gameIdx)]) {
      const game = games[String(gameIdx)].game;
      if (!game) { gameIdx++; continue; }

      // game is [gameInfo, { leagues: { ... } }]
      const gameLeagues = game[1]?.leagues;
      if (!gameLeagues) { gameIdx++; continue; }

      let leagueIdx = 0;
      while (gameLeagues[String(leagueIdx)]) {
        const leagueArr = gameLeagues[String(leagueIdx)].league;
        if (leagueArr && leagueArr[0]) {
          const l = leagueArr[0];
          const leagueKey = l.league_key || '';
          // Extract league ID from key (e.g., "423.l.123456" -> "123456")
          const parts = leagueKey.split('.l.');
          const externalId = parts[1] || leagueKey;

          leagues.push({
            externalId,
            leagueKey,
            name: l.name || `Yahoo League`,
            seasonYear: parseInt(l.season) || new Date().getFullYear(),
            teamCount: parseInt(l.num_teams) || 12,
            scoringFormat: l.scoring_type === 'headpoint' ? 'ppr' : 'standard',
            currentWeek: parseInt(l.current_week) || 1,
          });
        }
        leagueIdx++;
      }
      gameIdx++;
    }
  } catch (e) {
    console.error('Error parsing Yahoo leagues response:', e);
  }

  return leagues;
}

// HTML page returned by the OAuth callback to close the popup
function getCallbackHtml(success: boolean, error?: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Yahoo Authorization</title></head>
<body style="background:#0f172a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <h2>${success ? 'Yahoo Connected!' : 'Connection Failed'}</h2>
  <p>${success ? 'You can close this window.' : (error || 'Unknown error')}</p>
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'yahoo_oauth', success: ${success}, error: ${error ? JSON.stringify(error) : 'null'} }, window.location.origin);
    setTimeout(() => window.close(), 1500);
  }
</script>
</body>
</html>`;
}

// Exported for use by leagues.ts sync
export { getYahooToken, yahooApiFetch };
