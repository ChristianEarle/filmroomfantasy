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
import { generateProjectionsFromProps } from '../services/projections';
import type { Env, Variables } from '../index';

// Rate limit for league routes: 60 req/min per IP (all auth-gated)
const leagueRateLimit = rateLimit(60, 60 * 1000);

export const leagueRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

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

    if (!name) {
      return c.json({ error: 'League name is required' }, 400);
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

  return c.json({
    league: {
      ...league,
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
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
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
    const { teamName } = body;

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
leagueRoutes.post('/connect', authMiddleware, async (c) => {
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
    } = body;

    if (!platform || !externalId || !name) {
      return c.json({ error: 'Platform, external ID, and name are required' }, 400);
    }

    // Check league limit for free users (max 1 league)
    if (user.subscriptionTier === 'free') {
      const userLeagues = await db.query.leagueMembers.findMany({
        where: eq(schema.leagueMembers.userId, user.id),
      });

      if (userLeagues.length >= 1) {
        return c.json(
          {
            error: 'Upgrade to Pro to connect multiple leagues',
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

      // Add user to existing league (store sleeperUsername so sync can find their team)
      await db.insert(schema.leagueMembers).values({
        id: generateId(),
        userId: user.id,
        leagueId: existingLeague.id,
        role: 'member',
        externalUsername: sleeperUsername || null,
      });

      // Create team for user
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
    });

    // Add user as commissioner
    await db.insert(schema.leagueMembers).values({
      id: generateId(),
      userId: user.id,
      leagueId,
      role: 'commissioner',
      externalUsername: sleeperUsername || null,
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
    console.error('Connect league error:', error);
    return c.json({ error: 'Failed to connect league' }, 500);
  }
});

// Sync league data from external platform
leagueRoutes.post('/:id/sync', authMiddleware, async (c) => {
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
      // Fetch rosters from Sleeper
      const rostersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/rosters`);
      if (!rostersResponse.ok) {
        return c.json({ error: 'Failed to fetch rosters from Sleeper' }, 500);
      }
      const rostersRaw = await rostersResponse.json();
      const rosters = validateSleeperArray(rostersRaw, isValidSleeperRoster, 'rosters');
      if (rosters.length === 0) {
        return c.json({ error: 'No valid rosters returned from Sleeper' }, 500);
      }

      // Fetch users from Sleeper
      const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}/users`);
      if (!usersResponse.ok) {
        return c.json({ error: 'Failed to fetch users from Sleeper' }, 500);
      }
      const sleeperUsersRaw = await usersResponse.json();
      const sleeperUsers = validateSleeperArray(sleeperUsersRaw, isValidSleeperUser, 'users');

      // Fetch all NFL players from Sleeper (cached - this is a large dataset, may take 15-20s)
      let sleeperPlayers: Record<string, any> = {};
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        const playersResponse = await fetch('https://api.sleeper.app/v1/players/nfl', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (playersResponse.ok) {
          sleeperPlayers = await playersResponse.json() as Record<string, any>;
        }
      } catch (e) {
        console.error('Failed to fetch Sleeper players (sync continues with basic player names):', e);
      }

      // Create a map of owner_id to user info
      const userMap = new Map<string, any>();
      for (const sleeperUser of sleeperUsers) {
        userMap.set(sleeperUser.user_id, sleeperUser);
      }

      // Find the current user's team in our database
      const userTeam = league.teams.find(t => t.ownerId === user.id);

      // Find which Sleeper user matches this app user (by externalUsername)
      let userSleeperUserId: string | null = null;
      if (membership.externalUsername) {
        // Find the Sleeper user that matches the stored username
        for (const sleeperUser of sleeperUsers) {
          if (
            sleeperUser.display_name?.toLowerCase() === membership.externalUsername.toLowerCase() ||
            sleeperUser.username?.toLowerCase() === membership.externalUsername.toLowerCase()
          ) {
            userSleeperUserId = sleeperUser.user_id;
            break;
          }
        }
      }

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
          // Check if team already exists (by external roster ID stored in name temporarily)
          const existingTeam = league.teams.find(t =>
            t.name === teamName || t.name.includes(`Roster ${roster.roster_id}`)
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

        // Sync roster players
        if (roster.players && roster.players.length > 0 && (isUserTeam || team)) {
          // First, delete existing roster spots for this team
          await db.delete(schema.rosterSpots)
            .where(eq(schema.rosterSpots.teamId, team.id));

          // Get starters array from roster
          const starters = roster.starters || [];

          // Define starting slots based on typical fantasy lineup
          const starterSlots = ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DEF'];

          for (let i = 0; i < roster.players.length; i++) {
            const playerId = roster.players[i];
            if (!playerId || INVALID_PLAYER_IDS.has(String(playerId).toLowerCase())) continue;
            const isStarter = starters.includes(playerId);
            const starterIndex = starters.indexOf(playerId);

            // Determine slot
            let slot: string;
            if (isStarter && starterIndex >= 0 && starterIndex < starterSlots.length) {
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

            // If player doesn't exist, create from pre-fetched Sleeper data
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
              player = { id: newPlayerId } as any;
              existingPlayersByExtId.set(playerId, { id: newPlayerId });
            }

            // Insert roster spot (player is guaranteed to exist at this point)
            if (player) {
              await db.insert(schema.rosterSpots).values({
                id: generateId(),
                teamId: team.id,
                playerId: player.id,
                slot,
                isStarter,
                acquiredType: 'sync',
              });
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

      // Map rosters to teams by matching names
      for (const roster of rosters) {
        const sleeperUser = userMap.get(roster.owner_id);
        const teamName = sleeperUser?.metadata?.team_name || sleeperUser?.display_name || `Team ${roster.roster_id}`;
        const matchingTeam = updatedTeams.find(t => t.name === teamName);
        if (matchingTeam) {
          rosterIdToTeamId.set(roster.roster_id, matchingTeam.id);
        }
      }

      // ── Fetch Sleeper league metadata to get accurate week & settings ──
      let matchupsImported = 0;
      let regularSeasonWeeks = 14; // fallback
      let playoffWeeksCount = league.playoffWeeks || 3; // fallback
      let effectiveCurrentWeek = league.currentWeek || 1;

      try {
        const sleeperLeagueRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
        if (sleeperLeagueRes.ok) {
          const sleeperLeague = await sleeperLeagueRes.json() as any;
          const settings = sleeperLeague?.settings || {};
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

          // Persist accurate league settings from Sleeper
          await db.update(schema.leagues)
            .set({
              currentWeek: effectiveCurrentWeek,
              playoffTeams: sleeperPlayoffTeams,
              teamCount: sleeperTeamCount,
              playoffWeeks: (playoffWeeksCount = settings.playoff_round_type === 2 ? 2 : 3),
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

      // Fetch stats for each completed week including playoffs (with throttling between requests)
      const statsWeekLimit = Math.min(effectiveCurrentWeek, totalWeeks);
      for (let week = 1; week <= statsWeekLimit; week++) {
        try {
          // Throttle: 150ms delay between sequential stats fetches
          if (week > 1) await sleep(150);

          // Use api.sleeper.com for stats — post-season uses same week numbers
          const seasonType = week > regularSeasonWeeks ? 'post' : 'regular';
          const statsResponse = await fetch(
            `https://api.sleeper.com/stats/nfl/${league.seasonYear}/${week}?season_type=${seasonType}`
          );

          if (!statsResponse.ok) {
            console.log(`No stats available for week ${week} (HTTP ${statsResponse.status})`);
            continue;
          }

          const weekStats = await statsResponse.json() as Record<string, any>;

          // Process stats for rostered players only
          for (const sleeperPlayerId of allRosteredPlayerIds) {
            const playerStats = weekStats[sleeperPlayerId];
            if (!playerStats) continue;

            // Find the player in our database by external ID
            const player = await db.query.nflPlayers.findFirst({
              where: eq(schema.nflPlayers.externalId, sleeperPlayerId),
            });

            if (!player) continue;

            // Check if stats already exist for this player/week
            const existingStats = await db.query.playerWeeklyStats.findFirst({
              where: and(
                eq(schema.playerWeeklyStats.playerId, player.id),
                eq(schema.playerWeeklyStats.week, week),
                eq(schema.playerWeeklyStats.seasonYear, league.seasonYear)
              ),
            });

            const statsData = {
              playerId: player.id,
              week,
              seasonYear: league.seasonYear,
              opponent: playerStats.opponent || null,

              // Passing
              passAttempts: playerStats.pass_att || 0,
              passCompletions: playerStats.pass_cmp || 0,
              passYards: playerStats.pass_yd || 0,
              passTDs: playerStats.pass_td || 0,
              passInterceptions: playerStats.pass_int || 0,

              // Rushing
              rushAttempts: playerStats.rush_att || 0,
              rushYards: playerStats.rush_yd || 0,
              rushTDs: playerStats.rush_td || 0,

              // Receiving
              targets: playerStats.rec_tgt || 0,
              receptions: playerStats.rec || 0,
              receivingYards: playerStats.rec_yd || 0,
              receivingTDs: playerStats.rec_td || 0,

              // Misc
              fumbles: playerStats.fum || 0,
              fumblesLost: playerStats.fum_lost || 0,
              twoPointConversions: (playerStats.pass_2pt || 0) + (playerStats.rush_2pt || 0) + (playerStats.rec_2pt || 0),

              // Kicking
              fgMade: playerStats.fgm || 0,
              fgAttempts: playerStats.fga || 0,
              fg40PlusMade: (playerStats.fgm_40_49 || 0) + (playerStats.fgm_50p || 0),
              fg50PlusMade: playerStats.fgm_50p || 0,
              xpMade: playerStats.xpm || 0,
              xpAttempts: playerStats.xpa || 0,

              // Snap counts
              offSnaps: Math.round(playerStats.off_snp || 0),
              defSnaps: Math.round(playerStats.def_snp || 0),
              stSnaps: Math.round(playerStats.st_snp || 0),
              tmOffSnaps: Math.round(playerStats.tm_off_snp || 0),
              tmDefSnaps: Math.round(playerStats.tm_def_snp || 0),
              tmStSnaps: Math.round(playerStats.tm_st_snp || 0),

              // Defense (for team defenses)
              sacks: playerStats.sack || 0,
              defInterceptions: playerStats.int || 0,
              fumblesRecovered: playerStats.fum_rec || 0,
              defenseTDs: (playerStats.def_td || 0) + (playerStats.st_td || 0),
              safeties: playerStats.safe || 0,
              pointsAllowed: playerStats.pts_allow || 0,

              // Fantasy Points (Sleeper provides these)
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
              statsImported++;
            }
          }
        } catch (e) {
          console.error(`Failed to fetch stats for week ${week}:`, e);
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

          // Import projections for players NOT already covered by book lines
          for (const [sleeperPlayerId, playerProj] of Object.entries(projections)) {
            if (!playerProj) continue;

            // Only import if the player exists in our database
            const player = await db.query.nflPlayers.findFirst({
              where: eq(schema.nflPlayers.externalId, sleeperPlayerId),
            });

            if (!player) continue;

            // Skip players already covered by book line projections
            if (playersCoveredByProps.has(player.id)) continue;

            // Determine scoring format from league
            const scoringFormat = league.scoringFormat || 'ppr';

            // Check if projection exists
            const existingProj = await db.query.playerProjections.findFirst({
              where: and(
                eq(schema.playerProjections.playerId, player.id),
                eq(schema.playerProjections.week, projectionWeek),
                eq(schema.playerProjections.seasonYear, league.seasonYear),
                eq(schema.playerProjections.scoringFormat, scoringFormat)
              ),
            });

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

      return c.json({
        success: true,
        message: `League synced successfully from Sleeper. ${rosters.length} teams, ${matchupsImported} matchups, ${statsImported} player stats, ${propsProjectionsCount} projections from book lines, and ${projectionsImported} projections from Sleeper updated.`,
        teamsUpdated: rosters.length,
        matchupsImported,
        statsImported,
        projectionsImported,
        propsProjections: propsProjectionsCount,
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
