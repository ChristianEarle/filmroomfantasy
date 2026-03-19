#!/usr/bin/env node
/**
 * Sync player stats from Sleeper API into the database.
 * Requires the API server to be running (npm run dev).
 * Usage: npm run sync:stats
 *
 * By default syncs the last 15 seasons. Override with:
 *   SEASON_YEAR=2024       - sync only this season
 *   SEASONS=15             - number of seasons (default 15)
 *   WEEKS=18               - max weeks per season (default 18)
 *   SYNC_SECRET=xxx        - admin key if required
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;
const WEEKS = process.env.WEEKS ? parseInt(process.env.WEEKS, 10) : 18;

// Single season override, or number of seasons to sync
const SEASON_YEAR = process.env.SEASON_YEAR ? parseInt(process.env.SEASON_YEAR, 10) : null;
const SEASONS = process.env.SEASONS ? parseInt(process.env.SEASONS, 10) : 15;

async function main() {
  const currentYear = new Date().getFullYear();
  const seasonsToSync = SEASON_YEAR != null
    ? [SEASON_YEAR]
    : Array.from({ length: SEASONS }, (_, i) => currentYear - 1 - i);

  console.log('Syncing player stats from Sleeper to database...');
  console.log(`API: ${API_URL}/api/admin/sync-stats`);
  console.log(`Seasons: ${seasonsToSync.join(', ')} (${seasonsToSync.length} seasons, ${WEEKS} weeks each)`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    for (const seasonYear of seasonsToSync) {
      process.stdout.write(`  ${seasonYear}... `);
      const res = await fetch(`${API_URL}/api/admin/sync-stats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ seasonYear, weeks: WEEKS }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(`failed: ${data.error || data.message || res.statusText}`);
        continue;
      }

      totalInserted += data.inserted || 0;
      totalUpdated += data.updated || 0;
      console.log(`✓ ${data.inserted || 0} inserted, ${data.updated || 0} updated`);
    }

    console.log('\nStats sync complete!');
    console.log(`  Total inserted: ${totalInserted}`);
    console.log(`  Total updated:  ${totalUpdated}`);
    console.log(`  Grand total:    ${totalInserted + totalUpdated}`);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure the API server is running: npm run dev');
    process.exit(1);
  }
}

main();
