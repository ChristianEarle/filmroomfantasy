import { Hono } from 'hono';
import { eq, like, and, desc, asc, sql, inArray, type SQL } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { generateId } from '../utils/id';
import { cached } from '../utils/cache';
import { normalizePlayerName } from '../utils/playerNames';
import { resolveDisplaySeason } from '../utils/seasons';
import { buildProjectionsFromProps } from '../services/projections';
import type { Env, Variables } from '../index';

// Rate limits for player routes
const playerSearchRateLimit = rateLimit(30, 60 * 1000); // 30 req/min for search
const playerReadRateLimit = rateLimit(120, 60 * 1000); // 120 req/min for reads

function mapSleeperStatsToRow(internalPlayerId: string, seasonYear: number, week: number, playerStats: any) {
  return {
    playerId: internalPlayerId,
    week,
    seasonYear,
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
}

/** Sleeper stats API returns array of { player_id, stats: {...}, opponent }. Extract stats for a player. */
function extractSleeperPlayerStats(apiResponse: any, sleeperExternalId: string): { stats: any; opponent: string } | null {
  if (Array.isArray(apiResponse)) {
    const item = apiResponse.find((p: any) => String(p?.player_id) === String(sleeperExternalId));
    if (!item) return null;
    const s = item.stats || {};
    return {
      stats: { ...s, opponent: item.opponent },
      opponent: item.opponent || null,
    };
  }
  if (apiResponse && typeof apiResponse === 'object' && apiResponse[sleeperExternalId]) {
    const playerStats = apiResponse[sleeperExternalId];
    return { stats: playerStats, opponent: playerStats.opponent };
  }
  return null;
}

/** Fetch stats for a player from Sleeper API and insert into DB. Returns array of weekly stats. */
async function fetchAndStoreSleeperStats(
  db: any,
  internalPlayerId: string,
  sleeperExternalId: string,
  seasonYear: number
): Promise<any[]> {
  const maxWeeks = 18;
  const weekPromises = Array.from({ length: maxWeeks }, (_, i) => i + 1).map(async (week) => {
    try {
      const res = await fetch(
        `https://api.sleeper.com/stats/nfl/${seasonYear}/${week}?season_type=regular`
      );
      if (!res.ok) return null;
      const raw = await res.json();
      const extracted = extractSleeperPlayerStats(raw, sleeperExternalId);
      if (!extracted) return null;
      return { week, playerStats: extracted.stats };
    } catch {
      return null;
    }
  });
  const results = await Promise.all(weekPromises);
  const inserted: any[] = [];
  for (const r of results) {
    if (!r) continue;
    const statsData = mapSleeperStatsToRow(internalPlayerId, seasonYear, r.week, r.playerStats);
    const existing = await db.query.playerWeeklyStats.findFirst({
      where: and(
        eq(schema.playerWeeklyStats.playerId, internalPlayerId),
        eq(schema.playerWeeklyStats.week, r.week),
        eq(schema.playerWeeklyStats.seasonYear, seasonYear)
      ),
    });
    if (existing) {
      await db
        .update(schema.playerWeeklyStats)
        .set(statsData)
        .where(eq(schema.playerWeeklyStats.id, existing.id));
    } else {
      await db.insert(schema.playerWeeklyStats).values({
        id: generateId(),
        ...statsData,
      });
    }
    inserted.push(statsData);
  }
  inserted.sort((a, b) => a.week - b.week);
  return inserted;
}

export const playerRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply rate limiting to all player read endpoints
playerRoutes.use('*', playerReadRateLimit);

// Get all players (paginated, filterable) with stats
playerRoutes.get('/', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');

  // Query params
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 500);
  const offset = (page - 1) * limit;

  const position = c.req.query('position');
  const team = c.req.query('team');
  const search = c.req.query('search');
  const status = c.req.query('status');
  const sortBy = c.req.query('sortBy') || 'name';
  const sortOrder = c.req.query('sortOrder') || 'asc';
  const leagueId = c.req.query('leagueId');
  const includeStats = c.req.query('includeStats') === 'true';
  const availableOnly = c.req.query('availableOnly') === 'true';
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));
  const weekParam = c.req.query('week');
  const week = weekParam ? parseInt(weekParam) : undefined;
  const scoringFormatParam = c.req.query('scoringFormat') || 'ppr';
  const scoringFormat = scoringFormatParam === 'half_ppr' || scoringFormatParam === 'half-ppr' ? 'half-ppr' : scoringFormatParam === 'standard' ? 'standard' : 'ppr';

  try {
    // Build where conditions (used in both past-week and normal flows)
    const conditions: SQL[] = [];
    if (position && position !== 'ALL') conditions.push(eq(schema.nflPlayers.position, position));
    if (team) conditions.push(eq(schema.nflPlayers.team, team));
    if (status) conditions.push(eq(schema.nflPlayers.status, status));
    if (search) {
      // Sanitize search input: strip non-name characters and escape LIKE wildcards
      const sanitizedSearch = search.replace(/[^a-zA-Z\s\-'.]/g, '').trim();
      if (sanitizedSearch.length >= 2) {
        const escapedSearch = sanitizedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_');
        conditions.push(like(schema.nflPlayers.name, `%${escapedSearch}%`));
      }
    }

    // When week is provided and week is complete, use past-week mode: stats only, sort by actual pts
    let weekComplete = false;
    if (week !== undefined && week >= 1 && week <= 18) {
      const gamesForWeek = await db.query.nflGames.findMany({
        where: and(eq(schema.nflGames.week, week), eq(schema.nflGames.seasonYear, season)),
        columns: { id: true, isComplete: true, homeScore: true, awayScore: true },
      });
      weekComplete = gamesForWeek.length > 0 && gamesForWeek.every(g => g.isComplete || (g.homeScore != null && g.awayScore != null));

      // Fallback: if we have stats for this week (Sleeper only has stats for completed weeks), treat as past week
      if (!weekComplete && includeStats) {
        const anyStat = await db.query.playerWeeklyStats.findFirst({
          where: and(
            eq(schema.playerWeeklyStats.week, week),
            eq(schema.playerWeeklyStats.seasonYear, season)
          ),
          columns: { id: true },
        });
        if (anyStat) weekComplete = true;
      }

      // Offseason fallback: if we're in the offseason (Feb-Aug), the entire NFL season is over
      if (!weekComplete) {
        const currentMonth = new Date().getMonth(); // 0=Jan, 1=Feb, ... 7=Aug
        if (currentMonth >= 1 && currentMonth <= 7) weekComplete = true;
      }
    }

    if (week !== undefined && weekComplete && includeStats && !availableOnly) {
      // Past-week mode: players who played, sorted by actual fantasy pts
      const ptsOrderCol = scoringFormat === 'standard' ? schema.playerWeeklyStats.fantasyPointsStd : scoringFormat === 'half-ppr' ? schema.playerWeeklyStats.fantasyPointsHalf : schema.playerWeeklyStats.fantasyPointsPPR;
      const stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(schema.playerWeeklyStats.week, week),
          eq(schema.playerWeeklyStats.seasonYear, season)
        ),
        orderBy: desc(ptsOrderCol),
      });
      const played = (s: typeof stats[0]) => {
        // DEF: has defensive stats (no offensive involvement)
        const hasDefStats = (s.defSnaps ?? 0) > 0 || (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 ||
          (s.fumblesRecovered ?? 0) > 0 || (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0;
        const noOffStats = (s.offSnaps ?? 0) === 0 && (s.passAttempts ?? 0) === 0 && (s.rushAttempts ?? 0) === 0 && (s.targets ?? 0) === 0;
        if (hasDefStats && noOffStats) return true;
        return (s.offSnaps ?? 0) > 0 || (s.defSnaps ?? 0) > 0 || (s.stSnaps ?? 0) > 0 ||
          (s.passAttempts ?? 0) > 0 || (s.rushAttempts ?? 0) > 0 || (s.targets ?? 0) > 0 ||
          (s.receptions ?? 0) > 0 || (s.passCompletions ?? 0) > 0 || (s.passYards ?? 0) > 0 ||
          (s.rushYards ?? 0) > 0 || (s.receivingYards ?? 0) > 0 ||
          (s.fgAttempts ?? 0) > 0 || (s.xpAttempts ?? 0) > 0 || (s.fgMade ?? 0) > 0 || (s.xpMade ?? 0) > 0 ||
          (s.sacks ?? 0) > 0 || (s.defInterceptions ?? 0) > 0 || (s.fumblesRecovered ?? 0) > 0 ||
          (s.defenseTDs ?? 0) > 0 || (s.safeties ?? 0) > 0 ||
          (s.fumbles ?? 0) > 0 || (s.twoPointConversions ?? 0) > 0;
      };
      const ptsCol = scoringFormat === 'standard' ? 'fantasyPointsStd' : scoringFormat === 'half-ppr' ? 'fantasyPointsHalf' : 'fantasyPointsPPR';
      const playedStats = stats.filter(played);
      const playerIdsFromStats = [...new Set(playedStats.map(s => s.playerId))];

      if (playerIdsFromStats.length === 0) {
        return c.json({
          players: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
          weekComplete: true,
          pointsType: 'actual',
        });
      }

      const CHUNK = 50;
      const idChunks: string[][] = [];
      for (let i = 0; i < playerIdsFromStats.length; i += CHUNK) idChunks.push(playerIdsFromStats.slice(i, i + CHUNK));

      const playerPromises = idChunks.map(chunk => {
        const cond = conditions.length > 0 ? and(...conditions, inArray(schema.nflPlayers.id, chunk)) : inArray(schema.nflPlayers.id, chunk);
        return db.query.nflPlayers.findMany({ where: cond });
      });
      const playerChunkResults = await Promise.all(playerPromises);
      const playersPast = playerChunkResults.flat();

      const ptsByPlayer = new Map<string, number>();
      const statsByPlayer = new Map<string, (typeof playedStats)[0]>();
      for (const s of playedStats) {
        const pts = (s as any)[ptsCol] ?? 0;
        ptsByPlayer.set(s.playerId, pts);
        statsByPlayer.set(s.playerId, s);
      }

      // Fetch projections for this week to show proj vs actual diff
      const projectionsByPlayer = new Map<string, number>();
      const projectionsForWeek = await db.query.playerProjections.findMany({
        where: and(
          eq(schema.playerProjections.week, week),
          eq(schema.playerProjections.seasonYear, season),
          eq(schema.playerProjections.scoringFormat, scoringFormat)
        ),
      });
      for (const proj of projectionsForWeek) {
        projectionsByPlayer.set(proj.playerId, proj.projectedPoints);
      }

      // Fallback: if no pre-generated projections found, calculate from player props (book lines)
      if (projectionsByPlayer.size === 0) {
        const weekProps = await db.query.playerProps.findMany({
          where: and(
            eq(schema.playerProps.week, week),
            eq(schema.playerProps.season, season)
          ),
        });
        if (weekProps.length > 0) {
          const propProjections = buildProjectionsFromProps(weekProps);
          // Build lookups from the players we already fetched
          const nameToId = new Map<string, string>();
          const extIdToId = new Map<string, string>();
          for (const p of playersPast) {
            if (p.name) nameToId.set(p.name.toLowerCase(), p.id);
            if ((p as any).externalId) extIdToId.set((p as any).externalId, p.id);
          }
          for (const proj of propProjections) {
            const playerId = (proj.playerId && extIdToId.get(proj.playerId))
              || nameToId.get(proj.playerName.toLowerCase());
            if (playerId) {
              const pts = scoringFormat === 'ppr' ? proj.points.ppr
                : scoringFormat === 'half-ppr' ? proj.points.halfPpr
                : proj.points.standard;
              projectionsByPlayer.set(playerId, pts);
            }
          }
        }
      }

      let enriched = playersPast.map(p => {
        const pts = ptsByPlayer.get(p.id) ?? 0;
        const s = statsByPlayer.get(p.id);
        const isDef = p.position === 'DEF';
        const snapPct = (() => {
          if (!s) return null;
          const off = s.offSnaps ?? 0, def = s.defSnaps ?? 0, st = s.stSnaps ?? 0;
          const tmOff = s.tmOffSnaps ?? 0, tmDef = s.tmDefSnaps ?? 0, tmSt = s.tmStSnaps ?? 0;
          if (off > 0 && tmOff > 0) return (off / tmOff) * 100;
          if (def > 0 && tmDef > 0) return (def / tmDef) * 100;
          if (st > 0 && tmSt > 0) return (st / tmSt) * 100;
          return null;
        })();
        const seasonStats = s ? {
          games: 1,
          gamesPlayed: 1,
          fantasyPointsPPR: s.fantasyPointsPPR ?? 0,
          fantasyPointsHalf: s.fantasyPointsHalf ?? 0,
          fantasyPointsStd: s.fantasyPointsStd ?? 0,
          passYards: s.passYards ?? 0,
          passTDs: s.passTDs ?? 0,
          rushYards: s.rushYards ?? 0,
          rushTDs: s.rushTDs ?? 0,
          receptions: s.receptions ?? 0,
          receivingYards: s.receivingYards ?? 0,
          receivingTDs: s.receivingTDs ?? 0,
          averageSnapPct: snapPct != null ? Math.round(snapPct * 10) / 10 : null,
        } : undefined;
        const projPts = projectionsByPlayer.get(p.id) ?? 0;
        return {
          ...p,
          projectedPoints: pts,
          avgPointsPPR: pts,
          weeklyProjectedPoints: projPts,
          seasonStats,
          isRostered: false as boolean,
        };
      });

      let rosteredPlayerIds: string[] = [];
      if (leagueId) {
        const teams = await db.query.teams.findMany({
          where: eq(schema.teams.leagueId, leagueId),
          with: { roster: true },
        });
        rosteredPlayerIds = teams.flatMap(t => t.roster.map(r => r.playerId));
      }
      enriched = enriched.map(p => ({ ...p, isRostered: rosteredPlayerIds.includes(p.id) }));

      if (position && position !== 'ALL' && position !== 'FLEX') enriched = enriched.filter((p: any) => p.position === position);
      if (position === 'FLEX') enriched = enriched.filter((p: any) => ['RB', 'WR', 'TE'].includes(p.position));
      if (team) enriched = enriched.filter((p: any) => (p as any).team === team);
      if (search) enriched = enriched.filter((p: any) => (p as any).name?.toLowerCase().includes(search?.toLowerCase()));
      if (availableOnly && leagueId) enriched = enriched.filter((p: any) => !p.isRostered);

      enriched.sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0));
      const total = enriched.length;
      const paginated = enriched.slice(offset, offset + limit);

      return c.json({
        players: paginated,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        weekComplete: true,
        pointsType: 'actual',
      });
    }

    // Get sort column safely (DB columns only)
    const getSortColumn = () => {
      const columns: Record<string, any> = {
        name: schema.nflPlayers.name,
        position: schema.nflPlayers.position,
        team: schema.nflPlayers.team,
        status: schema.nflPlayers.status,
      };
      return columns[sortBy] || schema.nflPlayers.name;
    };

    // When sorting by projected/avg points, we must fetch more, enrich, then sort in memory
    const sortByComputed = sortBy === 'projectedPoints' || sortBy === 'avgPointsPPR';
    // When availableOnly, fetch extra to compensate for rostered players we'll filter out
    const availableMultiplier = availableOnly && leagueId ? 3 : 1;
    const fetchLimit = (sortByComputed && includeStats) || availableOnly
      ? Math.max((limit + offset) * availableMultiplier, 500)
      : limit + offset;
    const fetchOffset = (sortByComputed && includeStats) || availableOnly ? 0 : offset;

    // Get players
    const players = await db.query.nflPlayers.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit: fetchLimit,
      offset: fetchOffset,
      orderBy: sortByComputed ? asc(schema.nflPlayers.name) : (sortOrder === 'desc' ? desc(getSortColumn()) : asc(getSortColumn())),
    });

    // Get rostered player IDs if leagueId provided
    let rosteredPlayerIds: string[] = [];
    if (leagueId) {
      const teams = await db.query.teams.findMany({
        where: eq(schema.teams.leagueId, leagueId),
        with: { roster: true },
      });
      rosteredPlayerIds = teams.flatMap(t => t.roster.map(r => r.playerId));
    }

    // Enrich players with stats if requested (batch fetch to avoid N+1)
    // Chunk playerIds to stay under D1/SQLite bound parameter limit (~100 per query)
    // Use parallel fetches for all chunks to maximize performance
    let enrichedPlayers = players;
    if (includeStats && players.length > 0) {
      const playerIds = players.map(p => p.id);
      const CHUNK = 50; // D1 limits ~100 params per query; inArray uses 1 per id + other WHERE vars

      // Create all chunk promises at once for parallel execution
      const chunks: string[][] = [];
      for (let i = 0; i < playerIds.length; i += CHUNK) {
        chunks.push(playerIds.slice(i, i + CHUNK));
      }

      // Fetch all chunks in parallel
      const chunkResults = await Promise.all(
        chunks.map(chunk => {
          // BUG-005 FIX: Always include scoringFormat in the projection query.
          // Previously, when week was undefined the scoringFormat filter was omitted,
          // causing projections from all formats to be returned and potentially mismatched.
          const projCond = week !== undefined
            ? and(inArray(schema.playerProjections.playerId, chunk), eq(schema.playerProjections.seasonYear, season), eq(schema.playerProjections.week, week), eq(schema.playerProjections.scoringFormat, scoringFormat))
            : and(inArray(schema.playerProjections.playerId, chunk), eq(schema.playerProjections.seasonYear, season), eq(schema.playerProjections.scoringFormat, scoringFormat));
          return Promise.all([
            db.query.playerWeeklyStats.findMany({
              where: and(
                inArray(schema.playerWeeklyStats.playerId, chunk),
                eq(schema.playerWeeklyStats.seasonYear, season)
              ),
            }),
            db.query.playerProjections.findMany({
              where: projCond,
              orderBy: week !== undefined ? undefined : desc(schema.playerProjections.week),
            }),
          ]);
        })
      );

      // Flatten results
      const allStats: { playerId: string; [k: string]: any }[] = [];
      const allProjections: { playerId: string; [k: string]: any }[] = [];
      for (const [statsChunk, projChunk] of chunkResults) {
        allStats.push(...statsChunk);
        allProjections.push(...projChunk);
      }

      const statsByPlayer = new Map<string, typeof allStats>();
      for (const s of allStats) {
        const list = statsByPlayer.get(s.playerId) || [];
        list.push(s);
        statsByPlayer.set(s.playerId, list);
      }

      const projectionByPlayer = new Map<string, (typeof allProjections)[0]>();
      for (const p of allProjections) {
        if (!projectionByPlayer.has(p.playerId)) projectionByPlayer.set(p.playerId, p);
      }

      enrichedPlayers = players.map((player) => {
        const stats = statsByPlayer.get(player.id) || [];
        const isDef = player.position === 'DEF';
        const seasonStats = stats.reduce((acc, week) => {
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

        const projection = projectionByPlayer.get(player.id);
        const gp = seasonStats.gamesPlayed ?? seasonStats.games;
        const avgSnapPct = (seasonStats as any).snapPctSum > 0 && gp > 0
          ? Math.round(((seasonStats as any).snapPctSum / gp) * 10) / 10
          : null;
        const avgPts = gp > 0
          ? Math.round((seasonStats.fantasyPointsPPR / gp) * 10) / 10
          : 0;

        // For completed weeks, use actual points scored; otherwise use projections
        let projPts = 0;
        if (weekComplete && week !== undefined) {
          const weekStat = stats.find((s: any) => s.week === week);
          if (weekStat) {
            const ptsCol = scoringFormat === 'standard' ? 'fantasyPointsStd' : scoringFormat === 'half-ppr' ? 'fantasyPointsHalf' : 'fantasyPointsPPR';
            projPts = (weekStat as any)[ptsCol] ?? 0;
          }
        } else {
          projPts = projection?.projectedPoints || 0;
        }
        const { snapPctSum, ...ss } = seasonStats as any;
        return {
          ...player,
          seasonStats: { ...ss, averageSnapPct: avgSnapPct },
          avgPointsPPR: avgPts,
          projectedPoints: projPts,
          isRostered: rosteredPlayerIds.includes(player.id),
        };
      });

      // Filter to available (non-rostered) when requested
      if (availableOnly && leagueId) {
        enrichedPlayers = enrichedPlayers.filter((p: any) => !p.isRostered);
      }
      // Sort by computed field and apply pagination
      if (sortByComputed) {
        const key = sortBy === 'projectedPoints' ? 'projectedPoints' : 'avgPointsPPR';
        enrichedPlayers = [...enrichedPlayers].sort((a, b) => {
          const aVal = (a as any)[key] ?? 0;
          const bVal = (b as any)[key] ?? 0;
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
        enrichedPlayers = enrichedPlayers.slice(offset, offset + limit);
      }
    } else {
      // Just add rostered status without stats
      enrichedPlayers = players.map(player => ({
        ...player,
        isRostered: rosteredPlayerIds.includes(player.id),
      }));
      if (availableOnly && leagueId) {
        enrichedPlayers = enrichedPlayers.filter((p: any) => !p.isRostered);
      }
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.nflPlayers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    return c.json({
      players: enrichedPlayers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      weekComplete,
      pointsType: weekComplete ? 'actual' : 'projected',
    });
  } catch (error) {
    console.error('Get players error:', error);
    return c.json({ error: 'Failed to fetch players' }, 500);
  }
});

// Projection movements - players whose projections have moved the most (for BiggestMovers / Trends)
// Cached for 5 minutes — projection movements update infrequently between syncs
playerRoutes.get('/projection-movements', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.query('week') || '1');
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));
  const scoringFormat = c.req.query('scoringFormat') || 'ppr';
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  try {
    const cacheKey = `projection-movements:${season}:${week}:${scoringFormat}:${limit}`;
    const movements = await cached(cacheKey, 5 * 60 * 1000, async () => {
      const currentProjections = await db.query.playerProjections.findMany({
        where: and(
          eq(schema.playerProjections.week, week),
          eq(schema.playerProjections.seasonYear, season),
          eq(schema.playerProjections.scoringFormat, scoringFormat)
        ),
        with: { player: true },
      });

      const playerIds = currentProjections.map(p => p.playerId);
      if (playerIds.length === 0) return [];

      const CHUNK = 50;
      const snapshots: { playerId: string; projectedPoints: number; snapshotAt: Date }[] = [];
      for (let i = 0; i < playerIds.length; i += CHUNK) {
        const chunk = playerIds.slice(i, i + CHUNK);
        const rows = await db.query.projectionLineSnapshots.findMany({
          where: and(
            inArray(schema.projectionLineSnapshots.playerId, chunk),
            eq(schema.projectionLineSnapshots.week, week),
            eq(schema.projectionLineSnapshots.seasonYear, season),
            eq(schema.projectionLineSnapshots.scoringFormat, scoringFormat)
          ),
          orderBy: asc(schema.projectionLineSnapshots.snapshotAt),
        });
        snapshots.push(...rows.map(r => ({ playerId: r.playerId, projectedPoints: r.projectedPoints, snapshotAt: r.snapshotAt })));
      }

      const earliestByPlayer = new Map<string, { projectedPoints: number; snapshotAt: Date }>();
      for (const s of snapshots) {
        if (!earliestByPlayer.has(s.playerId)) earliestByPlayer.set(s.playerId, { projectedPoints: s.projectedPoints, snapshotAt: s.snapshotAt });
      }

      return currentProjections
        .map(p => {
          const prev = earliestByPlayer.get(p.playerId);
          const prevPts = prev?.projectedPoints ?? p.projectedPoints;
          const movement = p.projectedPoints - prevPts;
          return {
            playerId: p.playerId,
            name: (p as any).player?.name,
            team: (p as any).player?.team,
            position: (p as any).player?.position,
            previousProjectedPoints: prevPts,
            projectedPoints: p.projectedPoints,
            movement,
          };
        })
        .filter(m => Math.abs(m.movement) > 0.01)
        .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement))
        .slice(0, limit);
    });

    return c.json({ movements });
  } catch (error) {
    console.error('Projection movements error:', error);
    return c.json({ error: 'Failed to fetch projection movements' }, 500);
  }
});

