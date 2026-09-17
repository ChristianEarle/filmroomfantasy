/**
 * Compare a stored row with the values a sync is about to write, so the
 * caller can skip the UPDATE (and any history snapshot that goes with it)
 * when nothing actually changed.
 *
 * Every row written, including index entries, counts against D1's daily
 * write budget. The 4-hourly syncs were rewriting thousands of identical
 * stats, projection, roster and matchup rows per run, which exhausted the
 * budget mid-day and made every write in the app fail, including the
 * session insert on sign-in.
 *
 * Cells are compared by value: null and undefined are equal, Dates by their
 * timestamp, booleans against 0/1 (SQLite has no boolean type), numbers by
 * value. A missing existing row always counts as changed.
 */
export function normalizeCell(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function rowChanged(
  existing: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  if (!existing) return true;
  for (const key of keys) {
    if (normalizeCell(existing[key]) !== normalizeCell(next[key])) return true;
  }
  return false;
}

/**
 * Order-independent fingerprint of a roster (or any set of rows) so a sync
 * can tell whether a delete-and-reinsert would produce the same rows it is
 * about to delete.
 */
export function rowSetSignature(
  rows: readonly Record<string, unknown>[],
  keys: readonly string[],
): string {
  return rows
    .map((row) => keys.map((key) => String(normalizeCell(row[key]))).join(''))
    .sort()
    .join('');
}
