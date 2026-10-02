import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyOwns } from './ownership';

/** A D1 binding whose owner lookup resolves through `first`. */
function fakeDb(first: () => Promise<unknown>): D1Database {
  return { prepare: () => ({ bind: () => ({ first }) }) } as unknown as D1Database;
}

describe('legacyOwns', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { owner: 'legacy', expected: true },
    { owner: 'ingest', expected: false },
    { owner: null, expected: true },
  ])('is $expected when the stored owner is $owner', async ({ owner, expected }) => {
    expect(await legacyOwns(fakeDb(async () => owner), 'odds')).toBe(expected);
  });

  it('fails open when the ingest_owner table is missing', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = fakeDb(() => Promise.reject(new Error('D1_ERROR: no such table: ingest_owner: SQLITE_ERROR')));

    expect(await legacyOwns(db, 'odds')).toBe(true);
    expect(errors).toHaveBeenCalledOnce();
  });

  it('fails open when the binding itself throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      prepare: () => {
        throw new Error('D1 binding unavailable');
      },
    } as unknown as D1Database;

    expect(await legacyOwns(db, 'odds')).toBe(true);
  });
});