// Recent best performers — top scorers over the last 1 week, 3 weeks, or season-to-date.
// Aggregates from player_weekly_stats. Optional leagueId surfaces ownership + "trade target" flag for non-rostered breakouts.
playerRoutes.get('/recent-leaders', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');

  // window: '1' (last week) | '3' (last 3 weeks, default — more stable than single-week) | 'stf' (season-to-date)
  const windowRaw = c.req.query('window') || '3';
  if (windowRaw !== '1' && windowRaw !== '3' && windowRaw !== 'stf') {
    return c.json({ error: "window must be '1', '3', or 'stf'" }, 400);
  }
  const window = windowRaw as '1' | '3' | 'stf';

  // season: optional int, clamped to 2000-2100. Defaults via resolveDisplaySeason (falls back to most recent year with games).
  const requestedSeasonRaw = c.req.query('season');
  let requestedSeason: number;
  if (requestedSeasonRaw) {
    const parsed = parseInt(requestedSeasonRaw);
    if (isNaN(parsed) || parsed < 2000 || parsed > 2100) {
      return c.json({ error: 'Invalid season' }, 400);
    }
    requestedSeason = parsed;
  } else {
    requestedSeason = new Date().getFullYear();
  }
  const resolved = await resolveDisplaySeason(db, requestedSeason);
  const season = resolved.season;

  // position: optional whitelist
  const positionRaw = c.req.query('position');
  const validPositions = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
  if (positionRaw && !validPositions.has(positionRaw)) {
    return c.json({ error: 'Invalid position' }, 400);
  }
  const position = positionRaw as 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | undefined;

  // limit: int, clamped 1-50, default 25. Guard against NaN before clamping.
  const limitRaw = parseInt(c.req.query('limit') || '25');
  const limit = isNaN(limitRaw) ? 25 : Math.min(Math.max(limitRaw, 1), 50);

  // leagueId: optional, length-capped + character-whitelisted to prevent abuse
  const leagueId = c.req.query('leagueId');
  if (leagueId && (leagueId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(leagueId))) {
    return c.json({ error: 'Invalid leagueId' }, 400);
  }

  try {
    const cacheKey = `recent-leaders:${season}:${window}:${leagueId || 'none'}:${position || 'all'}:${limit}`;
    const payload = await cached(cacheKey, 10 * 60 * 1000, async () => {
      // 1. Find the most recent week with stats for this season.
      const latestWeekResult = await db
        .select({ maxWeek: sql<number>`max(${schema.playerWeeklyStats.week})` })
        .from(schema.playerWeeklyStats)
        .where(eq(schema.playerWeeklyStats.seasonYear, season));
      const latestWeek = latestWeekResult[0]?.maxWeek ?? 0;

      if (latestWeek < 1) {
        return {
          window,
          weeks: [],
          latestWeek: 0,
          leaders: [],
          season,
          position: position ?? null,
          leagueId: leagueId ?? null,
          limit,
        };
      }

      // 2. Build the window's week list (clamped to ≥ 1).
      let weeks: number[];
      if (window === '1') {
        weeks = [latestWeek];
      } else if (window === '3') {
        const start = Math.max(1, latestWeek - 2);
        weeks = [];
        for (let w = start; w <= latestWeek; w++) weeks.push(w);
      } else {
        weeks = [];
        for (let w = 1; w <= latestWeek; w++) weeks.push(w);
      }

      // 3. Aggregate top-N by ppg over the window. Inner-join nfl_players so we can filter by position at the DB level.
      //    Drop inactive rows by requiring at least some scoring signal — DEF/K have no offensive snaps so we can't gate on off_snaps.
      const windowConditions: SQL[] = [
        eq(schema.playerWeeklyStats.seasonYear, season),
        inArray(schema.playerWeeklyStats.week, weeks),
      ];
      if (position) {
        windowConditions.push(eq(schema.nflPlayers.position, position));
      }
      const windowAgg = await db
        .select({
          playerId: schema.playerWeeklyStats.playerId,
          ppg: sql<number>`ROUND(AVG(${schema.playerWeeklyStats.fantasyPointsPPR}), 2)`.as('ppg'),
          games: sql<number>`COUNT(*)`.as('games'),
          total: sql<number>`ROUND(SUM(${schema.playerWeeklyStats.fantasyPointsPPR}), 2)`.as('total'),
        })
        .from(schema.playerWeeklyStats)
        .innerJoin(schema.nflPlayers, eq(schema.nflPlayers.id, schema.playerWeeklyStats.playerId))
        .where(and(...windowConditions))
        .groupBy(schema.playerWeeklyStats.playerId)
        .orderBy(sql`ppg DESC, total DESC`)
        .limit(limit);

      if (windowAgg.length === 0) {
        return {
          window,
          weeks,
          latestWeek,
          leaders: [],
          season,
          position: position ?? null,
          leagueId: leagueId ?? null,
          limit,
        };
      }

      const topIds = windowAgg.map(r => r.playerId);

      // 4. Hydrate player metadata.
      const players = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.id, topIds),
      });
      const playerById = new Map(players.map(p => [p.id, p]));

      // 5. Season-to-date average for the same player set — used to compute delta vs. season norm.
      //    Skip when window === 'stf' (delta is 0 by definition).
      const seasonPpgById = new Map<string, number>();
      if (window !== 'stf') {
        const seasonAgg = await db
          .select({
            playerId: schema.playerWeeklyStats.playerId,
            ppg: sql<number>`ROUND(AVG(${schema.playerWeeklyStats.fantasyPointsPPR}), 2)`.as('ppg'),
          })
          .from(schema.playerWeeklyStats)
          .where(and(
            eq(schema.playerWeeklyStats.seasonYear, season),
            inArray(schema.playerWeeklyStats.playerId, topIds),
          ))
          .groupBy(schema.playerWeeklyStats.playerId);
        for (const row of seasonAgg) {
          seasonPpgById.set(row.playerId, row.ppg ?? 0);
        }
      }

      // 6. League ownership (only if leagueId provided AND league actually has teams).
      //    rosteredPlayerIds is intentionally empty when leagueTeamCount is 0 so ownedInLeague stays null below.
      let leagueTeamCount = 0;
      let rosteredPlayerIds = new Set<string>();
      if (leagueId) {
        const teams = await db.query.teams.findMany({
          where: eq(schema.teams.leagueId, leagueId),
          columns: { id: true },
        });
        leagueTeamCount = teams.length;
        if (teams.length > 0) {
          const teamIds = teams.map(t => t.id);
          const rosterRows = await db
            .select({ playerId: schema.rosterSpots.playerId })
            .from(schema.rosterSpots)
            .where(inArray(schema.rosterSpots.teamId, teamIds));
          rosteredPlayerIds = new Set(rosterRows.map(r => r.playerId));
        }
      }

      // 7. Build leader rows + compute posRank within the result set (1..N per position).
      const POS_THRESHOLDS: Record<string, number> = { QB: 18, RB: 12, WR: 12, TE: 8, K: 8, DEF: 8 };
      const ownershipAvailable = leagueId !== undefined && leagueTeamCount > 0;
      const posCounter = new Map<string, number>();
      const leaders = windowAgg
        .map(row => {
          const player = playerById.get(row.playerId);
          if (!player) return null;
          const seasonPpg = window === 'stf' ? row.ppg : (seasonPpgById.get(row.playerId) ?? row.ppg);
          const delta = window === 'stf' ? 0 : Number((row.ppg - seasonPpg).toFixed(2));
          const posKey = player.position || 'NA';
          const nextRank = (posCounter.get(posKey) ?? 0) + 1;
          posCounter.set(posKey, nextRank);

          const ownedInLeague = ownershipAvailable ? rosteredPlayerIds.has(player.id) : null;
          const ownedPct = ownedInLeague === null ? null : (ownedInLeague ? 100 : 0);
          const threshold = POS_THRESHOLDS[posKey] ?? 999;
          const tradeTarget =
            ownedInLeague === false && delta >= 3 && row.ppg >= threshold;

          return {
            id: player.id,
            name: player.name,
            team: player.team,
            position: player.position,
            headshotUrl: player.headshotUrl ?? null,
            games: row.games,
            ppg: row.ppg,
            seasonPpg,
            delta,
            posRank: nextRank,
            ownedPct,
            ownedInLeague,
            tradeTarget,
          };
        })
        .filter(<T>(x: T | null): x is T => x !== null);

      return {
        window,
        weeks,
        latestWeek,
        leaders,
        season,
        position: position ?? null,
        leagueId: leagueId ?? null,
        limit,
      };
    });

    return c.json(payload);
  } catch (error) {
    console.error('Recent leaders error:', error);
    return c.json({ error: 'Failed to fetch recent leaders' }, 500);
  }
});

