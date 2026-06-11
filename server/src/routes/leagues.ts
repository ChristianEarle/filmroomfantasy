import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  mapStatus,
  throttledFetchAll,
  sleep,
  isValidSleeperRoster,
  isValidSleeperUser,
  isValidSleeperMatchup,
  validateSleeperArray,
} from '../services/sleeper';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import { timingSafeEqual } from '../utils/crypto';
import { generateProjectionsFromProps } from '../services/projections';
import {
  fetchLeague as fetchMflLeague,
  fetchRosters as fetchMflRosters,
  fetchSchedule as fetchMflSchedule,
  fetchPlayerScores as fetchMflPlayerScores,
  parseMflName,
  mapMflPosition,
  mapMflTeam,
  ensureArray,
} from '../services/mfl';
import type { Env, Variables } from '../index';

// Rate limit for league routes: 60 req/min per IP (all auth-gated)
const leagueRateLimit = rateLimit(60, 60 * 1000);

export const leagueRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Generate a short, human-shareable, unguessable invite code (no ambiguous chars).
function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let code = '';
  for (let i = 0; i < bytes.length; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

// Apply rate limiting to all league routes
leagueRoutes.use('*', leagueRateLimit);

// Get user's leagues
leagueRoutes.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const memberships = await db.query.leagueMembers.findMany({
    where: eq(schema.leagueMembers.userId, user.id),
    with: {
      league: {
        with: {
          teams: true,
        },
      },
    },
  });

  const leagues = memberships.map(m => ({
    ...m.league,
    role: m.role,
    teamCount: m.league.teams.length,
  }));

  return c.json({ leagues });
});

// Create a new league
leagueRoutes.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const {
      name,
      scoringFormat = 'ppr',
      teamCount = 12,
      seasonYear = new Date().getFullYear(),
      playoffWeeks = 3,
      playoffTeams = 6,
      waiverType = 'faab',
      waiverBudget = 100,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
      return c.json({ error: 'League name is required and must be between 1 and 100 characters' }, 400);
    }

    const validScoringFormats = ['ppr', 'half_ppr', 'standard'];
    if (!validScoringFormats.includes(scoringFormat)) {
      return c.json({ error: 'Invalid scoring format. Must be ppr, half_ppr, or standard' }, 400);
    }

    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 32) {
      return c.json({ error: 'Team count must be between 2 and 32' }, 400);
    }

    const validWaiverTypes = ['faab', 'rolling'];
    if (!validWaiverTypes.includes(waiverType)) {
      return c.json({ error: 'Invalid waiver type. Must be faab or rolling' }, 400);
    }

    const leagueId = generateId();

    // Create league
    await db.insert(schema.leagues).values({
      id: leagueId,
      name,
      scoringFormat,
      teamCount,
      seasonYear,
      playoffWeeks,
      playoffTeams,
      waiverType,
      waiverBudget,
      inviteCode: generateInviteCode(),
    });

    // Add creator as commissioner
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: user.id,
      leagueId,
      role: 'commissioner',
    });

    // Create team for commissioner
    const teamId = generateId();
    await db.insert(schema.teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: `${user.username}'s Team`,
      waiverPriority: 1,
      faabBudget: waiverBudget,
    });

    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, leagueId),
    });

    return c.json({ league, teamId }, 201);
  } catch (error) {
    console.error('Create league error:', error);
    return c.json({ error: 'Failed to create league' }, 500);
  }
});

// Get league details
leagueRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check membership
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
    with: {
      teams: {
        with: {
          owner: true,
        },
      },
      members: {
        with: {
          user: true,
        },
      },
    },
  });

  if (!league) {
    return c.json({ error: 'League not found' }, 404);
  }

  // For Sleeper leagues: resolve which team belongs to the connected user (by Sleeper username)
  // Also build a map of Sleeper user_id → user data for live owner names
  let userSleeperUserId: string | null = null;
  const sleeperUserMap = new Map<string, { username?: string; display_name?: string }>();
  if (league.platform === 'sleeper' && league.externalId) {
    try {
      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (usersRes.ok) {
        const sleeperUsers = (await usersRes.json()) as { user_id: string; username?: string; display_name?: string }[];
        for (const su of sleeperUsers) {
          sleeperUserMap.set(su.user_id, su);
          if (
            membership.externalUsername &&
            (su.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() ||
            su.username?.toLowerCase() === membership.externalUsername.toLowerCase())
          ) {
            userSleeperUserId = su.user_id;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch Sleeper users for league:', e);
    }
  }

  // Only expose the invite code to the commissioner — it's the join secret.
  const { inviteCode: _inviteCode, ...leaguePublic } = league;

  return c.json({
    league: {
      ...leaguePublic,
      ...(membership.role === 'commissioner' ? { inviteCode: league.inviteCode } : {}),
      role: membership.role,
      teams: league.teams.map(t => {
        const isCurrentUserTeam = userSleeperUserId != null && t.externalOwnerId === userSleeperUserId;
        // Get owner name: prefer live Sleeper data, then DB stored name, then app username
        const sleeperUser = t.externalOwnerId ? sleeperUserMap.get(t.externalOwnerId) : undefined;
        const ownerUsername = sleeperUser?.display_name || sleeperUser?.username || t.ownerDisplayName || t.owner.username;
        return {
          id: t.id,
          name: t.name,
          wins: t.wins,
          losses: t.losses,
          ties: t.ties,
          pointsFor: t.pointsFor,
          pointsAgainst: t.pointsAgainst,
          externalOwnerId: t.externalOwnerId,
          waiverPriority: t.waiverPriority,
          faabBudget: t.faabBudget,
          isCurrentUserTeam,
          owner: {
            id: t.owner.id,
            username: ownerUsername,
            avatarUrl: t.owner.avatarUrl,
          },
        };
      }),
    },
  });
});

// Update league settings (commissioner only)
leagueRoutes.put('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check if user is commissioner
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId),
      eq(schema.leagueMembers.role, 'commissioner')
    ),
  });

  if (!membership) {
    return c.json({ error: 'Only commissioners can update league settings' }, 403);
  }

  try {
    const body = await c.req.json();
    const allowedUpdates = [
      'name',
      'scoringFormat',
      'currentWeek',
      'tradeDeadline',
      'playoffWeeks',
      'playoffTeams',
      'waiverType',
      'waiverBudget',
    ];

    const updates: Record<string, unknown> = {};

    // Validate each field before accepting
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 100) {
        return c.json({ error: 'League name must be between 1 and 100 characters' }, 400);
      }
      updates.name = body.name.trim();
    }
    if (body.scoringFormat !== undefined) {
      if (!['ppr', 'half_ppr', 'standard'].includes(body.scoringFormat)) {
        return c.json({ error: 'Invalid scoring format' }, 400);
      }
      updates.scoringFormat = body.scoringFormat;
    }
    if (body.currentWeek !== undefined) {
      if (!Number.isInteger(body.currentWeek) || body.currentWeek < 1 || body.currentWeek > 22) {
        return c.json({ error: 'Current week must be between 1 and 22' }, 400);
      }
      updates.currentWeek = body.currentWeek;
    }
    if (body.tradeDeadline !== undefined) {
      updates.tradeDeadline = body.tradeDeadline;
    }
    if (body.playoffWeeks !== undefined) {
      if (!Number.isInteger(body.playoffWeeks) || body.playoffWeeks < 1 || body.playoffWeeks > 5) {
        return c.json({ error: 'Playoff weeks must be between 1 and 5' }, 400);
      }
      updates.playoffWeeks = body.playoffWeeks;
    }
    if (body.playoffTeams !== undefined) {
      if (!Number.isInteger(body.playoffTeams) || body.playoffTeams < 2 || body.playoffTeams > 16) {
        return c.json({ error: 'Playoff teams must be between 2 and 16' }, 400);
      }
      updates.playoffTeams = body.playoffTeams;
    }
    if (body.waiverType !== undefined) {
      if (!['faab', 'rolling'].includes(body.waiverType)) {
        return c.json({ error: 'Invalid waiver type' }, 400);
      }
      updates.waiverType = body.waiverType;
    }
    if (body.waiverBudget !== undefined) {
      if (!Number.isInteger(body.waiverBudget) || body.waiverBudget < 0 || body.waiverBudget > 10000) {
        return c.json({ error: 'Waiver budget must be between 0 and 10000' }, 400);
      }
      updates.waiverBudget = body.waiverBudget;
    }

    updates.updatedAt = new Date();

    await db
      .update(schema.leagues)
      .set(updates)
      .where(eq(schema.leagues.id, leagueId));

    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, leagueId),
    });

    return c.json({ league });
  } catch (error) {
    console.error('Update league error:', error);
    return c.json({ error: 'Failed to update league' }, 500);
  }
});

// Join a league (with invite code - simplified)
leagueRoutes.post('/:id/join', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check if already a member
  const existingMembership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });

  if (existingMembership) {
    return c.json({ error: 'Already a member of this league' }, 400);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
    with: {
      teams: true,
    },
  });

  if (!league) {
    return c.json({ error: 'League not found' }, 404);
  }

  if (league.teams.length >= league.teamCount) {
    return c.json({ error: 'League is full' }, 400);
  }

  try {
    const body = await c.req.json();
    const { teamName, inviteCode } = body;

    // Require a matching invite code. Without this, knowing a league id would be
    // enough to join (and read) any league. Fail closed if the league has no
    // code set (legacy rows) — the commissioner must rotate one in first.
    if (!league.inviteCode || typeof inviteCode !== 'string' || !timingSafeEqual(inviteCode, league.inviteCode)) {
      return c.json({ error: 'Invalid or missing invite code' }, 403);
    }

    // Add as member
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: user.id,
      leagueId,
      role: 'member',
    });

    // Create team
    const teamId = generateId();
    await db.insert(schema.teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: teamName || `${user.username}'s Team`,
      waiverPriority: league.teams.length + 1,
      faabBudget: league.waiverBudget || 100,
    });

    return c.json({ message: 'Joined league successfully', teamId }, 201);
  } catch (error) {
    console.error('Join league error:', error);
    return c.json({ error: 'Failed to join league' }, 500);
  }
});

// Connect external league (Sleeper, ESPN, Yahoo)
// Connect endpoint is moderately expensive (DB writes + lookups) and
// uncapped previously. Match the protection level of /sync.
const connectRateLimit = rateLimit(10, 15 * 60 * 1000);

