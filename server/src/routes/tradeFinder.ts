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

  // Cache key based on league + team + current week + day (rebuilt each day)
  const todayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = new Request(
    `https://cache.local/trade-finder/needs/${league.id}/${userTeam.id}/${league.currentWeek}/${todayKey}`
  );
  const cache = (caches as CacheStorage & { default: Cache }).default;

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = (await cached.json()) as { needs: TeamNeeds };
      return c.json(data);
    }
  } catch {
    // cache miss/unavailable — continue
  }

  const leagueSettings: LeagueSettings = {
    scoringFormat:
      (league.scoringFormat as LeagueSettings['scoringFormat']) || 'ppr',
    superflex: false,
    tePremium: false,
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

  // Store in cache (10 min TTL)
  try {
    const response = new Response(JSON.stringify({ needs }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=600',
      },
    });
    c.executionCtx?.waitUntil(cache.put(cacheKey, response.clone()));
  } catch {
    // ignore cache failures
  }

  return c.json({ needs });
});

// ── POST /recommendations ────────────────────────────────────────────

interface RecommendationsBody {
  leagueId: string;
  targetPosition?: string;
  targetTeamId?: string;
  leagueSettings?: Partial<LeagueSettings>;
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
    },
  });
  if (!league) return c.json({ error: 'League not found' }, 404);

  // Cache key: per (league, user team, filters, week, day)
  const todayKey = new Date().toISOString().slice(0, 10);
  const filterKey = `${body.targetPosition || 'any'}-${body.targetTeamId || 'any'}`;
  const cacheKey = new Request(
    `https://cache.local/trade-finder/recs/${league.id}/${userTeam.id}/${league.currentWeek}/${filterKey}/${todayKey}`
  );
  const cache = (caches as CacheStorage & { default: Cache }).default;

  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = (await cached.json()) as {
        recommendations: TradeRecommendation[];
      };
      return c.json(data);
    }
  } catch {
    // cache miss
  }

  const mergedLeagueSettings: LeagueSettings = {
    scoringFormat:
      body.leagueSettings?.scoringFormat ??
      ((league.scoringFormat as LeagueSettings['scoringFormat']) || 'ppr'),
    superflex: body.leagueSettings?.superflex ?? false,
    tePremium: body.leagueSettings?.tePremium ?? false,
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
  });

  // Store in cache (10 min TTL)
  try {
    const response = new Response(JSON.stringify({ recommendations }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=600',
      },
    });
    c.executionCtx?.waitUntil(cache.put(cacheKey, response.clone()));
  } catch {
    // ignore cache failures
  }

  return c.json({ recommendations });
});

// Avoid unused import warning
void desc;

export { tradeFinderRoutes };
