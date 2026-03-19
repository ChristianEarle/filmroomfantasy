import type { PlayerWeeklyStats } from '../db/schema';

// PPR Scoring (1 point per reception)
export const calculatePPRPoints = (stats: Partial<PlayerWeeklyStats>): number => {
  let points = 0;

  // Passing
  points += (stats.passYards || 0) * 0.04;      // 1 point per 25 yards
  points += (stats.passTDs || 0) * 4;            // 4 points per TD
  points += (stats.passInterceptions || 0) * -1; // -1 per INT

  // Rushing
  points += (stats.rushYards || 0) * 0.1;        // 1 point per 10 yards
  points += (stats.rushTDs || 0) * 6;            // 6 points per TD

  // Receiving
  points += (stats.receptions || 0) * 1;         // 1 point per reception (PPR)
  points += (stats.receivingYards || 0) * 0.1;   // 1 point per 10 yards
  points += (stats.receivingTDs || 0) * 6;       // 6 points per TD

  // Misc
  points += (stats.fumbles || 0) * -2;           // -2 per fumble lost
  points += (stats.twoPointConversions || 0) * 2; // 2 per 2PT conversion

  // Kicking
  points += (stats.fgMade || 0) * 3;             // 3 per FG made
  points += (stats.fg40PlusMade || 0) * 1;       // +1 bonus for 40+ yard FG
  points += (stats.fg50PlusMade || 0) * 1;       // +1 bonus for 50+ yard FG
  points += (stats.xpMade || 0) * 1;             // 1 per XP made

  // Defense (D/ST)
  points += (stats.sacks || 0) * 1;              // 1 per sack
  points += (stats.defInterceptions || 0) * 2;   // 2 per INT
  points += (stats.fumblesRecovered || 0) * 2;   // 2 per fumble recovery
  points += (stats.defenseTDs || 0) * 6;         // 6 per defensive TD
  points += (stats.safeties || 0) * 2;           // 2 per safety

  // Points allowed scoring (D/ST)
  if (stats.pointsAllowed !== undefined && stats.pointsAllowed !== null) {
    if (stats.pointsAllowed === 0) points += 10;
    else if (stats.pointsAllowed <= 6) points += 7;
    else if (stats.pointsAllowed <= 13) points += 4;
    else if (stats.pointsAllowed <= 20) points += 1;
    else if (stats.pointsAllowed <= 27) points += 0;
    else if (stats.pointsAllowed <= 34) points += -1;
    else points += -4;
  }

  return Math.round(points * 100) / 100;
};

// Half PPR Scoring (0.5 points per reception)
export const calculateHalfPPRPoints = (stats: Partial<PlayerWeeklyStats>): number => {
  let points = calculatePPRPoints(stats);
  // Adjust for half PPR (subtract 0.5 per reception since we added 1)
  points -= (stats.receptions || 0) * 0.5;
  return Math.round(points * 100) / 100;
};

// Standard Scoring (0 points per reception)
export const calculateStandardPoints = (stats: Partial<PlayerWeeklyStats>): number => {
  let points = calculatePPRPoints(stats);
  // Adjust for standard (subtract 1 per reception since we added 1)
  points -= (stats.receptions || 0) * 1;
  return Math.round(points * 100) / 100;
};

// Calculate all three scoring formats
export const calculateAllFormats = (stats: Partial<PlayerWeeklyStats>) => {
  return {
    ppr: calculatePPRPoints(stats),
    halfPpr: calculateHalfPPRPoints(stats),
    standard: calculateStandardPoints(stats),
  };
};

// Get position rank color
export const getPositionRankColor = (rank: number): 'elite' | 'good' | 'average' | 'bad' => {
  if (rank <= 5) return 'elite';
  if (rank <= 12) return 'good';
  if (rank <= 24) return 'average';
  return 'bad';
};

// Calculate roster projected points
export const calculateRosterProjectedPoints = (
  projections: { playerId: string; projectedPoints: number; isStarter: boolean }[]
): number => {
  return projections
    .filter(p => p.isStarter)
    .reduce((sum, p) => sum + p.projectedPoints, 0);
};
