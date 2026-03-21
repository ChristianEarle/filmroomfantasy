import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { PlayerProps } from '../db/schema';
import { generateId } from '../utils/id';
import { invalidateCache } from '../utils/cache';

/**
 * Convert player prop lines (from sportsbooks) into projected fantasy points.
 *
 * The over/under line for a stat market is the book's implied expectation.
 * We take the over_point as the expected value for each stat category and
 * run it through the standard fantasy scoring formula.
 *
 * For anytime TD props we convert American odds → implied probability to
 * estimate expected TDs (counted as rushing/receiving TDs).
 */

// Prop market keys from The Odds API
const MARKET_PASS_YDS = 'player_pass_yds';
const MARKET_PASS_TDS = 'player_pass_tds';
const MARKET_RUSH_YDS = 'player_rush_yds';
const MARKET_RUSH_TDS = 'player_rush_tds';
const MARKET_REC_YDS = 'player_reception_yds';
const MARKET_RECEPTIONS = 'player_receptions';
const MARKET_ANYTIME_TD = 'player_anytime_td';

interface PropsByMarket {
  [market: string]: {
    overPoint: number | null;
    overPrice: number | null;
    underPrice: number | null;
    yesPrice: number | null;
    noPrice: number | null;
  };
}

export interface ProjectedStats {
  projPassYards: number | null;
  projPassTDs: number | null;
  projRushYards: number | null;
  projRushTDs: number | null;
  projReceptions: number | null;
  projRecYards: number | null;
  projRecTDs: number | null;
}

export interface ProjectionResult {
  playerId: string;
  playerName: string;
  projectedStats: ProjectedStats;
  points: {
    ppr: number;
    halfPpr: number;
    standard: number;
  };
}

/**
 * Convert American odds to implied probability (0-1).
 * Positive odds (e.g. +150): probability = 100 / (odds + 100)
 * Negative odds (e.g. -130): probability = |odds| / (|odds| + 100)
 */
