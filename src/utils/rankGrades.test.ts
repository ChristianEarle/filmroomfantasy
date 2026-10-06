import { describe, expect, it } from 'vitest';
import { gradesFollowRank } from './rankGrades';

const g = (...grades: string[]) => grades.map((grade) => ({ grade }));

describe('gradesFollowRank', () => {
  it('lowers a grade that outranks the team above it', () => {
    expect(gradesFollowRank(g('A', 'B', 'A-', 'C')).map((t) => t.grade)).toEqual(['A', 'B', 'B', 'C']);
  });

  it('leaves an already-ordered list alone', () => {
    const teams = g('A+', 'A-', 'B', 'D');
    expect(gradesFollowRank(teams)).toEqual(teams);
  });

  it('ignores unknown grades', () => {
    expect(gradesFollowRank(g('B', 'weird', 'A')).map((t) => t.grade)).toEqual(['B', 'weird', 'B']);
  });
});
