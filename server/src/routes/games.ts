import { Hono } from 'hono';
import { eq, and, asc, inArray, like } from 'drizzle-orm';
import * as schema from '../db/schema';
import { optionalAuthMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { fetchEspnScoreboard, getNflSeasonContext, getTeamDisplayName, getStaticNetwork } from '../services/espn';
import { desc, limit } from 'drizzle-orm';
import type { Env, Variables } from '../index';

export const gameRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Rate limit public game endpoints: 60 requests per minute per IP
const publicRateLimit = rateLimit(60, 60 * 1000);
// Stricter rate limit for ESPN proxy: 20 requests per minute
const espnProxyRateLimit = rateLimit(20, 60 * 1000);

// Apply rate limit to all game routes
gameRoutes.use('*', publicRateLimit);

async function persistGamesToDb(
  db: any,
  rows: import('../services/espn').EspnGameRow[]
) {
  for (const row of rows) {
    const existing = await db.query.nflGames.findFirst({
      where: eq(schema.nflGames.id, row.id),
    });
    const values: Record<string, any> = {
      id: row.id,
      externalId: row.id,
      week: row.week,
      seasonYear: row.seasonYear,
      seasonType: row.seasonType,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      gameTime: row.gameTime,
      spread: row.spread,
      overUnder: row.overUnder,
      tvNetwork: row.tvNetwork,
      stadium: row.stadium,
      weather: row.weather,
      homeScore: row.homeScore ?? null,
      awayScore: row.awayScore ?? null,
      isComplete: row.homeScore != null && row.awayScore != null,
    };
    if (existing) {
      // Don't overwrite these fields with null — ESPN drops odds/broadcast for completed games
      if (values.tvNetwork == null && existing.tvNetwork) delete values.tvNetwork;
      if (values.spread == null && existing.spread != null) delete values.spread;
      if (values.overUnder == null && existing.overUnder != null) delete values.overUnder;
      await db.update(schema.nflGames).set(values).where(eq(schema.nflGames.id, row.id));
    } else {
      await db.insert(schema.nflGames).values(values);
    }
  }
}

// NFL teams that play in indoor/dome/retractable-roof stadiums
const INDOOR_TEAMS = new Set(['NO', 'DET', 'MIN', 'LV', 'IND', 'ATL', 'DAL', 'HOU', 'ARI']);

// Normalize team abbreviation aliases (ESPN uses WSH, Sleeper/player DB uses WAS)
function normalizeTeam(abbrev: string): string {
  return abbrev === 'WSH' ? 'WAS' : abbrev;
}

// Helper: map a DB game row to the slate API response shape
function dbGameToSlateGame(g: any) {
  let weather = g.weather ? (JSON.parse(g.weather) as { displayValue: string; temperature?: number }) : null;
  const gameTime = new Date(g.gameTime);
  const isFinalOrPast = g.isComplete || gameTime.getTime() < Date.now() - 4 * 3600000;

  // Fallback: if no weather data stored, infer from home team's stadium
  if (!weather) {
    if (INDOOR_TEAMS.has(g.homeTeam)) {
      weather = { displayValue: 'Indoor', temperature: 72 };
    } else if (isFinalOrPast) {
      weather = { displayValue: 'Outdoor' };
    }
  }

  return {
    id: g.id,
    awayTeam: getTeamDisplayName(g.awayTeam),
    awayTeamLogo: g.awayTeam,
    homeTeam: getTeamDisplayName(g.homeTeam),
    homeTeamLogo: g.homeTeam,
    gameTime: gameTime.toISOString(),
    gameTimeDisplay: gameTime.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    spread: g.spread != null ? Math.abs(g.spread) : null,
    favoredTeam: (g.spread != null && g.spread < 0 ? 'home' : 'away') as 'home' | 'away',
    overUnder: g.overUnder,
    tvNetwork: g.tvNetwork || getStaticNetwork(g.week, g.homeTeam, g.awayTeam) || 'TBD',
    weather,
    homeScore: g.homeScore ?? undefined,
    awayScore: g.awayScore ?? undefined,
    status: g.isComplete ? 'final' : isFinalOrPast ? 'final' : 'scheduled',
  };
}

// ── Top Performers for completed games ──

interface TopPerformer {
  playerName: string;
  position: string;
  fantasyPoints: number;
  statLine: string;
  headshotUrl: string | null;
}

function buildStatLine(position: string, stats: any): string {
  switch (position) {
    case 'QB': {
      const parts: string[] = [];
      if (stats.passYards) parts.push(`${Math.round(stats.passYards)} YDS`);
      if (stats.passTDs) parts.push(`${stats.passTDs} TD`);
      if (stats.passInterceptions) parts.push(`${stats.passInterceptions} INT`);
      if (stats.rushYards && stats.rushYards >= 20) parts.push(`${Math.round(stats.rushYards)} RUSH`);
      return parts.join(', ');
    }
    case 'RB': {
      const parts: string[] = [];
      if (stats.rushYards) parts.push(`${Math.round(stats.rushYards)} YDS`);
      if (stats.rushTDs) parts.push(`${stats.rushTDs} TD`);
      if (stats.receptions && stats.receptions >= 2) parts.push(`${stats.receptions} REC`);
      return parts.join(', ');
    }
    case 'WR':
    case 'TE': {
      const parts: string[] = [];
      if (stats.receptions) parts.push(`${stats.receptions} REC`);
      if (stats.receivingYards) parts.push(`${Math.round(stats.receivingYards)} YDS`);
      if (stats.receivingTDs) parts.push(`${stats.receivingTDs} TD`);
      return parts.join(', ');
    }
    case 'K': {
      const parts: string[] = [];
      if (stats.fgMade != null) parts.push(`${stats.fgMade}/${stats.fgAttempts} FG`);
      if (stats.xpMade != null) parts.push(`${stats.xpMade}/${stats.xpAttempts} XP`);
      return parts.join(', ');
    }
    case 'DEF': {
      const parts: string[] = [];
      if (stats.sacks) parts.push(`${stats.sacks} SCK`);
      if (stats.defInterceptions) parts.push(`${stats.defInterceptions} INT`);
      if (stats.pointsAllowed != null) parts.push(`${stats.pointsAllowed} PA`);
      return parts.join(', ');
    }
    default:
      return '';
  }
}

async function getTopPerformersForWeek(
  db: any,
  week: number,
  seasonYear: number,
  completedTeamPairs: Array<{ homeTeam: string; awayTeam: string; gameId: string }>
): Promise<Map<string, { home: TopPerformer | null; away: TopPerformer | null }>> {
  const result = new Map<string, { home: TopPerformer | null; away: TopPerformer | null }>();
  if (completedTeamPairs.length === 0) return result;

  // Collect all unique team abbreviations (normalized)
  const allTeams = new Set<string>();
  for (const pair of completedTeamPairs) {
    allTeams.add(normalizeTeam(pair.homeTeam));
    allTeams.add(normalizeTeam(pair.awayTeam));
  }

  // Query 1: all stats for this week/season (small result set — only players who played)
  const stats = await db.query.playerWeeklyStats.findMany({
    where: and(
      eq(schema.playerWeeklyStats.week, week),
      eq(schema.playerWeeklyStats.seasonYear, seasonYear),
    ),
  });

  if (stats.length === 0) return result;

  // Collect player IDs that have stats this week
  const playerIdSet = new Set<string>();
  for (const s of stats) { playerIdSet.add(s.playerId as string); }
  const playerIdsWithStats: string[] = [...playerIdSet];

  // Query 2: player info — chunk to stay under D1's variable limit (D1 max ~100)
  const CHUNK_SIZE = 80;
  const players: any[] = [];
  for (let i = 0; i < playerIdsWithStats.length; i += CHUNK_SIZE) {
    const chunk = playerIdsWithStats.slice(i, i + CHUNK_SIZE);
    const chunkPlayers = await db.query.nflPlayers.findMany({
      where: inArray(schema.nflPlayers.id, chunk),
      columns: { id: true, name: true, firstName: true, lastName: true, position: true, team: true, headshotUrl: true },
    });
    players.push(...chunkPlayers);
  }

  // Index stats by playerId
  const statsMap = new Map<string, any>();
  for (const s of stats) {
    statsMap.set(s.playerId, s);
  }

  // Index players by team (only those on teams we care about)
  const playerMap = new Map<string, any>();
  const playersByTeam = new Map<string, any[]>();
  for (const p of players) {
    playerMap.set(p.id, p);
    const normTeam = normalizeTeam(p.team);
    if (allTeams.has(normTeam)) {
      if (!playersByTeam.has(normTeam)) playersByTeam.set(normTeam, []);
      playersByTeam.get(normTeam)!.push(p);
    }
  }

  // For each completed game, find the top scorer per team
  for (const { homeTeam, awayTeam, gameId } of completedTeamPairs) {
    const findTopForTeam = (teamAbbrev: string, opponentAbbrev: string): TopPerformer | null => {
      const teamPlayers = playersByTeam.get(normalizeTeam(teamAbbrev)) ?? [];
      let best: { player: any; stats: any; points: number } | null = null;

      for (const player of teamPlayers) {
        const s = statsMap.get(player.id);
        if (!s) continue;
        // Validate opponent to ensure stats are from this game (normalize both sides)
        const statOpponent = normalizeTeam((s.opponent ?? '').toString().toUpperCase());
        const normalizedOpp = normalizeTeam(opponentAbbrev.toUpperCase());
        if (statOpponent && statOpponent !== normalizedOpp) continue;
        const pts = s.fantasyPointsPPR ?? 0;
        if (!best || pts > best.points) {
          best = { player, stats: s, points: pts };
        }
      }

      if (!best || best.points <= 0) return null;
      return {
        playerName: best.player.name || `${best.player.firstName ?? ''} ${best.player.lastName ?? ''}`.trim(),
        position: best.player.position,
        fantasyPoints: best.points,
        statLine: buildStatLine(best.player.position, best.stats),
        headshotUrl: best.player.headshotUrl ?? null,
      };
    };

    result.set(gameId, {
      home: findTopForTeam(homeTeam, awayTeam),
      away: findTopForTeam(awayTeam, homeTeam),
    });
  }

  return result;
}

async function enrichGamesWithTopPerformers(
  db: any,
  games: any[],
  week: number,
  season: number
): Promise<any[]> {
  // Identify completed games
  const completedPairs: Array<{ homeTeam: string; awayTeam: string; gameId: string }> = [];
  for (const g of games) {
    if (g.status === 'final') {
      completedPairs.push({
        homeTeam: g.homeTeamLogo,
        awayTeam: g.awayTeamLogo,
        gameId: g.id,
      });
    }
  }

  if (completedPairs.length === 0) return games;

  const topPerformers = await getTopPerformersForWeek(db, week, season, completedPairs);

  return games.map(g => {
    const performers = topPerformers.get(g.id);
    if (!performers) return g;
    return { ...g, topPerformers: performers };
  });
}

// GET /games/slate - returns games for Game Slate view
// Smart caching: uses DB when all games are complete, hits ESPN only when scores may be missing
gameRoutes.get('/slate', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = c.req.query('week') ? parseInt(c.req.query('week')!) : undefined;
  const ctx = getNflSeasonContext();
  const season = ctx.season;
  // During offseason (Feb–Aug), default to last regular season week
  const month = new Date().getMonth();
  const isOffseason = month >= 1 && month <= 7;
  const effectiveWeek = week ?? (isOffseason ? 18 : undefined);
  const seasontype = effectiveWeek != null && effectiveWeek >= 1 && effectiveWeek <= 18 ? '2' : ctx.seasontype;

  try {
    // 1. Check DB first
    let dbGames: any[] = [];
    const targetWeek = effectiveWeek ?? 18;
    if (effectiveWeek != null) {
      dbGames = await db.query.nflGames.findMany({
        where: and(eq(schema.nflGames.week, targetWeek), eq(schema.nflGames.seasonYear, season)),
        orderBy: asc(schema.nflGames.gameTime),
      });
    }

    if (dbGames.length > 0) {
      // Check if DB data is complete — all games either have scores or haven't started yet
      const now = Date.now();
      const needsRefresh = dbGames.some(g => {
        const gameStarted = new Date(g.gameTime).getTime() < now;
        const hasScores = g.isComplete && g.homeScore != null && g.awayScore != null;
        // Game has started but we don't have final scores → need ESPN refresh
        return gameStarted && !hasScores;
      });

      if (!needsRefresh) {
        // All games are either complete with scores or haven't started — use DB (no ESPN hit)
        const slateGames = dbGames.map(dbGameToSlateGame);
        const enriched = await enrichGamesWithTopPerformers(db, slateGames, targetWeek, season);
        return c.json({
          week: dbGames[0]?.week ?? targetWeek,
          season,
          weekLabel: `Week ${targetWeek}`,
          games: enriched,
        });
      }
    }

    // 2. DB is empty or has games missing scores — fetch from ESPN
    try {
      const result = await fetchEspnScoreboard(effectiveWeek, season, seasontype);
      if (result.source === 'espn') {
        // Clean up stale static-schedule entries before persisting real ESPN data
        const hasStaticGames = dbGames.some(g => String(g.id).startsWith('static-'));
        if (hasStaticGames) {
          await db.delete(schema.nflGames)
            .where(and(
              like(schema.nflGames.id, `static-%-w${targetWeek}-%`),
              eq(schema.nflGames.seasonYear, season)
            ));
        }
      }
      // Persist updated data (scores, status) to DB for future requests
      await persistGamesToDb(db, result.dbRows);

      // Fill in missing tvNetwork (ESPN drops broadcast info for completed games)
      for (const g of result.games) {
        if (!g.tvNetwork) {
          // Try DB first, then static schedule
          const dbMatch = dbGames.find(d => String(d.id) === String(g.id));
          g.tvNetwork = dbMatch?.tvNetwork || getStaticNetwork(result.week, g.homeTeamLogo, g.awayTeamLogo) || 'TBD';
        }
      }

      const enrichedEspn = await enrichGamesWithTopPerformers(db, result.games, result.week, season);
      return c.json({
        week: result.week,
        season: result.season,
        weekLabel: effectiveWeek != null ? `Week ${effectiveWeek}` : `Week ${result.week}`,
        games: enrichedEspn,
      });
    } catch (espnError) {
      console.warn('ESPN fetch failed, falling back to DB:', espnError instanceof Error ? espnError.message : espnError);
    }

    // 3. ESPN failed — return whatever DB has (if anything)
    if (dbGames.length > 0) {
      const fallbackGames = dbGames.map(dbGameToSlateGame);
      const enrichedFallback = await enrichGamesWithTopPerformers(db, fallbackGames, targetWeek, season);
      return c.json({
        week: dbGames[0]?.week ?? targetWeek,
        season,
        weekLabel: `Week ${targetWeek}`,
        games: enrichedFallback,
      });
    }

    // 4. No data at all — return empty with unavailable flag
    return c.json({
      week: targetWeek,
      season,
      weekLabel: `Week ${targetWeek}`,
      games: [],
      _espnUnavailable: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Slate games error:', msg, error);
    return c.json({ error: 'Failed to fetch games', details: msg }, 500);
  }
});

// ESPN scoreboard proxy - returns real NFL games with weather, persists to DB (must be before /:id)
gameRoutes.get('/espn/scoreboard', espnProxyRateLimit, optionalAuthMiddleware, async (c) => {
  const week = c.req.query('week') ? parseInt(c.req.query('week')!) : undefined;
  const season = c.req.query('season') ? parseInt(c.req.query('season')!) : undefined;
  const ctx = getNflSeasonContext();

  try {
    const { games, dbRows, week: w, season: s } = await fetchEspnScoreboard(
      week,
      season ?? ctx.season,
      ctx.seasontype
    );
    const db = c.get('db');
    await persistGamesToDb(db, dbRows);

    return c.json({
      week: w,
      season: s,
      weekLabel: `Week ${w}`,
      games,
    });
  } catch (error) {
    console.error('ESPN scoreboard error:', error);
    return c.json({ error: 'Failed to fetch ESPN scoreboard' }, 500);
  }
});

// Get all games for a week
gameRoutes.get('/week/:week', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.param('week'));
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));

  if (isNaN(week) || week < 1 || week > 22) {
    return c.json({ error: 'Invalid week number' }, 400);
  }
  if (isNaN(season) || season < 2000 || season > 2100) {
    return c.json({ error: 'Invalid season year' }, 400);
  }

  try {
    const games = await db.query.nflGames.findMany({
      where: and(
        eq(schema.nflGames.week, week),
        eq(schema.nflGames.seasonYear, season)
      ),
      orderBy: asc(schema.nflGames.gameTime),
    });

    // Group games by day
    const gamesByDay = games.reduce((acc, game) => {
      const date = new Date(game.gameTime).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(game);
      return acc;
    }, {} as Record<string, typeof games>);

    return c.json({
      week,
      season,
      games,
      gamesByDay,
    });
  } catch (error) {
    console.error('Get games error:', error);
    return c.json({ error: 'Failed to fetch games' }, 500);
  }
});