function americanOddsToProb(odds: number): number {
  if (odds >= 0) {
    return 100 / (odds + 100);
  }
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/**
 * For an anytime TD market, estimate the expected number of TDs.
 *
 * We use the yes/no prices to get an implied probability of scoring >= 1 TD.
 * Then convert that to an expected TD count using a Poisson approximation:
 *   P(at least 1 TD) = 1 - e^(-lambda)  =>  lambda = -ln(1 - p)
 *
 * We remove ~3% vig from the raw implied probability.
 */
function estimateTDsFromAnytimeLine(
  yesPrice: number | null,
  noPrice: number | null
): number {
  if (yesPrice == null && noPrice == null) return 0;

  let impliedProb: number;
  if (yesPrice != null && noPrice != null) {
    const yesProb = americanOddsToProb(yesPrice);
    const noProb = americanOddsToProb(noPrice);
    // Remove vig by normalizing
    impliedProb = yesProb / (yesProb + noProb);
  } else if (yesPrice != null) {
    impliedProb = americanOddsToProb(yesPrice) * 0.97; // rough vig removal
  } else {
    impliedProb = 1 - americanOddsToProb(noPrice!) * 1.03;
  }

  // Clamp to avoid math issues
  impliedProb = Math.max(0.01, Math.min(0.99, impliedProb));

  // Poisson: P(>=1) = 1 - e^(-lambda) => lambda = -ln(1-p)
  const lambda = -Math.log(1 - impliedProb);
  return Math.round(lambda * 100) / 100;
}

/**
 * Group an array of player prop records by player name, picking
 * the most recent snapshot per market.
 */
export function groupPropsByPlayer(
  props: PlayerProps[]
): Map<string, { playerExternalId: string | null; props: PropsByMarket }> {
  const byPlayer = new Map<
    string,
    { playerExternalId: string | null; props: PropsByMarket }
  >();

  // Sort by snapshotTime descending so we process newest first
  const sorted = [...props].sort(
    (a, b) => b.snapshotTime.localeCompare(a.snapshotTime)
  );

  for (const prop of sorted) {
    if (!byPlayer.has(prop.playerName)) {
      byPlayer.set(prop.playerName, {
        playerExternalId: prop.playerExternalId,
        props: {},
      });
    }
    const entry = byPlayer.get(prop.playerName)!;

    // Update external ID if we find one
    if (!entry.playerExternalId && prop.playerExternalId) {
      entry.playerExternalId = prop.playerExternalId;
    }

    // Only keep the first (newest) snapshot per market
    if (!entry.props[prop.market]) {
      entry.props[prop.market] = {
        overPoint: prop.overPoint,
        overPrice: prop.overPrice,
        underPrice: prop.underPrice,
        yesPrice: prop.yesPrice,
        noPrice: prop.noPrice,
      };
    }
  }

  return byPlayer;
}

/**
 * Calculate projected stats from prop lines for a single player.
 */
export function calculateProjectedStats(props: PropsByMarket): ProjectedStats {
  const passYds = props[MARKET_PASS_YDS]?.overPoint ?? null;
  const passTDs = props[MARKET_PASS_TDS]?.overPoint ?? null;
  const rushYds = props[MARKET_RUSH_YDS]?.overPoint ?? null;
  const rushTDs = props[MARKET_RUSH_TDS]?.overPoint ?? null;
  const recYds = props[MARKET_REC_YDS]?.overPoint ?? null;
  const receptions = props[MARKET_RECEPTIONS]?.overPoint ?? null;

  // For anytime TD: estimate expected TDs from odds
  const anytimeTD = props[MARKET_ANYTIME_TD];
  let anytimeTDs = 0;
  if (anytimeTD) {
    anytimeTDs = estimateTDsFromAnytimeLine(
      anytimeTD.yesPrice,
      anytimeTD.noPrice
    );
  }

  // Distribute anytime TDs into rush/rec TDs if no explicit TD props exist
  let projRushTDs = rushTDs;
  let projRecTDs: number | null = null;

  if (anytimeTDs > 0) {
    const hasExplicitRushTDs = rushTDs != null;
    const hasExplicitPassTDs = passTDs != null;

    if (!hasExplicitRushTDs) {
      // Player has anytime TD line but no rush TD line
      // Likely a RB/WR/TE — assign anytime TDs as their TD expectation
      if (rushYds != null && recYds == null) {
        // Pure rusher
        projRushTDs = anytimeTDs;
      } else if (recYds != null && rushYds == null) {
        // Pure receiver
        projRecTDs = anytimeTDs;
      } else if (recYds != null && rushYds != null) {
        // Dual-threat: split proportionally by yards
        const totalYds = (rushYds || 0) + (recYds || 0);
        if (totalYds > 0) {
          projRushTDs = Math.round(anytimeTDs * ((rushYds || 0) / totalYds) * 100) / 100;
          projRecTDs = Math.round(anytimeTDs * ((recYds || 0) / totalYds) * 100) / 100;
        } else {
          projRecTDs = anytimeTDs;
        }
      } else if (!hasExplicitPassTDs) {
        // No yardage lines at all, just assign as receiving TDs
        projRecTDs = anytimeTDs;
      }
    }
  }

  return {
    projPassYards: passYds,
    projPassTDs: passTDs,
    projRushYards: rushYds,
    projRushTDs: projRushTDs,
    projReceptions: receptions,
    projRecYards: recYds,
    projRecTDs: projRecTDs,
  };
}

/**
 * Calculate fantasy points from projected stats using standard scoring.
 */
export function calculateFantasyPoints(
  stats: ProjectedStats,
  format: 'ppr' | 'half-ppr' | 'standard' = 'ppr'
): number {
  let points = 0;

  // Passing
  points += (stats.projPassYards || 0) * 0.04;   // 1 pt per 25 yds
  points += (stats.projPassTDs || 0) * 4;         // 4 pts per TD

  // Rushing
  points += (stats.projRushYards || 0) * 0.1;     // 1 pt per 10 yds
  points += (stats.projRushTDs || 0) * 6;          // 6 pts per TD

  // Receiving
  const receptions = stats.projReceptions || 0;
  if (format === 'ppr') {
    points += receptions * 1;
  } else if (format === 'half-ppr') {
    points += receptions * 0.5;
  }
  // standard: 0 pts per reception
  points += (stats.projRecYards || 0) * 0.1;      // 1 pt per 10 yds
  points += (stats.projRecTDs || 0) * 6;            // 6 pts per TD

  return Math.round(points * 100) / 100;
}

/**
 * Build projections for all players from their prop lines.
 * Returns an array of ProjectionResult with stats and points for all formats.
 */
export function buildProjectionsFromProps(
  props: PlayerProps[]
): ProjectionResult[] {
  const grouped = groupPropsByPlayer(props);
  const results: ProjectionResult[] = [];

  for (const [playerName, data] of grouped) {
    const projectedStats = calculateProjectedStats(data.props);

    // Skip players with no meaningful stat lines
    const hasStats =
      projectedStats.projPassYards != null ||
      projectedStats.projRushYards != null ||
      projectedStats.projRecYards != null ||
      projectedStats.projReceptions != null ||
      projectedStats.projRushTDs != null ||
      projectedStats.projRecTDs != null ||
      projectedStats.projPassTDs != null;

    if (!hasStats) continue;

    const ppr = calculateFantasyPoints(projectedStats, 'ppr');
    const halfPpr = calculateFantasyPoints(projectedStats, 'half-ppr');
    const standard = calculateFantasyPoints(projectedStats, 'standard');

    // Skip zero-point projections
    if (ppr === 0 && standard === 0) continue;

    results.push({
      playerId: data.playerExternalId || '',
      playerName,
      projectedStats,
      points: { ppr, halfPpr, standard },
    });
  }

  return results;
}

/**
 * Generate projections from stored player props in the database.
 * Reads props for the given week, calculates fantasy points from book lines,
 * and upserts into the playerProjections table.
 */
export async function generateProjectionsFromProps(
  db: any,
  week: number,
  seasonYear: number
): Promise<{ generated: number; updated: number }> {
  // Fetch all props for this week
  const props = await db.query.playerProps.findMany({
    where: and(
      eq(schema.playerProps.week, week),
      eq(schema.playerProps.season, seasonYear)
    ),
  });

  if (props.length === 0) {
    return { generated: 0, updated: 0 };
  }

  const projections = buildProjectionsFromProps(props);

  // Build a lookup of player names → player IDs in our database
  const allPlayers = await db.query.nflPlayers.findMany({
    columns: { id: true, externalId: true, name: true, firstName: true, lastName: true },
  });
  const playerByExtId = new Map<string, string>();
  const playerByName = new Map<string, string>();
  for (const p of allPlayers) {
    if (p.externalId) playerByExtId.set(p.externalId, p.id);
    if (p.name) playerByName.set(p.name.toLowerCase(), p.id);
    if (p.firstName && p.lastName) {
      playerByName.set(`${p.firstName} ${p.lastName}`.toLowerCase(), p.id);
    }
  }

  let generated = 0;
  let updated = 0;
  const BATCH_SIZE = 50;
  const statements: any[] = [];

  for (const proj of projections) {
    // Resolve player ID
    let playerId = proj.playerId ? playerByExtId.get(proj.playerId) : undefined;
    if (!playerId) {
      playerId = playerByName.get(proj.playerName.toLowerCase());
    }
    if (!playerId) continue;

    // Create projections for all three scoring formats
    const formats: Array<{ format: 'ppr' | 'half-ppr' | 'standard'; points: number }> = [
      { format: 'ppr', points: proj.points.ppr },
      { format: 'half-ppr', points: proj.points.halfPpr },
      { format: 'standard', points: proj.points.standard },
    ];

    for (const { format, points } of formats) {
      const existingProj = await db.query.playerProjections.findFirst({
        where: and(
          eq(schema.playerProjections.playerId, playerId),
          eq(schema.playerProjections.week, week),
          eq(schema.playerProjections.seasonYear, seasonYear),
          eq(schema.playerProjections.scoringFormat, format)
        ),
      });

      const projData = {
        playerId,
        week,
        seasonYear,
        scoringFormat: format,
        projectedPoints: points,
        projPassYards: proj.projectedStats.projPassYards,
        projPassTDs: proj.projectedStats.projPassTDs,
        projRushYards: proj.projectedStats.projRushYards,
        projRushTDs: proj.projectedStats.projRushTDs,
        projReceptions: proj.projectedStats.projReceptions,
        projRecYards: proj.projectedStats.projRecYards,
        projRecTDs: proj.projectedStats.projRecTDs,
        updatedAt: new Date(),
      };

      if (existingProj) {
        // Snapshot the old projection before overwriting
        statements.push(
          db.insert(schema.projectionLineSnapshots).values({
            id: generateId(),
            playerId,
            week,
            seasonYear,
            scoringFormat: format,
            snapshotAt: new Date(),
            projectedPoints: existingProj.projectedPoints,
            projPassYards: existingProj.projPassYards ?? null,
            projPassTDs: existingProj.projPassTDs ?? null,
            projRushYards: existingProj.projRushYards ?? null,
            projRushTDs: existingProj.projRushTDs ?? null,
            projReceptions: existingProj.projReceptions ?? null,
            projRecYards: existingProj.projRecYards ?? null,
            projRecTDs: existingProj.projRecTDs ?? null,
          })
        );
        statements.push(
          db.update(schema.playerProjections)
            .set(projData)
            .where(eq(schema.playerProjections.id, existingProj.id))
        );
        updated++;
      } else {
        statements.push(
          db.insert(schema.playerProjections).values({
            id: generateId(),
            ...projData,
          })
        );
        generated++;
      }

      if (statements.length >= BATCH_SIZE) {
        await db.batch(statements as any);
        statements.length = 0;
      }
    }
  }

  if (statements.length > 0) {
    await db.batch(statements as any);
  }

  invalidateCache('players:', true);
  invalidateCache('projection', true);

  console.log(`[projections] Generated ${generated}, updated ${updated} from ${projections.length} player prop lines`);
  return { generated, updated };
}
