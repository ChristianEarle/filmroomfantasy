import { Hono } from 'hono';
import { eq, and, inArray, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import type { Env, Variables } from '../index';

// Rate limit for matchup routes: 60 req/min per IP
const matchupRateLimit = rateLimit(60, 60 * 1000);

export const matchupRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply rate limiting to all matchup routes
matchupRoutes.use('*', matchupRateLimit);

// Helper: pick the right fantasy points column based on league scoring format
function getPointsColumn(scoringFormat: string) {
  switch (scoringFormat) {
    case 'half_ppr':
    case 'half-ppr':
      return schema.playerWeeklyStats.fantasyPointsHalf;
    case 'standard':
      return schema.playerWeeklyStats.fantasyPointsStd;
    default: // 'ppr'
      return schema.playerWeeklyStats.fantasyPointsPPR;
  }
}

function getProjectedPointsColumn(scoringFormat: string) {
  return schema.playerProjections.projectedPoints;
}

// Get matchup details
matchupRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const matchupId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const matchup = await db.query.matchups.findFirst({
      where: eq(schema.matchups.id, matchupId),
      with: {
        league: true,
        homeTeam: {
          with: {
            owner: true,
            roster: {
              with: {
                player: true,
              },
            },
          },
        },
        awayTeam: {
          with: {
            owner: true,
            roster: {
              with: {
                player: true,
              },
            },
          },
        },
      },
    });

    if (!matchup) {
      return c.json({ error: 'Matchup not found' }, 404);
    }

    // Check if user is in the league
    const membership = await db.query.leagueMembers.findFirst({
      where: and(
        eq(schema.leagueMembers.userId, user.id),
        eq(schema.leagueMembers.leagueId, matchup.leagueId)
      ),
    });

    if (!membership) {
      return c.json({ error: 'Not a member of this league' }, 403);
    }

    // Collect all player IDs from both rosters to batch-fetch stats and projections
    const allRosterPlayers = [
      ...(matchup.homeTeam?.roster || []),
      ...(matchup.awayTeam?.roster || []),
    ];
    const allPlayerIds = allRosterPlayers.map(r => r.player.id);
    const scoringFormat = matchup.league.scoringFormat || 'ppr';
    const seasonYear = matchup.league.seasonYear;
    const week = matchup.week;

    // Batch fetch weekly stats for all roster players
    const statsMap = new Map<string, number>();
    if (allPlayerIds.length > 0) {
      const pointsCol = getPointsColumn(scoringFormat);
      const stats = await db
        .select({
          playerId: schema.playerWeeklyStats.playerId,
          points: pointsCol,
        })
        .from(schema.playerWeeklyStats)
        .where(
          and(
            inArray(schema.playerWeeklyStats.playerId, allPlayerIds),
            eq(schema.playerWeeklyStats.week, week),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear)
          )
        );
      for (const s of stats) {
        statsMap.set(s.playerId, (s.points as number) || 0);
      }
    }

    // Batch fetch projections for all roster players
    const projMap = new Map<string, number>();
    if (allPlayerIds.length > 0) {
      // Normalize scoring format for projections table
      const projScoringFormat = scoringFormat === 'half_ppr' ? 'half-ppr' : scoringFormat;
      const projections = await db
        .select({
          playerId: schema.playerProjections.playerId,
          projectedPoints: schema.playerProjections.projectedPoints,
        })
        .from(schema.playerProjections)
        .where(
          and(
            inArray(schema.playerProjections.playerId, allPlayerIds),
            eq(schema.playerProjections.week, week),
            eq(schema.playerProjections.seasonYear, seasonYear),
            eq(schema.playerProjections.scoringFormat, projScoringFormat)
          )
        );
      for (const p of projections) {
        projMap.set(p.playerId, (p.projectedPoints as number) || 0);
      }
    }

    // Format the response
    const formatTeam = (team: typeof matchup.homeTeam, score: number | null, projectedScore: number | null) => {
      const starters = team.roster
        .filter(r => r.isStarter)
        .map(r => ({
          slot: r.slot,
          player: {
            id: r.player.id,
            name: r.player.name,
            team: r.player.team,
            position: r.player.position,
            status: r.player.status,
            headshotUrl: r.player.headshotUrl,
          },
          points: statsMap.get(r.player.id) || 0,
          projectedPoints: projMap.get(r.player.id) || 0,
        }));

      // Calculate team score from starters if no stored score
      const calculatedScore = starters.reduce((sum, s) => sum + s.points, 0);
      const calculatedProjected = starters.reduce((sum, s) => sum + s.projectedPoints, 0);

      return {
        id: team.id,
        name: team.name,
        owner: {
          id: team.owner.id,
          username: team.owner.username,
          avatarUrl: team.owner.avatarUrl,
        },
        record: `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}`,
        score: score || calculatedScore,
        projectedScore: projectedScore || calculatedProjected,
        starters,
        bench: team.roster
          .filter(r => !r.isStarter)
          .map(r => ({
            slot: r.slot,
            player: {
              id: r.player.id,
              name: r.player.name,
              team: r.player.team,
              position: r.player.position,
              status: r.player.status,
              headshotUrl: r.player.headshotUrl,
            },
            points: statsMap.get(r.player.id) || 0,
            projectedPoints: projMap.get(r.player.id) || 0,
          })),
      };
    };

    return c.json({
      matchup: {
        id: matchup.id,
        week: matchup.week,
        isPlayoff: matchup.isPlayoff,
        isChampionship: matchup.isChampionship,
        isComplete: matchup.isComplete,
        league: {
          id: matchup.league.id,
          name: matchup.league.name,
          scoringFormat: matchup.league.scoringFormat,
        },
        homeTeam: formatTeam(matchup.homeTeam, matchup.homeScore, matchup.homeProjectedScore),
        awayTeam: formatTeam(matchup.awayTeam, matchup.awayScore, matchup.awayProjectedScore),
      },
    });
  } catch (error) {
    console.error('Get matchup error:', error);
    return c.json({ error: 'Failed to fetch matchup' }, 500);
  }
});

