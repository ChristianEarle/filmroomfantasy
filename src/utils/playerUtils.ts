import type { Player } from '../App';

/** API response shape for a player from the /players endpoint */
export interface APIPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  status: string;
  byeWeek: number | null;
  headshotUrl?: string | null;
  avgPointsPPR: number;
  projectedPoints: number;
  weeklyProjectedPoints?: number;
  isRostered: boolean;
  seasonStats?: {
    games: number;
    gamesPlayed?: number;
    fantasyPointsPPR: number;
    fantasyPointsHalf: number;
    fantasyPointsStd: number;
    passYards: number;
    passTDs: number;
    rushYards: number;
    rushTDs: number;
    receptions: number;
    receivingYards: number;
    receivingTDs: number;
  };
}

/** Valid fantasy positions */
const VALID_POSITIONS = new Set<Player['position']>(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX']);

/**
 * Convert an API player to the app's display Player format.
 * Generates a keyLine from season stats and validates position.
 */
export function convertAPIPlayerToPlayer(player: APIPlayer, index: number): Player {
  const avgPts = player.avgPointsPPR || 0;
  const projPts = player.projectedPoints || 0;

  let keyLine = '';
  if (player.seasonStats) {
    const stats = player.seasonStats;
    if (player.position === 'QB') {
      // BUG-008 fix: Include rushing stats for dual-threat QBs so points are explainable
      const rushPart = stats.rushYards > 0 ? `, ${stats.rushYards} rush` : '';
      const rushTDPart = stats.rushTDs > 0 ? `, ${stats.rushTDs} rTD` : '';
      keyLine = `${stats.passYards} yds, ${stats.passTDs} TD${rushPart}${rushTDPart}`;
    } else if (player.position === 'RB') {
      keyLine = `${stats.rushYards} rush, ${stats.receivingYards} rec`;
    } else if (player.position === 'WR' || player.position === 'TE') {
      keyLine = `${stats.receptions} rec, ${stats.receivingYards} yds`;
    } else if (player.position === 'K' || player.position === 'DEF') {
      keyLine = `Avg: ${avgPts.toFixed(1)} pts`;
    }
  } else {
    keyLine = projPts > 0 ? `Proj: ${projPts.toFixed(1)} pts` : `Avg: ${avgPts.toFixed(1)} pts`;
  }

  const validPosition = VALID_POSITIONS.has(player.position as Player['position'])
    ? (player.position as Player['position'])
    : 'FLEX';

  return {
    id: player.id,
    rank: index + 1,
    name: player.name,
    team: player.team,
    position: validPosition,
    keyLine,
    projectedPoints: projPts > 0 ? projPts : avgPts,
    weekChange: 0,
    weeklyProjectedPoints: player.weeklyProjectedPoints,
    headshotUrl: player.headshotUrl ?? null,
  };
}

/**
 * Get the default NFL season year.
 * NFL season spans into early next year: Jan–Feb = previous year's season.
 */
export function getDefaultSeason(): number {
  const d = new Date();
  return d.getMonth() <= 3 ? d.getFullYear() - 1 : d.getFullYear();
}

/**
 * Convert scoring label to API format string.
 */
export function scoringToFormat(scoring: 'PPR' | 'Half PPR' | 'Standard'): string {
  return scoring === 'PPR' ? 'ppr' : scoring === 'Half PPR' ? 'half-ppr' : 'standard';
}

/** NFL regular season weeks */
export const NFL_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;
