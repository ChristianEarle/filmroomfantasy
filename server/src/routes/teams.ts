import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import type { Env, Variables } from '../index';

// Rate limit for team routes: 60 req/min per IP
const teamRateLimit = rateLimit(60, 60 * 1000);

export const teamRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply rate limiting to all team routes
teamRoutes.use('*', teamRateLimit);

// Helper to get player stats summary
async function getPlayerStatsSummary(db: any, playerId: string, seasonYear: number, position?: string) {
  const stats = await db.query.playerWeeklyStats.findMany({
    where: and(
      eq(schema.playerWeeklyStats.playerId, playerId),
      eq(schema.playerWeeklyStats.seasonYear, seasonYear)
    ),
  });

  if (stats.length === 0) return null;

  // DEF plays every game - count each week as played; K requires FG/XP attempts
  const isDef = position === 'DEF';

  const totals = stats.reduce((acc: any, week: any) => {
    const played = isDef ||
      (week.offSnaps ?? 0) > 0 || (week.defSnaps ?? 0) > 0 || (week.stSnaps ?? 0) > 0 ||
      ((week.passAttempts ?? 0) > 0 || (week.rushAttempts ?? 0) > 0 || (week.targets ?? 0) > 0 ||
      (week.receptions ?? 0) > 0 || (week.fgAttempts ?? 0) > 0 || (week.xpAttempts ?? 0) > 0 ||
      (week.sacks ?? 0) > 0 || (week.defInterceptions ?? 0) > 0);
    const snapPct = (() => {
      const off = week.offSnaps ?? 0, def = week.defSnaps ?? 0, st = week.stSnaps ?? 0;
      const tmOff = week.tmOffSnaps ?? 0, tmDef = week.tmDefSnaps ?? 0, tmSt = week.tmStSnaps ?? 0;
      if (off > 0 && tmOff > 0) return (off / tmOff) * 100;
      if (def > 0 && tmDef > 0) return (def / tmDef) * 100;
      if (st > 0 && tmSt > 0) return (st / tmSt) * 100;
      return null;
    })();
    return {
      games: acc.games + 1,
      gamesPlayed: acc.gamesPlayed + (played ? 1 : 0),
      snapPctSum: acc.snapPctSum + (snapPct != null ? snapPct : 0),
      fantasyPointsPPR: acc.fantasyPointsPPR + (week.fantasyPointsPPR || 0),
      fantasyPointsHalf: acc.fantasyPointsHalf + (week.fantasyPointsHalf || 0),
      fantasyPointsStd: acc.fantasyPointsStd + (week.fantasyPointsStd || 0),
      passYards: acc.passYards + (week.passYards || 0),
      passTDs: acc.passTDs + (week.passTDs || 0),
      rushYards: acc.rushYards + (week.rushYards || 0),
      rushTDs: acc.rushTDs + (week.rushTDs || 0),
      receptions: acc.receptions + (week.receptions || 0),
      receivingYards: acc.receivingYards + (week.receivingYards || 0),
      receivingTDs: acc.receivingTDs + (week.receivingTDs || 0),
    };
  }, {
    games: 0,
    gamesPlayed: 0,
    snapPctSum: 0,
    fantasyPointsPPR: 0,
    fantasyPointsHalf: 0,
    fantasyPointsStd: 0,
    passYards: 0,
    passTDs: 0,
    rushYards: 0,
    rushTDs: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTDs: 0,
  });

  const gp = totals.gamesPlayed ?? totals.games;
  const averageSnapPct = totals.snapPctSum > 0 && gp > 0 ? Math.round((totals.snapPctSum / gp) * 10) / 10 : null;
  return {
    ...totals,
    averageSnapPct,
    avgPointsPPR: gp > 0 ? Math.round((totals.fantasyPointsPPR / gp) * 10) / 10 : 0,
    avgPointsHalf: gp > 0 ? Math.round((totals.fantasyPointsHalf / gp) * 10) / 10 : 0,
    avgPointsStd: gp > 0 ? Math.round((totals.fantasyPointsStd / gp) * 10) / 10 : 0,
  };
}

// Get team details
teamRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: {
      owner: true,
      league: true,
      roster: {
        with: {
          player: true,
        },
      },
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Check if user is in the same league
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, team.leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  return c.json({
    team: {
      id: team.id,
      name: team.name,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      pointsFor: team.pointsFor,
      pointsAgainst: team.pointsAgainst,
      streak: team.streak,
      waiverPriority: team.waiverPriority,
      faabBudget: team.faabBudget,
      isOwner: team.ownerId === user.id,
      owner: {
        id: team.owner.id,
        username: team.owner.username,
        avatarUrl: team.owner.avatarUrl,
      },
      league: {
        id: team.league.id,
        name: team.league.name,
        scoringFormat: team.league.scoringFormat,
      },
      roster: team.roster.map(r => ({
        id: r.id,
        slot: r.slot,
        isStarter: r.isStarter,
        acquiredAt: r.acquiredAt,
        acquiredType: r.acquiredType,
        player: {
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          position: r.player.position,
          status: r.player.status,
          injuryNote: r.player.injuryNote,
          headshotUrl: r.player.headshotUrl,
          byeWeek: r.player.byeWeek,
        },
      })),
    },
  });
});

