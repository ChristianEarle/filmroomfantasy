#!/usr/bin/env node
/**
 * Sync players from Sleeper API into the database.
 * Requires the API server to be running (npm run dev).
 * Usage: npm run sync:players
 *
 * Optional: Set SYNC_SECRET env var and pass as X-Admin-Key header if your server requires it.
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing players from Sleeper to database...');
  console.log(`API: ${API_URL}/api/admin/sync-players`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-players`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log('Sync complete!');
    console.log(`  Inserted: ${data.inserted}`);
    console.log(`  Updated:  ${data.updated}`);
    console.log(`  Total:    ${data.total}`);
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure the API server is running: npm run dev');
    process.exit(1);
  }
}

main();
