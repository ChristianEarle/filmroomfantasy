#!/usr/bin/env node
/**
 * Backfill historical data for an entire NFL season.
 *
 * Syncs: games, stats, historical odds, player props, and projections.
 *
 * Usage:
 *   cd server && node scripts/backfill-season.mjs
 *
 * Environment:
 *   API_URL      - default http://localhost:8787  (or your production Workers URL)
 *   SYNC_SECRET  - admin key (X-Admin-Key header)
 *   SEASON       - season year (default 2025)
 *   START_WEEK   - first week to sync (default 1)
 *   END_WEEK     - last week to sync (default 18)
 *   SKIP_GAMES   - set "1" to skip games sync
 *   SKIP_STATS   - set "1" to skip stats sync
 *   SKIP_ODDS    - set "1" to skip historical odds sync
 *   SKIP_PROPS   - set "1" to skip player props sync
 *   SKIP_PROJ    - set "1" to skip projections sync
 */

const API_URL = process.env.API_URL || 'http://localhost:8787';
const SYNC_SECRET = process.env.SYNC_SECRET;
const SEASON = parseInt(process.env.SEASON || '2025', 10);
const START_WEEK = parseInt(process.env.START_WEEK || '1', 10);
const END_WEEK = parseInt(process.env.END_WEEK || '18', 10);

const SKIP_GAMES = process.env.SKIP_GAMES === '1';
const SKIP_STATS = process.env.SKIP_STATS === '1';
const SKIP_ODDS = process.env.SKIP_ODDS === '1';
const SKIP_PROPS = process.env.SKIP_PROPS === '1';
const SKIP_PROJ = process.env.SKIP_PROJ === '1';

// 2025 NFL regular season — Thursday of each week (used for historical odds API date param)
// These are approximate kickoff dates; the Odds API uses them to find the snapshot.
const NFL_2025_WEEK_DATES = {
  1:  '2025-09-04T23:00:00Z',
  2:  '2025-09-11T23:00:00Z',
  3:  '2025-09-18T23:00:00Z',
  4:  '2025-09-25T23:00:00Z',
  5:  '2025-10-02T23:00:00Z',
  6:  '2025-10-09T23:00:00Z',
  7:  '2025-10-16T23:00:00Z',
  8:  '2025-10-23T23:00:00Z',
  9:  '2025-10-30T23:00:00Z',
  10: '2025-11-06T23:00:00Z',
  11: '2025-11-13T23:00:00Z',
  12: '2025-11-20T23:00:00Z',
  13: '2025-11-27T23:00:00Z',
  14: '2025-12-04T23:00:00Z',
  15: '2025-12-11T23:00:00Z',
  16: '2025-12-18T23:00:00Z',
  17: '2025-12-25T23:00:00Z',
  18: '2026-01-03T23:00:00Z',
};

const headers = { 'Content-Type': 'application/json' };
if (SYNC_SECRET) headers['X-Admin-Key'] = SYNC_SECRET;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callEndpoint(path, body, label) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`    ✗ ${label}: ${data.error || data.message || res.statusText}`);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`    ✗ ${label}: ${err.message}`);
    return null;
  }
}

