/**
 * Normalize a player name so sources that spell the same person differently
 * still match up. The Odds API uses "Brian Robinson Jr.", Sleeper stores
 * "Brian Robinson", FantasyPros writes "A.J. Brown" while rankings feeds
 * write "AJ Brown" — normalization strips punctuation + generational
 * suffixes so everyone collapses to the same key.
 *
 * Example:
 *   "Brian Robinson Jr." → "brian robinson"
 *   "A.J. Brown"         → "aj brown"
 *   "Kenneth Walker III"  → "kenneth walker"
 *   "Ja'Marr Chase"       → "jamarr chase"
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    // Strip common punctuation (periods, apostrophes, hyphens, quotes).
    .replace(/[.'`’‘"“”\-]/g, '')
    // Drop generational suffixes.
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