// Search players (quick search) — rate limited, input sanitized
playerRoutes.get('/search', playerSearchRateLimit, optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const query = c.req.query('q');

  if (!query || query.length < 2) {
    return c.json({ players: [] });
  }

  // Enforce max query length to prevent abuse
  if (query.length > 100) {
    return c.json({ error: 'Search query too long (max 100 characters)' }, 400);
  }

  // Sanitize: strip characters that are not letters, spaces, hyphens, periods, or apostrophes
  const sanitized = query.replace(/[^a-zA-Z\s\-'.]/g, '').trim();
  if (sanitized.length < 2) {
    return c.json({ players: [] });
  }

  // Escape SQL LIKE wildcards in the user input to prevent LIKE injection
  const escapedQuery = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');

  try {
    const players = await db.query.nflPlayers.findMany({
      where: like(schema.nflPlayers.name, `%${escapedQuery}%`),
      limit: 20,
    });

    return c.json({ players });
  } catch (error) {
    console.error('Search players error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

// Get all recent news across all players + published articles
// Cached for 5 minutes — news doesn't change frequently and this is a high-traffic endpoint
playerRoutes.get('/news', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);

  try {
    const cacheKey = `player-news-with-articles:${limit}`;
    const news = await cached(cacheKey, 5 * 60 * 1000, async () => {
      // Fetch player news and published articles in parallel
      const [playerNewsItems, articleItems] = await Promise.all([
        db.query.playerNews.findMany({
          orderBy: desc(schema.playerNews.publishedAt),
          limit,
          with: {
            player: true,
          },
        }),
        db.query.articles.findMany({
          where: eq(schema.articles.status, 'published'),
          orderBy: [desc(schema.articles.createdAt)],
          limit,
          with: {
            playerLinks: {
              with: { player: true },
            },
          },
        }),
      ]);

      // Convert articles to news-shaped items, including linked players
      const articleNewsItems = articleItems.map((a: any) => {
        const linkedPlayers = a.playerLinks?.map((lnk: any) => lnk.player).filter(Boolean) || [];
        return {
          id: `article-${a.id}`,
          playerId: linkedPlayers[0]?.id || null,
          headline: a.title,
          content: a.description,
          source: a.author || 'FilmRoom',
          sourceUrl: `/articles/${a.slug}`,
          aiSummary: null,
          impactLevel: null,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : a.createdAt,
          createdAt: a.createdAt,
          player: linkedPlayers[0] || null,
          players: linkedPlayers,
          isArticle: true,
        };
      });

      // Merge and sort by publishedAt descending, take up to limit
      const merged = [...playerNewsItems, ...articleNewsItems]
        .sort((a: any, b: any) => {
          const dateA = a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt);
          const dateB = b.publishedAt instanceof Date ? b.publishedAt : new Date(b.publishedAt);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, limit);

      return merged;
    });

    return c.json({ news });
  } catch (error) {
    console.error('Get all news error:', error);
    return c.json({ error: 'Failed to fetch news' }, 500);
  }
});

// Get trending players from Sleeper platform + league-specific ownership
// Cached for 10 minutes — reduces external Sleeper API calls and D1 queries
playerRoutes.get('/trending', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const direction = c.req.query('direction') || 'up'; // 'up' or 'down'
  const leagueId = c.req.query('leagueId'); // optional: for league-specific ownership %
  const limit = Math.min(parseInt(c.req.query('limit') || '15'), 25);

  try {
    // Cache the Sleeper API call (10 min TTL) — this is the most expensive part
    const sleeperType = direction === 'up' ? 'add' : 'drop';
    const sleeperCacheKey = `sleeper-trending:${sleeperType}:${limit}`;
    const sleeperTrending = await cached<Array<{ player_id: string; count: number }>>(
      sleeperCacheKey, 10 * 60 * 1000, async () => {
        const sleeperRes = await fetch(
          `https://api.sleeper.app/v1/players/nfl/trending/${sleeperType}?lookback_hours=336&limit=${limit}`
        );
        if (!sleeperRes.ok) {
          throw new Error(`Sleeper API returned ${sleeperRes.status}`);
        }
        return sleeperRes.json();
      }
    );

    if (!sleeperTrending || sleeperTrending.length === 0) {
      return c.json({ trending: [] });
    }

    // 2. Map Sleeper external IDs to our internal players
    const externalIds = sleeperTrending.map(t => t.player_id);
    const CHUNK_SIZE = 80;
    const allPlayers: any[] = [];
    for (let i = 0; i < externalIds.length; i += CHUNK_SIZE) {
      const chunk = externalIds.slice(i, i + CHUNK_SIZE);
      const chunkPlayers = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.externalId, chunk),
      });
      allPlayers.push(...chunkPlayers);
    }
    const playerByExtId = new Map(allPlayers.map(p => [p.externalId, p]));

    // 3. Get league-specific ownership data if leagueId provided
    let leagueRosteredIds = new Set<string>();
    let leagueTeamCount = 0;

    if (leagueId) {
      // Get all teams in this league
      const leagueTeams = await db.query.teams.findMany({
        where: eq(schema.teams.leagueId, leagueId),
        columns: { id: true },
      });
      leagueTeamCount = leagueTeams.length;

      if (leagueTeams.length > 0) {
        const teamIds = leagueTeams.map(t => t.id);
        // Get all rostered players in this league
        const rosterRows = await db
          .select({ playerId: schema.rosterSpots.playerId })
          .from(schema.rosterSpots)
          .where(inArray(schema.rosterSpots.teamId, teamIds));
        leagueRosteredIds = new Set(rosterRows.map(r => r.playerId));
      }
    }

    // 4. Get the latest weekly stats for PPR points (last synced week)
    const internalIds = allPlayers.map(p => p.id);
    const avgPointsMap = new Map<string, number>();
    if (internalIds.length > 0) {
      // Get average PPR points from last 4 weeks of stats
      for (let i = 0; i < internalIds.length; i += CHUNK_SIZE) {
        const chunk = internalIds.slice(i, i + CHUNK_SIZE);
        const statsRows = await db
          .select({
            playerId: schema.playerWeeklyStats.playerId,
            avgPts: sql<number>`ROUND(AVG(${schema.playerWeeklyStats.fantasyPointsPPR}), 1)`.as('avg_pts'),
          })
          .from(schema.playerWeeklyStats)
          .where(inArray(schema.playerWeeklyStats.playerId, chunk))
          .groupBy(schema.playerWeeklyStats.playerId) as any[];
        for (const row of statsRows) {
          avgPointsMap.set(row.playerId, row.avgPts ?? 0);
        }
      }
    }

    // 5. Build response
    const trending = sleeperTrending
      .map(t => {
        const player = playerByExtId.get(t.player_id);
        if (!player) return null;

        // Ownership: if league provided, show league-specific; otherwise platform estimate
        let ownedPct = 0;
        if (leagueId && leagueTeamCount > 0) {
          ownedPct = leagueRosteredIds.has(player.id) ? 100 : 0;
        }

        return {
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          status: player.status,
          headshotUrl: player.headshotUrl ?? null,
          trendDirection: direction,
          trendValue: t.count,
          ownedPct,
          ownedInLeague: leagueId ? leagueRosteredIds.has(player.id) : undefined,
          avgPointsPPR: avgPointsMap.get(player.id) ?? 0,
        };
      })
      .filter(Boolean);

    return c.json({
      trending,
      source: 'sleeper',
      leagueId: leagueId || null,
    });
  } catch (error) {
    console.error('Get trending error:', error);
    return c.json({ error: 'Failed to fetch trending players' }, 500);
  }
});