// Get games with line movements for a week (for Trends view)
gameRoutes.get('/line-movements', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.query('week') || '1');
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));

  try {
    const games = await db.query.nflGames.findMany({
      where: and(eq(schema.nflGames.week, week), eq(schema.nflGames.seasonYear, season)),
      columns: { id: true, homeTeam: true, awayTeam: true, spread: true, overUnder: true },
    });

    const movements: Array<{
      id: string;
      game: string;
      awayTeam: string;
      homeTeam: string;
      prop: string;
      oldLine: number | string;
      newLine: number | string;
      movement: number;
      direction: 'up' | 'down';
    }> = [];

    for (const game of games) {
      const snapshots = await db.query.gameLineSnapshots.findMany({
        where: eq(schema.gameLineSnapshots.gameId, game.id),
        orderBy: asc(schema.gameLineSnapshots.snapshotAt),
      });
      if (snapshots.length === 0) continue;

      const first = snapshots[0];
      const gameLabel = `${game.awayTeam} @ ${game.homeTeam}`;

      if (first.spread != null && game.spread != null && Math.abs((game.spread ?? 0) - first.spread) > 0.01) {
        const movement = (game.spread ?? 0) - first.spread;
        const fav = (game.spread ?? 0) > 0 ? game.homeTeam : game.awayTeam;
        movements.push({
          id: game.id,
          game: gameLabel,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          prop: 'Spread',
          oldLine: `${fav} ${first.spread! > 0 ? '' : '+'}${(-first.spread!).toFixed(1)}`,
          newLine: `${fav} ${(game.spread ?? 0) > 0 ? '' : '+'}${(-(game.spread ?? 0)).toFixed(1)}`,
          movement,
          direction: movement > 0 ? 'up' : 'down',
        });
      }
      if (first.overUnder != null && game.overUnder != null && Math.abs((game.overUnder ?? 0) - first.overUnder) > 0.01) {
        const movement = (game.overUnder ?? 0) - first.overUnder;
        movements.push({
          id: `${game.id}-ou`,
          game: gameLabel,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          prop: 'Total Points',
          oldLine: first.overUnder,
          newLine: game.overUnder!,
          movement,
          direction: movement > 0 ? 'up' : 'down',
        });
      }
    }

    movements.sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement));
    return c.json({ movements });
  } catch (error) {
    console.error('Line movements error:', error);
    return c.json({ error: 'Failed to fetch line movements' }, 500);
  }
});

