import { describe, expect, it } from 'vitest';
import { normalizeScoringFormat, pickByScoringFormat } from './scoringFormat';

describe('normalizeScoringFormat', () => {
  it('maps both stored spellings of half PPR to the projection key', () => {
    expect(normalizeScoringFormat('half_ppr')).toBe('half-ppr');
    expect(normalizeScoringFormat('half-ppr')).toBe('half-ppr');
    expect(normalizeScoringFormat('Half PPR')).toBe('half-ppr');
    expect(normalizeScoringFormat('halfppr')).toBe('half-ppr');
  });

  it('recognises standard and its aliases', () => {
    expect(normalizeScoringFormat('standard')).toBe('standard');
    expect(normalizeScoringFormat('STD')).toBe('standard');
    expect(normalizeScoringFormat('non-ppr')).toBe('standard');
  });

  it('defaults anything else to ppr', () => {
    expect(normalizeScoringFormat('ppr')).toBe('ppr');
    expect(normalizeScoringFormat('PPR')).toBe('ppr');
    expect(normalizeScoringFormat(undefined)).toBe('ppr');
    expect(normalizeScoringFormat(null)).toBe('ppr');
    expect(normalizeScoringFormat('')).toBe('ppr');
    expect(normalizeScoringFormat('custom')).toBe('ppr');
  });
});

describe('pickByScoringFormat', () => {
  const triple = { ppr: 'P', half: 'H', std: 'S' };
  it('selects the matching value', () => {
    expect(pickByScoringFormat('ppr', triple)).toBe('P');
    expect(pickByScoringFormat('half-ppr', triple)).toBe('H');
    expect(pickByScoringFormat('standard', triple)).toBe('S');
  });
});