// Get live scoring for a matchup (for real-time updates)
matchupRoutes.get('/:id/live', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const matchupId = c.req.param('id');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const matchup = await db.query.matchups.findFirst({
      where: eq(schema.matchups.id, matchupId),
    });

    if (!matchup) {
      return c.json({ error: 'Matchup not found' }, 404);
    }

    // Calculate live scores from player_weekly_stats
    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, matchup.leagueId),
    });
    const scoringFormat = league?.scoringFormat || 'ppr';
    const seasonYear = league?.seasonYear || new Date().getFullYear();
    const pointsCol = getPointsColumn(scoringFormat);

    // Get starters for both teams
    const homeRoster = await db.query.rosterSpots.findMany({
      where: and(
        eq(schema.rosterSpots.teamId, matchup.homeTeamId),
        eq(schema.rosterSpots.isStarter, true)
      ),
    });
    const awayRoster = await db.query.rosterSpots.findMany({
      where: and(
        eq(schema.rosterSpots.teamId, matchup.awayTeamId),
        eq(schema.rosterSpots.isStarter, true)
      ),
    });

    const allStarterIds = [
      ...homeRoster.map(r => r.playerId),
      ...awayRoster.map(r => r.playerId),
    ];

    // Batch fetch stats
    const statsMap = new Map<string, number>();
    if (allStarterIds.length > 0) {
      const stats = await db
        .select({
          playerId: schema.playerWeeklyStats.playerId,
          points: pointsCol,
        })
        .from(schema.playerWeeklyStats)
        .where(
          and(
            inArray(schema.playerWeeklyStats.playerId, allStarterIds),
            eq(schema.playerWeeklyStats.week, matchup.week),
            eq(schema.playerWeeklyStats.seasonYear, seasonYear)
          )
        );
      for (const s of stats) {
        statsMap.set(s.playerId, (s.points as number) || 0);
      }
    }

    const homeScore = homeRoster.reduce((sum, r) => sum + (statsMap.get(r.playerId) || 0), 0);
    const awayScore = awayRoster.reduce((sum, r) => sum + (statsMap.get(r.playerId) || 0), 0);

    return c.json({
      matchupId: matchup.id,
      homeScore: matchup.homeScore || Math.round(homeScore * 100) / 100,
      awayScore: matchup.awayScore || Math.round(awayScore * 100) / 100,
      homeProjectedScore: matchup.homeProjectedScore || 0,
      awayProjectedScore: matchup.awayProjectedScore || 0,
      isComplete: matchup.isComplete,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get live scoring error:', error);
    return c.json({ error: 'Failed to fetch live scoring' }, 500);
  }
});

