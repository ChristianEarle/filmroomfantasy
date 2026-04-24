/**
 * tradePlayerEnrichment — shared player enrichment for the trade
 * analyzer. Pulls season aggregates, recent-week trend, current-week
 * projection, and recent news for a list of players, and formats
 * them as the per-player text block that gets appended to the
 * analyzer prompt.
 *
 * Used by BOTH the manual /analyze route and the Trade Finder's
 * verification pass. Extracted so the finder's analyzer grades
 * trades with the same rich data the manual analyzer uses — in
 * particular, the recent-news block, which surfaces "role reduced",
 * "benched", "trade rumors", etc. that the structural TradeContext
 * doesn't carry.
 *
 * Missing this block was one of two root causes of the finder
 * recommending trades the manual analyzer hates: the finder was
 * grading blind to recent news.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { inferPlayerTenure, type PlayerTenureInfo } from './playerTenure';

type DB = ReturnType<typeof drizzle<typeof schema>>;

// ── Types ────────────────────────────────────────────────────────────

export interface EnrichedPlayerData {
  name: string;
  position: string;
  nflTeam: string;
  age: number | null;
  yearsExp: number | null;
  /**
   * Server-computed NFL tenure (draft class, rookie-vs-sophomore disambiguation).
   * The analyzer prompt trusts this label over `yearsExp` alone.
   */
  tenure: PlayerTenureInfo;
  status: string;
  injuryNote: string | null;
  injuryBodyPart: string | null;
  depthChartOrder: number | null;
  byeWeek: number | null;
  seasonStats: {
    gamesPlayed: number;
    fantasyPointsPPR: number;
    avgPointsPPR: number;
    passYards: number;
    passTDs: number;
    passInterceptions: number;
    rushYards: number;
    rushTDs: number;
    targets: number;
    receptions: number;
    receivingYards: number;
    receivingTDs: number;
    avgSnapPct: number | null;
  } | null;
  recentWeeks: {
    week: number;
    pointsPPR: number;
    opponent: string | null;
  }[];
  projection: {
    projectedPoints: number;
    weekRank: number | null;
    positionRank: number | null;
  } | null;
  recentNews: {
    headline: string;
    aiSummary: string | null;
    impactLevel: string | null;
  }[];
}

// ── Fetcher ──────────────────────────────────────────────────────────

/**
 * Fetch enrichment data for a list of player NAMES. Returns a Map
 * keyed by lowercase player name. Players not found in the DB are
 * silently omitted — callers should treat a missing entry as "no
 * enrichment available" rather than an error.
 */
