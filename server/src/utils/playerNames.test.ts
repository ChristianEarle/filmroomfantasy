import { describe, it, expect } from 'vitest';
import { normalizePlayerName } from './playerNames';

describe('normalizePlayerName', () => {
  it('strips generational suffixes', () => {
    expect(normalizePlayerName('Brian Robinson Jr.')).toBe('brian robinson');
    expect(normalizePlayerName('Kenneth Walker III')).toBe('kenneth walker');
  });

  it('strips punctuation and apostrophes', () => {
    expect(normalizePlayerName('A.J. Brown')).toBe('aj brown');
    expect(normalizePlayerName("Ja'Marr Chase")).toBe('jamarr chase');
  });

  it('lowercases and collapses whitespace', () => {
    expect(normalizePlayerName('  Josh   Allen ')).toBe('josh allen');
  });

  it('makes differently-formatted names from different sources match', () => {
    expect(normalizePlayerName('A.J. Brown')).toBe(normalizePlayerName('AJ Brown'));
    expect(normalizePlayerName('Brian Robinson Jr.')).toBe(normalizePlayerName('Brian Robinson'));
  });

  it('is idempotent', () => {
    const once = normalizePlayerName('Ja’Marr Chase');
    expect(normalizePlayerName(once)).toBe(once);
  });
});
