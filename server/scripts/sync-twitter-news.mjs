#!/usr/bin/env node
/**
 * Sync player news from Twitter/X via RSS feeds.
 * Requires the API server to be running and TWITTER_RSS_URLS configured.
 * Usage: npm run sync:twitter
 *
 * Optional: Set API_URL and SYNC_SECRET env vars.
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;

async function main() {
  console.log('Syncing player news from Twitter RSS feeds...');
  console.log(`API: ${API_URL}/api/admin/sync-twitter-news`);

  const headers = { 'Content-Type': 'application/json' };
  if (SYNC_SECRET) {
    headers['X-Admin-Key'] = SYNC_SECRET;
  }

  try {
    const res = await fetch(`${API_URL}/api/admin/sync-twitter-news`, {
      method: 'POST',
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Sync failed:', data.error || data.message || res.statusText);
      if (data.message) console.error('  ', data.message);
      process.exit(1);
    }

    console.log('Sports news sync complete!');
    console.log(`  Items fetched: ${data.itemsFetched}`);
    console.log(`  News inserted: ${data.inserted}`);
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
    console.error('Set TWITTER_RSS_URLS in wrangler.toml [vars] or via wrangler secret');
    process.exit(1);
  }
}

main();