async function main() {
  const weeks = [];
  for (let w = START_WEEK; w <= END_WEEK; w++) weeks.push(w);

  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║   NFL ${SEASON} Season Backfill (Weeks ${START_WEEK}-${END_WEEK})   ║`);
  console.log(`╚════════════════════════════════════════════╝`);
  console.log(`API: ${API_URL}`);
  console.log(`Syncing: ${[
    !SKIP_GAMES && 'games',
    !SKIP_STATS && 'stats',
    !SKIP_ODDS && 'odds',
    !SKIP_PROPS && 'props',
    !SKIP_PROJ && 'projections',
  ].filter(Boolean).join(', ')}\n`);

  // ─── Step 1: Sync players (needed for stats/projections) ───
  console.log('▸ Syncing players...');
  const playersResult = await callEndpoint('/api/admin/sync-players', {}, 'sync-players');
  if (playersResult) {
    console.log(`    ✓ ${playersResult.inserted || 0} inserted, ${playersResult.updated || 0} updated`);
  }

  // ─── Step 2: Sync games for all weeks ───
  if (!SKIP_GAMES) {
    console.log(`\n▸ Syncing games (all ${weeks.length} weeks)...`);
    const gamesResult = await callEndpoint('/api/admin/sync-games', {
      seasonYear: SEASON,
      weeks,
    }, 'sync-games');
    if (gamesResult) {
      console.log(`    ✓ ${gamesResult.inserted || 0} inserted, ${gamesResult.updated || 0} updated`);
    }
  }

  // ─── Step 3: Sync stats week by week ───
  if (!SKIP_STATS) {
    console.log(`\n▸ Syncing stats week by week...`);
    for (const week of weeks) {
      process.stdout.write(`    Week ${String(week).padStart(2)}... `);
      const result = await callEndpoint('/api/admin/sync-stats', {
        seasonYear: SEASON,
        weeks: [week],
      }, `stats-week-${week}`);
      if (result) {
        console.log(`✓ ${result.inserted || 0} ins / ${result.updated || 0} upd`);
      }
      await sleep(500); // rate limit buffer
    }
  }

  // ─── Step 4: Sync historical odds week by week ───
  if (!SKIP_ODDS) {
    console.log(`\n▸ Syncing historical odds week by week...`);
    console.log(`    (Each call uses 1 Odds API request)`);
    for (const week of weeks) {
      const date = NFL_2025_WEEK_DATES[week];
      if (!date) {
        console.log(`    Week ${week}: no date mapped, skipping`);
        continue;
      }
      process.stdout.write(`    Week ${String(week).padStart(2)} (${date.slice(0, 10)})... `);
      const result = await callEndpoint('/api/admin/sync-historical-odds', {
        date,
        week,
      }, `odds-week-${week}`);
      if (result) {
        console.log(`✓ ${result.inserted || 0} ins / ${result.skipped || 0} skip`);
      }
      await sleep(1000); // respect rate limits
    }
  }

  // ─── Step 5: Sync player props week by week ───
  if (!SKIP_PROPS) {
    console.log(`\n▸ Syncing player props week by week...`);
    console.log(`    (Multiple API calls per week — one per game)`);
    for (const week of weeks) {
      const date = NFL_2025_WEEK_DATES[week];
      if (!date) {
        console.log(`    Week ${week}: no date mapped, skipping`);
        continue;
      }
      process.stdout.write(`    Week ${String(week).padStart(2)}... `);

      // Sync props for all games in the week by not specifying gameIndex
      // The endpoint processes the first game by default, so we loop through game indices
      let totalProps = 0;
      let gameIdx = 0;
      let consecutiveFails = 0;

      while (consecutiveFails < 2) {
        const result = await callEndpoint('/api/admin/sync-player-props', {
          week,
          date,
          season: SEASON,
          gameIndex: gameIdx,
        }, `props-week-${week}-game-${gameIdx}`);

        if (result && result.success) {
          totalProps += result.props_inserted || 0;
          consecutiveFails = 0;
        } else {
          consecutiveFails++;
        }
        gameIdx++;
        await sleep(1200); // rate limit
        if (gameIdx > 16) break; // max 16 games per week
      }
      console.log(`✓ ${totalProps} props inserted across ${gameIdx - consecutiveFails} games`);
    }
  }

  // ─── Step 6: Generate projections from props + Sleeper ───
  if (!SKIP_PROJ) {
    console.log(`\n▸ Generating projections (all weeks, all formats)...`);
    const projResult = await callEndpoint('/api/admin/sync-projections', {
      seasonYear: SEASON,
      weeks,
      source: 'auto',
    }, 'sync-projections');
    if (projResult) {
      console.log(`    ✓ ${projResult.inserted || 0} ins / ${projResult.updated || 0} upd`);
    }
  }

  console.log(`\n════════════════════════════════════════════`);
  console.log(`Backfill complete for ${SEASON} season!`);
  console.log(`════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