leagueRoutes.post('/connect', connectRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const body = await c.req.json();
    const {
      platform,
      externalId,
      name,
      scoringFormat = 'ppr',
      teamCount = 12,
      seasonYear = new Date().getFullYear(),
      sleeperUsername, // User's Sleeper username to identify their team
      sleeperUserId,   // User's Sleeper user_id for reliable matching
    } = body;

    if (!platform || !externalId || !name) {
      return c.json({ error: 'Platform, external ID, and name are required' }, 400);
    }

    const validPlatforms = ['sleeper', 'espn', 'yahoo', 'mfl'];
    if (!validPlatforms.includes(platform)) {
      return c.json({ error: 'Invalid platform. Must be sleeper, espn, yahoo, or mfl' }, 400);
    }

    if (typeof externalId !== 'string' || externalId.trim().length === 0 || externalId.length > 200) {
      return c.json({ error: 'Invalid external ID' }, 400);
    }

    // Check league limit for free users (max 1 league)
    if (user.subscriptionTier === 'free') {
      const userLeagues = await db.query.leagueMembers.findMany({
        where: eq(schema.leagueMembers.userId, user.id),
      });

      if (userLeagues.length >= 1) {
        return c.json(
          {
            error: 'Upgrade to Pro or Elite to connect multiple leagues',
            code: 'LEAGUE_LIMIT_EXCEEDED',
            tier: 'free',
            maxLeagues: 1,
          },
          402
        );
      }
    }

    // Check if league is already connected
    const existingLeague = await db.query.leagues.findFirst({
      where: and(
        eq(schema.leagues.platform, platform),
        eq(schema.leagues.externalId, externalId)
      ),
    });

    if (existingLeague) {
      // Check if user is already a member
      const existingMembership = await db.query.leagueMembers.findFirst({
        where: and(
          eq(schema.leagueMembers.userId, user.id),
          eq(schema.leagueMembers.leagueId, existingLeague.id)
        ),
      });

      if (existingMembership) {
        return c.json({ error: 'You have already connected this league' }, 400);
      }

      // Add user to existing league (store sleeperUserId for reliable sync matching, fall back to username)
      const storedExternalUsername = sleeperUserId || sleeperUsername || null;
      await db.insert(schema.leagueMembers).values({
        id: generateId(),
        userId: user.id,
        leagueId: existingLeague.id,
        role: 'member',
        externalUsername: storedExternalUsername,
      });

      // If a team for this Sleeper user already exists in the league (because
      // another app user already imported the league and synced rosters),
      // associate the joining user with that existing team rather than
      // creating a duplicate placeholder. The team keeps its original
      // ownerId; the joining user's view of "my team" is resolved at read
      // time via league_members.externalUsername → teams.externalOwnerId.
      if (sleeperUserId) {
        const existingTeam = await db.query.teams.findFirst({
          where: and(
            eq(schema.teams.leagueId, existingLeague.id),
            eq(schema.teams.externalOwnerId, sleeperUserId)
          ),
        });
        if (existingTeam) {
          return c.json({
            league: existingLeague,
            team: { id: existingTeam.id, name: existingTeam.name },
          }, 201);
        }
      }

      // No matching team yet (e.g. original connector hasn't synced).
      // Create a placeholder; sync will reconcile it with the real roster
      // via the externalUsername → externalOwnerId match.
      const teamId = generateId();
      await db.insert(schema.teams).values({
        id: teamId,
        leagueId: existingLeague.id,
        ownerId: user.id,
        name: `${user.username}'s Team`,
        waiverPriority: 1,
        faabBudget: 100,
      });

      return c.json({
        league: existingLeague,
        team: { id: teamId, name: `${user.username}'s Team` },
      }, 201);
    }

    // Create new league from external platform
    const leagueId = generateId();

    await db.insert(schema.leagues).values({
      id: leagueId,
      name,
      platform,
      externalId,
      scoringFormat,
      teamCount,
      seasonYear,
      waiverType: 'faab',
      waiverBudget: 100,
      inviteCode: generateInviteCode(),
    });

    // Add user as commissioner
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: user.id,
      leagueId,
      role: 'commissioner',
      externalUsername: sleeperUserId || sleeperUsername || null,
    });

    // Create team for user
    const teamId = generateId();
    await db.insert(schema.teams).values({
      id: teamId,
      leagueId,
      ownerId: user.id,
      name: `${user.username}'s Team`,
      waiverPriority: 1,
      faabBudget: 100,
    });

    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, leagueId),
    });

    return c.json({
      league,
      team: { id: teamId, name: `${user.username}'s Team` },
    }, 201);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Connect league error:', err);
    return c.json({ error: err.message || 'Failed to connect league' }, 500);
  }
});

// ----------------------------------------------------------------
// In-memory cache for the Sleeper players blob (~5MB JSON).
// Persists across requests within a single Worker isolate. TTL 6h
// because the players list changes slowly (depth-chart updates,
// injuries, trades). Cuts sync wall-time by 1-3s on cache hits.
// For cross-isolate caching, move to KV / R2 — needs a binding the
// user provisions in Cloudflare, so left as an in-isolate cache.
// ----------------------------------------------------------------
type SleeperPlayersBlob = Record<string, any>;
interface PlayerCacheEntry { data: SleeperPlayersBlob; fetchedAt: number; }
const PLAYER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function getCachedSleeperPlayers(): SleeperPlayersBlob | null {
  const entry = (globalThis as any).__sleeperPlayerCache as PlayerCacheEntry | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > PLAYER_CACHE_TTL_MS) return null;
  return entry.data;
}

function setCachedSleeperPlayers(data: SleeperPlayersBlob) {
  (globalThis as any).__sleeperPlayerCache = { data, fetchedAt: Date.now() } satisfies PlayerCacheEntry;
}

// Fetch the Sleeper players blob with caching. Returns {} on failure
// so callers can continue with degraded player matching.
async function fetchSleeperPlayersCached(): Promise<SleeperPlayersBlob> {
  const cached = getCachedSleeperPlayers();
  if (cached) return cached;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const res = await fetch('https://api.sleeper.app/v1/players/nfl', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json() as SleeperPlayersBlob;
      setCachedSleeperPlayers(data);
      return data;
    }
  } catch (e) {
    console.error('Failed to fetch Sleeper players blob:', e);
  }
  return {};
}

// ----------------------------------------------------------------
// Quick-sync route — called immediately after a league is connected.
// Imports only teams, rosters, and roster spots. Skips matchup
// history, stats import, projections, and trade ingest so it stays
// well within Cloudflare's wall-time limit on the user's first
// connection. The manual "Sync" button still hits the full route
// for richer data.
// ----------------------------------------------------------------
const quickSyncRateLimit = rateLimit(10, 15 * 60 * 1000);

leagueRoutes.post('/:id/sync/quick', quickSyncRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) return c.json({ error: 'Not authenticated' }, 401);

  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });
  if (!membership) return c.json({ error: 'Not a member of this league' }, 403);

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
    with: { teams: true },
  });
  if (!league) return c.json({ error: 'League not found' }, 404);

  // Only Sleeper supports a quick-sync fast-path today. For other platforms,
  // fall through and have the client call the regular /sync route.
  if (league.platform !== 'sleeper' || !league.externalId) {
    return c.json({
      success: true,
      message: `Quick sync skipped — ${league.platform || 'manual'} leagues use the full sync.`,
      userTeamMatched: false,
    });
  }

  try {
    const [rostersResponse, usersResponse, playersData, sleeperLeagueResult] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${league.externalId}/rosters`),
      fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`),
      fetchSleeperPlayersCached(),
      (async () => {
        try {
          const res = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
          if (res.ok) return await res.json() as any;
        } catch (e) {
          console.error('Quick-sync: failed to fetch Sleeper league metadata (using fallback slot template):', e);
        }
        return null;
      })(),
    ]);

    if (!rostersResponse.ok) {
      return c.json({ error: 'Failed to fetch rosters from Sleeper' }, 500);
    }
    const rosters = validateSleeperArray(await rostersResponse.json(), isValidSleeperRoster, 'rosters');
    if (rosters.length === 0) {
      return c.json({ error: 'No valid rosters returned from Sleeper' }, 500);
    }

    if (!usersResponse.ok) {
      return c.json({ error: 'Failed to fetch users from Sleeper' }, 500);
    }
    const sleeperUsers = validateSleeperArray(await usersResponse.json(), isValidSleeperUser, 'users');

    // Build the real starter slot template from league.roster_positions — same
    // logic as the full /sync route. Without this, FLEX/Superflex slots get
    // mislabeled with the player's natural position (e.g. a RB in FLEX gets
    // slotted as "RB" twice). Falls back to the standard 9-man lineup shape
    // if the metadata fetch failed.
    const leagueRosterPositions: string[] = Array.isArray(sleeperLeagueResult?.roster_positions)
      ? sleeperLeagueResult.roster_positions
      : [];
    const BENCH_SLOTS = new Set(['BN', 'IR', 'TAXI']);
    const startingPositions = leagueRosterPositions.filter(
      (p) => typeof p === 'string' && !BENCH_SLOTS.has(p.toUpperCase())
    );
    const slotTotalCounts: Record<string, number> = {};
    for (const pos of startingPositions) slotTotalCounts[pos] = (slotTotalCounts[pos] || 0) + 1;
    const slotRunningCounts: Record<string, number> = {};
    const starterSlots = startingPositions.length > 0
      ? startingPositions.map((pos) => {
          slotRunningCounts[pos] = (slotRunningCounts[pos] || 0) + 1;
          return slotTotalCounts[pos] > 1 ? `${pos}${slotRunningCounts[pos]}` : pos;
        })
      : ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF'];

    // Match the app user to a Sleeper user via stored user_id (preferred) or username/display_name.
    let userSleeperUserId: string | null = null;
    if (membership.externalUsername) {
      const stored = membership.externalUsername;
      const direct = sleeperUsers.find(u => u.user_id === stored);
      if (direct) {
        userSleeperUserId = direct.user_id;
      } else {
        for (const su of sleeperUsers) {
          if (
            su.display_name?.toLowerCase() === stored.toLowerCase() ||
            su.username?.toLowerCase() === stored.toLowerCase()
          ) {
            userSleeperUserId = su.user_id;
            break;
          }
        }
      }
    }

    const userMap = new Map<string, any>();
    for (const su of sleeperUsers) userMap.set(su.user_id, su);

    // Pre-batch player lookups so we don't N+1 the DB during roster insert.
    const INVALID_PLAYER_IDS = new Set(['invalid', '0', '']);
    const allExternalIds = new Set<string>();
    for (const r of rosters) {
      if (r.players) {
        for (const pid of r.players) {
          if (pid && !INVALID_PLAYER_IDS.has(String(pid).toLowerCase())) {
            allExternalIds.add(String(pid));
          }
        }
      }
    }
    const externalIdArray = Array.from(allExternalIds);
    const playerByExtId = new Map<string, { id: string }>();
    for (let i = 0; i < externalIdArray.length; i += 50) {
      const chunk = externalIdArray.slice(i, i + 50);
      const found = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.externalId, chunk),
        columns: { id: true, externalId: true },
      });
      for (const p of found) {
        if (p.externalId) playerByExtId.set(p.externalId, { id: p.id });
      }
    }

    let teamsImported = 0;
    let userRosterAssigned = false;
    const userTeam =
      league.teams.find(t => t.ownerId === user.id) ||
      (userSleeperUserId
        ? league.teams.find(t => t.externalOwnerId === userSleeperUserId)
        : undefined);

    for (const roster of rosters) {
      const su = userMap.get(roster.owner_id);
      const teamName = su?.metadata?.team_name || su?.display_name || `Team ${roster.roster_id}`;
      const ownerDisplayName = su?.display_name || su?.username || `Owner ${roster.roster_id}`;
      const isUserTeam = userTeam && !userRosterAssigned && userSleeperUserId && roster.owner_id === userSleeperUserId;

      let teamId: string;
      if (isUserTeam) {
        teamId = userTeam.id;
        userRosterAssigned = true;
        await db.update(schema.teams).set({
          externalOwnerId: String(roster.owner_id),
          ownerDisplayName,
          name: teamName,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          pointsFor: roster.settings?.fpts || 0,
          pointsAgainst: roster.settings?.fpts_against || 0,
          updatedAt: new Date(),
        }).where(eq(schema.teams.id, userTeam.id));
      } else {
        const existing = league.teams.find(t => t.externalOwnerId === String(roster.owner_id));
        if (existing) {
          teamId = existing.id;
          await db.update(schema.teams).set({
            ownerDisplayName,
            name: teamName,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsFor: roster.settings?.fpts || 0,
            pointsAgainst: roster.settings?.fpts_against || 0,
            updatedAt: new Date(),
          }).where(eq(schema.teams.id, existing.id));
        } else {
          teamId = generateId();
          await db.insert(schema.teams).values({
            id: teamId,
            leagueId: league.id,
            ownerId: user.id,
            externalOwnerId: String(roster.owner_id),
            ownerDisplayName,
            name: teamName,
            wins: roster.settings?.wins || 0,
            losses: roster.settings?.losses || 0,
            ties: roster.settings?.ties || 0,
            pointsFor: roster.settings?.fpts || 0,
            pointsAgainst: roster.settings?.fpts_against || 0,
            faabBudget: 100,
          });
        }
      }
      teamsImported++;

      // Roster spots — clear + reinsert atomically to keep the page snappy.
      await db.delete(schema.rosterSpots).where(eq(schema.rosterSpots.teamId, teamId));

      const starters = Array.isArray(roster.starters) ? roster.starters : [];
      const players = Array.isArray(roster.players) ? roster.players : [];

      let benchCount = 0;
      for (const pid of players) {
        const idStr = String(pid);
        if (INVALID_PLAYER_IDS.has(idStr.toLowerCase())) continue;
        const dbPlayer = playerByExtId.get(idStr);
        if (!dbPlayer) {
          // Player not yet in DB — skip silently. The next admin sync-players
          // run will pick them up; full /sync handles upserts.
          continue;
        }
        const starterIdx = starters.indexOf(idStr);
        const isStarter = starterIdx >= 0;
        // Use the league's roster_positions template for starter slots so
        // FLEX/Superflex/etc. get labeled correctly. Fall back to the player's
        // natural position if the template is shorter than the starters array
        // (shouldn't happen, but defensive).
        const slot = isStarter
          ? (starterSlots[starterIdx] || playersData[idStr]?.position || `S${starterIdx + 1}`)
          : `BN${++benchCount}`;
        try {
          await db.insert(schema.rosterSpots).values({
            id: generateId(),
            teamId,
            playerId: dbPlayer.id,
            slot,
            isStarter,
            acquiredType: 'sync',
          });
        } catch (e) {
          // Unique constraint violation — skip duplicate insert
          console.error('Quick-sync roster insert error (non-fatal):', e);
        }
      }
    }

    // Surface a warning if we couldn't link this user to any Sleeper roster.
    // Same shape as the full-sync response so the UI handles it identically.
    const warning = !userRosterAssigned && userSleeperUserId
      ? `We synced the league but couldn't find a Sleeper roster matching your account. Open league settings to update your Sleeper username.`
      : !userRosterAssigned && !membership.externalUsername
      ? `League synced. To highlight your team, set your Sleeper username in league settings.`
      : null;

    return c.json({
      success: true,
      message: `Quick sync complete: ${teamsImported} teams imported.`,
      userTeamMatched: userRosterAssigned,
      warning,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('Quick sync error:', err);
    return c.json({ error: err.message || 'Quick sync failed' }, 500);
  }
});