// Update team name
teamRoutes.put('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (team.ownerId !== user.id) {
    return c.json({ error: 'Only the team owner can update the team' }, 403);
  }

  try {
    const { name } = await c.req.json();

    if (name) {
      if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
        return c.json({ error: 'Team name must be between 1 and 100 characters' }, 400);
      }
      await db
        .update(schema.teams)
        .set({ name: name.trim(), updatedAt: new Date() })
        .where(eq(schema.teams.id, teamId));
    }

    const updatedTeam = await db.query.teams.findFirst({
      where: eq(schema.teams.id, teamId),
    });

    return c.json({ team: updatedTeam });
  } catch (error) {
    console.error('Update team error:', error);
    return c.json({ error: 'Failed to update team' }, 500);
  }
});

// Get team roster with stats and projections
teamRoutes.get('/:id/roster', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: {
      league: true,
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  // Check if user is in the same league
  const membership = await db.query.leagueMembers.findFirst({
    where: and(
      eq(schema.leagueMembers.userId, user.id),
      eq(schema.leagueMembers.leagueId, team.leagueId)
    ),
  });

  if (!membership) {
    return c.json({ error: 'Not a member of this league' }, 403);
  }

  const roster = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, teamId),
    with: {
      player: true,
    },
  });

  const seasonYear = team.league?.seasonYear || new Date().getFullYear();
  const scoringFormat = team.league?.scoringFormat || 'ppr';
  const currentWeek = team.league?.currentWeek || 1;

  // Enrich roster with stats and projections
  const enrichedRoster = await Promise.all(roster.map(async (r) => {
    // Get season stats
    const seasonStats = await getPlayerStatsSummary(db, r.player.id, seasonYear, r.player.position);

    // Get current projection
    const projection = await db.query.playerProjections.findFirst({
      where: and(
        eq(schema.playerProjections.playerId, r.player.id),
        eq(schema.playerProjections.seasonYear, seasonYear),
        eq(schema.playerProjections.scoringFormat, scoringFormat)
      ),
      orderBy: desc(schema.playerProjections.week),
    });

    // Get current week's actual stats
    const currentWeekStats = await db.query.playerWeeklyStats.findFirst({
      where: and(
        eq(schema.playerWeeklyStats.playerId, r.player.id),
        eq(schema.playerWeeklyStats.seasonYear, seasonYear),
        eq(schema.playerWeeklyStats.week, currentWeek)
      ),
    });

    // Get most recent week's stats (for "Last Week" display)
    const lastWeekStats = await db.query.playerWeeklyStats.findFirst({
      where: and(
        eq(schema.playerWeeklyStats.playerId, r.player.id),
        eq(schema.playerWeeklyStats.seasonYear, seasonYear)
      ),
      orderBy: desc(schema.playerWeeklyStats.week),
    });

    return {
      slot: r.slot,
      isStarter: r.isStarter,
      acquiredAt: r.acquiredAt,
      acquiredType: r.acquiredType,
      player: {
        ...r.player,
        // Season totals
        seasonStats: seasonStats ? {
          games: seasonStats.games,
          gamesPlayed: seasonStats.gamesPlayed ?? seasonStats.games,
          averageSnapPct: seasonStats.averageSnapPct ?? null,
          totalPoints: scoringFormat === 'ppr'
            ? seasonStats.fantasyPointsPPR
            : scoringFormat === 'half_ppr'
              ? seasonStats.fantasyPointsHalf
              : seasonStats.fantasyPointsStd,
          avgPoints: scoringFormat === 'ppr'
            ? seasonStats.avgPointsPPR
            : scoringFormat === 'half_ppr'
              ? seasonStats.avgPointsHalf
              : seasonStats.avgPointsStd,
          passYards: seasonStats.passYards,
          passTDs: seasonStats.passTDs,
          rushYards: seasonStats.rushYards,
          rushTDs: seasonStats.rushTDs,
          receptions: seasonStats.receptions,
          receivingYards: seasonStats.receivingYards,
          receivingTDs: seasonStats.receivingTDs,
        } : null,
        // Current week projection
        projectedPoints: projection?.projectedPoints || 0,
        // Current week actual points
        actualPoints: currentWeekStats
          ? (scoringFormat === 'ppr'
            ? currentWeekStats.fantasyPointsPPR
            : scoringFormat === 'half_ppr'
              ? currentWeekStats.fantasyPointsHalf
              : currentWeekStats.fantasyPointsStd)
          : null,
        // Last week's actual points
        lastWeekPoints: lastWeekStats
          ? (scoringFormat === 'ppr'
            ? lastWeekStats.fantasyPointsPPR
            : scoringFormat === 'half_ppr'
              ? lastWeekStats.fantasyPointsHalf
              : lastWeekStats.fantasyPointsStd)
          : null,
      },
    };
  }));

  // Separate starters and bench
  const starters = enrichedRoster.filter(r => r.isStarter);
  const bench = enrichedRoster.filter(r => !r.isStarter);

  // Calculate team projected total
  const projectedTotal = starters.reduce((sum, r) => sum + (r.player.projectedPoints || 0), 0);

  return c.json({
    roster: {
      starters,
      bench,
      projectedTotal: Math.round(projectedTotal * 10) / 10,
      scoringFormat,
    },
  });
});