// Get single game details (with players; supports lookup by id or query ?home=X&away=Y)
gameRoutes.get('/:id', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const gameId = c.req.param('id');
  const homeQ = c.req.query('home');
  const awayQ = c.req.query('away');

  try {
    let game = await db.query.nflGames.findFirst({
      where: eq(schema.nflGames.id, gameId),
    });

    // If game not found by ID, try lookup by home/away query params (for slate games)
    if (!game && homeQ && awayQ) {
      const games = await db.query.nflGames.findMany({
        where: and(
          eq(schema.nflGames.homeTeam, homeQ.toUpperCase()),
          eq(schema.nflGames.awayTeam, awayQ.toUpperCase()),
          eq(schema.nflGames.seasonYear, getNflSeasonContext().season)
        ),
        orderBy: asc(schema.nflGames.gameTime),
        limit: 1,
      });
      game = games[0] ?? null;
    }

    if (!game) {
      return c.json({ error: 'Game not found' }, 404);
    }

    // Get players currently on roster (active, questionable, doubtful - exclude IR/out)
    const rosterStatuses: string[] = ['active', 'questionable', 'doubtful'];
    const homePlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(schema.nflPlayers.team, game!.homeTeam),
        inArray(schema.nflPlayers.status, rosterStatuses)
      ),
    });

    const awayPlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(schema.nflPlayers.team, game!.awayTeam),
        inArray(schema.nflPlayers.status, rosterStatuses)
      ),
    });

    // Game is complete if explicitly marked, or if it has final scores, or if game time was >4 hours ago
    const hasScores = game!.homeScore != null && game!.awayScore != null;
    const gameTimePast = new Date(game!.gameTime).getTime() < Date.now() - 4 * 60 * 60 * 1000;
    const gameComplete = !!game!.isComplete || hasScores || gameTimePast;
    const pointsMap = new Map<string, { points: number; weekRank?: number }>();

    if (gameComplete) {
      // Use actual game stats for finished games - only include players who actually played
      const homeTeamUpper = game!.homeTeam.toUpperCase();
      const awayTeamUpper = game!.awayTeam.toUpperCase();
      const homePlayerIds = new Set(homePlayers.map((p) => p.id));
      const awayPlayerIds = new Set(awayPlayers.map((p) => p.id));
      const allPlayerIds = [...homePlayerIds, ...awayPlayerIds];
      const stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(schema.playerWeeklyStats.week, game!.week),
          eq(schema.playerWeeklyStats.seasonYear, game!.seasonYear),
          inArray(schema.playerWeeklyStats.playerId, allPlayerIds)
        ),
      });
      for (const s of stats) {
        // Must be stats from this game: when opponent is set, it must match the game's opposing team
        const statOpponent = (s.opponent ?? '').toString().toUpperCase();
        if (statOpponent) {
          const isHome = homePlayerIds.has(s.playerId);
          const expectedOpponent = isHome ? awayTeamUpper : homeTeamUpper;
          if (statOpponent !== expectedOpponent) continue; // wrong game
        }

        // Participation: snaps, stat activity, or DEF-specific stats
        const played =
          (s.offSnaps ?? 0) > 0 || (s.defSnaps ?? 0) > 0 || (s.stSnaps ?? 0) > 0 ||
          (s.passAttempts ?? 0) > 0 || (s.rushAttempts ?? 0) > 0 || (s.targets ?? 0) > 0 ||
          (s.receptions ?? 0) > 0 || (s.passCompletions ?? 0) > 0 || (s.passYards ?? 0) > 0 ||
          (s.rushYards ?? 0) > 0 || (s.receivingYards ?? 0) > 0 ||
          (s.fgAttempts ?? 0) > 0 || (s.xpAttempts ?? 0) > 0 || (s.fgMade ?? 0) > 0 || (s.xpMade ?? 0) > 0 ||
          (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 || (s.fumblesRecovered ?? 0) > 0 ||
          (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0 ||
          (s.fumbles ?? 0) > 0 || (s.twoPointConversions ?? 0) > 0;
        if (played) {
          pointsMap.set(s.playerId, { points: s.fantasyPointsPPR ?? 0 });
        }
      }
    } else {
      // Use projections for upcoming/in-progress games
      const projections = await db.query.playerProjections.findMany({
        where: and(
          eq(schema.playerProjections.week, game!.week),
          eq(schema.playerProjections.seasonYear, game!.seasonYear),
          eq(schema.playerProjections.scoringFormat, 'ppr')
        ),
        columns: { playerId: true, projectedPoints: true, weekRank: true },
      });
      for (const p of projections) {
        pointsMap.set(p.playerId, {
          points: p.projectedPoints,
          weekRank: p.weekRank ?? undefined,
        });
      }
    }

    const enrich = (p: typeof homePlayers[0]) => {
      const data = pointsMap.get(p.id);
      return {
        ...p,
        projectedPoints: data?.points ?? 0,
        weekRank: data?.weekRank,
      };
    };

    const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

    const processPlayers = (players: typeof homePlayers) => {
      let list = players.map(enrich);

      if (gameComplete) {
        // Only show players who played (have stats)
        list = list.filter((p) => pointsMap.has(p.id));
      }

      // Only show the starting QB; keep all other positions
      const qbs = list.filter((p) => p.position === 'QB');
      const nonQbs = list.filter((p) => p.position !== 'QB');
      const starterQB = qbs.length === 0
        ? []
        : [qbs.reduce((best, p) => (p.projectedPoints >= best.projectedPoints ? p : best))];
      list = [...nonQbs, ...starterQB];

      // Sort by position (QB, RB, WR, TE, K, DEF), then by points high to low within each position
      return list.sort((a, b) => {
        const posA = POSITION_ORDER.indexOf(a.position as typeof POSITION_ORDER[number]);
        const posB = POSITION_ORDER.indexOf(b.position as typeof POSITION_ORDER[number]);
        if (posA !== posB) return posA - posB;
        return b.projectedPoints - a.projectedPoints;
      });
    };

    return c.json({
      game,
      homePlayers: processPlayers(homePlayers),
      awayPlayers: processPlayers(awayPlayers),
    });
  } catch (error) {
    console.error('Get game error:', error);
    return c.json({ error: 'Failed to fetch game' }, 500);
  }
});

