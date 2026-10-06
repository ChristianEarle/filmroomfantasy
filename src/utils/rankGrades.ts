const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D'];

/**
 * Keeps letter grades in step with the order teams are shown in. A team can
 * never display a higher grade than the team ranked above it, so a power
 * ranking that puts a hot B team ahead of an A team doesn't read as a
 * contradiction. Ranked order is trusted; grades are only ever lowered.
 */
export function gradesFollowRank<T extends { grade: string }>(ranked: T[]): T[] {
  let ceiling = 0;
  return ranked.map((team) => {
    const idx = GRADE_ORDER.indexOf(team.grade);
    if (idx === -1) return team;
    ceiling = Math.max(ceiling, idx);
    return ceiling === idx ? team : { ...team, grade: GRADE_ORDER[ceiling] };
  });
}