// Get available stats seasons (for defaulting to most recent)
// Cached for 1 hour — available seasons change at most once per day
playerRoutes.get('/stats/available-years', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  try {
    const data = await cached('stats-available-years', 60 * 60 * 1000, async () => {
      const result = await db
        .select({ seasonYear: schema.playerWeeklyStats.seasonYear })
        .from(schema.playerWeeklyStats)
        .groupBy(schema.playerWeeklyStats.seasonYear)
        .orderBy(desc(schema.playerWeeklyStats.seasonYear));
      const years = result.map((r) => r.seasonYear).filter((y): y is number => y != null);
      const now = new Date();
      const fallbackSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
      return {
        years: years.length > 0 ? years : [fallbackSeason, fallbackSeason - 1],
        latest: years[0] ?? fallbackSeason,
      };
    });
    return c.json(data);
  } catch (error) {
    console.error('Get available years error:', error);
    const now = new Date();
    const fallbackSeason = now.getMonth() <= 6 ? now.getFullYear() - 1 : now.getFullYear();
    return c.json({ years: [fallbackSeason, fallbackSeason - 1], latest: fallbackSeason });
  }
});

// Get player details
playerRoutes.get('/:id', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const idParam = c.req.param('id');

  try {
    // Resolve playerId — accept either our internal id or the Sleeper externalId
    // (numeric). Mirrors the resolution behavior of /:id/stats and the other
    // sibling routes so /players/:slug-:externalId profile URLs work.
    const lookupColumn = /^\d+$/.test(idParam)
      ? schema.nflPlayers.externalId
      : schema.nflPlayers.id;

    const player = await db.query.nflPlayers.findFirst({
      where: eq(lookupColumn, idParam),
      with: {
        news: {
          orderBy: desc(schema.playerNews.publishedAt),
          limit: 3,
        },
      },
    });

    if (!player) {
      return c.json({ error: 'Player not found' }, 404);
    }

    return c.json({ player });
  } catch (error) {
    console.error('Get player error:', error);
    return c.json({ error: 'Failed to fetch player' }, 500);
  }
});