// Get game line history (spread/OU snapshots for trends)
gameRoutes.get('/:id/line-history', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const gameId = c.req.param('id');

  try {
    const game = await db.query.nflGames.findFirst({
      where: eq(schema.nflGames.id, gameId),
    });
    if (!game) return c.json({ error: 'Game not found' }, 404);

    const snapshots = await db.query.gameLineSnapshots.findMany({
      where: eq(schema.gameLineSnapshots.gameId, gameId),
      orderBy: asc(schema.gameLineSnapshots.snapshotAt),
    });

    return c.json({
      gameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      currentSpread: game.spread,
      currentOverUnder: game.overUnder,
      history: snapshots.map(s => ({
        snapshotAt: s.snapshotAt,
        spread: s.spread,
        overUnder: s.overUnder,
      })),
    });
  } catch (error) {
    console.error('Game line history error:', error);
    return c.json({ error: 'Failed to fetch line history' }, 500);
  }
});

// Get player props for a game
gameRoutes.get('/:id/props', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const gameId = c.req.param('id');

  try {
    const game = await db.query.nflGames.findFirst({
      where: eq(schema.nflGames.id, gameId),
    });

    if (!game) {
      return c.json({ error: 'Game not found' }, 404);
    }

    // Get players currently on roster (active, questionable, doubtful)
    const rosterStatuses: string[] = ['active', 'questionable', 'doubtful'];
    const homePlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(schema.nflPlayers.team, game.homeTeam),
        inArray(schema.nflPlayers.status, rosterStatuses)
      ),
    });

    const awayPlayers = await db.query.nflPlayers.findMany({
      where: and(
        eq(schema.nflPlayers.team, game.awayTeam),
        inArray(schema.nflPlayers.status, rosterStatuses)
      ),
    });

    const allPlayerIds = [...homePlayers, ...awayPlayers].map(p => p.id);

    const projections = await db.query.playerProjections.findMany({
      where: and(
        eq(schema.playerProjections.week, game.week),
        eq(schema.playerProjections.seasonYear, game.seasonYear)
      ),
      with: {
        player: true,
      },
    });

    // Filter to only players in this game
    const gameProjections = projections.filter(p =>
      allPlayerIds.includes(p.playerId)
    );

    return c.json({
      gameId,
      spread: game.spread,
      overUnder: game.overUnder,
      homeMoneyline: game.homeMoneyline,
      awayMoneyline: game.awayMoneyline,
      props: gameProjections.map(p => ({
        player: p.player,
        projectedPoints: p.projectedPoints,
        weekRank: p.weekRank,
        positionRank: p.positionRank,
        projPassYards: p.projPassYards,
        projPassTDs: p.projPassTDs,
        projRushYards: p.projRushYards,
        projRushTDs: p.projRushTDs,
        projReceptions: p.projReceptions,
        projRecYards: p.projRecYards,
        projRecTDs: p.projRecTDs,
      })),
    });
  } catch (error) {
    console.error('Get game props error:', error);
    return c.json({ error: 'Failed to fetch game props' }, 500);
  }
});