export async function fetchPlayerData(
  db: DB,
  playerNames: string[]
): Promise<Map<string, EnrichedPlayerData>> {
  if (playerNames.length === 0) return new Map();

  const allPlayers = await db.query.nflPlayers.findMany({
    columns: {
      id: true,
      name: true,
      position: true,
      team: true,
      age: true,
      yearsExp: true,
      status: true,
      injuryNote: true,
      injuryBodyPart: true,
      depthChartOrder: true,
      byeWeek: true,
    },
  });

  const nameToLower = new Map(playerNames.map((n) => [n.toLowerCase(), n]));
  const matchedPlayers = allPlayers.filter((p) =>
    nameToLower.has(p.name.toLowerCase())
  );

  if (matchedPlayers.length === 0) return new Map();

  const playerIds = matchedPlayers.map((p) => p.id);
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const [weeklyStats, prevWeeklyStats, projections, news] = await Promise.all([
    db.query.playerWeeklyStats.findMany({
      where: and(
        inArray(schema.playerWeeklyStats.playerId, playerIds),
        eq(schema.playerWeeklyStats.seasonYear, currentYear)
      ),
      orderBy: [desc(schema.playerWeeklyStats.week)],
    }),
    // Prior-season activity — used only to tell "incoming rookie" apart
    // from "last year's rookie" since Sleeper's yearsExp can't do that
    // reliably during offseason.
    db.query.playerWeeklyStats.findMany({
      where: and(
        inArray(schema.playerWeeklyStats.playerId, playerIds),
        eq(schema.playerWeeklyStats.seasonYear, previousYear)
      ),
      columns: {
        playerId: true,
        offSnaps: true,
        passAttempts: true,
        rushAttempts: true,
        receptions: true,
        targets: true,
      },
    }),
    db.query.playerProjections.findMany({
      where: and(
        inArray(schema.playerProjections.playerId, playerIds),
        eq(schema.playerProjections.seasonYear, currentYear),
        eq(schema.playerProjections.scoringFormat, 'ppr')
      ),
      orderBy: [desc(schema.playerProjections.week)],
    }),
    db.query.playerNews.findMany({
      where: inArray(schema.playerNews.playerId, playerIds),
      orderBy: [desc(schema.playerNews.publishedAt)],
      limit: playerIds.length * 3,
    }),
  ]);

  const playedPrevByPlayer = new Set<string>();
  for (const s of prevWeeklyStats) {
    const active =
      Number(s.offSnaps ?? 0) > 0 ||
      Number(s.passAttempts ?? 0) > 0 ||
      Number(s.rushAttempts ?? 0) > 0 ||
      Number(s.receptions ?? 0) > 0 ||
      Number(s.targets ?? 0) > 0;
    if (active) playedPrevByPlayer.add(s.playerId);
  }

  // In-season stats don't flow into this module's "current year"
  // window until games start; treat Jan–Jul as offseason for tenure
  // purposes (same rubric as tradeContext.computeSeasonPhase).
  const monthNow = new Date().getUTCMonth();
  const seasonPhaseForTenure: 'offseason' | 'preseason' | 'regular' | 'playoffs' =
    monthNow >= 1 && monthNow <= 6 ? 'offseason' : monthNow === 7 ? 'preseason' : 'regular';

  const statsByPlayer = new Map<string, typeof weeklyStats>();
  for (const s of weeklyStats) {
    const list = statsByPlayer.get(s.playerId) || [];
    list.push(s);
    statsByPlayer.set(s.playerId, list);
  }

  const projByPlayer = new Map<string, (typeof projections)[0]>();
  for (const p of projections) {
    if (!projByPlayer.has(p.playerId)) projByPlayer.set(p.playerId, p);
  }

  const newsByPlayer = new Map<string, typeof news>();
  for (const n of news) {
    const list = newsByPlayer.get(n.playerId) || [];
    if (list.length < 3) list.push(n);
    newsByPlayer.set(n.playerId, list);
  }

  const result = new Map<string, EnrichedPlayerData>();

  for (const player of matchedPlayers) {
    const stats = statsByPlayer.get(player.id) || [];
    const proj = projByPlayer.get(player.id);
    const playerNews = newsByPlayer.get(player.id) || [];

    let seasonStats: EnrichedPlayerData['seasonStats'] = null;
    if (stats.length > 0) {
      const played = stats.filter((s) => {
        if (player.position === 'DEF') return true;
        const off = (s.offSnaps ?? 0) as number;
        const hasActivity =
          ((s.passAttempts ?? 0) as number) > 0 ||
          ((s.rushAttempts ?? 0) as number) > 0 ||
          ((s.receptions ?? 0) as number) > 0 ||
          ((s.targets ?? 0) as number) > 0;
        return off > 0 || hasActivity;
      });

      const gamesPlayed = played.length;
      if (gamesPlayed > 0) {
        const totalPPR = played.reduce(
          (sum, s) => sum + ((s.fantasyPointsPPR ?? 0) as number),
          0
        );
        const totalPassYards = played.reduce(
          (sum, s) => sum + ((s.passYards ?? 0) as number),
          0
        );
        const totalPassTDs = played.reduce(
          (sum, s) => sum + ((s.passTDs ?? 0) as number),
          0
        );
        const totalINTs = played.reduce(
          (sum, s) => sum + ((s.passInterceptions ?? 0) as number),
          0
        );
        const totalRushYards = played.reduce(
          (sum, s) => sum + ((s.rushYards ?? 0) as number),
          0
        );
        const totalRushTDs = played.reduce(
          (sum, s) => sum + ((s.rushTDs ?? 0) as number),
          0
        );
        const totalTargets = played.reduce(
          (sum, s) => sum + ((s.targets ?? 0) as number),
          0
        );
        const totalReceptions = played.reduce(
          (sum, s) => sum + ((s.receptions ?? 0) as number),
          0
        );
        const totalRecYards = played.reduce(
          (sum, s) => sum + ((s.receivingYards ?? 0) as number),
          0
        );
        const totalRecTDs = played.reduce(
          (sum, s) => sum + ((s.receivingTDs ?? 0) as number),
          0
        );

        let snapPctSum = 0;
        let snapPctCount = 0;
        for (const s of played) {
          const off = (s.offSnaps ?? 0) as number;
          const tmOff = (s.tmOffSnaps ?? 0) as number;
          if (off > 0 && tmOff > 0) {
            snapPctSum += (off / tmOff) * 100;
            snapPctCount++;
          }
        }

        seasonStats = {
          gamesPlayed,
          fantasyPointsPPR: Math.round(totalPPR * 10) / 10,
          avgPointsPPR: Math.round((totalPPR / gamesPlayed) * 10) / 10,
          passYards: Math.round(totalPassYards),
          passTDs: totalPassTDs,
          passInterceptions: totalINTs,
          rushYards: Math.round(totalRushYards),
          rushTDs: totalRushTDs,
          targets: totalTargets,
          receptions: totalReceptions,
          receivingYards: Math.round(totalRecYards),
          receivingTDs: totalRecTDs,
          avgSnapPct:
            snapPctCount > 0
              ? Math.round((snapPctSum / snapPctCount) * 10) / 10
              : null,
        };
      }
    }

    const recentWeeks = stats.slice(0, 3).map((s) => ({
      week: s.week,
      pointsPPR: Math.round(((s.fantasyPointsPPR ?? 0) as number) * 10) / 10,
      opponent: s.opponent,
    }));

    const tenure: PlayerTenureInfo =
      player.position === 'DEF'
        ? { draftClass: null, rookieStatus: 'veteran', tenureLabel: 'Team defense' }
        : inferPlayerTenure({
            yearsExp: player.yearsExp,
            playedInCurrentSeason: (seasonStats?.gamesPlayed ?? 0) > 0,
            playedInPreviousSeason: playedPrevByPlayer.has(player.id),
            seasonYear: currentYear,
            seasonPhase: seasonPhaseForTenure,
          });

    result.set(player.name.toLowerCase(), {
      name: player.name,
      position: player.position,
      nflTeam: player.team,
      age: player.age,
      yearsExp: player.yearsExp,
      tenure,
      status: player.status,
      injuryNote: player.injuryNote,
      injuryBodyPart: player.injuryBodyPart,
      depthChartOrder: player.depthChartOrder,
      byeWeek: player.byeWeek,
      seasonStats,
      recentWeeks,
      projection: proj
        ? {
            projectedPoints: (proj.projectedPoints ?? 0) as number,
            weekRank: proj.weekRank,
            positionRank: proj.positionRank,
          }
        : null,
      recentNews: playerNews.map((n) => ({
        headline: n.headline,
        aiSummary: n.aiSummary,
        impactLevel: n.impactLevel,
      })),
    });
  }

  return result;
}