// Get years for which this player has stats (for dropdown - only show years with data)
playerRoutes.get('/:id/stats/available-years', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  let playerId = c.req.param('id');

  try {
    // Resolve playerId - might be our UUID or Sleeper externalId
    if (/^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.externalId, playerId),
      });
      if (player) playerId = player.id;
    }

    const result = await db
      .select({ seasonYear: schema.playerWeeklyStats.seasonYear })
      .from(schema.playerWeeklyStats)
      .where(eq(schema.playerWeeklyStats.playerId, playerId))
      .groupBy(schema.playerWeeklyStats.seasonYear)
      .orderBy(desc(schema.playerWeeklyStats.seasonYear));
    const years = result.map((r) => r.seasonYear).filter((y): y is number => y != null);

    return c.json({
      years: years.length > 0 ? years : [],
      latest: years[0] ?? null,
    });
  } catch (error) {
    console.error('Get player available years error:', error);
    return c.json({ years: [], latest: null });
  }
});

// Get player stats
playerRoutes.get('/:id/stats', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  let playerId = c.req.param('id');

  try {
    // Resolve season - use "latest" or fetch max from DB when not specified
    const seasonParam = c.req.query('season') || 'latest';
    let season: number;
    if (seasonParam === 'latest') {
      const maxResult = await db
        .select({ maxYear: sql<number>`max(${schema.playerWeeklyStats.seasonYear})` })
        .from(schema.playerWeeklyStats);
      const fallbackSeason = new Date().getMonth() <= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear();
      season = maxResult[0]?.maxYear ?? fallbackSeason;
    } else {
      const parsed = parseInt(seasonParam);
      const fallbackSeason = new Date().getMonth() <= 6 ? new Date().getFullYear() - 1 : new Date().getFullYear();
      season = isNaN(parsed) ? fallbackSeason : parsed;
    }
    // Resolve playerId - might be our UUID or Sleeper externalId
    let stats = await db.query.playerWeeklyStats.findMany({
      where: and(
        eq(schema.playerWeeklyStats.playerId, playerId),
        eq(schema.playerWeeklyStats.seasonYear, season)
      ),
      orderBy: asc(schema.playerWeeklyStats.week),
    });

    // Fallback 1: if no stats and playerId looks like Sleeper ID (numeric), try lookup by externalId
    if (stats.length === 0 && /^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.externalId, playerId),
      });
      if (player) {
        playerId = player.id;
        stats = await db.query.playerWeeklyStats.findMany({
          where: and(
            eq(schema.playerWeeklyStats.playerId, playerId),
            eq(schema.playerWeeklyStats.seasonYear, season)
          ),
          orderBy: asc(schema.playerWeeklyStats.week),
        });
      }
    }

    // Fallback 2: if requested season has no stats, try prior season
    if (stats.length === 0 && season >= 2023) {
      stats = await db.query.playerWeeklyStats.findMany({
        where: and(
          eq(schema.playerWeeklyStats.playerId, playerId),
          eq(schema.playerWeeklyStats.seasonYear, season - 1)
        ),
        orderBy: asc(schema.playerWeeklyStats.week),
      });
    }

    // Resolve player position for DEF (plays every game; K needs attempts to count as played)
    const playerRow = await db.query.nflPlayers.findFirst({
      where: eq(schema.nflPlayers.id, playerId),
      columns: { position: true },
    });
    const position = playerRow?.position ?? '';

    // Calculate season totals (gamesPlayed = weeks with snap participation; fallback to stat activity for older records)
    // DEF plays every game - count each week with stats as played; K requires FG/XP attempts
    const seasonTotals = stats.reduce(
      (acc, week) => {
        const isDef = position === 'DEF';
        const played = isDef ||
          (week.offSnaps ?? 0) > 0 || (week.defSnaps ?? 0) > 0 || (week.stSnaps ?? 0) > 0 ||
          ((week.passAttempts ?? 0) > 0 || (week.rushAttempts ?? 0) > 0 || (week.targets ?? 0) > 0 ||
          (week.receptions ?? 0) > 0 || (week.fgAttempts ?? 0) > 0 || (week.xpAttempts ?? 0) > 0 ||
          (week.sacks ?? 0) > 0 || (week.defInterceptions ?? 0) > 0);
        const snapPct = (() => {
          const off = week.offSnaps ?? 0;
          const def = week.defSnaps ?? 0;
          const st = week.stSnaps ?? 0;
          const tmOff = week.tmOffSnaps ?? 0;
          const tmDef = week.tmDefSnaps ?? 0;
          const tmSt = week.tmStSnaps ?? 0;
          if (off > 0 && tmOff > 0) return (off / tmOff) * 100;
          if (def > 0 && tmDef > 0) return (def / tmDef) * 100;
          if (st > 0 && tmSt > 0) return (st / tmSt) * 100;
          return null;
        })();
        return {
          games: acc.games + 1,
          gamesPlayed: acc.gamesPlayed + (played ? 1 : 0),
          snapPctSum: acc.snapPctSum + (snapPct != null ? snapPct : 0),
          passYards: acc.passYards + (week.passYards || 0),
        passTDs: acc.passTDs + (week.passTDs || 0),
        passInterceptions: acc.passInterceptions + (week.passInterceptions || 0),
        rushYards: acc.rushYards + (week.rushYards || 0),
        rushTDs: acc.rushTDs + (week.rushTDs || 0),
        receptions: acc.receptions + (week.receptions || 0),
        receivingYards: acc.receivingYards + (week.receivingYards || 0),
        receivingTDs: acc.receivingTDs + (week.receivingTDs || 0),
        targets: acc.targets + (week.targets || 0),
        fantasyPointsPPR: acc.fantasyPointsPPR + (week.fantasyPointsPPR || 0),
        fantasyPointsHalf: acc.fantasyPointsHalf + (week.fantasyPointsHalf || 0),
        fantasyPointsStd: acc.fantasyPointsStd + (week.fantasyPointsStd || 0),
        };
      },
      {
        games: 0,
        gamesPlayed: 0,
        snapPctSum: 0,
        passYards: 0,
        passTDs: 0,
        passInterceptions: 0,
        rushYards: 0,
        rushTDs: 0,
        receptions: 0,
        receivingYards: 0,
        receivingTDs: 0,
        targets: 0,
        fantasyPointsPPR: 0,
        fantasyPointsHalf: 0,
        fantasyPointsStd: 0,
      }
    );

    const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const computeSnapPct = (row: any) => {
      const off = row.offSnaps ?? 0;
      const def = row.defSnaps ?? 0;
      const st = row.stSnaps ?? 0;
      const tmOff = row.tmOffSnaps ?? 0;
      const tmDef = row.tmDefSnaps ?? 0;
      const tmSt = row.tmStSnaps ?? 0;
      if (off > 0 && tmOff > 0) return Math.round((off / tmOff) * 1000) / 10;
      if (def > 0 && tmDef > 0) return Math.round((def / tmDef) * 1000) / 10;
      if (st > 0 && tmSt > 0) return Math.round((st / tmSt) * 1000) / 10;
      return null;
    };
    const normalize = (row: any) => {
      const out: any = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.includes('_') ? toCamel(k) : k] = v;
      }
      const snapPct = computeSnapPct(row);
      if (snapPct != null) out.snapPct = snapPct;
      return out;
    };
    const normalizedStats = stats.map(normalize);

    const { snapPctSum, ...totalsOut } = seasonTotals as any;
    const averageSnapPct = snapPctSum > 0 && (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0
      ? Math.round((snapPctSum / (seasonTotals.gamesPlayed ?? seasonTotals.games)) * 10) / 10
      : null;
    return c.json({
      weeklyStats: normalizedStats,
      seasonTotals: { ...totalsOut, averageSnapPct },
      resolvedSeason: season,
      averagePointsPPR: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0
        ? Math.round((seasonTotals.fantasyPointsPPR / (seasonTotals.gamesPlayed ?? seasonTotals.games)) * 10) / 10
        : 0,
      averagePointsHalf: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0
        ? Math.round((seasonTotals.fantasyPointsHalf / (seasonTotals.gamesPlayed ?? seasonTotals.games)) * 10) / 10
        : 0,
      averagePointsStd: (seasonTotals.gamesPlayed ?? seasonTotals.games) > 0
        ? Math.round((seasonTotals.fantasyPointsStd / (seasonTotals.gamesPlayed ?? seasonTotals.games)) * 10) / 10
        : 0,
    });
  } catch (error) {
    console.error('Get player stats error:', error);
    return c.json({ error: 'Failed to fetch player stats' }, 500);
  }
});

// Get player projections
playerRoutes.get('/:id/projections', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  let playerId = c.req.param('id');
  const week = c.req.query('week');
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));
  const scoringFormat = c.req.query('format') || 'ppr';

  try {
    if (/^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.externalId, playerId),
      });
      if (player) playerId = player.id;
    }

    const conditions = [
      eq(schema.playerProjections.playerId, playerId),
      eq(schema.playerProjections.seasonYear, season),
      eq(schema.playerProjections.scoringFormat, scoringFormat),
    ];

    if (week) {
      conditions.push(eq(schema.playerProjections.week, parseInt(week)));
    }

    const projections = await db.query.playerProjections.findMany({
      where: and(...conditions),
      orderBy: asc(schema.playerProjections.week),
    });

    return c.json({ projections });
  } catch (error) {
    console.error('Get player projections error:', error);
    return c.json({ error: 'Failed to fetch projections' }, 500);
  }
});