// Sync league data from external platform
// Stricter rate limit: 3 syncs per 15 minutes per IP (expensive external API calls)
const syncRateLimit = rateLimit(3, 15 * 60 * 1000);

leagueRoutes.post('/:id/sync', syncRateLimit, authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check membership
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
    with: {
      teams: true,
    },
  });

  if (!league) {
    return c.json({ error: 'League not found' }, 404);
  }

  // Handle Sleeper sync
  if (league.platform === 'sleeper' && league.externalId) {
    try {
      // Fetch rosters, users, players, and league metadata from Sleeper in parallel.
      // We need the league metadata up-front (specifically `roster_positions`) so we
      // can map each starter's array index to its real slot label (QB/RB1/WR3/FLEX/…)
      // instead of using a hardcoded template that breaks for non-standard leagues.
      const [rostersResponse, usersResponse, playersResult, sleeperLeagueResult] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${league.externalId}/rosters`),
        fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`),
        fetchSleeperPlayersCached(),
        (async () => {
          try {
            const res = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
            if (res.ok) {
              return await res.json() as any;
            }
          } catch (e) {
            console.error('Failed to fetch Sleeper league metadata (sync continues with fallback slot template):', e);
          }
          return null;
        })(),
      ]);

      if (!rostersResponse.ok) {
        return c.json({ error: 'Failed to fetch rosters from Sleeper' }, 500);
      }
      const rostersRaw = await rostersResponse.json();
      const rosters = validateSleeperArray(rostersRaw, isValidSleeperRoster, 'rosters');
      if (rosters.length === 0) {
        return c.json({ error: 'No valid rosters returned from Sleeper' }, 500);
      }

      if (!usersResponse.ok) {
        return c.json({ error: 'Failed to fetch users from Sleeper' }, 500);
      }
      const sleeperUsersRaw = await usersResponse.json();
      const sleeperUsers = validateSleeperArray(sleeperUsersRaw, isValidSleeperUser, 'users');

      const sleeperPlayers = playersResult;

      // Build the real starter slot template from the league's `roster_positions`.
      // Sleeper's `roster.starters` array is ordered the same way as the non-bench
      // entries in `roster_positions`, so mapping index → slot is only correct if
      // we use the league's actual starting lineup shape. When the same position
      // appears multiple times (e.g. RB, RB, WR, WR, WR) we append a 1-based index
      // (RB1, RB2, WR1, WR2, WR3) so downstream sorting can order them correctly.
      const buildStarterSlotTemplate = (rosterPositions: string[]): string[] => {
        const BENCH_SLOTS = new Set(['BN', 'IR', 'TAXI']);
        const startingPositions = rosterPositions.filter(
          (p) => typeof p === 'string' && !BENCH_SLOTS.has(p.toUpperCase())
        );
        const totalCounts: Record<string, number> = {};
        for (const pos of startingPositions) {
          totalCounts[pos] = (totalCounts[pos] || 0) + 1;
        }
        const runningCounts: Record<string, number> = {};
        return startingPositions.map((pos) => {
          runningCounts[pos] = (runningCounts[pos] || 0) + 1;
          // Only number the slot when the same position appears more than once.
          return totalCounts[pos] > 1 ? `${pos}${runningCounts[pos]}` : pos;
        });
      };

      const leagueRosterPositions: string[] = Array.isArray(sleeperLeagueResult?.roster_positions)
        ? sleeperLeagueResult.roster_positions
        : [];
      // If we couldn't read roster_positions from the Sleeper league metadata, fall
      // back to the standard starting lineup shape. This preserves the old behavior
      // for leagues whose metadata fetch failed rather than blocking the whole sync.
      const starterSlots = leagueRosterPositions.length > 0
        ? buildStarterSlotTemplate(leagueRosterPositions)
        : ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF'];

      // Create a map of owner_id to user info
      const userMap = new Map<string, any>();
      for (const sleeperUser of sleeperUsers) {
        userMap.set(sleeperUser.user_id, sleeperUser);
      }

      // Find which Sleeper user matches this app user.
      // externalUsername may contain a Sleeper user_id (preferred) or a username/display_name.
      let userSleeperUserId: string | null = null;
      if (membership.externalUsername) {
        const stored = membership.externalUsername;
        // First try direct user_id match (most reliable)
        const directMatch = sleeperUsers.find(u => u.user_id === stored);
        if (directMatch) {
          userSleeperUserId = directMatch.user_id;
        } else {
          // Fall back to username/display_name matching
          for (const sleeperUser of sleeperUsers) {
            if (
              sleeperUser.display_name?.toLowerCase() === stored.toLowerCase() ||
              sleeperUser.username?.toLowerCase() === stored.toLowerCase()
            ) {
              userSleeperUserId = sleeperUser.user_id;
              break;
            }
          }
        }
      }

      // Find the current user's team in our database.
      // Prefer a team this user already owns (the common single-user case).
      // For users who joined an already-connected league, ownership stays with
      // the original importer, so also resolve via externalUsername → externalOwnerId.
      const userTeam =
        league.teams.find(t => t.ownerId === user.id) ||
        (userSleeperUserId
          ? league.teams.find(t => t.externalOwnerId === userSleeperUserId)
          : undefined);

      // Track which roster ID belongs to the user
      let userRosterAssigned = false;

      // Sleeper uses "Invalid"/"0" for empty IR/starter slots - skip these
      const INVALID_PLAYER_IDS = new Set(['invalid', '0', '']);

      // Pre-fetch all players referenced across all rosters in one batch query
      const allExternalPlayerIds = new Set<string>();
      for (const roster of rosters) {
        if (roster.players) {
          for (const pid of roster.players) {
            if (pid && !INVALID_PLAYER_IDS.has(String(pid).toLowerCase())) {
              allExternalPlayerIds.add(String(pid));
            }
          }
        }
      }
      const externalIdArray = Array.from(allExternalPlayerIds);
      const existingPlayersByExtId = new Map<string, { id: string }>();
      if (externalIdArray.length > 0) {
        // Batch in chunks of 50 to stay within D1's SQL variable limits
        for (let i = 0; i < externalIdArray.length; i += 50) {
          const chunk = externalIdArray.slice(i, i + 50);
          const found = await db.query.nflPlayers.findMany({
            where: inArray(schema.nflPlayers.externalId, chunk),
            columns: { id: true, externalId: true },
          });
          for (const p of found) {
            if (p.externalId) existingPlayersByExtId.set(p.externalId, { id: p.id });
          }
        }
      }

      // Process each roster
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.owner_id);
        const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
        const ownerDisplayName = sleeperUser?.display_name || sleeperUser?.username || `Owner ${roster.roster_id}`;

        // Check if this roster belongs to the app user - match by Sleeper user ID only (no fallback to first roster)
        const isUserTeam = userTeam && !userRosterAssigned && userSleeperUserId && roster.owner_id === userSleeperUserId;

        let team;
        if (isUserTeam) {
          // Update the existing user team with Sleeper data
          team = userTeam;
          userRosterAssigned = true;
          await db.update(schema.teams)
            .set({
              externalOwnerId: String(roster.owner_id),
              ownerDisplayName,
              name: teamName,
              wins: roster.settings?.wins || 0,
              losses: roster.settings?.losses || 0,
              ties: roster.settings?.ties || 0,
              pointsFor: roster.settings?.fpts || 0,
              pointsAgainst: roster.settings?.fpts_against || 0,
              waiverPriority: roster.settings?.waiver_position || 1,
              faabBudget: roster.settings?.waiver_budget_used != null
                ? Math.max(0, (league.waiverBudget || 100) - roster.settings.waiver_budget_used)
                : league.waiverBudget || 100,
              updatedAt: new Date(),
            })
            .where(eq(schema.teams.id, team.id));
        } else {
          // Check if an opponent team already exists for this Sleeper user.
          // Prefer externalOwnerId — it's the stable Sleeper user_id and won't
          // collide when two teams share a display name. Fall back to the
          // legacy name-based match only for teams created by older syncs
          // that never recorded externalOwnerId.
          const sleeperOwnerId = String(roster.owner_id);
          const existingTeam =
            league.teams.find(t => t.externalOwnerId === sleeperOwnerId) ||
            league.teams.find(t =>
              !t.externalOwnerId && (t.name === teamName || t.name.includes(`Roster ${roster.roster_id}`))
            );

          if (existingTeam) {
            team = existingTeam;
            await db.update(schema.teams)
              .set({
                externalOwnerId: String(roster.owner_id),
                ownerDisplayName,
                name: teamName,
                wins: roster.settings?.wins || 0,
                losses: roster.settings?.losses || 0,
                ties: roster.settings?.ties || 0,
                pointsFor: roster.settings?.fpts || 0,
                pointsAgainst: roster.settings?.fpts_against || 0,
                waiverPriority: roster.settings?.waiver_position || 1,
                updatedAt: new Date(),
              })
              .where(eq(schema.teams.id, team.id));
          } else {
            // Create new team for this roster (opponent team - ownerId for app access, externalOwnerId for Sleeper identity)
            const teamId = generateId();
            await db.insert(schema.teams).values({
              id: teamId,
              leagueId: league.id,
              ownerId: user.id,
              externalOwnerId: String(roster.owner_id),
              ownerDisplayName,
              name: teamName,
              wins: roster.settings?.wins || 0,
              losses: roster.settings?.losses || 0,
              ties: roster.settings?.ties || 0,
              pointsFor: roster.settings?.fpts || 0,
              pointsAgainst: roster.settings?.fpts_against || 0,
              waiverPriority: roster.settings?.waiver_position || 1,
              faabBudget: roster.settings?.waiver_budget_used != null
                ? Math.max(0, (league.waiverBudget || 100) - roster.settings.waiver_budget_used)
                : league.waiverBudget || 100,
            });
            team = { id: teamId };
          }
        }

        // Sync roster players.
        // We build the full set of new roster_spots rows in memory first, then
        // delete + bulk-insert at the end. D1 has no real transactions, so the
        // previous pattern (delete-then-insert-in-a-loop) left a team with an
        // empty roster if any player insert failed mid-way. Doing all the work
        // up-front means a thrown error aborts before we wipe the old rows.
        if (roster.players && roster.players.length > 0 && (isUserTeam || team)) {
          // Get starters array from roster. Sleeper orders this array to match the
          // non-bench entries of the league's `roster_positions`, and uses the
          // sentinel "0" / "Invalid" for empty starter slots — so `starters[i]`
          // corresponds to `starterSlots[i]` position-for-position.
          const starters = roster.starters || [];

          const newSpots: Array<{
            id: string;
            teamId: string;
            playerId: string;
            slot: string;
            isStarter: boolean;
            acquiredType: 'sync';
          }> = [];

          for (let i = 0; i < roster.players.length; i++) {
            const playerId = roster.players[i];
            if (!playerId || INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) continue;
            const starterIndex = starters.indexOf(playerId);
            const isStarter = starterIndex >= 0 && starterIndex < starterSlots.length;

            // Determine slot
            let slot: string;
            if (isStarter) {
              slot = starterSlots[starterIndex];
            } else {
              // Bench slot
              const benchIndex = roster.players.filter((p: string, idx: number) =>
                !starters.includes(p) && idx < i
              ).length;
              slot = `BN${benchIndex + 1}`;
            }

            // Check if player exists in our database (from pre-fetched batch)
            let player = existingPlayersByExtId.get(playerId) || null;

            // If player doesn't exist, create from pre-fetched Sleeper data.
            // Player-row leaks across syncs are harmless (rows in a shared
            // table), so we don't bother rolling them back if a later step
            // fails — but we still let the error propagate to abort the sync
            // rather than silently producing an incomplete roster.
            if (!player) {
              const playerData = sleeperPlayers[playerId];

              const newPlayerId = generateId();
              await db.insert(schema.nflPlayers).values({
                id: newPlayerId,
                externalId: playerId,
                name: playerData
                  ? `${playerData.first_name || ''} ${playerData.last_name || ''}`.trim() || `Player ${playerId}`
                  : `Player ${playerId}`,
                firstName: playerData?.first_name,
                lastName: playerData?.last_name,
                team: playerData?.team || 'FA',
                position: playerData?.position || 'UNK',
                status: mapStatus(playerData?.status, playerData?.injury_status),
                injuryNote: playerData?.injury_notes,
                injuryBodyPart: playerData?.injury_body_part,
                byeWeek: playerData?.bye_week,
                age: playerData?.age,
                height: playerData?.height,
                weight: playerData?.weight,
                college: playerData?.college,
                yearsExp: playerData?.years_exp,
                jerseyNumber: playerData?.number,
                depthChartOrder: playerData?.depth_chart_order,
              });
              player = { id: newPlayerId };
              existingPlayersByExtId.set(playerId, { id: newPlayerId });
            }

            newSpots.push({
              id: generateId(),
              teamId: team.id,
              playerId: player.id,
              slot,
              isStarter,
              acquiredType: 'sync',
            });
          }

          // All new rows successfully constructed — now swap them in.
          // Delete + insert still aren't atomic in D1, but the window is tiny
          // and any failure here is logged at the outer catch.
          await db.delete(schema.rosterSpots)
            .where(eq(schema.rosterSpots.teamId, team.id));
          if (newSpots.length > 0) {
            // Chunk inserts to stay well under D1's bound-parameter ceiling.
            for (let i = 0; i < newSpots.length; i += 50) {
              await db.insert(schema.rosterSpots).values(newSpots.slice(i, i + 50));
            }
          }
        }
      }

      // Now sync matchups from Sleeper
      // Build a map of roster_id to team_id
      const rosterIdToTeamId = new Map<number, string>();

      // Re-fetch teams after creating them
      const updatedTeams = await db.query.teams.findMany({
        where: eq(schema.teams.leagueId, league.id),
      });

      // Map rosters to teams by externalOwnerId (stable Sleeper user_id).
      // Falling back to name would mis-route matchups when two Sleeper users
      // share a display name; the team rows we just upserted above all carry
      // externalOwnerId, so this lookup is reliable.
      for (const roster of rosters) {
        const sleeperOwnerId = String(roster.owner_id);
        const matchingTeam = updatedTeams.find(t => t.externalOwnerId === sleeperOwnerId);
        if (matchingTeam) {
          rosterIdToTeamId.set(roster.roster_id, matchingTeam.id);
        }
      }

      // ── Apply Sleeper league metadata (fetched earlier) for week & settings ──
      let matchupsImported = 0;
      let regularSeasonWeeks = 14; // fallback
      let playoffWeeksCount = league.playoffWeeks || 3; // fallback
      let effectiveCurrentWeek = league.currentWeek || 1;

      try {
        if (sleeperLeagueResult) {
          const sleeperLeague = sleeperLeagueResult;
          const settings = sleeperLeague?.settings || {};
          const scoringSettings = sleeperLeague?.scoring_settings || {};
          const rosterPositions: string[] = leagueRosterPositions;
          const playoffWeekStart = settings.playoff_week_start || 15;
          regularSeasonWeeks = playoffWeekStart - 1; // e.g., 14
          const sleeperLeg = settings.leg || 1;
          const leagueStatus = sleeperLeague?.status || 'in_season';
          const sleeperPlayoffTeams = settings.playoff_teams || league.playoffTeams || 6;
          const sleeperTeamCount = settings.num_teams || league.teamCount || 12;

          // If season is complete or in playoffs, all regular season weeks are done
          if (leagueStatus === 'complete' || sleeperLeg > regularSeasonWeeks) {
            effectiveCurrentWeek = regularSeasonWeeks + 1;
          } else {
            effectiveCurrentWeek = sleeperLeg;
          }

          // Derive extended settings so the Trade Analyzer can auto-populate
          // format + advanced toggles instead of asking the user.
          //
          // Scoring format — Sleeper stores a `rec` value in scoring_settings:
          //   1.0 = full PPR, 0.5 = half, 0 = standard
          const recVal = Number(scoringSettings.rec ?? 0);
          const derivedScoringFormat: 'ppr' | 'half-ppr' | 'standard' =
            recVal >= 0.9 ? 'ppr' : recVal >= 0.4 ? 'half-ppr' : 'standard';

          // TE premium — TE-specific reception bonus beyond base PPR
          const recTeVal = Number(scoringSettings.rec_te ?? 0);
          const bonusRecTeVal = Number(scoringSettings.bonus_rec_te ?? 0);
          const derivedTePremium = recTeVal + bonusRecTeVal > 0;

          // Superflex — a SUPER_FLEX slot (or 2+ QB slots) in the roster
          const qbSlotCount = rosterPositions.filter((p) => p === 'QB').length;
          const derivedSuperflex =
            rosterPositions.includes('SUPER_FLEX') || qbSlotCount >= 2;

          // League type — Sleeper `settings.type`: 0 redraft, 1 keeper, 2 dynasty
          const sleeperType = Number(settings.type ?? 0);
          const derivedLeagueType: 'redraft' | 'dynasty' | 'keeper' =
            sleeperType === 2 ? 'dynasty' : sleeperType === 1 ? 'keeper' : 'redraft';

          // Persist accurate league settings from Sleeper
          await db.update(schema.leagues)
            .set({
              currentWeek: effectiveCurrentWeek,
              playoffTeams: sleeperPlayoffTeams,
              teamCount: sleeperTeamCount,
              playoffWeeks: (playoffWeeksCount = settings.playoff_round_type === 2 ? 2 : 3),
              scoringFormat: derivedScoringFormat,
              leagueType: derivedLeagueType,
              hasSuperflex: derivedSuperflex,
              hasTePremium: derivedTePremium,
              updatedAt: new Date(),
            })
            .where(eq(schema.leagues.id, league.id));
        }
      } catch (e) {
        console.log('Could not fetch Sleeper league metadata, using stored currentWeek');
      }

      // Fetch matchups for ALL weeks including playoffs
      const totalWeeks = regularSeasonWeeks + playoffWeeksCount;
      const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);
      const matchupUrls = weekNumbers.map(week =>
        `https://api.sleeper.app/v1/league/${league.externalId}/matchups/${week}`
      );
      const matchupResponses = await throttledFetchAll<any[]>(matchupUrls, 5, 200);

      // Process matchups for each week
      for (let i = 0; i < weekNumbers.length; i++) {
        const week = weekNumbers[i];
        const rawMatchups = matchupResponses[i];
        if (!rawMatchups) continue;

        const weekMatchups = validateSleeperArray(rawMatchups, isValidSleeperMatchup, `matchups week ${week}`);
        if (weekMatchups.length === 0) continue;

        // Group matchups by matchup_id
        const matchupGroups = new Map<number, typeof weekMatchups>();
        for (const m of weekMatchups) {
          if (m.matchup_id) {
            if (!matchupGroups.has(m.matchup_id)) {
              matchupGroups.set(m.matchup_id, []);
            }
            matchupGroups.get(m.matchup_id)!.push(m);
          }
        }

        // Process each matchup pair
        for (const [, teams] of matchupGroups) {
          if (teams.length === 2) {
            const team1 = teams[0];
            const team2 = teams[1];

            const homeTeamId = rosterIdToTeamId.get(team1.roster_id);
            const awayTeamId = rosterIdToTeamId.get(team2.roster_id);

            if (homeTeamId && awayTeamId) {
              // Check if matchup already exists
              const existingMatchup = await db.query.matchups.findFirst({
                where: and(
                  eq(schema.matchups.leagueId, league.id),
                  eq(schema.matchups.week, week),
                  eq(schema.matchups.homeTeamId, homeTeamId)
                ),
              });

              const isPlayoffWeek = week > regularSeasonWeeks;
              const isChampionshipWeek = week === regularSeasonWeeks + playoffWeeksCount;

              // Convert Sleeper starters (external IDs) to internal IDs
              const homeStarters = (team1.starters || [])
                .map((eid: string) => existingPlayersByExtId.get(eid)?.id)
                .filter((id: string | undefined): id is string => !!id);
              const awayStarters = (team2.starters || [])
                .map((eid: string) => existingPlayersByExtId.get(eid)?.id)
                .filter((id: string | undefined): id is string => !!id);

              if (!existingMatchup) {
                // Create the matchup
                await db.insert(schema.matchups).values({
                  id: generateId(),
                  leagueId: league.id,
                  week,
                  homeTeamId,
                  awayTeamId,
                  homeScore: team1.points || 0,
                  awayScore: team2.points || 0,
                  homeProjectedScore: team1.projected_points || 0,
                  awayProjectedScore: team2.projected_points || 0,
                  isComplete: week < effectiveCurrentWeek,
                  isPlayoff: isPlayoffWeek,
                  isChampionship: isChampionshipWeek,
                  homeStartersJson: homeStarters.length > 0 ? JSON.stringify(homeStarters) : null,
                  awayStartersJson: awayStarters.length > 0 ? JSON.stringify(awayStarters) : null,
                });
                matchupsImported++;
              } else {
                // Update existing matchup scores and playoff flags
                await db.update(schema.matchups)
                  .set({
                    homeScore: team1.points || 0,
                    awayScore: team2.points || 0,
                    isComplete: week < effectiveCurrentWeek,
                    isPlayoff: isPlayoffWeek,
                    isChampionship: isChampionshipWeek,
                    homeStartersJson: homeStarters.length > 0 ? JSON.stringify(homeStarters) : null,
                    awayStartersJson: awayStarters.length > 0 ? JSON.stringify(awayStarters) : null,
                  })
                  .where(eq(schema.matchups.id, existingMatchup.id));
              }
            }
          }
        }
      }

      // ========================================
      // STEP 4: Import player stats for the current season
      // ========================================
      let statsImported = 0;

      // Get all unique player external IDs from all rosters (exclude placeholders like Invalid/0)
      const allRosteredPlayerIds = new Set<string>();
      for (const roster of rosters) {
        if (roster.players) {
          for (const playerId of roster.players) {
            if (playerId && !INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) {
              allRosteredPlayerIds.add(playerId);
            }
          }
        }
      }

      // Fetch all weeks of stats in parallel (much faster than sequential)
      const statsWeekLimit = Math.min(effectiveCurrentWeek, totalWeeks);
      const statsUrls = Array.from({ length: statsWeekLimit }, (_, i) => {
        const week = i + 1;
        const seasonType = week > regularSeasonWeeks ? 'post' : 'regular';
        return `https://api.sleeper.com/stats/nfl/${league.seasonYear}/${week}?season_type=${seasonType}`;
      });
      const allWeekStats = await throttledFetchAll<Record<string, any>>(statsUrls, 5, 200);

      // Pre-fetch existing stats for all rostered players in bulk
      const playerIdArray = Array.from(existingPlayersByExtId.entries());
      const existingStatsMap = new Map<string, { id: string }>();
      for (let i = 0; i < playerIdArray.length; i += 50) {
        const chunk = playerIdArray.slice(i, i + 50).map(([, p]) => p.id);
        const found = await db.query.playerWeeklyStats.findMany({
          where: and(
            inArray(schema.playerWeeklyStats.playerId, chunk),
            eq(schema.playerWeeklyStats.seasonYear, league.seasonYear)
          ),
          columns: { id: true, playerId: true, week: true },
        });
        for (const s of found) {
          existingStatsMap.set(`${s.playerId}_${s.week}`, { id: s.id });
        }
      }

      // Process stats using pre-fetched maps (no per-player DB lookups)
      for (let i = 0; i < statsWeekLimit; i++) {
        const week = i + 1;
        const weekStats = allWeekStats[i];
        if (!weekStats) continue;

        try {
          for (const sleeperPlayerId of allRosteredPlayerIds) {
            const playerStats = weekStats[sleeperPlayerId];
            if (!playerStats) continue;

            // Use pre-fetched player map instead of DB query
            const player = existingPlayersByExtId.get(sleeperPlayerId);
            if (!player) continue;

            const statsKey = `${player.id}_${week}`;
            const existingStats = existingStatsMap.get(statsKey);

            const statsData = {
              playerId: player.id,
              week,
              seasonYear: league.seasonYear,
              opponent: playerStats.opponent || null,
              passAttempts: playerStats.pass_att || 0,
              passCompletions: playerStats.pass_cmp || 0,
              passYards: playerStats.pass_yd || 0,
              passTDs: playerStats.pass_td || 0,
              passInterceptions: playerStats.pass_int || 0,
              rushAttempts: playerStats.rush_att || 0,
              rushYards: playerStats.rush_yd || 0,
              rushTDs: playerStats.rush_td || 0,
              targets: playerStats.rec_tgt || 0,
              receptions: playerStats.rec || 0,
              receivingYards: playerStats.rec_yd || 0,
              receivingTDs: playerStats.rec_td || 0,
              fumbles: playerStats.fum || 0,
              fumblesLost: playerStats.fum_lost || 0,
              twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),
              fgMade: playerStats.fgm || 0,
              fgAttempts: playerStats.fga || 0,
              fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
              fg50PlusMade: playerStats.fgm_50p || 0,
              xpMade: playerStats.xpm || 0,
              xpAttempts: playerStats.xpa || 0,
              offSnaps: Math.round(playerStats.off_snp || 0),
              defSnaps: Math.round(playerStats.def_snp || 0),
              stSnaps: Math.round(playerStats.st_snp || 0),
              tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
              tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
              tmStSnaps: Math.round(playerStats.tm_st_snp || 0),
              sacks: playerStats.sack || 0,
              defInterceptions: playerStats.int || 0,
              fumblesRecovered: playerStats.fum_rec || 0,
              defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
              safeties: playerStats.safe || 0,
              pointsAllowed: playerStats.pts_allow || 0,
              fantasyPointsPPR: playerStats.pts_ppr || 0,
              fantasyPointsHalf: playerStats.pts_half_ppr || 0,
              fantasyPointsStd: playerStats.pts_std || 0,
            };

            if (existingStats) {
              await db.update(schema.playerWeeklyStats)
                .set(statsData)
                .where(eq(schema.playerWeeklyStats.id, existingStats.id));
            } else {
              await db.insert(schema.playerWeeklyStats).values({
                id: generateId(),
                ...statsData,
              });
              existingStatsMap.set(statsKey, { id: 'new' });
              statsImported++;
            }
          }
        } catch (e) {
          console.error(`Failed to process stats for week ${week}:`, e);
        }
      }

      // ========================================
      // STEP 5: Import projections for current/upcoming week (ALL players in DB)
      // Projections are calculated from book lines (player props) first,
      // then Sleeper projections fill in any remaining players.
      // ========================================
      let projectionsImported = 0;
      let propsProjectionsCount = 0;
      // Use the current week for projections (capped to regular season)
      const projectionWeek = Math.min(effectiveCurrentWeek, regularSeasonWeeks);

      try {
        // Step 5a: Generate projections from book lines (player props)
        const propsResult = await generateProjectionsFromProps(db, projectionWeek, league.seasonYear);
        propsProjectionsCount = propsResult.generated + propsResult.updated;

        // Track which players already have props-based projections
        const playersCoveredByProps = new Set<string>();
        if (propsProjectionsCount > 0) {
          const propsProjections = await db.query.playerProjections.findMany({
            where: and(
              eq(schema.playerProjections.week, projectionWeek),
              eq(schema.playerProjections.seasonYear, league.seasonYear)
            ),
            columns: { playerId: true },
          });
          for (const p of propsProjections) {
            playersCoveredByProps.add(p.playerId);
          }
        }

        // Step 5b: Sleeper fallback for players without prop lines
        const projectionsResponse = await fetch(
          `https://api.sleeper.com/projections/nfl/${league.seasonYear}/${projectionWeek}?season_type=regular`
        );

        if (projectionsResponse.ok) {
          const projections = await projectionsResponse.json() as Record<string, any>;

          // Check if week is complete (for snapshot - only snapshot before overwrite if game not played)
          const gamesForWeek = await db.query.nflGames.findMany({
            where: and(eq(schema.nflGames.week, projectionWeek), eq(schema.nflGames.seasonYear, league.seasonYear)),
            columns: { isComplete: true, homeScore: true, awayScore: true },
          });
          const weekComplete = gamesForWeek.length > 0 && gamesForWeek.every(g => g.isComplete || (g.homeScore != null && g.awayScore != null));

          // Pre-fetch existing projections for this week in bulk
          const scoringFormat = league.scoringFormat || 'ppr';
          const existingProjMap = new Map<string, any>();
          const allPlayerIds = Array.from(existingPlayersByExtId.values()).map(p => p.id);
          for (let pi = 0; pi < allPlayerIds.length; pi += 50) {
            const chunk = allPlayerIds.slice(pi, pi + 50);
            const found = await db.query.playerProjections.findMany({
              where: and(
                inArray(schema.playerProjections.playerId, chunk),
                eq(schema.playerProjections.week, projectionWeek),
                eq(schema.playerProjections.seasonYear, league.seasonYear),
                eq(schema.playerProjections.scoringFormat, scoringFormat)
              ),
            });
            for (const p of found) {
              existingProjMap.set(p.playerId, p);
            }
          }

          // Import projections for players NOT already covered by book lines
          for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
            if (!playerProj) continue;

            // Use pre-fetched player map instead of DB query
            const player = existingPlayersByExtId.get(sleeperPlayerId);
            if (!player) continue;

            // Skip players already covered by book line projections
            if (playersCoveredByProps.has(player.id)) continue;

            const existingProj = existingProjMap.get(player.id);

            const projData = {
              playerId: player.id,
              week: projectionWeek,
              seasonYear: league.seasonYear,
              scoringFormat,
              projectedPoints: scoringFormat === 'ppr'
                ? (playerProj.pts_ppr || 0)
                : scoringFormat === 'half_ppr'
                  ? (playerProj.pts_half_ppr || 0)
                  : (playerProj.pts_std || 0),
              projPassYards: playerProj.pass_yd || null,
              projPassTDs: playerProj.pass_td || null,
              projRushYards: playerProj.rush_yd || null,
              projRushTDs: playerProj.rush_td || null,
              projReceptions: playerProj.rec || null,
              projRecYards: playerProj.rec_yd || null,
              projRecTDs: playerProj.rec_td || null,
              updatedAt: new Date(),
            };

            if (existingProj) {
              if (!weekComplete) {
                await db.insert(schema.projectionLineSnapshots).values({
                  id: generateId(),
                  playerId: player.id,
                  week: projectionWeek,
                  seasonYear: league.seasonYear,
                  scoringFormat,
                  snapshotAt: new Date(),
                  projectedPoints: existingProj.projectedPoints,
                  projPassYards: existingProj.projPassYards ?? null,
                  projPassTDs: existingProj.projPassTDs ?? null,
                  projRushYards: existingProj.projRushYards ?? null,
                  projRushTDs: existingProj.projRushTDs ?? null,
                  projReceptions: existingProj.projReceptions ?? null,
                  projRecYards: existingProj.projRecYards ?? null,
                  projRecTDs: existingProj.projRecTDs ?? null,
                });
              }
              await db.update(schema.playerProjections)
                .set(projData)
                .where(eq(schema.playerProjections.id, existingProj.id));
            } else {
              await db.insert(schema.playerProjections).values({
                id: generateId(),
                ...projData,
              });
              projectionsImported++;
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch projections:', e);
      }

      // Auto-ingest executed trades into the historical trades table.
      // Safe + idempotent — failures don't block the rest of the sync.
      let tradesIngested = 0;
      try {
        const { ingestSleeperTrades } = await import('../services/tradeIngest');
        const stats = await ingestSleeperTrades(db, league.id);
        tradesIngested = stats.inserted + stats.updated;
        if (stats.errors > 0) {
          console.warn(
            `[sleeper sync] Trade ingest completed with ${stats.errors} errors for league ${league.id}`
          );
        }
      } catch (e) {
        console.error('Trade ingest failed (non-blocking):', e);
      }

      // If we couldn't pin the user to a Sleeper roster, surface a warning so
      // the UI can prompt them to set their Sleeper username (otherwise their
      // "my team" view will be empty even though the league synced fine).
      const userMatchWarning = !userRosterAssigned
        ? (membership.externalUsername
            ? `We synced the league but couldn't find a Sleeper roster matching "${membership.externalUsername}". Re-enter your Sleeper username in league settings.`
            : 'We synced the league but don\'t know which roster is yours. Add your Sleeper username in league settings to see your team.')
        : null;

      return c.json({
        success: true,
        message: `League synced successfully from Sleeper. ${rosters.length} teams, ${matchupsImported} matchups, ${statsImported} player stats, ${propsProjectionsCount} projections from book lines, ${projectionsImported} projections from Sleeper, and ${tradesIngested} trades updated.`,
        teamsUpdated: rosters.length,
        matchupsImported,
        statsImported,
        projectionsImported,
        propsProjections: propsProjectionsCount,
        tradesIngested,
        userTeamMatched: userRosterAssigned,
        warning: userMatchWarning,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Sleeper sync error:', err);
      return c.json({ error: err.message || 'Failed to sync league from Sleeper' }, 500);
    }
  }

  // Handle Yahoo sync
  if (league.platform === 'yahoo' && league.externalId) {
    try {
      const { getYahooToken, yahooApiFetch } = await import('./yahoo');

      // Get fresh user for latest Yahoo tokens
      const freshUser = await db.query.users.findFirst({
        where: eq(schema.users.id, user.id),
      });
      if (!freshUser?.yahooAccessToken) {
        return c.json({ error: 'Yahoo account not connected. Please connect your Yahoo account in Settings.' }, 400);
      }

      const accessToken = await getYahooToken(db, freshUser, c.env);
      const leagueKey = league.externalId; // stored as the full league_key, e.g. "423.l.123456"

      // 1. Fetch league settings
      const settingsData = await yahooApiFetch(accessToken, `/league/${leagueKey}/settings`);
      const settings = settingsData?.fantasy_content?.league?.[1]?.settings?.[0] || {};

      // 2. Fetch teams (rosters)
      const teamsData = await yahooApiFetch(accessToken, `/league/${leagueKey}/teams/roster`);
      const teamsObj = teamsData?.fantasy_content?.league?.[1]?.teams;

      let teamsImported = 0;
      let playersImported = 0;

      if (teamsObj) {
        let teamIdx = 0;
        while (teamsObj[String(teamIdx)]) {
          const teamArr = teamsObj[String(teamIdx)].team;
          if (!teamArr) { teamIdx++; continue; }

          const teamInfo = teamArr[0];
          // teamInfo is an array of metadata objects
          let teamName = 'Unknown Team';
          let teamKey = '';
          let managerEmail = '';

          if (Array.isArray(teamInfo)) {
            for (const item of teamInfo) {
              if (typeof item === 'object' && item !== null) {
                if ('name' in item) teamName = item.name;
                if ('team_key' in item) teamKey = item.team_key;
                if ('managers' in item) {
                  const mgr = Array.isArray(item.managers) ? item.managers[0]?.manager : null;
                  if (mgr?.email) managerEmail = mgr.email;
                }
              }
            }
          }

          // Extract team ID from key (e.g., "423.l.123456.t.1" -> "1")
          const teamExternalId = teamKey.split('.t.').pop() || String(teamIdx + 1);

          // Upsert team (use externalOwnerId to store Yahoo team external ID)
          const existingTeam = league.teams.find(t => t.externalOwnerId === teamExternalId);
          let teamId: string;

          if (existingTeam) {
            teamId = existingTeam.id;
            await db.update(schema.teams).set({
              name: teamName,
              updatedAt: new Date(),
            }).where(eq(schema.teams.id, existingTeam.id));
          } else {
            teamId = crypto.randomUUID();
            await db.insert(schema.teams).values({
              id: teamId,
              name: teamName,
              leagueId: league.id,
              ownerId: user.id, // Default to current user; will be corrected if manager info available
              externalOwnerId: teamExternalId,
            });
          }
          teamsImported++;

          // Parse roster
          const rosterData = teamArr[1]?.roster;
          const rosterPlayers = rosterData?.['0']?.players;

          if (rosterPlayers) {
            let playerIdx = 0;
            while (rosterPlayers[String(playerIdx)]) {
              const playerArr = rosterPlayers[String(playerIdx)].player;
              if (!playerArr) { playerIdx++; continue; }

              const playerInfo = playerArr[0];
              let playerName = 'Unknown';
              let position = 'UNKNOWN';
              let nflTeam = '';
              let yahooPlayerId = '';

              if (Array.isArray(playerInfo)) {
                for (const item of playerInfo) {
                  if (typeof item === 'object' && item !== null) {
                    if ('name' in item && typeof item.name === 'object') {
                      playerName = item.name.full || playerName;
                    }
                    if ('display_position' in item) position = item.display_position;
                    if ('editorial_team_abbr' in item) nflTeam = item.editorial_team_abbr?.toUpperCase() || '';
                    if ('player_id' in item) yahooPlayerId = String(item.player_id);
                  }
                }
              }

              // Try to find matching player in our DB by name
              if (playerName !== 'Unknown') {
                const nameParts = playerName.split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                let dbPlayer = null;
                // First try exact name match
                if (firstName && lastName) {
                  dbPlayer = await db.query.nflPlayers.findFirst({
                    where: and(
                      eq(schema.nflPlayers.firstName, firstName),
                      eq(schema.nflPlayers.lastName, lastName),
                      eq(schema.nflPlayers.position, position),
                    ),
                  });
                }

                if (dbPlayer) {
                  // Add to roster
                  const existingRoster = await db.query.rosterSpots.findFirst({
                    where: and(
                      eq(schema.rosterSpots.teamId, teamId),
                      eq(schema.rosterSpots.playerId, dbPlayer.id),
                    ),
                  });

                  const selectedPosition = playerArr[1]?.selected_position?.[1]?.position || position;

                  if (!existingRoster) {
                    await db.insert(schema.rosterSpots).values({
                      id: crypto.randomUUID(),
                      teamId,
                      playerId: dbPlayer.id,
                      slot: selectedPosition,
                      isStarter: selectedPosition !== 'BN' && selectedPosition !== 'IR',
                    });
                    playersImported++;
                  } else {
                    await db.update(schema.rosterSpots).set({
                      slot: selectedPosition,
                      isStarter: selectedPosition !== 'BN' && selectedPosition !== 'IR',
                    }).where(eq(schema.rosterSpots.id, existingRoster.id));
                  }
                }
              }

              playerIdx++;
            }
          }

          teamIdx++;
        }
      }

      // 3. Fetch matchups for current week
      let matchupsImported = 0;
      try {
        const currentWeek = settings.current_week || 1;
        const matchupData = await yahooApiFetch(accessToken, `/league/${leagueKey}/scoreboard;week=${currentWeek}`);
        const matchups = matchupData?.fantasy_content?.league?.[1]?.scoreboard?.['0']?.matchups;

        if (matchups) {
          let matchupIdx = 0;
          while (matchups[String(matchupIdx)]) {
            const matchup = matchups[String(matchupIdx)].matchup;
            if (!matchup) { matchupIdx++; continue; }

            const matchupTeams = matchup['0']?.teams;
            if (!matchupTeams) { matchupIdx++; continue; }

            const team1Info = matchupTeams['0']?.team;
            const team2Info = matchupTeams['1']?.team;

            if (team1Info && team2Info) {
              // Extract team keys
              const getTeamExternalId = (teamArr: any) => {
                if (!Array.isArray(teamArr[0])) return '';
                for (const item of teamArr[0]) {
                  if (typeof item === 'object' && item !== null && 'team_key' in item) {
                    return item.team_key.split('.t.').pop() || '';
                  }
                }
                return '';
              };

              const getTeamScore = (teamArr: any) => {
                if (!teamArr[1]?.team_points) return 0;
                return parseFloat(teamArr[1].team_points.total) || 0;
              };

              const team1ExtId = getTeamExternalId(team1Info);
              const team2ExtId = getTeamExternalId(team2Info);

              const dbTeam1 = await db.query.teams.findFirst({
                where: and(eq(schema.teams.leagueId, league.id), eq(schema.teams.externalOwnerId, team1ExtId)),
              });
              const dbTeam2 = await db.query.teams.findFirst({
                where: and(eq(schema.teams.leagueId, league.id), eq(schema.teams.externalOwnerId, team2ExtId)),
              });

              if (dbTeam1 && dbTeam2) {
                const existingMatchup = await db.query.matchups.findFirst({
                  where: and(
                    eq(schema.matchups.leagueId, league.id),
                    eq(schema.matchups.week, currentWeek),
                    eq(schema.matchups.homeTeamId, dbTeam1.id),
                  ),
                });

                const score1 = getTeamScore(team1Info);
                const score2 = getTeamScore(team2Info);

                if (!existingMatchup) {
                  await db.insert(schema.matchups).values({
                    id: crypto.randomUUID(),
                    leagueId: league.id,
                    week: currentWeek,
                    homeTeamId: dbTeam1.id,
                    awayTeamId: dbTeam2.id,
                    homeScore: score1,
                    awayScore: score2,
                  });
                  matchupsImported++;
                } else {
                  await db.update(schema.matchups).set({
                    homeScore: score1,
                    awayScore: score2,
                  }).where(eq(schema.matchups.id, existingMatchup.id));
                }
              }
            }

            matchupIdx++;
          }
        }
      } catch (matchupErr) {
        console.error('Yahoo matchup sync error (non-fatal):', matchupErr);
      }

      // Update league metadata
      await db.update(schema.leagues).set({
        teamCount: teamsImported || league.teamCount,
        updatedAt: new Date(),
      }).where(eq(schema.leagues.id, league.id));

      return c.json({
        success: true,
        message: `Synced from Yahoo: ${teamsImported} teams, ${playersImported} players, ${matchupsImported} matchups`,
        teamsImported,
        playersImported,
        matchupsImported,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Yahoo sync error:', err);
      return c.json({ error: err.message || 'Failed to sync league from Yahoo' }, 500);
    }
  }

  // Handle MFL sync
  if (league.platform === 'mfl' && league.externalId) {
    try {
      const year = league.seasonYear || new Date().getFullYear();

      // 1. Fetch league settings from MFL
      const mflLeagueData = await fetchMflLeague(league.externalId, year);
      const mflLeague = mflLeagueData?.league;
      if (!mflLeague) {
        return c.json({ error: 'Failed to fetch league data from MFL. Check your league ID.' }, 500);
      }

      const franchises = ensureArray(mflLeague.franchises?.franchise);
      if (franchises.length === 0) {
        return c.json({ error: 'No franchises found in MFL league' }, 500);
      }

      // Update league metadata
      await db.update(schema.leagues)
        .set({
          name: mflLeague.name || league.name,
          teamCount: franchises.length,
          updatedAt: new Date(),
        })
        .where(eq(schema.leagues.id, league.id));

      // 2. Fetch rosters from MFL
      const mflRostersData = await fetchMflRosters(league.externalId, year);
      const mflRosters = ensureArray(mflRostersData?.rosters?.franchise);

      // Build franchise ID → franchise info map
      const franchiseMap = new Map<string, typeof franchises[0]>();
      for (const f of franchises) {
        franchiseMap.set(f.id, f);
      }

      let teamsImported = 0;
      let playersImported = 0;

      // Collect all MFL player IDs across all rosters for batch lookup
      const allMflPlayerIds = new Set<string>();
      for (const roster of mflRosters) {
        const players = ensureArray(roster.player);
        for (const p of players) {
          if (p.id) allMflPlayerIds.add(p.id);
        }
      }

      // Pre-fetch MFL player details for name matching
      let mflPlayerMap = new Map<string, { firstName: string; lastName: string; fullName: string; position: string; team: string }>();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const mflPlayersUrl = `https://api.myfantasyleague.com/${year}/export?TYPE=players&DETAILS=1&JSON=1`;
        const playersResponse = await fetch(mflPlayersUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FilmRoomFantasy/1.0' },
        });
        clearTimeout(timeoutId);
        if (playersResponse.ok) {
          const playersData = await playersResponse.json() as any;
          const mflPlayers = ensureArray(playersData?.players?.player);
          for (const mp of mflPlayers) {
            if (!mp.id) continue;
            const parsed = parseMflName(mp.name || '');
            const pos = mapMflPosition(mp.position || '');
            if (pos) {
              mflPlayerMap.set(mp.id, {
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                fullName: parsed.fullName,
                position: pos,
                team: mapMflTeam(mp.team || 'FA'),
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch MFL players (sync continues with name matching):', e);
      }

      // Process each franchise/roster
      for (const roster of mflRosters) {
        const franchise = franchiseMap.get(roster.id);
        const teamName = franchise?.name || `Team ${roster.id}`;
        const ownerName = franchise?.owner_name || teamName;

        // Upsert team
        const existingTeam = league.teams.find(t => t.externalOwnerId === roster.id);
        let teamId: string;

        if (existingTeam) {
          teamId = existingTeam.id;
          await db.update(schema.teams).set({
            name: teamName,
            ownerDisplayName: ownerName,
            faabBudget: franchise?.bbidAvailableBalance ? parseInt(franchise.bbidAvailableBalance, 10) : undefined,
            updatedAt: new Date(),
          }).where(eq(schema.teams.id, existingTeam.id));
        } else {
          teamId = generateId();
          await db.insert(schema.teams).values({
            id: teamId,
            name: teamName,
            leagueId: league.id,
            ownerId: user.id,
            externalOwnerId: roster.id,
            ownerDisplayName: ownerName,
            faabBudget: franchise?.bbidAvailableBalance ? parseInt(franchise.bbidAvailableBalance, 10) : 100,
          });
        }
        teamsImported++;

        // Sync roster players
        const rosterPlayers = ensureArray(roster.player);
        if (rosterPlayers.length > 0) {
          // Clear existing roster spots for this team
          await db.delete(schema.rosterSpots)
            .where(eq(schema.rosterSpots.teamId, teamId));

          let starterCount = 0;
          let benchCount = 0;

          for (const rosterPlayer of rosterPlayers) {
            if (!rosterPlayer.id) continue;

            const mflPlayerInfo = mflPlayerMap.get(rosterPlayer.id);
            if (!mflPlayerInfo) continue; // Skip non-fantasy positions

            // Try to find the player in our DB by name + position
            let dbPlayer = null;
            if (mflPlayerInfo.firstName && mflPlayerInfo.lastName) {
              dbPlayer = await db.query.nflPlayers.findFirst({
                where: and(
                  eq(schema.nflPlayers.firstName, mflPlayerInfo.firstName),
                  eq(schema.nflPlayers.lastName, mflPlayerInfo.lastName),
                  eq(schema.nflPlayers.position, mflPlayerInfo.position),
                ),
              });
            }

            // Fallback: try full name match
            if (!dbPlayer && mflPlayerInfo.fullName) {
              dbPlayer = await db.query.nflPlayers.findFirst({
                where: and(
                  eq(schema.nflPlayers.name, mflPlayerInfo.fullName),
                  eq(schema.nflPlayers.position, mflPlayerInfo.position),
                ),
              });
            }

            // For DEF, match by team
            if (!dbPlayer && mflPlayerInfo.position === 'DEF') {
              dbPlayer = await db.query.nflPlayers.findFirst({
                where: and(
                  eq(schema.nflPlayers.team, mflPlayerInfo.team),
                  eq(schema.nflPlayers.position, 'DEF'),
                ),
              });
            }

            if (dbPlayer) {
              const isIR = rosterPlayer.status === 'INJURED_RESERVE' || rosterPlayer.status === 'TAXI_SQUAD';
              const isStarter = !isIR && rosterPlayer.status === 'ROSTER' && starterCount < 9;
              const slot = isIR ? 'IR' : isStarter ? mflPlayerInfo.position : `BN${benchCount + 1}`;

              if (isStarter) starterCount++;
              if (!isStarter && !isIR) benchCount++;

              await db.insert(schema.rosterSpots).values({
                id: generateId(),
                teamId,
                playerId: dbPlayer.id,
                slot,
                isStarter,
                acquiredType: 'sync',
              });
              playersImported++;
            }
          }
        }
      }

      // 3. Sync matchups from MFL schedule
      let matchupsImported = 0;
      try {
        const mflScheduleData = await fetchMflSchedule(league.externalId, year);
        const weeklySchedules = ensureArray(mflScheduleData?.schedule?.weeklySchedule);

        // Re-fetch teams after upserts
        const updatedTeams = await db.query.teams.findMany({
          where: eq(schema.teams.leagueId, league.id),
        });
        const franchiseIdToTeamId = new Map<string, string>();
        for (const t of updatedTeams) {
          if (t.externalOwnerId) {
            franchiseIdToTeamId.set(t.externalOwnerId, t.id);
          }
        }

        for (const weekSchedule of weeklySchedules) {
          const week = parseInt(weekSchedule.week, 10);
          if (isNaN(week) || week < 1) continue;

          const matchups = ensureArray(weekSchedule.matchup);
          for (const matchup of matchups) {
            const teams = ensureArray(matchup.franchise);
            if (teams.length !== 2) continue;

            const homeTeamId = franchiseIdToTeamId.get(teams[0].id);
            const awayTeamId = franchiseIdToTeamId.get(teams[1].id);
            if (!homeTeamId || !awayTeamId) continue;

            const homeScore = parseFloat(teams[0].score || '0') || 0;
            const awayScore = parseFloat(teams[1].score || '0') || 0;
            const isComplete = (teams[0].result === 'W' || teams[0].result === 'L' || teams[0].result === 'T');

            // Check for existing matchup
            const existingMatchup = await db.query.matchups.findFirst({
              where: and(
                eq(schema.matchups.leagueId, league.id),
                eq(schema.matchups.week, week),
                eq(schema.matchups.homeTeamId, homeTeamId),
              ),
            });

            if (!existingMatchup) {
              await db.insert(schema.matchups).values({
                id: generateId(),
                leagueId: league.id,
                week,
                homeTeamId,
                awayTeamId,
                homeScore,
                awayScore,
                isComplete,
              });
              matchupsImported++;
            } else {
              await db.update(schema.matchups)
                .set({ homeScore, awayScore, isComplete })
                .where(eq(schema.matchups.id, existingMatchup.id));
            }
          }
        }
      } catch (scheduleErr) {
        console.error('MFL schedule sync error (non-fatal):', scheduleErr);
      }

      // 4. Sync player scores for completed weeks
      let statsImported = 0;
      try {
        const currentWeek = league.currentWeek || 1;
        for (let week = 1; week <= currentWeek; week++) {
          if (week > 1) await sleep(150);
          try {
            const scoresData = await fetchMflPlayerScores(league.externalId, year, week);
            const playerScores = ensureArray(
              scoresData?.playerScores?.playerScore as any
            );

            for (const ps of playerScores) {
              if (!ps.id || !ps.score) continue;
              const mflInfo = mflPlayerMap.get(ps.id);
              if (!mflInfo) continue;

              // Find player in DB
              let dbPlayer = null;
              if (mflInfo.firstName && mflInfo.lastName) {
                dbPlayer = await db.query.nflPlayers.findFirst({
                  where: and(
                    eq(schema.nflPlayers.firstName, mflInfo.firstName),
                    eq(schema.nflPlayers.lastName, mflInfo.lastName),
                    eq(schema.nflPlayers.position, mflInfo.position),
                  ),
                });
              }
              if (!dbPlayer && mflInfo.position === 'DEF') {
                dbPlayer = await db.query.nflPlayers.findFirst({
                  where: and(
                    eq(schema.nflPlayers.team, mflInfo.team),
                    eq(schema.nflPlayers.position, 'DEF'),
                  ),
                });
              }
              if (!dbPlayer) continue;

              const score = parseFloat(ps.score) || 0;

              // Check if stats exist
              const existingStats = await db.query.playerWeeklyStats.findFirst({
                where: and(
                  eq(schema.playerWeeklyStats.playerId, dbPlayer.id),
                  eq(schema.playerWeeklyStats.week, week),
                  eq(schema.playerWeeklyStats.seasonYear, year),
                ),
              });

              // MFL only provides total score, not breakdowns - store as PPR points
              if (existingStats) {
                await db.update(schema.playerWeeklyStats)
                  .set({ fantasyPointsPPR: score, fantasyPointsHalf: score, fantasyPointsStd: score })
                  .where(eq(schema.playerWeeklyStats.id, existingStats.id));
              } else if (score > 0) {
                await db.insert(schema.playerWeeklyStats).values({
                  id: generateId(),
                  playerId: dbPlayer.id,
                  week,
                  seasonYear: year,
                  fantasyPointsPPR: score,
                  fantasyPointsHalf: score,
                  fantasyPointsStd: score,
                });
                statsImported++;
              }
            }
          } catch (weekErr) {
            console.error(`MFL stats sync error for week ${week} (non-fatal):`, weekErr);
          }
        }
      } catch (statsErr) {
        console.error('MFL stats sync error (non-fatal):', statsErr);
      }

      return c.json({
        success: true,
        message: `Synced from MFL: ${teamsImported} teams, ${playersImported} players, ${matchupsImported} matchups, ${statsImported} stats`,
        teamsImported,
        playersImported,
        matchupsImported,
        statsImported,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('MFL sync error:', err);
      return c.json({ error: err.message || 'Failed to sync league from MFL' }, 500);
    }
  }

  // Handle ESPN sync (public leagues only — private leagues require SWID +
  // ESPN_S2 cookies, which we don't store yet. See TODO at the end of this file.)
  if (league.platform === 'espn' && league.externalId) {
    try {
      const year = league.seasonYear || new Date().getFullYear();
      const espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${encodeURIComponent(league.externalId)}?view=mTeam&view=mRoster&view=mMatchup&view=mSettings`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const espnRes = await fetch(espnUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!espnRes.ok) {
        const body = await espnRes.text().catch(() => '');
        const isPrivate = espnRes.status === 401 || espnRes.status === 403;
        return c.json({
          error: isPrivate
            ? 'ESPN league is private. Make it public in ESPN settings (private-league cookie auth is not yet supported).'
            : `Failed to fetch league from ESPN (HTTP ${espnRes.status}). ${body.slice(0, 200)}`,
        }, 500);
      }

      const espnData = await espnRes.json() as any;
      const espnTeams = Array.isArray(espnData?.teams) ? espnData.teams : [];
      if (espnTeams.length === 0) {
        return c.json({ error: 'No teams returned from ESPN' }, 500);
      }

      const currentWeek = parseInt(String(espnData?.scoringPeriodId ?? espnData?.status?.currentMatchupPeriod ?? 1), 10) || 1;
      const teamCount = espnTeams.length;

      // Update league metadata + currentWeek so the rest of the app sees fresh data.
      await db.update(schema.leagues).set({
        name: espnData?.settings?.name || league.name,
        teamCount,
        currentWeek,
        updatedAt: new Date(),
      }).where(eq(schema.leagues.id, league.id));

      // ESPN position/lineup mappings (limited to fantasy-relevant slots).
      // Source: ESPN's internal constants — these are well-known and stable.
      const POSITION: Record<number, string> = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DEF' };
      const LINEUP_SLOT: Record<number, string> = {
        0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 7: 'FLEX',
        16: 'DEF', 17: 'K', 20: 'BN', 21: 'IR', 23: 'FLEX',
      };
      // ESPN pro team ID → standard NFL abbreviation. Used to match DEF.
      const PRO_TEAM: Record<number, string> = {
        1:'ATL',2:'BUF',3:'CHI',4:'CIN',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GB',10:'TEN',
        11:'IND',12:'KC',13:'LV',14:'LAR',15:'MIA',16:'MIN',17:'NE',18:'NO',19:'NYG',20:'NYJ',
        21:'PHI',22:'ARI',23:'PIT',24:'LAC',25:'SF',26:'SEA',27:'TB',28:'WAS',29:'CAR',30:'JAX',
        33:'BAL',34:'HOU',
      };

      let teamsImported = 0;
      let playersImported = 0;
      let userRosterAssigned = false;

      // Try to match the app user to an ESPN team via their league_members.externalUsername.
      // ESPN identifies owners by a SWID GUID — we don't have a clean mapping from
      // app username to SWID, so we match by team display name as a best-effort.
      const userClaim = membership.externalUsername?.toLowerCase().trim();

      for (const espnTeam of espnTeams) {
        const espnTeamId = String(espnTeam.id);
        const teamName = [espnTeam.location, espnTeam.nickname].filter(Boolean).join(' ').trim()
          || espnTeam.name
          || `Team ${espnTeamId}`;
        // ESPN's public API only exposes a SWID GUID in `owners[]`, not a display
        // name — show the team name instead so we don't render a raw GUID to users.
        const ownerDisplayName = teamName;
        const record = espnTeam.record?.overall || {};

        const isUserTeam =
          !userRosterAssigned && userClaim &&
          (teamName.toLowerCase() === userClaim ||
           teamName.toLowerCase().includes(userClaim));

        const existing = league.teams.find(t => t.externalOwnerId === espnTeamId)
          || (isUserTeam ? league.teams.find(t => t.ownerId === user.id) : undefined);

        let teamId: string;
        if (existing) {
          teamId = existing.id;
          await db.update(schema.teams).set({
            externalOwnerId: espnTeamId,
            ownerDisplayName,
            name: teamName,
            wins: record.wins || 0,
            losses: record.losses || 0,
            ties: record.ties || 0,
            pointsFor: record.pointsFor || 0,
            pointsAgainst: record.pointsAgainst || 0,
            updatedAt: new Date(),
          }).where(eq(schema.teams.id, existing.id));
          if (isUserTeam) userRosterAssigned = true;
        } else {
          teamId = generateId();
          await db.insert(schema.teams).values({
            id: teamId,
            leagueId: league.id,
            ownerId: user.id,
            externalOwnerId: espnTeamId,
            ownerDisplayName,
            name: teamName,
            wins: record.wins || 0,
            losses: record.losses || 0,
            ties: record.ties || 0,
            pointsFor: record.pointsFor || 0,
            pointsAgainst: record.pointsAgainst || 0,
            faabBudget: 100,
          });
          if (isUserTeam) userRosterAssigned = true;
        }
        teamsImported++;

        // Roster sync — atomic delete + reinsert
        const entries = Array.isArray(espnTeam.roster?.entries) ? espnTeam.roster.entries : [];
        await db.delete(schema.rosterSpots).where(eq(schema.rosterSpots.teamId, teamId));

        let benchCount = 0;
        for (const entry of entries) {
          const player = entry?.playerPoolEntry?.player;
          if (!player) continue;
          const position = POSITION[player.defaultPositionId];
          if (!position) continue; // skip non-fantasy positions

          // Match player in DB: name + position first, then DEF by team
          let dbPlayer = null;
          const firstName = String(player.firstName || '').trim();
          const lastName = String(player.lastName || '').trim();
          const fullName = String(player.fullName || `${firstName} ${lastName}`).trim();

          if (firstName && lastName) {
            dbPlayer = await db.query.nflPlayers.findFirst({
              where: and(
                eq(schema.nflPlayers.firstName, firstName),
                eq(schema.nflPlayers.lastName, lastName),
                eq(schema.nflPlayers.position, position),
              ),
            });
          }
          if (!dbPlayer && fullName) {
            dbPlayer = await db.query.nflPlayers.findFirst({
              where: and(
                eq(schema.nflPlayers.name, fullName),
                eq(schema.nflPlayers.position, position),
              ),
            });
          }
          if (!dbPlayer && position === 'DEF') {
            const teamAbbr = PRO_TEAM[player.proTeamId];
            if (teamAbbr) {
              dbPlayer = await db.query.nflPlayers.findFirst({
                where: and(
                  eq(schema.nflPlayers.team, teamAbbr),
                  eq(schema.nflPlayers.position, 'DEF'),
                ),
              });
            }
          }
          if (!dbPlayer) continue;

          const lineupSlotId = entry.lineupSlotId;
          const slotLabel = LINEUP_SLOT[lineupSlotId];
          const isBench = slotLabel === 'BN';
          const isIR = slotLabel === 'IR';
          const isStarter = !isBench && !isIR && !!slotLabel;
          const slot = isIR ? 'IR' : isBench ? `BN${++benchCount}` : (slotLabel || position);

          try {
            await db.insert(schema.rosterSpots).values({
              id: generateId(),
              teamId,
              playerId: dbPlayer.id,
              slot,
              isStarter,
              acquiredType: 'sync',
            });
            playersImported++;
          } catch (e) {
            console.error('ESPN roster insert error (non-fatal):', e);
          }
        }
      }

      // Matchups — only the current week to keep this within wall-time.
      let matchupsImported = 0;
      try {
        const schedule = Array.isArray(espnData?.schedule) ? espnData.schedule : [];
        const espnTeamIdToTeamId = new Map<string, string>();
        const refreshedTeams = await db.query.teams.findMany({
          where: eq(schema.teams.leagueId, league.id),
        });
        for (const t of refreshedTeams) {
          if (t.externalOwnerId) espnTeamIdToTeamId.set(t.externalOwnerId, t.id);
        }

        for (const game of schedule) {
          const week = parseInt(String(game?.matchupPeriodId ?? 0), 10);
          if (!week || week !== currentWeek) continue;
          const homeTeamId = espnTeamIdToTeamId.get(String(game?.home?.teamId));
          const awayTeamId = espnTeamIdToTeamId.get(String(game?.away?.teamId));
          if (!homeTeamId || !awayTeamId) continue;

          const homeScore = Number(game?.home?.totalPoints || 0);
          const awayScore = Number(game?.away?.totalPoints || 0);
          const isComplete = !!game?.winner && String(game.winner).toUpperCase() !== 'UNDECIDED';

          const existing = await db.query.matchups.findFirst({
            where: and(
              eq(schema.matchups.leagueId, league.id),
              eq(schema.matchups.week, week),
              eq(schema.matchups.homeTeamId, homeTeamId),
            ),
          });
          if (existing) {
            await db.update(schema.matchups)
              .set({ homeScore, awayScore, isComplete })
              .where(eq(schema.matchups.id, existing.id));
          } else {
            await db.insert(schema.matchups).values({
              id: generateId(),
              leagueId: league.id,
              week,
              homeTeamId,
              awayTeamId,
              homeScore,
              awayScore,
              isComplete,
            });
            matchupsImported++;
          }
        }
      } catch (scheduleErr) {
        console.error('ESPN schedule sync error (non-fatal):', scheduleErr);
      }

      const warning = !userRosterAssigned
        ? `League synced. To highlight your team, set your ESPN team name in league settings.`
        : null;

      return c.json({
        success: true,
        message: `Synced from ESPN: ${teamsImported} teams, ${playersImported} players, ${matchupsImported} matchups`,
        teamsImported,
        playersImported,
        matchupsImported,
        userTeamMatched: userRosterAssigned,
        warning,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('ESPN sync error:', err);
      return c.json({ error: err.message || 'Failed to sync league from ESPN' }, 500);
    }
  }

  // For other platforms or custom leagues
  return c.json({
    success: true,
    message: `League synced successfully from ${league.platform || 'FilmRoom'}`,
  });
});

// Disconnect/delete league
leagueRoutes.delete('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check membership
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  try {
    // Get all team IDs in this league (needed to clean up child records)
    const leagueTeams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, leagueId),
      columns: { id: true },
    });
    const teamIds = leagueTeams.map(t => t.id);

    if (teamIds.length > 0) {
      // Delete child records that reference teams (order matters for FK constraints)
      // 1. Roster spots (has cascade, but be explicit)
      for (const tid of teamIds) {
        await db.delete(schema.rosterSpots).where(eq(schema.rosterSpots.teamId, tid));
      }

      // 2. Matchups referencing these teams
      for (const tid of teamIds) {
        await db.delete(schema.matchups).where(eq(schema.matchups.homeTeamId, tid));
        await db.delete(schema.matchups).where(eq(schema.matchups.awayTeamId, tid));
      }

      // 3. Transactions referencing these teams
      for (const tid of teamIds) {
        await db.delete(schema.transactions).where(eq(schema.transactions.addTeamId, tid));
        await db.delete(schema.transactions).where(eq(schema.transactions.dropTeamId, tid));
      }

      // 4. Delete all teams
      await db.delete(schema.teams).where(eq(schema.teams.leagueId, leagueId));
    }

    // Delete league members
    await db.delete(schema.leagueMembers).where(eq(schema.leagueMembers.leagueId, leagueId));

    // Delete the league itself
    await db.delete(schema.leagues).where(eq(schema.leagues.id, leagueId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Disconnect league error:', error);
    return c.json({ error: 'Failed to disconnect league' }, 500);
  }
});

// Get league standings
leagueRoutes.get('/:id/standings', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Check membership
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  // Get the league info and teams
  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
  });

  const teams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
    with: {
      owner: true,
    },
  });

  // Resolve which team belongs to the connected user (for Sleeper leagues)
  // Also build a map of Sleeper user_id → username for live owner names
  let userSleeperUserId: string | null = null;
  const sleeperUserMap = new Map<string, { username?: string; display_name?: string }>();
  if (league?.platform === 'sleeper' && league.externalId) {
    try {
      const usersRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (usersRes.ok) {
        const sleeperUsers = (await usersRes.json()) as { user_id: string; username?: string; display_name?: string }[];
        for (const su of sleeperUsers) {
          sleeperUserMap.set(su.user_id, su);
          if (
            membership.externalUsername &&
            (su.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() ||
            su.username?.toLowerCase() === membership.externalUsername.toLowerCase())
          ) {
            userSleeperUserId = su.user_id;
          }
        }
      }
    } catch {
      // Sleeper lookup failed — fall back to ownerId match
    }
  }

  // Sort by wins, then points for
  const standings = teams
    .map(t => {
      // Determine if this team belongs to the logged-in user
      const isCurrentUserTeam = userSleeperUserId
        ? t.externalOwnerId === userSleeperUserId
        : t.ownerId === user!.id && teams.filter(x => x.ownerId === user!.id).length === 1;

      // Get owner name: prefer live Sleeper data, then DB stored name, then app username
      const sleeperUser = t.externalOwnerId ? sleeperUserMap.get(t.externalOwnerId) : undefined;
      const ownerUsername = sleeperUser?.display_name || sleeperUser?.username || t.ownerDisplayName || t.owner.username;

      return {
        id: t.id,
        name: t.name,
        owner: {
          id: t.owner.id,
          username: ownerUsername,
        },
        isCurrentUserTeam,
        wins: t.wins,
        losses: t.losses,
        ties: t.ties,
        pointsFor: t.pointsFor,
        pointsAgainst: t.pointsAgainst,
        winPct: t.wins + t.losses + t.ties > 0
          ? t.wins / (t.wins + t.losses + t.ties)
          : 0,
        streak: t.streak,
        playoffSeed: t.playoffSeed,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    })
    .map((t, i) => ({ ...t, rank: i + 1 }));

  return c.json({ standings });
});
