#!/usr/bin/env node
/**
 * Sync player news from ESPN's public API into the database.
 * Requires the API server to be running (npm run dev).
 * Usage: npm run sync:espn
 *
 * Optional: Set API_URL and SYNC_SECRET env vars.
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing player news from ESPN...');
  console.log(`API: ${API_URL}/api/admin/sync-espn-news`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-espn-news`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      process.exit(1);
    }

    console.log('ESPN news sync complete!');
    console.log(`  Articles fetched: ${data.articlesFetched}`);
    console.log(`  News inserted: ${data.inserted}`);
    console.log(`  Skipped (duplicates): ${data.skipped}`);
    if (data.aiFiltering) {
      console.log('  AI filtering: enabled');
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nMake sure the API server is running: npm run dev');
    process.exit(1);
  }
}

main();