// Get player news + articles linked to this player
playerRoutes.get('/:id/news', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  let playerId = c.req.param('id');

  try {
    if (/^\d+$/.test(playerId)) {
      const player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.externalId, playerId),
      });
      if (player) playerId = player.id;
    }

    // Fetch player news and linked articles in parallel
    const [newsItems, articleLinks] = await Promise.all([
      db.query.playerNews.findMany({
        where: eq(schema.playerNews.playerId, playerId),
        orderBy: desc(schema.playerNews.publishedAt),
        limit: 10,
      }),
      db.query.articlePlayers.findMany({
        where: eq(schema.articlePlayers.playerId, playerId),
        with: {
          article: true,
        },
      }),
    ]);

    // Convert linked articles to news-shaped items (only published ones)
    const articleNewsItems = articleLinks
      .filter((lnk: any) => lnk.article?.status === 'published')
      .map((lnk: any) => ({
        id: `article-${lnk.article.id}`,
        playerId,
        headline: lnk.article.title,
        content: lnk.article.description,
        source: lnk.article.author || 'FilmRoom',
        sourceUrl: `/articles/${lnk.article.slug}`,
        aiSummary: null,
        impactLevel: null,
        publishedAt: lnk.article.publishedAt ? new Date(lnk.article.publishedAt) : lnk.article.createdAt,
        createdAt: lnk.article.createdAt,
        isArticle: true,
      }));

    // Merge and sort by date, limit to 10
    const merged = [...newsItems, ...articleNewsItems]
      .sort((a: any, b: any) => {
        const dateA = a.publishedAt instanceof Date ? a.publishedAt : new Date(a.publishedAt);
        const dateB = b.publishedAt instanceof Date ? b.publishedAt : new Date(b.publishedAt);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);

    return c.json({ news: merged });
  } catch (error) {
    console.error('Get player news error:', error);
    return c.json({ error: 'Failed to fetch player news' }, 500);
  }
});

// Get player prop lines for a specific week
playerRoutes.get('/:id/props', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const idParam = c.req.param('id');
  const week = parseInt(c.req.query('week') || '1', 10);
  const season = parseInt(c.req.query('season') || '2025', 10);

  if (!week || week < 1 || week > 18) {
    return c.json({ error: 'Invalid week (must be 1-18)' }, 400);
  }

  try {
    // Get player info — accept either internal id or Sleeper externalId
    const lookupColumn = /^\d+$/.test(idParam)
      ? schema.nflPlayers.externalId
      : schema.nflPlayers.id;
    const player = await db.query.nflPlayers.findFirst({
      where: eq(lookupColumn, idParam),
    });

    if (!player) {
      return c.json({ error: 'Player not found' }, 404);
    }

    const playerId = player.id;

    // Name matching between Sleeper and The Odds API is inconsistent —
    // Sleeper strips "Jr." suffixes and some punctuation, sportsbooks don't.
    // Fetch all props for the requested week/season, then filter client-side
    // by normalized name so variants collapse to the same player.
    const targetNormalized = normalizePlayerName(player.name);

    const findProps = async (s: number) => {
      const rows = await db.query.playerProps.findMany({
        where: and(
          eq(schema.playerProps.week, week),
          eq(schema.playerProps.season, s)
        ),
        orderBy: asc(schema.playerProps.market),
      });
      return rows.filter(r => normalizePlayerName(r.playerName) === targetNormalized);
    };

    // Try the requested season first. If no props exist (e.g. we're in the
    // 2026 offseason and no 2026 lines have been posted yet), fall back to
    // the most recent season that has props for this player. The UI shows a
    // "last season" badge via isFallback so users know it's historical.
    let effectiveSeason = season;
    let isFallback = false;
    let props = await findProps(season);

    if (props.length === 0) {
      // Walk back up to 3 prior seasons looking for props for this player.
      // Each findProps call is already scoped to a single week+season so
      // the loop stays cheap and bounded.
      for (let s = season - 1; s >= season - 3; s--) {
        const found = await findProps(s);
        if (found.length > 0) {
          effectiveSeason = s;
          isFallback = true;
          props = found;
          break;
        }
      }
    }

    // Weekly stats are fetched for the EFFECTIVE season so "actual vs line"
    // comparisons line up with whichever season's props we're showing.
    const weeklyStats = await db.query.playerWeeklyStats.findFirst({
      where: and(
        eq(schema.playerWeeklyStats.playerId, playerId),
        eq(schema.playerWeeklyStats.week, week),
        eq(schema.playerWeeklyStats.seasonYear, effectiveSeason)
      ),
    });

    // Transform to more readable format
    const propsByMarket: Record<string, any> = {};
    for (const prop of props) {
      const marketKey = prop.market.replace('player_', '').replace('_', '');

      if (!propsByMarket[marketKey]) {
        propsByMarket[marketKey] = {
          line: prop.overPoint || prop.underPoint,
          overPrice: prop.overPrice,
          underPrice: prop.underPrice,
          yesPrice: prop.yesPrice,
          noPrice: prop.noPrice,
        };
      }
    }

    // Build response with actual values from stats
    const actual: Record<string, any> = {};
    if (weeklyStats) {
      actual.passYds = weeklyStats.passYards;
      actual.passTds = weeklyStats.passTDs;
      actual.rushYds = weeklyStats.rushYards;
      actual.rushTds = weeklyStats.rushTDs;
      actual.recYds = weeklyStats.receivingYards;
      actual.recs = weeklyStats.receptions;
      actual.scoredTd = (weeklyStats.passTDs || 0) + (weeklyStats.rushTDs || 0) + (weeklyStats.receivingTDs || 0) > 0;
    }

    return c.json({
      player: {
        name: player.name,
        team: player.team,
        position: player.position,
      },
      props: propsByMarket,
      actual,
      week,
      season: effectiveSeason,
      requestedSeason: season,
      isFallback,
    });
  } catch (error) {
    console.error('Get player props error:', error);
    return c.json({ error: 'Failed to fetch player props' }, 500);
  }
});

// Get props for all players in a week (for rankings/table view)
playerRoutes.get('/props', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.query('week') || '1', 10);
  const season = parseInt(c.req.query('season') || '2025', 10);
  const position = c.req.query('position')?.toUpperCase();

  if (!week || week < 1 || week > 18) {
    return c.json({ error: 'Invalid week (must be 1-18)' }, 400);
  }

  try {
    // Get all props for this week
    const allProps = await db.query.playerProps.findMany({
      where: and(
        eq(schema.playerProps.week, week),
        eq(schema.playerProps.season, season)
      ),
      orderBy: [
        asc(schema.playerProps.playerName),
        asc(schema.playerProps.market),
      ],
    });

    // Group by player
    const propsByPlayer: Record<string, any> = {};
    for (const prop of allProps) {
      if (!propsByPlayer[prop.playerName]) {
        propsByPlayer[prop.playerName] = {
          playerName: prop.playerName,
          externalId: prop.playerExternalId,
          team: prop.homeTeam, // Will be overwritten if we find the player
          position: 'UNK',
          props: {},
        };
      }

      const marketKey = prop.market.replace('player_', '').replace('_', '');
      if (!propsByPlayer[prop.playerName].props[marketKey]) {
        propsByPlayer[prop.playerName].props[marketKey] = {
          line: prop.overPoint || prop.underPoint,
          overPrice: prop.overPrice,
          underPrice: prop.underPrice,
          yesPrice: prop.yesPrice,
          noPrice: prop.noPrice,
        };
      }
    }

    // Enrich with player info
    const playerNames = Object.keys(propsByPlayer);
    if (playerNames.length > 0) {
      const players = await db.query.nflPlayers.findMany({
        where: inArray(schema.nflPlayers.name, playerNames),
      });

      const playerMap = new Map(players.map(p => [p.name, p]));
      for (const [name, propData] of Object.entries(propsByPlayer)) {
        const player = playerMap.get(name);
        if (player) {
          propData.team = player.team;
          propData.position = player.position;
          propData.externalId = player.externalId;
        }
      }
    }

    // Filter by position if requested
    let result = Object.values(propsByPlayer);
    if (position) {
      result = result.filter((p: any) => p.position === position);
    }

    return c.json({
      week,
      season,
      position: position || null,
      count: result.length,
      players: result,
    });
  } catch (error) {
    console.error('Get all props error:', error);
    return c.json({ error: 'Failed to fetch props' }, 500);
  }
});

// Get available players for a league (not on any roster)
playerRoutes.get('/available/:leagueId', authMiddleware, async (c) => {
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
    // Get all rostered player IDs in this league
    const teams = await db.query.teams.findMany({
      where: eq(schema.teams.leagueId, leagueId),
      with: {
        roster: true,
      },
    });

    const rosteredPlayerIds = teams.flatMap(t => t.roster.map(r => r.playerId));

    // Get all players not on a roster
    const allPlayers = await db.query.nflPlayers.findMany({
      where: eq(schema.nflPlayers.status, 'active'),
    });

    const availablePlayers = allPlayers.filter(
      p => !rosteredPlayerIds.includes(p.id)
    );

    return c.json({ players: availablePlayers });
  } catch (error) {
    console.error('Get available players error:', error);
    return c.json({ error: 'Failed to fetch available players' }, 500);
  }
});

