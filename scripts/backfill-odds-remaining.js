const fs = require('fs');
const path = require('path');

const GAME_IDS = [
  // Week 1
  '401772510', '401772714', '401772718', '401772719', '401772720', '401772721',
  '401772722', '401772723', '401772810', '401772827', '401772828', '401772829',
  '401772830', '401772831', '401772832', '401772918',
  // Week 2
  '401772715', '401772724', '401772725', '401772726', '401772727', '401772728',
  '401772729', '401772730', '401772811', '401772833', '401772834', '401772835',
  '401772836', '401772837', '401772919', '401772936',
  // Week 18
  '401772955', '401772956', '401772957', '401772958', '401772959', '401772960',
  '401772961', '401772962', '401772963', '401772964', '401772965', '401772966',
  '401772967', '401772968', '401772969', '401772970',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOdds(gameId, retries = 3) {
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/${gameId}/competitions/${gameId}/odds`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`  FAILED ${gameId}: HTTP ${res.status} (attempt ${attempt})`);
        if (attempt < retries) { await delay(2000 * attempt); continue; }
        return null;
      }
      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        console.error(`  FAILED ${gameId}: no items`);
        return null;
      }
      let item = data.items[0];
      for (const candidate of data.items) {
        if (candidate.provider && candidate.provider.name === 'ESPN BET') {
          item = candidate;
          break;
        }
      }
      return { gameId, spread: item.spread, overUnder: item.overUnder, details: item.details || '' };
    } catch (err) {
      console.error(`  ERROR ${gameId} (attempt ${attempt}): ${err.message}`);
      if (attempt < retries) { await delay(3000 * attempt); continue; }
      return null;
    }
  }
  return null;
}

async function main() {
  console.log(`Fetching odds for ${GAME_IDS.length} games...\n`);
  const results = [];
  let success = 0, fail = 0;

  for (let i = 0; i < GAME_IDS.length; i++) {
    const gameId = GAME_IDS[i];
    console.log(`[${i + 1}/${GAME_IDS.length}] Fetching ${gameId}...`);
    const odds = await fetchOdds(gameId);
    if (odds) {
      console.log(`  OK: spread=${odds.spread}, o/u=${odds.overUnder} (${odds.details})`);
      results.push(odds);
      success++;
    } else {
      fail++;
    }
    if (i < GAME_IDS.length - 1) await delay(300);
  }

  console.log(`\nDone. Success: ${success}, Failed: ${fail}`);

  const sqlLines = results.map(r =>
    `UPDATE nfl_games SET spread = ${r.spread}, over_under = ${r.overUnder} WHERE id = '${r.gameId}';`
  );
  const outPath = path.join(__dirname, 'backfill-odds-remaining.sql');
  fs.writeFileSync(outPath, sqlLines.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${sqlLines.length} UPDATE statements to ${outPath}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
