import { describe, it, expect, vi } from 'vitest';
import { chunkedInArrayFetch, DEFAULT_ID_CHUNK } from './chunked';

describe('chunkedInArrayFetch', () => {
  it('returns an empty array without calling fetchChunk for empty ids', async () => {
    const fetchChunk = vi.fn(async () => []);
    const result = await chunkedInArrayFetch([], 50, fetchChunk);
    expect(result).toEqual([]);
    expect(fetchChunk).not.toHaveBeenCalled();
  });

  it('makes a single call when ids fit within the chunk size', async () => {
    const ids = ['a', 'b', 'c'];
    const fetchChunk = vi.fn(async (chunk: string[]) => chunk.map(id => ({ id })));
    const result = await chunkedInArrayFetch(ids, 50, fetchChunk);
    expect(fetchChunk).toHaveBeenCalledTimes(1);
    expect(fetchChunk).toHaveBeenCalledWith(ids);
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('splits ids into multiple chunks and flattens the results', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const seenChunks: string[][] = [];
    const fetchChunk = vi.fn(async (chunk: string[]) => {
      seenChunks.push(chunk);
      return chunk.map(id => ({ id }));
    });
    const result = await chunkedInArrayFetch(ids, 2, fetchChunk);
    expect(fetchChunk).toHaveBeenCalledTimes(3);
    expect(seenChunks).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('exports 50 as the default chunk size, matching the D1 bound-parameter precedent', () => {
    expect(DEFAULT_ID_CHUNK).toBe(50);
  });
});