// Get live scores (for in-progress games) — fetches real-time from ESPN
gameRoutes.get('/live/scores', espnProxyRateLimit, optionalAuthMiddleware, async (c) => {
  const db = c.get('db');

  try {
    const ctx = getNflSeasonContext();

    // Fetch real-time scoreboard from ESPN
    let espnGames: any[] = [];
    try {
      const params = new URLSearchParams({ season: String(ctx.season), seasontype: ctx.seasontype });
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json() as any;
        espnGames = data?.events ?? [];
      }
    } catch (espnErr) {
      console.warn('ESPN live fetch failed, falling back to DB:', espnErr);
    }

    // If ESPN returned data, parse live games and persist scores to DB
    if (espnGames.length > 0) {
      const liveResults = [];

      for (const ev of espnGames) {
        const comp = ev.competitions?.[0];
        const status = ev.status;
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
        const homeAbbrev = home?.team?.abbreviation ?? '';
        const awayAbbrev = away?.team?.abbreviation ?? '';
        const homeScore = home?.score != null ? parseInt(String(home.score), 10) : 0;
        const awayScore = away?.score != null ? parseInt(String(away.score), 10) : 0;

        const statusType = status?.type?.name; // 'STATUS_IN_PROGRESS', 'STATUS_FINAL', 'STATUS_SCHEDULED'
        const isInProgress = statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME' || statusType === 'STATUS_END_PERIOD';
        const isComplete = statusType === 'STATUS_FINAL';
        const quarter = status?.period != null ? String(status.period) : null;
        const timeRemaining = status?.displayClock ?? null;
        const detail = status?.type?.detail ?? null;

        // Persist live scores to DB (best-effort, don't fail if DB write fails)
        try {
          await db.update(schema.nflGames).set({
            homeScore: homeScore || null,
            awayScore: awayScore || null,
            quarter: isComplete ? 'Final' : quarter,
            timeRemaining: isComplete ? null : timeRemaining,
            isComplete,
          }).where(eq(schema.nflGames.externalId, ev.id));
        } catch { /* ignore DB persist errors */ }

        // Only return games that are in progress or just completed
        if (isInProgress || isComplete) {
          liveResults.push({
            id: ev.id,
            homeTeam: homeAbbrev,
            awayTeam: awayAbbrev,
            homeScore,
            awayScore,
            quarter: isComplete ? 'Final' : (detail ?? `Q${quarter}`),
            timeRemaining: isComplete ? null : timeRemaining,
            isComplete,
          });
        }
      }

      return c.json({
        games: liveResults,
        source: 'espn',
        lastUpdated: new Date().toISOString(),
      });
    }

    // Fallback: read from DB if ESPN is unavailable
    const now = new Date();
    const games = await db.query.nflGames.findMany({
      where: eq(schema.nflGames.isComplete, false),
    });

    const liveGames = games.filter(g => new Date(g.gameTime) <= now);

    return c.json({
      games: liveGames.map(g => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeScore: g.homeScore || 0,
        awayScore: g.awayScore || 0,
        quarter: g.quarter,
        timeRemaining: g.timeRemaining,
        isComplete: g.isComplete,
      })),
      source: 'db',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get live scores error:', error);
    return c.json({ error: 'Failed to fetch live scores' }, 500);
  }
});

