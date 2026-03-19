/**
 * Shared matchup grade utilities.
 * Used by MatchupView, TeamView, and any other component that needs matchup grades.
 */

/** Calculate a matchup grade from projected points and position. */
export const calculateGrade = (
  projection: number,
  position: string
): 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F' => {
  const thresholds: Record<string, number[]> = {
    QB: [25, 22, 20, 18, 15],
    RB: [18, 15, 12, 10, 8],
    WR: [18, 15, 12, 10, 8],
    TE: [14, 12, 10, 8, 6],
    K: [10, 9, 8, 7, 6],
    DEF: [10, 8, 6, 4, 2],
    FLEX: [18, 15, 12, 10, 8],
  };
  const posThresholds = thresholds[position] || thresholds.WR;
  if (projection >= posThresholds[0]) return 'A+';
  if (projection >= posThresholds[1]) return 'A';
  if (projection >= posThresholds[2]) return 'B+';
  if (projection >= posThresholds[3]) return 'B';
  if (projection >= posThresholds[4]) return 'C+';
  return 'C';
};

/** Get a human-readable label for a matchup grade. */
export const getMatchupGradeLabel = (grade: string | undefined): string => {
  if (!grade) return 'Matchup: —';
  if (grade.startsWith('A')) return 'Elite';
  if (grade.startsWith('B')) return 'Good';
  if (grade.startsWith('C')) return 'Average';
  return 'Tough';
};

/** Get Tailwind color classes for a matchup grade badge. */
export const getMatchupGradeColor = (grade: string | undefined, isDarkMode: boolean): string => {
  if (!grade)
    return isDarkMode
      ? 'text-slate-500 bg-slate-800/60 border-slate-600'
      : 'text-slate-400 bg-slate-100 border-slate-200';
  if (grade.startsWith('A'))
    return isDarkMode
      ? 'text-emerald-400 bg-emerald-500/25 border-emerald-500/40'
      : 'text-emerald-600 bg-emerald-100 border-emerald-300';
  if (grade.startsWith('B'))
    return isDarkMode
      ? 'text-blue-400 bg-blue-500/25 border-blue-500/40'
      : 'text-blue-600 bg-blue-100 border-blue-300';
  if (grade.startsWith('C'))
    return isDarkMode
      ? 'text-amber-400 bg-amber-500/25 border-amber-500/40'
      : 'text-amber-600 bg-amber-100 border-amber-300';
  return isDarkMode
    ? 'text-rose-400 bg-rose-500/25 border-rose-500/40'
    : 'text-rose-600 bg-rose-100 border-rose-300';
};
