/**
 * Trade Context service — gathers FACTS, never judgments.
 *
 * The division of labor between this module and the Claude prompt is strict:
 *  - This module produces clean, structured, nullable data pulled from D1.
 *  - Claude does ALL weighting, scoring, and interpretation.
 *
 * Every field is nullable because the AI reads absence as information:
 *  - No projection during offseason? Claude should acknowledge uncertainty.
 *  - No Vegas line yet? Claude should not pretend to know.
 *  - Injury status null? Means active.
 *
 * DO NOT add valuation scores, weights, tier grades, or "dynasty multipliers"
 * here. If you feel the urge to encode a rule, put the fact in the output and
 * let the AI reason about it.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

type DB = ReturnType<typeof drizzle<typeof schema>>;

// ── League settings passed from the client ──────────────────────────

export interface LeagueSettings {
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  superflex: boolean;
  tePremium: boolean;
  teamCount: number;
  rosterSlots?: {
    qb?: number;
    rb?: number;
    wr?: number;
    te?: number;
    flex?: number;
    superflex?: number;
    k?: number;
    def?: number;
    bench?: number;
    ir?: number;
  };
}

// ── Output shape ─────────────────────────────────────────────────────

export interface PlayerFacts {
  id: string;
  name: string;
  position: string;
  nflTeam: string;

  identity: {
    age: number | null;
    yearsExp: number | null;
    status: string; // 'active' | 'questionable' | 'doubtful' | 'out' | 'injured_reserve'
    injuryNote: string | null;
    injuryBodyPart: string | null;
    depthChartOrder: number | null;
    byeWeek: number | null;
  };

  /** Recent game-level volume (last 4 played games in the current season) */
  recentVolume: {
    dataSource: 'currentSeason' | 'previousSeason' | 'none';
    games: Array<{
      week: number;
      opponent: string | null;
      fantasyPoints: number;
      snapPct: number | null;
      touches: number | null;
      targets: number | null;
    }>;
    seasonGamesPlayed: number;
    seasonFantasyPointsTotal: number;
    seasonFantasyPointsAvg: number;
  } | null;

  /** Next-week and ROS projections; any field may be null outside of season */
  projection: {
    dataSource: 'currentWeek' | 'none';
    nextWeek: {
      week: number;
      projectedPoints: number;
      weekRank: number | null;
      positionRank: number | null;
    } | null;
    /** Season-long remaining outlook — coarse but useful for ROS trades */
    seasonTotal: {
      seasonYear: number;
      projectedPoints: number | null;
    } | null;
  } | null;

  /** Vegas / market signals for the player's next game */
  marketSignal: {
    teamImpliedTotal: number | null; // from gameOdds spread + over/under
    opponentImpliedTotal: number | null;
    gameSpread: number | null; // positive = player's team is underdog
    gameTotal: number | null;
    playerProps: Array<{
      market: string; // 'player_pass_yds', 'player_rush_yds', ...
      overPoint: number | null;
      underPoint: number | null;
    }>;
  } | null;

  /** Next four weeks of scheduled opponents, plus playoff weeks 15-17 */
  schedule: {
    nextFour: Array<{
      week: number;
      opponent: string | null;
      home: boolean | null;
      impliedTotal: number | null;
    }>;
    playoffWeeks: Array<{
      week: number;
      opponent: string | null;
      home: boolean | null;
      impliedTotal: number | null;
    }>;
  };
}

export interface UserContext {
  teamId: string;
  teamName: string;
  record: { wins: number; losses: number; ties: number };
  standing: {
    rank: number;
    totalTeams: number;
    gamesBack: number | null;
    playoffSeedLine: number;
  };
  pointsFor: number;
  pointsAgainst: number;
  roster: {
    starters: RosterSlot[];
    bench: RosterSlot[];
    ir: RosterSlot[];
  };
}

export interface RosterSlot {
  slot: string;
  playerId: string | null;
  name: string | null;
  position: string | null;
  nflTeam: string | null;
  status: string | null;
  age: number | null;
  byeWeek: number | null;
}

