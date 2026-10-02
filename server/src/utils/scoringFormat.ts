/**
 * One spelling for a league's scoring format.
 *
 * `leagues.scoring_format` holds two vocabularies: the connect flow and the
 * league settings PATCH store `half_ppr` (underscore), while the Sleeper
 * sync derives `half-ppr` (hyphen). Projections, rankings and every points
 * column key on the hyphenated form, so any consumer that compares the raw
 * league value against one spelling silently misses the other — a half-PPR
 * league connected through the app got zero projections on its roster and
 * matchup pages because no `half_ppr` projection rows exist.
 *
 * Normalize at the point of use instead of migrating the column: both
 * spellings are still written by live code paths and the client edits them.
 */
export type ScoringFormat = 'ppr' | 'half-ppr' | 'standard';

export function normalizeScoringFormat(raw: string | null | undefined): ScoringFormat {
  const f = (raw ?? '').toString().trim().toLowerCase();
  if (f === '') return 'ppr';
  if (f.includes('half') || f === '0.5') return 'half-ppr';
  if (f === 'standard' || f === 'std' || f === 'non-ppr' || f === 'non_ppr' || f === '0') return 'standard';
  return 'ppr';
}

/** Pick the value for a format from a {ppr, half, std} triple. */
export function pickByScoringFormat<T>(
  format: ScoringFormat,
  values: { ppr: T; half: T; std: T }
): T {
  if (format === 'half-ppr') return values.half;
  if (format === 'standard') return values.std;
  return values.ppr;
}
