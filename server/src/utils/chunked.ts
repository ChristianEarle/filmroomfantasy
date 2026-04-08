/**
 * Run an `inArray` / IN (…) query in chunks to stay within D1's bound
 * parameter limit. D1 imposes a cap per query (the existing sync code
 * in routes/leagues.ts chunks at 50 for the same reason). Without
 * chunking, any query built from a list longer than the limit fails
 * at runtime with a generic SQL error.
 *
 * Usage:
 *   const rows = await chunkedInArrayFetch(ids, 50, (chunk) =>
 *     db.query.foo.findMany({ where: inArray(schema.foo.id, chunk) })
 *   );
 *
 * Runs chunks sequentially (cheap on D1, and avoids racing). Ordering
 * across chunks is not preserved — callers that care should key into
 * the result by id after the fact.
 */
export async function chunkedInArrayFetch<TRow>(
  ids: string[],
  chunkSize: number,
  fetchChunk: (chunk: string[]) => Promise<TRow[]>
): Promise<TRow[]> {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) return fetchChunk(ids);
  const out: TRow[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const rows = await fetchChunk(chunk);
    for (const r of rows) out.push(r);
  }
  return out;
}

/** Default chunk size matching the precedent in routes/leagues.ts. */
export const DEFAULT_ID_CHUNK = 50;
