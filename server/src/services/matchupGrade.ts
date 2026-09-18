/**
 * Defense-vs-position matchup grade: how many fantasy points the upcoming
 * opponent has allowed to this player's position over its last five
 * completed games, against the league average over the same weeks, mapped
 * to an A+..D- grade. Shared by GET /players/:id/matchup-grade (the grade
 * pill on the player card) and the AI take's data block.
 */
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { resolveDisplaySeason, getDefaultSeason } from '../utils/seasons';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export interface MatchupGradeOptions {
  /** Season as passed on the query string; defaults to the latest season with stats. */
  season?: string;
  /** Week as passed on the query string; defaults to the team's next incomplete game. */
  week?: string;
  format?: 'ppr' | 'half' | 'std';
}

export type MatchupGradeResult = Awaited<ReturnType<typeof computeMatchupGrade>>;

export async function computeMatchupGrade(
  db: DB,
  player: typeof schema.nflPlayers.$inferSelect,
  opts: MatchupGradeOptions = {},
) {
  const seasonParam = opts.season;
  const weekParam = opts.week;
  const formatParam = opts.format ?? 'ppr';

  const position = player.position; // QB, RB, WR, TE, K, DEF
  const playerTeam = player.team;

  // Determine season, transparently falling back to the most recent season
  // with games when the requested one has no data (e.g. 2026 pre-kickoff).
  let requestedSeason: number;
  if (seasonParam) {
    const parsed = parseInt(seasonParam);
    requestedSeason = isNaN(parsed) ? getDefaultSeason() : parsed;
  } else {
    const maxResult = await db
      .select({ maxYear: sql<number>`max(${schema.playerWeeklyStats.seasonYear})` })
      .from(schema.playerWeeklyStats);
    requestedSeason = maxResult[0]?.maxYear ?? getDefaultSeason();
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
    return ({
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
    return ({
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
    return ({
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

  return ({
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
}