// Get upcoming games
gameRoutes.get('/upcoming', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const limit = parseInt(c.req.query('limit') || '10');

  try {
    const now = new Date();
    const games = await db.query.nflGames.findMany({
      where: eq(schema.nflGames.isComplete, false),
      orderBy: asc(schema.nflGames.gameTime),
      limit,
    });

    // Filter to only future games
    const upcomingGames = games.filter(g => new Date(g.gameTime) > now);

    return c.json({ games: upcomingGames });
  } catch (error) {
    console.error('Get upcoming games error:', error);
    return c.json({ error: 'Failed to fetch upcoming games' }, 500);
  }
});

// Get schedule for a team
gameRoutes.get('/team/:team', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const team = c.req.param('team').toUpperCase();
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));

  try {
    // Get all games where team is home or away
    const allGames = await db.query.nflGames.findMany({
      where: eq(schema.nflGames.seasonYear, season),
      orderBy: asc(schema.nflGames.week),
    });

    const teamGames = allGames.filter(
      g => g.homeTeam === team || g.awayTeam === team
    );

    return c.json({
      team,
      season,
      schedule: teamGames.map(g => ({
        ...g,
        isHome: g.homeTeam === team,
        opponent: g.homeTeam === team ? g.awayTeam : g.homeTeam,
      })),
    });
  } catch (error) {
    console.error('Get team schedule error:', error);
    return c.json({ error: 'Failed to fetch team schedule' }, 500);
  }
});