// ── Formatter ────────────────────────────────────────────────────────

/**
 * Format a single EnrichedPlayerData as the text block that gets
 * appended to the analyzer prompt. Includes bio, injury, season
 * totals, recent trend, projection, and recent news.
 */
export function formatPlayerDataBlock(data: EnrichedPlayerData): string {
  const lines: string[] = [];

  lines.push(`**${data.name}** (${data.position}, ${data.nflTeam})`);

  const bioDetails: string[] = [];
  if (data.age) bioDetails.push(`Age: ${data.age}`);
  if (data.yearsExp != null) bioDetails.push(`Experience: ${data.yearsExp} years`);
  if (data.depthChartOrder) bioDetails.push(`Depth chart: #${data.depthChartOrder}`);
  if (data.byeWeek) bioDetails.push(`Bye: Week ${data.byeWeek}`);
  if (bioDetails.length > 0) lines.push(bioDetails.join(' | '));
  // Authoritative tenure label — trust over `yearsExp` alone to tell
  // incoming rookies apart from last year's rookies.
  lines.push(`Tenure: ${data.tenure.tenureLabel}`);

  if (data.status !== 'active') {
    const injury = [data.status.toUpperCase()];
    if (data.injuryBodyPart) injury.push(data.injuryBodyPart);
    if (data.injuryNote) injury.push(`- ${data.injuryNote}`);
    lines.push(`Injury: ${injury.join(' ')}`);
  }

  if (data.seasonStats) {
    const s = data.seasonStats;
    lines.push(
      `Season (${s.gamesPlayed} games): ${s.fantasyPointsPPR} total PPR pts, ${s.avgPointsPPR} PPR pts/game`
    );

    if (data.position === 'QB') {
      lines.push(
        `  Passing: ${s.passYards} yds, ${s.passTDs} TD, ${s.passInterceptions} INT | Rushing: ${s.rushYards} yds, ${s.rushTDs} TD`
      );
    } else if (data.position === 'RB') {
      lines.push(
        `  Rushing: ${s.rushYards} yds, ${s.rushTDs} TD | Receiving: ${s.receptions} rec/${s.targets} tgt, ${s.receivingYards} yds, ${s.receivingTDs} TD`
      );
    } else if (data.position === 'WR' || data.position === 'TE') {
      lines.push(
        `  Receiving: ${s.receptions} rec/${s.targets} tgt, ${s.receivingYards} yds, ${s.receivingTDs} TD | Rushing: ${s.rushYards} yds, ${s.rushTDs} TD`
      );
    }

    if (s.avgSnapPct != null) {
      lines.push(`  Snap %: ${s.avgSnapPct}% avg`);
    }
  }

  if (data.recentWeeks.length > 0) {
    const weekStrs = data.recentWeeks.map(
      (w) => `Wk${w.week}: ${w.pointsPPR}pts${w.opponent ? ` vs ${w.opponent}` : ''}`
    );
    lines.push(`Recent: ${weekStrs.join(', ')}`);
  }

  if (data.projection) {
    const p = data.projection;
    let projStr = `Next week projection: ${p.projectedPoints} PPR pts`;
    if (p.positionRank) projStr += ` (${data.position}${p.positionRank})`;
    if (p.weekRank) projStr += ` | Overall #${p.weekRank}`;
    lines.push(projStr);
  }

  if (data.recentNews.length > 0) {
    lines.push('Recent news:');
    for (const n of data.recentNews) {
      const impact = n.impactLevel ? `[${n.impactLevel.toUpperCase()}]` : '';
      const text = n.aiSummary || n.headline;
      lines.push(`  ${impact} ${text}`);
    }
  }

  return lines.join('\n');
}

/**
 * Build a full multi-player enrichment block from a list of player
 * names. Dedupes by lowercase name. Returns null if no enrichment
 * data is available (so callers can skip appending the block header).
 */
export async function buildPlayerEnrichmentBlock(
  db: DB,
  playerNames: string[]
): Promise<string | null> {
  const unique = Array.from(
    new Set(playerNames.map((n) => n.toLowerCase()))
  ).map((lower) => playerNames.find((n) => n.toLowerCase() === lower)!);

  const data = await fetchPlayerData(db, unique);
  const blocks: string[] = [];
  for (const name of unique) {
    const d = data.get(name.toLowerCase());
    if (d) blocks.push(formatPlayerDataBlock(d));
  }
  return blocks.length > 0 ? blocks.join('\n\n') : null;
}