// Get all matchups for a league week
matchupRoutes.get('/league/:leagueId/week/:week', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');
  const week = parseInt(c.req.param('week'));

  if (isNaN(week) || week < 1 || week > 22) {
    return c.json({ error: 'Invalid week number' }, 400);
  }

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
    const matchups = await db.query.matchups.findMany({
      where: and(
        eq(schema.matchups.leagueId, leagueId),
        eq(schema.matchups.week, week)
      ),
      with: {
        homeTeam: {
          with: { owner: true },
        },
        awayTeam: {
          with: { owner: true },
        },
      },
    });

    return c.json({
      week,
      matchups: matchups.map(m => ({
        id: m.id,
        isPlayoff: m.isPlayoff,
        isChampionship: m.isChampionship,
        isComplete: m.isComplete,
        homeTeam: {
          id: m.homeTeam.id,
          name: m.homeTeam.name,
          owner: m.homeTeam.ownerDisplayName || m.homeTeam.owner.username,
          score: m.homeScore || 0,
          projectedScore: m.homeProjectedScore || 0,
        },
        awayTeam: {
          id: m.awayTeam.id,
          name: m.awayTeam.name,
          owner: m.awayTeam.ownerDisplayName || m.awayTeam.owner.username,
          score: m.awayScore || 0,
          projectedScore: m.awayProjectedScore || 0,
        },
      })),
    });
  } catch (error) {
    console.error('Get league matchups error:', error);
    return c.json({ error: 'Failed to fetch matchups' }, 500);
  }
});

// Get user's current matchup
matchupRoutes.get('/my/current', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.query('leagueId');

  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  if (!leagueId) {
    return c.json({ error: 'League ID required' }, 400);
  }

  try {
    // Get league and current week
    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, leagueId),
    });

    if (!league) {
      return c.json({ error: 'League not found' }, 404);
    }

    // Get user's team
    const team = await db.query.teams.findFirst({
      where: and(
        eq(schema.teams.leagueId, leagueId),
        eq(schema.teams.ownerId, user.id)
      ),
    });

    if (!team) {
      return c.json({ error: 'Team not found' }, 404);
    }

    // Find matchup where user's team is home or away
    const matchup = await db.query.matchups.findFirst({
      where: and(
        eq(schema.matchups.leagueId, leagueId),
        eq(schema.matchups.week, league.currentWeek)
      ),
      with: {
        homeTeam: { with: { owner: true } },
        awayTeam: { with: { owner: true } },
      },
    });

    if (!matchup) {
      return c.json({ error: 'No matchup found for current week' }, 404);
    }

    const isHome = matchup.homeTeamId === team.id;
    const myTeam = isHome ? matchup.homeTeam : matchup.awayTeam;
    const opponent = isHome ? matchup.awayTeam : matchup.homeTeam;
    const myScore = isHome ? matchup.homeScore : matchup.awayScore;
    const opponentScore = isHome ? matchup.awayScore : matchup.homeScore;

    return c.json({
      matchupId: matchup.id,
      week: matchup.week,
      myTeam: {
        id: myTeam.id,
        name: myTeam.name,
        score: myScore || 0,
      },
      opponent: {
        id: opponent.id,
        name: opponent.name,
        owner: opponent.ownerDisplayName || opponent.owner.username,
        score: opponentScore || 0,
      },
      isComplete: matchup.isComplete,
    });
  } catch (error) {
    console.error('Get current matchup error:', error);
    return c.json({ error: 'Failed to fetch current matchup' }, 500);
  }
});

