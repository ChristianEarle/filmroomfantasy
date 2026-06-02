import { describe, it, expect } from 'vitest';
import { rankingsToCsv, type ExportableRanking } from './csvExport';

function make(over: Partial<ExportableRanking> & { name: string }): ExportableRanking {
  return {
    overallRank: over.overallRank ?? 1,
    positionRank: over.positionRank ?? 1,
    tier: over.tier ?? 1,
    projectedPoints: over.projectedPoints ?? null,
    adp: over.adp ?? null,
    adpDelta: over.adpDelta ?? null,
    rationale: over.rationale ?? 'rationale',
    player: {
      name: over.name,
      position: over.player?.position ?? 'QB',
      team: over.player?.team ?? 'BUF',
      age: over.player?.age ?? 28,
    },
  };
}

describe('rankingsToCsv', () => {
  it('emits a header row and one row per ranking', () => {
    const csv = rankingsToCsv([
      make({ name: 'Josh Allen', overallRank: 1, positionRank: 1, tier: 1, projectedPoints: 380, adp: 6, adpDelta: -5 }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Rank,Player,Position,Team,Age,Proj Pts,ADP,Value Delta,Tier,Rationale');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('1,Josh Allen,QB1,BUF,28,380.0,6.0,-5.0,1,rationale');
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = rankingsToCsv([
      make({ name: 'Smith, Jr.', rationale: 'He said "elite" upside' }),
    ]);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('"Smith, Jr."');
    expect(row).toContain('"He said ""elite"" upside"');
  });

  it('neutralizes CSV formula injection in free-text fields', () => {
    const csv = rankingsToCsv([
      make({ name: '=cmd()', rationale: '@SUM(A1)' }),
    ]);
    const row = csv.split('\r\n')[1];
    // Leading =/@ get an apostrophe prefix so spreadsheets do not execute them.
    expect(row).toContain("'=cmd()");
    expect(row).toContain("'@SUM(A1)");
  });

  it('does not mangle negative numeric values', () => {
    const csv = rankingsToCsv([make({ name: 'X', adpDelta: -12 })]);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('-12.0');
    expect(row).not.toContain("'-12");
  });

  it('renders null numeric fields as empty cells', () => {
    const csv = rankingsToCsv([make({ name: 'X', projectedPoints: null, adp: null, adpDelta: null })]);
    const row = csv.split('\r\n')[1];
    // ...,Age,Proj Pts,ADP,Value Delta,... → three consecutive empties
    expect(row).toContain('28,,,,1,');
  });
});
