import { describe, it, expect } from 'vitest';
import { parseMflName, mapMflPosition, mapMflTeam } from './mfl';

describe('parseMflName', () => {
  it('parses a standard "Last, First" name', () => {
    expect(parseMflName('Mahomes, Patrick')).toEqual({
      firstName: 'Patrick',
      lastName: 'Mahomes',
      fullName: 'Patrick Mahomes',
    });
  });

  it('falls back to the raw string as lastName/fullName for team defenses / unexpected formats', () => {
    expect(parseMflName('Chiefs D/ST')).toEqual({
      firstName: '',
      lastName: 'Chiefs D/ST',
      fullName: 'Chiefs D/ST',
    });
  });
});

describe('mapMflPosition', () => {
  it('maps offensive fantasy positions straight through, and returns null for untracked defensive positions', () => {
    expect(mapMflPosition('QB')).toBe('QB');
    expect(mapMflPosition('PK')).toBe('K');
    expect(mapMflPosition('Def')).toBe('DEF');
    expect(mapMflPosition('LB')).toBeNull();
    expect(mapMflPosition('CB')).toBeNull();
  });
});

describe('mapMflTeam', () => {
  it('normalizes MFL-specific team codes and passes already-standard/unknown codes through unchanged', () => {
    expect(mapMflTeam('GBP')).toBe('GB');
    expect(mapMflTeam('JAC')).toBe('JAX');
    expect(mapMflTeam('KCC')).toBe('KC');
    expect(mapMflTeam('KC')).toBe('KC');
    expect(mapMflTeam('ZZZ')).toBe('ZZZ');
  });
});