// Get all matchups for a league (for playoff simulator)
matchupRoutes.get('/league/:leagueId/all', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.get('db');
  const leagueId = c.req.param('leagueId');

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
    // Fetch league to determine effective current week for isComplete
    const league = await db.query.leagues.findFirst({
      where: eq(schema.leagues.id, leagueId),
      columns: { currentWeek: true, externalId: true, platform: true },
    });

    // Determine effective current week: use league's stored currentWeek,
    // but if we're in the offseason (Feb-Aug), the season is fully complete
    let effectiveCurrentWeek = league?.currentWeek || 1;
    const currentMonth = new Date().getMonth(); // 0=Jan, 1=Feb, ... 7=Aug
    const isOffseason = currentMonth >= 1 && currentMonth <= 7;

    // For Sleeper leagues, try to get accurate week from Sleeper API
    if (league?.platform === 'sleeper' && league.externalId) {
      try {
        const sleeperRes = await fetch(`https://api.sleeper.app/v1/league/${league.externalId}`);
        if (sleeperRes.ok) {
          const sleeperLeague = await sleeperRes.json() as any;
          const settings = sleeperLeague?.settings || {};
          const playoffWeekStart = settings.playoff_week_start || 15;
          const regularSeasonWeeks = playoffWeekStart - 1;
          const sleeperLeg = settings.leg || 1;
          const leagueStatus = sleeperLeague?.status || 'in_season';

          if (leagueStatus === 'complete' || isOffseason || sleeperLeg > regularSeasonWeeks) {
            effectiveCurrentWeek = regularSeasonWeeks + 1;
          } else {
            effectiveCurrentWeek = sleeperLeg;
          }
        }
      } catch {
        // Fall through to offseason check below
      }
    }

    // Offseason fallback: if Sleeper fetch failed but we're in offseason, mark all weeks done
    if (isOffseason && effectiveCurrentWeek <= 1) {
      effectiveCurrentWeek = 19; // higher than any regular season week
    }

    const matchups = await db.query.matchups.findMany({
      where: eq(schema.matchups.leagueId, leagueId),
      with: {
        homeTeam: {
          with: { owner: true },
        },
        awayTeam: {
          with: { owner: true },
        },
      },
      orderBy: (matchups, { asc }) => [asc(matchups.week)],
    });

    return c.json({
      matchups: matchups.map(m => {
        // Derive isComplete: use DB flag, but also check against effectiveCurrentWeek
        const isComplete = m.isComplete || m.week < effectiveCurrentWeek;
        return {
          id: m.id,
          week: m.week,
          isPlayoff: m.isPlayoff,
          isChampionship: m.isChampionship,
          isComplete,
          homeTeam: {
            id: m.homeTeam.id,
            name: m.homeTeam.name,
            owner: m.homeTeam.ownerDisplayName || m.homeTeam.owner.username,
            score: m.homeScore || 0,
            projectedScore: m.homeProjectedScore || 0,
          },
          awayTeam: {
            id: m.awayTeam.id,
            name: m.awayTeam.name,
            owner: m.awayTeam.ownerDisplayName || m.awayTeam.owner.username,
            score: m.awayScore || 0,
            projectedScore: m.awayProjectedScore || 0,
          },
        };
      }),
    });
  } catch (error) {
    console.error('Get all league matchups error:', error);
    return c.json({ error: 'Failed to fetch matchups' }, 500);
  }
});