// Set lineup (move players between slots)
teamRoutes.put('/:id/roster', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (team.ownerId !== user.id) {
    return c.json({ error: 'Only the team owner can set the lineup' }, 403);
  }

  try {
    const { moves } = await c.req.json();

    // moves: [{ playerId: string, newSlot: string, isStarter: boolean }]
    for (const move of moves) {
      const { playerId, newSlot, isStarter } = move;

      await db
        .update(schema.rosterSpots)
        .set({
          slot: newSlot,
          isStarter: isStarter ?? false,
        })
        .where(
          and(
            eq(schema.rosterSpots.teamId, teamId),
            eq(schema.rosterSpots.playerId, playerId)
          )
        );
    }

    return c.json({ message: 'Lineup updated successfully' });
  } catch (error) {
    console.error('Set lineup error:', error);
    return c.json({ error: 'Failed to update lineup' }, 500);
  }
});

// Add player to roster (free agent)
teamRoutes.post('/:id/roster/add', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: {
      roster: true,
    },
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (team.ownerId !== user.id) {
    return c.json({ error: 'Only the team owner can add players' }, 403);
  }

  try {
    const { playerId, slot, dropPlayerId } = await c.req.json();

    // Check if player exists
    const player = await db.query.nflPlayers.findFirst({
      where: eq(schema.nflPlayers.id, playerId),
    });

    if (!player) {
      return c.json({ error: 'Player not found' }, 404);
    }

    // Check if player is already on a team in this league
    const existingRoster = await db.query.rosterSpots.findFirst({
      where: eq(schema.rosterSpots.playerId, playerId),
      with: {
        team: true,
      },
    });

    if (existingRoster && existingRoster.team.leagueId === team.leagueId) {
      return c.json({ error: 'Player is already on a team in this league' }, 400);
    }

    // If dropping a player, remove them first
    if (dropPlayerId) {
      await db
        .delete(schema.rosterSpots)
        .where(
          and(
            eq(schema.rosterSpots.teamId, teamId),
            eq(schema.rosterSpots.playerId, dropPlayerId)
          )
        );
    }

    // Add the new player
    await db.insert(schema.rosterSpots).values({
      id: generateId(),
      teamId,
      playerId,
      slot: slot || 'BN1',
      isStarter: false,
      acquiredType: 'free_agent',
    });

    return c.json({ message: 'Player added successfully' }, 201);
  } catch (error) {
    console.error('Add player error:', error);
    return c.json({ error: 'Failed to add player' }, 500);
  }
});

// Drop player from roster
teamRoutes.delete('/:id/roster/:playerId', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const teamId = c.req.param('id');
  const playerId = c.req.param('playerId');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });

  if (!team) {
    return c.json({ error: 'Team not found' }, 404);
  }

  if (team.ownerId !== user.id) {
    return c.json({ error: 'Only the team owner can drop players' }, 403);
  }

  try {
    const rosterSpot = await db.query.rosterSpots.findFirst({
      where: and(
        eq(schema.rosterSpots.teamId, teamId),
        eq(schema.rosterSpots.playerId, playerId)
      ),
    });

    if (!rosterSpot) {
      return c.json({ error: 'Player not on roster' }, 404);
    }

    await db
      .delete(schema.rosterSpots)
      .where(eq(schema.rosterSpots.id, rosterSpot.id));

    return c.json({ message: 'Player dropped successfully' });
  } catch (error) {
    console.error('Drop player error:', error);
    return c.json({ error: 'Failed to drop player' }, 500);
  }
});
