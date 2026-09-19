import { describe, expect, it } from 'vitest';
import { normalizeCell, rowChanged, rowSetSignature } from './rowDiff';

describe('rowChanged', () => {
  it('treats a missing existing row as changed', () => {
    expect(rowChanged(null, { a: 1 }, ['a'])).toBe(true);
    expect(rowChanged(undefined, { a: 1 }, ['a'])).toBe(true);
  });

  it('is false when every compared cell matches', () => {
    const existing = { id: 'x', points: 12.5, yards: 80, note: null, updatedAt: new Date(1) };
    const next = { points: 12.5, yards: 80, note: undefined, updatedAt: new Date(99) };
    expect(rowChanged(existing, next, ['points', 'yards', 'note'])).toBe(false);
  });

  it('is true when any compared cell differs', () => {
    const existing = { points: 12.5, yards: 80 };
    expect(rowChanged(existing, { points: 12.5, yards: 81 }, ['points', 'yards'])).toBe(true);
    expect(rowChanged(existing, { points: 12.5, yards: null }, ['points', 'yards'])).toBe(true);
  });

  it('ignores keys that are not listed', () => {
    const existing = { points: 12.5, updatedAt: new Date(1) };
    expect(rowChanged(existing, { points: 12.5, updatedAt: new Date(2) }, ['points'])).toBe(false);
  });

  it('compares booleans against the 0/1 SQLite stores', () => {
    expect(rowChanged({ isComplete: 1 }, { isComplete: true }, ['isComplete'])).toBe(false);
    expect(rowChanged({ isComplete: false }, { isComplete: 0 }, ['isComplete'])).toBe(false);
    expect(rowChanged({ isComplete: false }, { isComplete: true }, ['isComplete'])).toBe(true);
  });

  it('compares dates by timestamp', () => {
    expect(normalizeCell(new Date(1234))).toBe(1234);
    expect(rowChanged({ at: new Date(5) }, { at: new Date(5) }, ['at'])).toBe(false);
  });
});

describe('rowSetSignature', () => {
  it('is order independent', () => {
    const a = [{ playerId: 'p1', slot: 'QB', isStarter: true }, { playerId: 'p2', slot: 'BN1', isStarter: false }];
    const b = [{ playerId: 'p2', slot: 'BN1', isStarter: 0 }, { playerId: 'p1', slot: 'QB', isStarter: 1 }];
    const keys = ['playerId', 'slot', 'isStarter'];
    expect(rowSetSignature(a, keys)).toBe(rowSetSignature(b, keys));
  });

  it('differs when a row changes or is added', () => {
    const keys = ['playerId', 'slot', 'isStarter'];
    const base = [{ playerId: 'p1', slot: 'QB', isStarter: true }];
    expect(rowSetSignature(base, keys)).not.toBe(rowSetSignature([{ playerId: 'p1', slot: 'QB', isStarter: false }], keys));
    expect(rowSetSignature(base, keys)).not.toBe(rowSetSignature([...base, { playerId: 'p2', slot: 'BN1', isStarter: false }], keys));
    expect(rowSetSignature([], keys)).toBe('');
  });
});
