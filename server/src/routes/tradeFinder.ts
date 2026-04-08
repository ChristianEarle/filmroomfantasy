import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';
import {
  buildTeamNeeds,
  findTradeRecommendations,
  type TeamNeeds,
  type TradeRecommendation,
} from '../services/tradeFinder';
import type { LeagueSettings } from '../services/tradeContext';

const tradeFinderRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Finder endpoints are all AI-backed and relatively heavy. Tight rate limit.
tradeFinderRoutes.use('*', rateLimit(20, 60 * 1000));

// ── Safe cache accessor ─────────────────────────────────────────────
//
// `caches.default` is normally available in Cloudflare Workers, but
// grabbing it directly and calling methods on it can throw in certain
// runtime configurations (e.g. the edge preview, certain local wrangler
// modes, or when globals are shimmed). Wrap access so a cache miss
// NEVER blows up the route handler.

function getSafeCache(): Cache | null {
  try {
    const c = (caches as unknown as { default?: Cache })?.default;
    return c ?? null;
  } catch {
    return null;
  }
}

async function safeCacheMatch(
  cache: Cache | null,
  key: Request
): Promise<Response | null> {
  if (!cache) return null;
  try {
    const match = await cache.match(key);
    return match ?? null;
  } catch {
    return null;
  }
}

function safeCachePut(
  cache: Cache | null,
  key: Request,
  response: Response,
  executionCtx?: ExecutionContext
): void {
  if (!cache) return;
  try {
    const work = cache.put(key, response).catch(() => {
      /* swallow — caching is best-effort */
    });
    executionCtx?.waitUntil(work);
  } catch {
    // ignore cache failures entirely — they must never surface to users
  }
}

// ── Tier guard helper ────────────────────────────────────────────────

function requiresProOrElite(tier: string): boolean {
  return tier === 'pro' || tier === 'elite';
}

// ── POST /needs ──────────────────────────────────────────────────────
// AI-generated team needs assessment. Pro/Elite only.

interface NeedsBody {
  leagueId: string;
}

