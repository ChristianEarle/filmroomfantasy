#!/usr/bin/env node
/**
 * Sync player news from Rotowire's public RSS feed into the database.
 * Requires the API server to be running (npm run dev).
 * Usage: npm run sync:rotowire
 *
 * Optional: Set API_URL and SYNC_SECRET env vars.
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing player news from Rotowire RSS...');
  console.log(`API: ${API_URL}/api/admin/sync-rotowire-news`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-rotowire-news`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log('Rotowire news sync complete!');
    console.log(`  Items fetched: ${data.itemsFetched}`);
    console.log(`  News inserted: ${data.inserted}`);
    console.log(`  Skipped (duplicates): ${data.skipped}`);
    if (data.diagnostics?.length) {
      console.log('  Feed diagnostics:');
      data.diagnostics.forEach((d) => {
        const status = d.error ? `ERROR: ${d.error}` : `${d.count} items`;
        console.log(`    - ${d.author}: ${status}`);
      });
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure the API server is running: npm run dev');
    process.exit(1);
  }
}

main();