// ---------------------------------------------------------------------------
// Matchup Grade – based on the opponent defense's last 5 games vs this position
// ---------------------------------------------------------------------------
playerRoutes.get('/:id/matchup-grade', optionalAuthMiddleware, async (c) => {
  const db = c.get('db');
  let playerId = c.req.param('id');
  const seasonParam = c.req.query('season');
  const weekParam = c.req.query('week'); // optional: evaluate grade for a specific week
  const formatParam = (c.req.query('format') || 'ppr') as 'ppr' | 'half' | 'std';

  try {
    // 1. Resolve player
    let player = await db.query.nflPlayers.findFirst({
      where: eq(schema.nflPlayers.id, playerId),
    });
    if (!player && /^\d+$/.test(playerId)) {
      player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.externalId, playerId),
      });
    }
    if (!player) return c.json({ error: 'Player not found' }, 404);

    const position = player.position; // QB, RB, WR, TE, K, DEF
    const playerTeam = player.team;

    // Determine season, transparently falling back to the most recent season
    // with games when the requested one has no data (e.g. 2026 pre-kickoff).
    let requestedSeason: number;
    if (seasonParam) {
      const parsed = parseInt(seasonParam);
      requestedSeason = isNaN(parsed) ? new Date().getFullYear() : parsed;
    } else {
      const maxResult = await db
        .select({ maxYear: sql<number>`max(${schema.playerWeeklyStats.seasonYear})` })
        .from(schema.playerWeeklyStats);
      requestedSeason = maxResult[0]?.maxYear ?? new Date().getFullYear();
    }
    const resolved = await resolveDisplaySeason(db, requestedSeason);
    const season = resolved.season;

    // 2. Find the opponent for this player's upcoming/current week
    //    Strategy: look at nfl_games for the player's team, find the next incomplete game,
    //    or if a week is specified, use that week.
    let opponentTeam: string | null = null;
    let matchupWeek: number | null = null;

    if (weekParam) {
      const week = parseInt(weekParam);
      if (!isNaN(week) && week >= 1 && week <= 22) {
        // Find the game for this team on the given week
        const game = await db.query.nflGames.findFirst({
          where: and(
            eq(schema.nflGames.seasonYear, season),
            eq(schema.nflGames.week, week),
            sql`(${schema.nflGames.homeTeam} = ${playerTeam} OR ${schema.nflGames.awayTeam} = ${playerTeam})`
          ),
        });
        if (game) {
          opponentTeam = game.homeTeam === playerTeam ? game.awayTeam : game.homeTeam;
          matchupWeek = week;
        }
      }
    }

    // If no week specified (or game not found), find next incomplete game
    if (!opponentTeam) {
      const nextGame = await db.query.nflGames.findFirst({
        where: and(
          eq(schema.nflGames.seasonYear, season),
          eq(schema.nflGames.seasonType, 'regular'),
          sql`(${schema.nflGames.homeTeam} = ${playerTeam} OR ${schema.nflGames.awayTeam} = ${playerTeam})`,
          eq(schema.nflGames.isComplete, false)
        ),
        orderBy: asc(schema.nflGames.week),
      });
      if (nextGame) {
        opponentTeam = nextGame.homeTeam === playerTeam ? nextGame.awayTeam : nextGame.homeTeam;
        matchupWeek = nextGame.week;
      }
    }

    // Fallback: if season is over, use the last completed game's opponent
    if (!opponentTeam) {
      const lastGame = await db.query.nflGames.findFirst({
        where: and(
          eq(schema.nflGames.seasonYear, season),
          eq(schema.nflGames.seasonType, 'regular'),
          sql`(${schema.nflGames.homeTeam} = ${playerTeam} OR ${schema.nflGames.awayTeam} = ${playerTeam})`,
          eq(schema.nflGames.isComplete, true)
        ),
        orderBy: desc(schema.nflGames.week),
      });
      if (lastGame) {
        opponentTeam = lastGame.homeTeam === playerTeam ? lastGame.awayTeam : lastGame.homeTeam;
        matchupWeek = lastGame.week;
      }
    }

    if (!opponentTeam) {
      return c.json({
        grade: null,
        label: 'Unknown',
        message: 'No matchup data available',
        opponent: null,
        week: null,
      });
    }

    // 3. Get the opponent defense's last 5 completed games (not bye weeks)
    //    A "completed game" for the defense = a game in nfl_games where that team played and isComplete.
    //    When we fell back to a prior season (offseason), ignore the matchupWeek
    //    cutoff — there's no "before-week-1" sample in the fallback season, so
    //    instead we use the whole completed season as the defense's context.
    const defWeekCutoff = resolved.isFallback ? null : matchupWeek;
    const defGames = await db
      .select({
        week: schema.nflGames.week,
        homeTeam: schema.nflGames.homeTeam,
        awayTeam: schema.nflGames.awayTeam,
      })
      .from(schema.nflGames)
      .where(
        and(
          eq(schema.nflGames.seasonYear, season),
          eq(schema.nflGames.seasonType, 'regular'),
          eq(schema.nflGames.isComplete, true),
          sql`(${schema.nflGames.homeTeam} = ${opponentTeam} OR ${schema.nflGames.awayTeam} = ${opponentTeam})`,
          defWeekCutoff ? sql`${schema.nflGames.week} < ${defWeekCutoff}` : sql`1=1`
        )
      )
      .orderBy(desc(schema.nflGames.week))
      .limit(5);

    if (defGames.length === 0) {
      return c.json({
        grade: null,
        label: 'Unknown',
        message: `No completed games found for ${opponentTeam} defense`,
        opponent: opponentTeam,
        week: matchupWeek,
      });
    }

    const defWeeks = defGames.map(g => g.week);

    // Pick the right fantasy points column
    const fpCol = formatParam === 'std'
      ? schema.playerWeeklyStats.fantasyPointsStd
      : formatParam === 'half'
        ? schema.playerWeeklyStats.fantasyPointsHalf
        : schema.playerWeeklyStats.fantasyPointsPPR;

    // 4. Query all players of this position who faced the opponent defense in those weeks
    //    The opponent field in player_weekly_stats stores the opposing team (with optional @ prefix)
    //    Players faced opponentTeam's defense = players whose opponent is opponentTeam (or @opponentTeam)
    //    AND who actually played (have stats / snaps)
    const defAllowedStats = await db
      .select({
        week: schema.playerWeeklyStats.week,
        fantasyPoints: fpCol,
        playerId: schema.playerWeeklyStats.playerId,
      })
      .from(schema.playerWeeklyStats)
      .innerJoin(schema.nflPlayers, eq(schema.playerWeeklyStats.playerId, schema.nflPlayers.id))
      .where(
        and(
          eq(schema.playerWeeklyStats.seasonYear, season),
          eq(schema.nflPlayers.position, position),
          inArray(schema.playerWeeklyStats.week, defWeeks),
          sql`(${schema.playerWeeklyStats.opponent} = ${opponentTeam} OR ${schema.playerWeeklyStats.opponent} = ${'@' + opponentTeam})`,
          // Must have actually played (non-zero stats)
          sql`(
            ${schema.playerWeeklyStats.offSnaps} > 0
            OR ${schema.playerWeeklyStats.defSnaps} > 0
            OR ${schema.playerWeeklyStats.passAttempts} > 0
            OR ${schema.playerWeeklyStats.rushAttempts} > 0
            OR ${schema.playerWeeklyStats.targets} > 0
            OR ${schema.playerWeeklyStats.receptions} > 0
            OR ${schema.playerWeeklyStats.fgAttempts} > 0
            OR ${schema.playerWeeklyStats.xpAttempts} > 0
            OR ${schema.playerWeeklyStats.sacks} > 0
            OR ${schema.playerWeeklyStats.defInterceptions} > 0
          )`
        )
      );

    // Sum fantasy points allowed by week
    const pointsByWeek = new Map<number, number>();
    for (const row of defAllowedStats) {
      const pts = row.fantasyPoints ?? 0;
      pointsByWeek.set(row.week, (pointsByWeek.get(row.week) ?? 0) + pts);
    }

    const weeksWithData = [...pointsByWeek.keys()];
    if (weeksWithData.length === 0) {
      return c.json({
        grade: null,
        label: 'Unknown',
        message: `No ${position} stats available against ${opponentTeam}`,
        opponent: opponentTeam,
        week: matchupWeek,
      });
    }

    const totalAllowed = [...pointsByWeek.values()].reduce((a, b) => a + b, 0);
    const avgAllowedPerGame = totalAllowed / weeksWithData.length;

    // 5. Get league-wide average for this position over the same weeks
    //    (total fantasy points scored by all players of this position in these weeks / number of weeks)
    const leagueAvgResult = await db
      .select({
        week: schema.playerWeeklyStats.week,
        totalPoints: sql<number>`sum(${fpCol})`,
      })
      .from(schema.playerWeeklyStats)
      .innerJoin(schema.nflPlayers, eq(schema.playerWeeklyStats.playerId, schema.nflPlayers.id))
      .where(
        and(
          eq(schema.playerWeeklyStats.seasonYear, season),
          eq(schema.nflPlayers.position, position),
          inArray(schema.playerWeeklyStats.week, defWeeks),
          sql`(
            ${schema.playerWeeklyStats.offSnaps} > 0
            OR ${schema.playerWeeklyStats.defSnaps} > 0
            OR ${schema.playerWeeklyStats.passAttempts} > 0
            OR ${schema.playerWeeklyStats.rushAttempts} > 0
            OR ${schema.playerWeeklyStats.targets} > 0
            OR ${schema.playerWeeklyStats.receptions} > 0
            OR ${schema.playerWeeklyStats.fgAttempts} > 0
            OR ${schema.playerWeeklyStats.xpAttempts} > 0
            OR ${schema.playerWeeklyStats.sacks} > 0
            OR ${schema.playerWeeklyStats.defInterceptions} > 0
          )`
        )
      )
      .groupBy(schema.playerWeeklyStats.week);

    // Count how many teams played each week to get per-team average
    const teamsPerWeekResult = await db
      .select({
        week: schema.nflGames.week,
        gameCount: sql<number>`count(*)`,
      })
      .from(schema.nflGames)
      .where(
        and(
          eq(schema.nflGames.seasonYear, season),
          eq(schema.nflGames.seasonType, 'regular'),
          eq(schema.nflGames.isComplete, true),
          inArray(schema.nflGames.week, defWeeks)
        )
      )
      .groupBy(schema.nflGames.week);

    const teamsPerWeek = new Map(teamsPerWeekResult.map(r => [r.week, r.gameCount * 2])); // each game = 2 teams

    // League avg points allowed per team per week for this position
    let leagueTotalPerTeam = 0;
    let leagueWeekCount = 0;
    for (const row of leagueAvgResult) {
      const numTeams = teamsPerWeek.get(row.week) ?? 32;
      leagueTotalPerTeam += (row.totalPoints ?? 0) / numTeams;
      leagueWeekCount++;
    }
    const leagueAvgPerTeamPerGame = leagueWeekCount > 0 ? leagueTotalPerTeam / leagueWeekCount : 0;

    // 6. Calculate grade: how does this defense compare to league average?
    //    Higher avgAllowed = easier matchup for the player (good grade)
    //    ratio > 1 means defense allows MORE than average (favorable)
    //    ratio < 1 means defense allows LESS than average (tough)
    const ratio = leagueAvgPerTeamPerGame > 0 ? avgAllowedPerGame / leagueAvgPerTeamPerGame : 1;

    // Map ratio to grade
    // ratio >= 1.25 → A+, 1.20 → A, 1.15 → A-, 1.10 → B+, 1.05 → B, 1.00 → B-
    // 0.95 → C+, 0.90 → C, 0.85 → C-, 0.80 → D+, 0.75 → D, < 0.75 → D-
    let grade: string;
    if (ratio >= 1.25) grade = 'A+';
    else if (ratio >= 1.20) grade = 'A';
    else if (ratio >= 1.15) grade = 'A-';
    else if (ratio >= 1.10) grade = 'B+';
    else if (ratio >= 1.05) grade = 'B';
    else if (ratio >= 1.00) grade = 'B-';
    else if (ratio >= 0.95) grade = 'C+';
    else if (ratio >= 0.90) grade = 'C';
    else if (ratio >= 0.85) grade = 'C-';
    else if (ratio >= 0.80) grade = 'D+';
    else if (ratio >= 0.75) grade = 'D';
    else grade = 'D-';

    const label = grade.startsWith('A') ? 'Elite'
      : grade.startsWith('B') ? 'Good'
        : grade.startsWith('C') ? 'Average'
          : 'Tough';

    // Build per-game breakdown for the last 5 games
    const gameBreakdown = defGames.map(g => ({
      week: g.week,
      pointsAllowed: Math.round((pointsByWeek.get(g.week) ?? 0) * 10) / 10,
    }));

    return c.json({
      grade,
      label,
      opponent: opponentTeam,
      week: matchupWeek,
      season,
      requestedSeason: resolved.requested,
      isFallback: resolved.isFallback,
      position,
      format: formatParam,
      gamesAnalyzed: weeksWithData.length,
      avgPointsAllowed: Math.round(avgAllowedPerGame * 10) / 10,
      leagueAvg: Math.round(leagueAvgPerTeamPerGame * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      gameBreakdown,
      message: `${opponentTeam} allows ${Math.round(avgAllowedPerGame * 10) / 10} ${formatParam.toUpperCase()} pts/game to ${position}s (league avg: ${Math.round(leagueAvgPerTeamPerGame * 10) / 10})`,
    });
  } catch (error) {
    console.error('Matchup grade error:', error);
    return c.json({ error: 'Failed to calculate matchup grade' }, 500);
  }
});

