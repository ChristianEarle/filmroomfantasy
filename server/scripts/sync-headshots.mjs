#!/usr/bin/env node
/**
 * Sync player headshots from Sleeper API into the database.
 * Updates headshot_url for existing players (lighter than full sync-players).
 * Requires the API server to be running (npm run dev).
 * Usage: npm run sync:headshots
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing player headshots from Sleeper...');
  console.log(`API: ${API_URL}/api/admin/sync-headshots`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-headshots`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log('Headshot sync complete!');
    console.log(`  Updated: ${data.updated}`);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure the API server is running: npm run dev');
    process.exit(1);
  }
}

main();
