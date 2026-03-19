#!/usr/bin/env node
/**
 * Sync NFL games from ESPN into the database (with weather).
 * Falls back to static 2025 schedule when ESPN API fails.
 *
 * Requires the API server to be running:
 *   cd server && npm run dev
 *
 * Usage: cd server && npm run sync:games
 *
 * Optional env:
 *   API_URL - default http://localhost:8787
 *   SYNC_SECRET - if set, must match server SYNC_SECRET (X-Admin-Key header)
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing NFL games (2025 season, weeks 1-18)...');
  console.log(`API: ${API_URL}/api/admin/sync-games`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-games`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        seasonYear: 2025,
        weeks: Array.from({ length: 18 }, (_, i) => i + 1),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log('Sync complete!');
    console.log(`  Inserted: ${data.inserted}`);
    console.log(`  Updated:  ${data.updated}`);
    console.log(`  Season:   ${data.seasonYear}`);
    console.log(`  Weeks:    ${data.weeks}`);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch')) {
      console.error('\nMake sure the API server is running: cd server && npm run dev');
      console.error('Server runs on port 8787 by default.');
    }
    process.exit(1);
  }
}

main();