export interface TradeContext {
  generatedAt: string; // ISO
  seasonYear: number;
  currentWeek: number;
  seasonPhase: 'preseason' | 'regular' | 'playoffs' | 'offseason';
  leagueSettings: LeagueSettings;
  players: PlayerFacts[];
  userContext: UserContext | null;
  /** Absence flags so the AI knows why data might be sparse */
  dataAvailability: {
    hasCurrentProjections: boolean;
    hasCurrentStats: boolean;
    hasVegasLines: boolean;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function computeSeasonPhase(
  currentWeek: number,
  hasAnyCurrentStats: boolean
): TradeContext['seasonPhase'] {
  const month = new Date().getUTCMonth(); // 0=Jan
  if (month >= 1 && month <= 6) return 'offseason'; // Feb–Jul
  if (month === 7) return 'preseason'; // Aug
  if (currentWeek >= 15) return 'playoffs';
  if (hasAnyCurrentStats || currentWeek >= 1) return 'regular';
  return 'preseason';
}

/** Implied team total from spread + over/under */
function computeImpliedTotal(
  gameTotal: number | null,
  spread: number | null,
  isFavorite: boolean
): number | null {
  if (gameTotal == null || spread == null) return null;
  // spread is expressed relative to home team typically. We take magnitude:
  const absSpread = Math.abs(spread);
  if (isFavorite) return gameTotal / 2 + absSpread / 2;
  return gameTotal / 2 - absSpread / 2;
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Run an inArray query in chunks to stay within D1's parameter limit.
 * D1 caps bound parameters per query (the existing leagues.ts sync code
 * chunks at 50 for the same reason). Without this, Trade Finder /
 * recommendations fails because it passes every rostered player in
 * the league (~180 ids for a 12-team league) in a single IN clause.
 */
async function chunkedInArrayFetch<TRow>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => Promise<TRow[]>
): Promise<TRow[]> {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) return fetchChunk(ids);
  const out: TRow[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const rows = await fetchChunk(chunk);
    for (const r of rows) out.push(r);
  }
  return out;
}

const ID_CHUNK = 50;

export interface BuildTradeContextArgs {
  db: DB;
  playerIds: string[];
  leagueSettings: LeagueSettings;
  seasonYear: number;
  currentWeek: number;
  userTeamId?: string | null;
  leagueId?: string | null;
}

export async function buildTradeContext({
  db,
  playerIds,
  leagueSettings,
  seasonYear,
  currentWeek,
  userTeamId,
  leagueId,
}: BuildTradeContextArgs): Promise<TradeContext> {
  // 1. Fetch all players (chunked — D1 parameter limit)
  const players = await chunkedInArrayFetch(playerIds, ID_CHUNK, (chunk) =>
    db.query.nflPlayers.findMany({
      where: inArray(schema.nflPlayers.id, chunk),
    })
  );

  // 2. Fetch recent weekly stats for these players (current season, chunked)
  const weeklyStats = await chunkedInArrayFetch(playerIds, ID_CHUNK, (chunk) =>
    db.query.playerWeeklyStats.findMany({
      where: and(
        inArray(schema.playerWeeklyStats.playerId, chunk),
        eq(schema.playerWeeklyStats.seasonYear, seasonYear)
      ),
      orderBy: [desc(schema.playerWeeklyStats.week)],
    })
  );

  const statsByPlayer = new Map<string, typeof weeklyStats>();
  for (const s of weeklyStats) {
    const arr = statsByPlayer.get(s.playerId) || [];
    arr.push(s);
    statsByPlayer.set(s.playerId, arr);
  }

  // 3. Fetch next-week projection per player (matching scoring format, chunked)
  const scoringKey: 'ppr' | 'half-ppr' | 'standard' =
    leagueSettings.scoringFormat;
  const projections = await chunkedInArrayFetch(playerIds, ID_CHUNK, (chunk) =>
    db.query.playerProjections.findMany({
      where: and(
        inArray(schema.playerProjections.playerId, chunk),
        eq(schema.playerProjections.seasonYear, seasonYear),
        eq(schema.playerProjections.scoringFormat, scoringKey)
      ),
      orderBy: [desc(schema.playerProjections.week)],
    })
  );

  // Keep the latest (highest week) projection per player
  const latestProjByPlayer = new Map<string, (typeof projections)[0]>();
  for (const p of projections) {
    if (!latestProjByPlayer.has(p.playerId)) latestProjByPlayer.set(p.playerId, p);
  }

  // 4. Fetch upcoming games for ALL teams (we need next 4 weeks + playoffs)
  const allTeamsOfPlayers = [...new Set(players.map((p) => p.team).filter(Boolean))];
  const upcomingGames =
    allTeamsOfPlayers.length > 0
      ? await db.query.nflGames.findMany({
          where: eq(schema.nflGames.seasonYear, seasonYear),
          orderBy: [desc(schema.nflGames.week)],
        })
      : [];

  // Build a lookup: team -> [ { week, opponent, isHome }... ]
  const teamSchedule = new Map<
    string,
    Array<{ week: number; opponent: string; home: boolean; gameId: string }>
  >();
  for (const g of upcomingGames) {
    if (g.homeTeam) {
      const list = teamSchedule.get(g.homeTeam) || [];
      list.push({ week: g.week, opponent: g.awayTeam, home: true, gameId: g.id });
      teamSchedule.set(g.homeTeam, list);
    }
    if (g.awayTeam) {
      const list = teamSchedule.get(g.awayTeam) || [];
      list.push({ week: g.week, opponent: g.homeTeam, home: false, gameId: g.id });
      teamSchedule.set(g.awayTeam, list);
    }
  }
  // Sort each team's games by week
  for (const [, games] of teamSchedule) {
    games.sort((a, b) => a.week - b.week);
  }

  // 5. Fetch Vegas odds for all games in the schedule we care about
  const gameIdsWeWantOdds = new Set<string>();
  for (const [, games] of teamSchedule) {
    for (const g of games) {
      if (g.week >= currentWeek && g.week <= currentWeek + 3) {
        gameIdsWeWantOdds.add(g.gameId);
      }
      if (g.week >= 15 && g.week <= 17) {
        gameIdsWeWantOdds.add(g.gameId);
      }
    }
  }

  const relevantGameIds = Array.from(gameIdsWeWantOdds);
  const oddsRows = await chunkedInArrayFetch(
    relevantGameIds,
    ID_CHUNK,
    (chunk) =>
      db.query.gameOdds.findMany({
        where: inArray(schema.gameOdds.gameId, chunk),
        orderBy: [desc(schema.gameOdds.snapshotTime)],
      })
  );

  // Latest total + spread per gameId
  const totalsByGame = new Map<string, number>();
  const spreadsByGame = new Map<
    string,
    { homePoint: number | null; awayPoint: number | null }
  >();
  const processedTotal = new Set<string>();
  const processedSpread = new Set<string>();
  for (const o of oddsRows) {
    if (o.market === 'totals' && !processedTotal.has(o.gameId)) {
      processedTotal.add(o.gameId);
      if (o.overPoint != null) totalsByGame.set(o.gameId, o.overPoint);
    }
    if (o.market === 'spreads' && !processedSpread.has(o.gameId)) {
      processedSpread.add(o.gameId);
      spreadsByGame.set(o.gameId, {
        homePoint: o.homePoint,
        awayPoint: o.awayPoint,
      });
    }
  }

  // 6. Player props for the next-week game per player
  const nextWeekGameIdsByPlayer = new Map<string, string>();
  for (const p of players) {
    const teamGames = teamSchedule.get(p.team) || [];
    const nextGame = teamGames.find((g) => g.week >= currentWeek);
    if (nextGame) nextWeekGameIdsByPlayer.set(p.id, nextGame.gameId);
  }

  // gameOdds.eventId isn't directly in playerProps schema — playerProps uses
  // its own eventId (Odds API event id). We match by player name instead.
  const nextWeekForProps = currentWeek;
  const propsRows =
    players.length > 0
      ? await db.query.playerProps.findMany({
          where: and(
            eq(schema.playerProps.week, nextWeekForProps),
            eq(schema.playerProps.season, seasonYear)
          ),
          orderBy: [desc(schema.playerProps.snapshotTime)],
        })
      : [];

  // Latest prop per (playerName, market)
  const propsByName = new Map<
    string,
    Map<string, { overPoint: number | null; underPoint: number | null }>
  >();
  const seenPropKey = new Set<string>();
  for (const pr of propsRows) {
    const key = `${pr.playerName.toLowerCase()}|${pr.market}`;
    if (seenPropKey.has(key)) continue;
    seenPropKey.add(key);
    const nameMap =
      propsByName.get(pr.playerName.toLowerCase()) || new Map();
    nameMap.set(pr.market, {
      overPoint: pr.overPoint,
      underPoint: pr.underPoint,
    });
    propsByName.set(pr.playerName.toLowerCase(), nameMap);
  }

  // 7. Build PlayerFacts[]
  const playerFacts: PlayerFacts[] = players.map((p) => {
    const stats = statsByPlayer.get(p.id) || [];
    // "played" = had any activity or offensive snaps
    const played = stats.filter((s) => {
      if (p.position === 'DEF') return true;
      const off = Number(s.offSnaps ?? 0);
      const activity =
        Number(s.passAttempts ?? 0) > 0 ||
        Number(s.rushAttempts ?? 0) > 0 ||
        Number(s.receptions ?? 0) > 0 ||
        Number(s.targets ?? 0) > 0;
      return off > 0 || activity;
    });

    const recentVolume: PlayerFacts['recentVolume'] =
      played.length > 0
        ? {
            dataSource: 'currentSeason',
            games: played.slice(0, 4).map((s) => {
              const off = Number(s.offSnaps ?? 0);
              const tmOff = Number(s.tmOffSnaps ?? 0);
              const snapPct =
                tmOff > 0 ? Math.round((off / tmOff) * 1000) / 10 : null;
              const touches =
                Number(s.rushAttempts ?? 0) + Number(s.receptions ?? 0);
              return {
                week: s.week,
                opponent: s.opponent,
                fantasyPoints: Math.round(Number(s.fantasyPointsPPR ?? 0) * 10) / 10,
                snapPct,
                touches: touches || null,
                targets: s.targets != null ? Number(s.targets) : null,
              };
            }),
            seasonGamesPlayed: played.length,
            seasonFantasyPointsTotal:
              Math.round(
                played.reduce(
                  (sum, s) => sum + Number(s.fantasyPointsPPR ?? 0),
                  0
                ) * 10
              ) / 10,
            seasonFantasyPointsAvg:
              Math.round(
                (played.reduce(
                  (sum, s) => sum + Number(s.fantasyPointsPPR ?? 0),
                  0
                ) /
                  played.length) *
                  10
              ) / 10,
          }
        : null;

    // Next-week projection
    const proj = latestProjByPlayer.get(p.id);
    const projection: PlayerFacts['projection'] = proj
      ? {
          dataSource: 'currentWeek',
          nextWeek: {
            week: proj.week,
            projectedPoints: Number(proj.projectedPoints ?? 0),
            weekRank: proj.weekRank,
            positionRank: proj.positionRank,
          },
          seasonTotal: null,
        }
      : null;

    // Market signal for next game
    const teamGames = teamSchedule.get(p.team) || [];
    const nextGame = teamGames.find((g) => g.week >= currentWeek);
    let marketSignal: PlayerFacts['marketSignal'] = null;
    if (nextGame) {
      const gameTotal = totalsByGame.get(nextGame.gameId) ?? null;
      const spread = spreadsByGame.get(nextGame.gameId);
      let teamSpread: number | null = null;
      if (spread) {
        teamSpread = nextGame.home ? spread.homePoint : spread.awayPoint;
      }
      const teamImplied = computeImpliedTotal(
        gameTotal,
        teamSpread,
        teamSpread != null ? teamSpread < 0 : false
      );
      const oppImplied =
        gameTotal != null && teamImplied != null
          ? Math.round((gameTotal - teamImplied) * 10) / 10
          : null;
      const nameProps = propsByName.get(p.name.toLowerCase());
      const playerProps = nameProps
        ? Array.from(nameProps.entries()).map(([market, values]) => ({
            market,
            overPoint: values.overPoint,
            underPoint: values.underPoint,
          }))
        : [];
      marketSignal = {
        teamImpliedTotal:
          teamImplied != null ? Math.round(teamImplied * 10) / 10 : null,
        opponentImpliedTotal: oppImplied,
        gameSpread: teamSpread,
        gameTotal,
        playerProps,
      };
    }

    // Schedule: next 4 weeks + weeks 15-17
    const nextFour = teamGames
      .filter((g) => g.week >= currentWeek && g.week < currentWeek + 4)
      .map((g) => {
        const gameTotal = totalsByGame.get(g.gameId) ?? null;
        const spread = spreadsByGame.get(g.gameId);
        let teamSpread: number | null = null;
        if (spread) teamSpread = g.home ? spread.homePoint : spread.awayPoint;
        const implied = computeImpliedTotal(
          gameTotal,
          teamSpread,
          teamSpread != null ? teamSpread < 0 : false
        );
        return {
          week: g.week,
          opponent: g.opponent,
          home: g.home,
          impliedTotal: implied != null ? Math.round(implied * 10) / 10 : null,
        };
      });

    const playoffWeeks = teamGames
      .filter((g) => g.week >= 15 && g.week <= 17)
      .map((g) => {
        const gameTotal = totalsByGame.get(g.gameId) ?? null;
        const spread = spreadsByGame.get(g.gameId);
        let teamSpread: number | null = null;
        if (spread) teamSpread = g.home ? spread.homePoint : spread.awayPoint;
        const implied = computeImpliedTotal(
          gameTotal,
          teamSpread,
          teamSpread != null ? teamSpread < 0 : false
        );
        return {
          week: g.week,
          opponent: g.opponent,
          home: g.home,
          impliedTotal: implied != null ? Math.round(implied * 10) / 10 : null,
        };
      });

    return {
      id: p.id,
      name: p.name,
      position: p.position,
      nflTeam: p.team,
      identity: {
        age: p.age,
        yearsExp: p.yearsExp,
        status: p.status,
        injuryNote: p.injuryNote,
        injuryBodyPart: p.injuryBodyPart,
        depthChartOrder: p.depthChartOrder,
        byeWeek: p.byeWeek,
      },
      recentVolume,
      projection,
      marketSignal,
      schedule: { nextFour, playoffWeeks },
    };
  });

  // 8. User context (optional)
  let userContext: UserContext | null = null;
  if (leagueId && userTeamId) {
    userContext = await buildUserContext(db, leagueId, userTeamId);
  }

  return {
    generatedAt: new Date().toISOString(),
    seasonYear,
    currentWeek,
    seasonPhase: computeSeasonPhase(currentWeek, weeklyStats.length > 0),
    leagueSettings,
    players: playerFacts,
    userContext,
    dataAvailability: {
      hasCurrentProjections: projections.length > 0,
      hasCurrentStats: weeklyStats.length > 0,
      hasVegasLines: oddsRows.length > 0,
    },
  };
}

// ── User context builder ─────────────────────────────────────────────

export async function buildUserContext(
  db: DB,
  leagueId: string,
  userTeamId: string
): Promise<UserContext | null> {
  const team = await db.query.teams.findFirst({
    where: and(
      eq(schema.teams.id, userTeamId),
      eq(schema.teams.leagueId, leagueId)
    ),
  });
  if (!team) return null;

  // Pull all teams to compute standing
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });

  // Sort by wins desc, then pointsFor desc
  const sorted = [...allTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });
  const rank = sorted.findIndex((t) => t.id === team.id) + 1;
  const leaderWins = sorted[0]?.wins ?? 0;
  const gamesBack = leaderWins - team.wins;

  // League playoff seed line (default 6)
  const league = await db.query.leagues.findFirst({
    where: eq(schema.leagues.id, leagueId),
    columns: { playoffTeams: true },
  });
  const playoffSeedLine = league?.playoffTeams ?? 6;

  // Roster
  const rosterRows = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, userTeamId),
    with: { player: true },
  });

  const starters: RosterSlot[] = [];
  const bench: RosterSlot[] = [];
  const ir: RosterSlot[] = [];
  for (const r of rosterRows) {
    const slot: RosterSlot = {
      slot: r.slot,
      playerId: r.playerId,
      name: r.player?.name ?? null,
      position: r.player?.position ?? null,
      nflTeam: r.player?.team ?? null,
      status: r.player?.status ?? null,
      age: r.player?.age ?? null,
      byeWeek: r.player?.byeWeek ?? null,
    };
    if (r.slot === 'IR') ir.push(slot);
    else if (r.isStarter) starters.push(slot);
    else bench.push(slot);
  }

  return {
    teamId: team.id,
    teamName: team.name,
    record: { wins: team.wins, losses: team.losses, ties: team.ties },
    standing: {
      rank,
      totalTeams: allTeams.length,
      gamesBack: gamesBack === 0 ? 0 : gamesBack,
      playoffSeedLine,
    },
    pointsFor: team.pointsFor,
    pointsAgainst: team.pointsAgainst,
    roster: { starters, bench, ir },
  };
}