// Get odds for games in a given week
gameRoutes.get('/odds', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.query('week') || '1');
  const season = parseInt(c.req.query('season') || '2025');

  try {
    // Get all games for the given week
    const games = await db.query.nflGames.findMany({
      where: and(eq(schema.nflGames.week, week), eq(schema.nflGames.seasonYear, season)),
    });

    if (games.length === 0) {
      return c.json({ games: [], week, season });
    }

    // For each game, get the latest odds snapshot
    const gameOdds = new Map<
      string,
      {
        game: (typeof games)[0];
        spreads: any[];
        totals: any[];
        moneylines: any[];
      }
    >();

    for (const game of games) {
      gameOdds.set(game.id, {
        game,
        spreads: [],
        totals: [],
        moneylines: [],
      });
    }

    // Get latest odds for all games in this week
    const allOdds = await db.query.gameOdds.findMany({
      where: and(
        eq(schema.gameOdds.week, week),
        eq(schema.gameOdds.season, season)
      ),
      orderBy: desc(schema.gameOdds.snapshotTime),
    });

    // Group by game and market, keeping only the latest snapshot per market
    const processed = new Set<string>();

    for (const odds of allOdds) {
      const key = `${odds.gameId}_${odds.market}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const gameOddEntry = gameOdds.get(odds.gameId);
      if (!gameOddEntry) continue;

      if (odds.market === 'spreads') {
        gameOddEntry.spreads.push(odds);
      } else if (odds.market === 'totals') {
        gameOddEntry.totals.push(odds);
      } else if (odds.market === 'h2h') {
        gameOddEntry.moneylines.push(odds);
      }
    }

    const result = [];
    for (const [, entry] of gameOdds) {
      result.push({
        gameId: entry.game.id,
        week: entry.game.week,
        homeTeam: entry.game.homeTeam,
        awayTeam: entry.game.awayTeam,
        commenceTime: entry.game.gameTime,
        spreads: entry.spreads.length > 0 ? entry.spreads[0] : null,
        totals: entry.totals.length > 0 ? entry.totals[0] : null,
        moneylines: entry.moneylines.length > 0 ? entry.moneylines[0] : null,
        lastUpdated: entry.spreads[0]?.snapshotTime || entry.totals[0]?.snapshotTime || entry.moneylines[0]?.snapshotTime,
      });
    }

    return c.json({
      games: result,
      week,
      season,
      count: result.length,
    });
  } catch (error) {
    console.error('Get game odds error:', error);
    return c.json({ error: 'Failed to fetch game odds' }, 500);
  }
});