tradeFinderRoutes.post('/needs', authMiddleware, async (c) => {
  const anthropicKey = c.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return c.json({ error: 'Trade Finder is not configured.' }, 503);
  }

  const user = c.get('user');
  const db = c.get('db');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const tier = user.subscriptionTier || 'free';
  if (!requiresProOrElite(tier)) {
    return c.json(
      { error: 'Trade Finder requires a Pro or Elite subscription.', code: 'TIER_REQUIRED' },
      403
    );
  }

  let body: NeedsBody;
  try {
    body = await c.req.json<NeedsBody>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body.leagueId) return c.json({ error: 'leagueId required' }, 400);

  try {
    // Verify membership
    const membership = await db.query.leagueMembers.findFirst({
      where: and(
        eq(schema.leagueMembers.userId, user.id),
        eq(schema.leagueMembers.leagueId, body.leagueId)
      ),
    });
    if (!membership) return c.json({ error: 'Not a member of this league' }, 403);

    // Resolve user's team
    const allTeams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, body.leagueId),
    });
    let userTeam = null;
    if (membership.externalUsername) {
      userTeam = allTeams.find(
        (t) => t.externalOwnerId === membership.externalUsername
      );
    }
    if (!userTeam) userTeam = allTeams.find((t) => t.ownerId === user.id);
    if (!userTeam) return c.json({ error: 'No team found for user' }, 404);

    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, body.leagueId),
    });
    if (!league) return c.json({ error: 'League not found' }, 404);

    // Guard against leagues with no rostered players yet (pre-sync state)
    const anyRosterSpot = await db.query.rosterSpots.findFirst({
      where: eq(schema.rosterSpots.teamId, userTeam.id),
    });
    if (!anyRosterSpot) {
      return c.json(
        {
          error: 'No roster data for this league yet — sync the league first.',
          code: 'NO_ROSTER',
        },
        409
      );
    }

    // Cache key based on league + team + current week + day (rebuilt each day)
    const todayKey = new Date().toISOString().slice(0, 10);
    const cacheKey = new Request(
      `https://cache.local/trade-finder/needs/${league.id}/${userTeam.id}/${league.currentWeek}/${todayKey}`
    );
    const cache = getSafeCache();

    const cached = await safeCacheMatch(cache, cacheKey);
    if (cached) {
      try {
        const data = (await cached.json()) as { needs: TeamNeeds };
        return c.json(data);
      } catch {
        // cached body was malformed — fall through and rebuild
      }
    }

    const leagueSettings: LeagueSettings = {
      scoringFormat:
        (league.scoringFormat as LeagueSettings['scoringFormat']) || 'ppr',
      superflex: league.hasSuperflex ?? false,
      tePremium: league.hasTePremium ?? false,
      teamCount: league.teamCount,
    };

    const needs = await buildTeamNeeds(
      db,
      anthropicKey,
      league.id,
      userTeam.id,
      leagueSettings,
      league.seasonYear,
      league.currentWeek
    );

    if (!needs) {
      return c.json({ error: 'Needs assessment failed' }, 502);
    }

    // Store in cache (10 min TTL) — best effort, never blocks the response
    const response = new Response(JSON.stringify({ needs }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=600',
      },
    });
    safeCachePut(cache, cacheKey, response.clone(), c.executionCtx);

    return c.json({ needs });
  } catch (err) {
    const requestId = c.get('requestId') || 'unknown';
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[${requestId}] /trade-finder/needs failed:`, msg, stack);
    return c.json(
      {
        error: 'Failed to build team needs.',
        requestId,
        detail: c.env.ENVIRONMENT === 'development' ? msg : undefined,
      },
      502
    );
  }
});

// ── POST /recommendations ────────────────────────────────────────────

interface RecommendationsBody {
  leagueId: string;
  targetPosition?: string;
  targetTeamId?: string;
  leagueSettings?: Partial<LeagueSettings>;
  /** Optional: restrict the user's send-side candidate pool to these
   *  player ids (must be on their roster). */
  userPlayerIds?: string[];
  /** Optional: draft picks the user is willing to throw in. Attached
   *  to every surviving candidate. */
  userPicks?: Array<{ year: number; round: number }>;
}

tradeFinderRoutes.post('/recommendations', authMiddleware, async (c) => {
  const anthropicKey = c.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return c.json({ error: 'Trade Finder is not configured.' }, 503);
  }

  const user = c.get('user');
  const db = c.get('db');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const tier = user.subscriptionTier || 'free';
  if (!requiresProOrElite(tier)) {
    return c.json(
      { error: 'Trade Finder requires a Pro or Elite subscription.', code: 'TIER_REQUIRED' },
      403
    );
  }

  let body: RecommendationsBody;
  try {
    body = await c.req.json<RecommendationsBody>();
  } catch {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  if (!body.leagueId) return c.json({ error: 'leagueId required' }, 400);

  try {
    // Membership + team resolution (same as /needs)
    const membership = await db.query.leagueMembers.findFirst({
      where: and(
        eq(schema.leagueMembers.userId, user.id),
        eq(schema.leagueMembers.leagueId, body.leagueId)
      ),
    });
    if (!membership) return c.json({ error: 'Not a member of this league' }, 403);

    const allTeams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, body.leagueId),
    });
    let userTeam = null;
    if (membership.externalUsername) {
      userTeam = allTeams.find(
        (t) => t.externalOwnerId === membership.externalUsername
      );
    }
    if (!userTeam) userTeam = allTeams.find((t) => t.ownerId === user.id);
    if (!userTeam) return c.json({ error: 'No team found for user' }, 404);

    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, body.leagueId),
      columns: {
        id: true,
        seasonYear: true,
        currentWeek: true,
        scoringFormat: true,
        teamCount: true,
        hasSuperflex: true,
        hasTePremium: true,
      },
    });
    if (!league) return c.json({ error: 'League not found' }, 404);

    // Cache key: per (league, user team, filters, week, day). Include
    // the asset filter in the key so different "must-include" sets don't
    // collide with each other.
    const todayKey = new Date().toISOString().slice(0, 10);
    const sortedPlayerIds = [...(body.userPlayerIds ?? [])].sort();
    const sortedPicks = [...(body.userPicks ?? [])]
      .map((p) => `${p.year}-${p.round}`)
      .sort();
    const assetKey =
      sortedPlayerIds.length === 0 && sortedPicks.length === 0
        ? 'any'
        : `p[${sortedPlayerIds.join(',')}]|pk[${sortedPicks.join(',')}]`;
    const filterKey = `${body.targetPosition || 'any'}-${body.targetTeamId || 'any'}-${assetKey}`;
    const cacheKey = new Request(
      `https://cache.local/trade-finder/recs/${league.id}/${userTeam.id}/${league.currentWeek}/${filterKey}/${todayKey}`
    );
    const cache = getSafeCache();

    const cached = await safeCacheMatch(cache, cacheKey);
    if (cached) {
      try {
        const data = (await cached.json()) as {
          recommendations: TradeRecommendation[];
        };
        return c.json(data);
      } catch {
        // malformed — rebuild
      }
    }

    const mergedLeagueSettings: LeagueSettings = {
      scoringFormat:
        body.leagueSettings?.scoringFormat ??
        ((league.scoringFormat as LeagueSettings['scoringFormat']) || 'ppr'),
      superflex: body.leagueSettings?.superflex ?? league.hasSuperflex ?? false,
      tePremium: body.leagueSettings?.tePremium ?? league.hasTePremium ?? false,
      teamCount: body.leagueSettings?.teamCount ?? league.teamCount,
    };

    const recommendations = await findTradeRecommendations({
      db,
      anthropicKey,
      leagueId: league.id,
      userTeamId: userTeam.id,
      leagueSettings: mergedLeagueSettings,
      seasonYear: league.seasonYear,
      currentWeek: league.currentWeek,
      targetPosition: body.targetPosition ?? null,
      targetTeamId: body.targetTeamId ?? null,
      maxRecommendations: 8,
      userPlayerIds: body.userPlayerIds ?? null,
      userPicks: body.userPicks ?? null,
    });

    const response = new Response(JSON.stringify({ recommendations }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=600',
      },
    });
    safeCachePut(cache, cacheKey, response.clone(), c.executionCtx);

    return c.json({ recommendations });
  } catch (err) {
    const requestId = c.get('requestId') || 'unknown';
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[${requestId}] /trade-finder/recommendations failed:`, msg, stack);
    return c.json(
      {
        error: 'Failed to build trade recommendations.',
        requestId,
        detail: c.env.ENVIRONMENT === 'development' ? msg : undefined,
      },
      502
    );
  }
});

// Avoid unused import warning
void desc;

export { tradeFinderRoutes };