// GET /api/players/:id/projection-accuracy
// Returns projection vs actual performance for a single player across all weeks
playerRoutes.get('/:id/projection-accuracy', async (c) => {
  const db = c.get('db');
  const playerId = c.req.param('id');
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));

  try {
    // Get player info
    const player = await db.query.nflPlayers.findFirst({
      where: eq(schema.nflPlayers.id, playerId),
    });

    if (!player) {
      return c.json({ error: 'Player not found' }, 404);
    }

    // Get all projections for this player for the season
    const projections = await db.query.playerProjections.findMany({
      where: and(
        eq(schema.playerProjections.playerId, playerId),
        eq(schema.playerProjections.seasonYear, season),
        eq(schema.playerProjections.scoringFormat, 'ppr') // Use PPR for consistency
      ),
    });

    // Get all actual stats for this player for the season
    const stats = await db.query.playerWeeklyStats.findMany({
      where: and(
        eq(schema.playerWeeklyStats.playerId, playerId),
        eq(schema.playerWeeklyStats.seasonYear, season)
      ),
    });

    // Get all games for this season
    const games = await db.query.nflGames.findMany({
      where: eq(schema.nflGames.seasonYear, season),
    });

    // Get odds data for all games
    const allOdds = await db.query.gameOdds.findMany({
      where: eq(schema.gameOdds.season, season),
    });

    // Build week-by-week comparison
    const weekData = [];
    for (const proj of projections) {
      const stat = stats.find(s => s.week === proj.week);
      const actual = stat ? stat.fantasyPointsPPR : null;

      // Find the game for this week to get team and odds
      const playerTeam = player.team;
      const game = games.find(
        g => g.week === proj.week && (g.homeTeam === playerTeam || g.awayTeam === playerTeam)
      );

      // Get odds for this game (most recent snapshot)
      let spread: number | null = null;
      let total: number | null = null;
      let impliedTeamTotal: number | null = null;

      if (game) {
        const gameOdds = allOdds.filter(o => o.gameId === game.id);
        if (gameOdds.length > 0) {
          // Use most recent odds
          const odds = gameOdds.sort((a, b) =>
            new Date(b.snapshotTime).getTime() - new Date(a.snapshotTime).getTime()
          )[0];

          // Store spread and total
          if (odds.homeTeam === playerTeam && odds.homePoint !== null) {
            spread = odds.homePoint;
          } else if (odds.awayTeam === playerTeam && odds.awayPoint !== null) {
            spread = odds.awayPoint;
          }

          if (odds.overPoint !== null) {
            total = odds.overPoint;
          }

          // Calculate implied team total: if favored, use (total + spread) / 2; if underdog, use (total - spread) / 2
          if (total !== null && spread !== null) {
            if (spread < 0) {
              // This team is favored
              impliedTeamTotal = (total + Math.abs(spread)) / 2;
            } else {
              // This team is underdog
              impliedTeamTotal = (total - spread) / 2;
            }
          }
        }
      }

      weekData.push({
        week: proj.week,
        projected: Math.round(proj.projectedPoints * 10) / 10,
        actual: actual !== null ? Math.round(actual * 10) / 10 : null,
        diff: actual !== null ? Math.round((actual - proj.projectedPoints) * 10) / 10 : null,
        gameOdds: {
          spread: spread !== null ? Math.round(spread * 10) / 10 : null,
          total: total !== null ? Math.round(total * 10) / 10 : null,
          impliedTeamTotal: impliedTeamTotal !== null ? Math.round(impliedTeamTotal * 10) / 10 : null,
        },
      });
    }

    // Calculate season stats (only for weeks with actual data)
    const weeksWithActual = weekData.filter(w => w.actual !== null);
    const avgProjected = weekData.length > 0
      ? Math.round((weekData.reduce((a, w) => a + w.projected, 0) / weekData.length) * 10) / 10
      : 0;
    const avgActual = weeksWithActual.length > 0
      ? Math.round((weeksWithActual.reduce((a, w) => a + (w.actual ?? 0), 0) / weeksWithActual.length) * 10) / 10
      : 0;
    const totalOverperformance = weeksWithActual.length > 0
      ? Math.round((weeksWithActual.reduce((a, w) => a + (w.diff ?? 0), 0)) * 10) / 10
      : 0;

    // Hit rate: % of weeks within 3 pts of projection
    const hitRate = weeksWithActual.length > 0
      ? Math.round((weeksWithActual.filter(w => Math.abs(w.diff ?? 0) <= 3).length / weeksWithActual.length) * 100)
      : 0;

    return c.json({
      player: {
        name: player.name,
        team: player.team,
        position: player.position,
      },
      weeks: weekData.sort((a, b) => a.week - b.week),
      season: {
        avgProjected,
        avgActual,
        accuracy: hitRate,
        totalOverperformance,
        gamesPlayed: weeksWithActual.length,
      },
    });
  } catch (error) {
    console.error('Projection accuracy error:', error);
    return c.json({ error: 'Failed to calculate projection accuracy' }, 500);
  }
});

// GET /api/players/projection-accuracy
// Returns top over/underperformers for a specific week
playerRoutes.get('/projection-accuracy', async (c) => {
  const db = c.get('db');
  const week = parseInt(c.req.query('week') || '1');
  const season = parseInt(c.req.query('season') || String(new Date().getFullYear()));
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const scoringFormatParam = c.req.query('scoringFormat') || 'ppr';

  try {
    // Get all projections for this week/season
    const projections = await db.query.playerProjections.findMany({
      where: and(
        eq(schema.playerProjections.week, week),
        eq(schema.playerProjections.seasonYear, season),
        eq(schema.playerProjections.scoringFormat, scoringFormatParam === 'half_ppr' || scoringFormatParam === 'half-ppr' ? 'half-ppr' : 'ppr')
      ),
    });

    // Get actual stats for this week
    const stats = await db.query.playerWeeklyStats.findMany({
      where: and(
        eq(schema.playerWeeklyStats.week, week),
        eq(schema.playerWeeklyStats.seasonYear, season)
      ),
    });

    // Get game for this week to find all teams playing
    const games = await db.query.nflGames.findMany({
      where: and(
        eq(schema.nflGames.week, week),
        eq(schema.nflGames.seasonYear, season)
      ),
    });

    // Get odds for all games this week
    const weekOdds = await db.query.gameOdds.findMany({
      where: and(
        eq(schema.gameOdds.week, week),
        eq(schema.gameOdds.season, season)
      ),
    });

    // Build comparison data
    const comparisons = [];
    for (const proj of projections) {
      const stat = stats.find(s => s.playerId === proj.playerId);
      if (!stat) continue; // Only include players with actual stats

      const player = await db.query.nflPlayers.findFirst({
        where: eq(schema.nflPlayers.id, proj.playerId),
      });

      if (!player) continue;

      const actual = stat.fantasyPointsPPR || 0;
      const diff = actual - proj.projectedPoints;

      // Find odds context for this player's team
      const game = games.find(g => g.homeTeam === player.team || g.awayTeam === player.team);
      let spread: number | null = null;
      let total: number | null = null;

      if (game) {
        const odds = weekOdds.find(o => o.gameId === game.id);
        if (odds) {
          if (odds.homeTeam === player.team && odds.homePoint !== null) {
            spread = odds.homePoint;
          } else if (odds.awayTeam === player.team && odds.awayPoint !== null) {
            spread = odds.awayPoint;
          }
          if (odds.overPoint !== null) {
            total = odds.overPoint;
          }
        }
      }

      comparisons.push({
        playerId: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        projected: Math.round(proj.projectedPoints * 10) / 10,
        actual: Math.round(actual * 10) / 10,
        diff: Math.round(diff * 10) / 10,
        gameSpread: spread !== null ? Math.round(spread * 10) / 10 : null,
        gameTotal: total !== null ? Math.round(total * 10) / 10 : null,
      });
    }

    // Sort by overperformance (largest positive diff first), limit results
    const sorted = comparisons
      .sort((a, b) => b.diff - a.diff)
      .slice(0, limit);

    return c.json({
      week,
      season,
      scoringFormat: scoringFormatParam,
      count: sorted.length,
      players: sorted,
    });
  } catch (error) {
    console.error('Weekly accuracy error:', error);
    return c.json({ error: 'Failed to fetch weekly accuracy data' }, 500);
  }
});