// ── Context formatting for the AI prompt ─────────────────────────────

/**
 * Render a TradeContext as a structured plaintext block for Claude. Keeps
 * facts organized and labeled so the model can reference them precisely.
 */
export function formatTradeContextForPrompt(ctx: TradeContext): string {
  const lines: string[] = [];
  lines.push('=== TRADE CONTEXT (authoritative facts — do NOT invent data) ===');
  lines.push(`Generated: ${ctx.generatedAt}`);
  lines.push(
    `Season: ${ctx.seasonYear} | Current Week: ${ctx.currentWeek} | Phase: ${ctx.seasonPhase}`
  );
  lines.push(
    `League: ${ctx.leagueSettings.scoringFormat.toUpperCase()}` +
      (ctx.leagueSettings.superflex ? ' + Superflex' : '') +
      (ctx.leagueSettings.tePremium ? ' + TE Premium' : '') +
      ` | ${ctx.leagueSettings.teamCount} teams`
  );
  lines.push(
    `Data availability — projections: ${ctx.dataAvailability.hasCurrentProjections}, ` +
      `stats: ${ctx.dataAvailability.hasCurrentStats}, vegas: ${ctx.dataAvailability.hasVegasLines}`
  );

  if (ctx.userContext) {
    const u = ctx.userContext;
    lines.push('');
    lines.push('--- YOUR TEAM ---');
    lines.push(`${u.teamName}: ${u.record.wins}-${u.record.losses}-${u.record.ties}`);
    lines.push(
      `Standing: #${u.standing.rank} of ${u.standing.totalTeams}` +
        (u.standing.gamesBack != null ? ` (${u.standing.gamesBack} GB)` : '') +
        ` | Playoff line: top ${u.standing.playoffSeedLine}`
    );
    lines.push(`Points For: ${u.pointsFor} | Against: ${u.pointsAgainst}`);
    if (u.roster.starters.length > 0) {
      lines.push('Starters:');
      for (const s of u.roster.starters) {
        lines.push(
          `  ${s.slot}: ${s.name ?? '(empty)'} ${s.position ? `(${s.position}, ${s.nflTeam})` : ''}` +
            (s.status && s.status !== 'active' ? ` [${s.status.toUpperCase()}]` : '')
        );
      }
    }
    if (u.roster.bench.length > 0) {
      lines.push(
        `Bench: ${u.roster.bench
          .map((s) => `${s.name ?? '(empty)'}${s.position ? ` (${s.position})` : ''}`)
          .join(', ')}`
      );
    }
    if (u.roster.ir.length > 0) {
      lines.push(
        `IR: ${u.roster.ir
          .map((s) => `${s.name ?? '(empty)'}${s.position ? ` (${s.position})` : ''}`)
          .join(', ')}`
      );
    }
  }

  lines.push('');
  lines.push('--- PLAYERS IN TRADE ---');
  for (const p of ctx.players) {
    lines.push('');
    lines.push(`**${p.name}** (${p.position}, ${p.nflTeam})`);
    const bio: string[] = [];
    if (p.identity.age != null) bio.push(`Age ${p.identity.age}`);
    if (p.identity.yearsExp != null) bio.push(`Exp ${p.identity.yearsExp}y`);
    if (p.identity.depthChartOrder != null)
      bio.push(`Depth #${p.identity.depthChartOrder}`);
    if (p.identity.byeWeek != null) bio.push(`Bye W${p.identity.byeWeek}`);
    if (bio.length) lines.push(`  ${bio.join(' | ')}`);
    if (p.identity.status !== 'active') {
      lines.push(
        `  Injury: ${p.identity.status.toUpperCase()}` +
          (p.identity.injuryBodyPart ? ` ${p.identity.injuryBodyPart}` : '') +
          (p.identity.injuryNote ? ` — ${p.identity.injuryNote}` : '')
      );
    }
    if (p.recentVolume) {
      lines.push(
        `  Season: ${p.recentVolume.seasonGamesPlayed} games, ` +
          `${p.recentVolume.seasonFantasyPointsTotal} pts total, ` +
          `${p.recentVolume.seasonFantasyPointsAvg} pts/game`
      );
      const recent = p.recentVolume.games
        .slice(0, 4)
        .map(
          (g) =>
            `W${g.week}${g.opponent ? `@${g.opponent}` : ''}: ${g.fantasyPoints}` +
            (g.snapPct != null ? `, ${g.snapPct}%sn` : '') +
            (g.touches != null ? `, ${g.touches}tch` : '') +
            (g.targets != null ? `, ${g.targets}tgt` : '')
        )
        .join(' | ');
      lines.push(`  Recent: ${recent}`);
    } else {
      lines.push('  Recent volume: NO CURRENT-SEASON GAMES PLAYED');
    }
    if (p.projection?.nextWeek) {
      const nw = p.projection.nextWeek;
      lines.push(
        `  Next Proj (W${nw.week}): ${nw.projectedPoints} pts` +
          (nw.positionRank ? ` (${p.position}${nw.positionRank})` : '')
      );
    } else {
      lines.push('  Next Proj: NONE (offseason or not yet published)');
    }
    if (p.marketSignal) {
      const m = p.marketSignal;
      const parts: string[] = [];
      if (m.teamImpliedTotal != null)
        parts.push(`team implied ${m.teamImpliedTotal}`);
      if (m.gameSpread != null) parts.push(`spread ${m.gameSpread}`);
      if (m.gameTotal != null) parts.push(`total ${m.gameTotal}`);
      if (parts.length) lines.push(`  Vegas: ${parts.join(' | ')}`);
      if (m.playerProps.length > 0) {
        const propStr = m.playerProps
          .slice(0, 5)
          .map(
            (pp) =>
              `${pp.market.replace('player_', '')}: ` +
              (pp.overPoint != null ? `o${pp.overPoint}` : '') +
              (pp.underPoint != null ? `/u${pp.underPoint}` : '')
          )
          .join(' | ');
        lines.push(`  Props: ${propStr}`);
      }
    } else {
      lines.push('  Vegas/props: NONE');
    }
    if (p.schedule.nextFour.length > 0) {
      const sched = p.schedule.nextFour
        .map(
          (g) =>
            `W${g.week} ${g.home ? 'vs' : '@'}${g.opponent ?? '?'}` +
            (g.impliedTotal != null ? ` (impl ${g.impliedTotal})` : '')
        )
        .join(', ');
      lines.push(`  Next 4: ${sched}`);
    }
    if (p.schedule.playoffWeeks.length > 0) {
      const sched = p.schedule.playoffWeeks
        .map(
          (g) =>
            `W${g.week} ${g.home ? 'vs' : '@'}${g.opponent ?? '?'}` +
            (g.impliedTotal != null ? ` (impl ${g.impliedTotal})` : '')
        )
        .join(', ');
      lines.push(`  Playoffs (W15-17): ${sched}`);
    }
  }

  lines.push('');
  lines.push('=== END TRADE CONTEXT ===');
  return lines.join('\n');
}
