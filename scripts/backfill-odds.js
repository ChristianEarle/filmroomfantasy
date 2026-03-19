const fs = require('fs');
const path = require('path');

const GAME_IDS = {
  week3: [
    '401772937', '401772842', '401772733', '401772731',
    '401772732', '401772839', '401772840', '401772841',
    '401772838', '401772734', '401772735', '401772736',
    '401772844', '401772843', '401772920', '401772812',
  ],
  week4: [
    '401772938', '401772632', '401772739', '401772740',
    '401772846', '401772847', '401772737', '401772845',
    '401772738', '401772849', '401772848', '401772741',
    '401772742', '401772921', '401772813', '401772716',
  ],
  week5: [
    '401772939', '401772633', '401772851', '401772744',
    '401772850', '401772745', '401772852', '401772743',
    '401772747', '401772746', '401772854', '401772853',
    '401772922', '401772814',
  ],
  week6: [
    '401772940', '401772634', '401772856', '401772750',
    '401772751', '401772748', '401772858', '401772857',
    '401772855', '401772859', '401772752', '401772749',
    '401772923', '401772815', '401772717',
  ],
  week7: [
    '401772941', '401772635', '401772861', '401772754',
    '401772755', '401772753', '401772862', '401772860',
    '401772757', '401772756', '401772864', '401772863',
    '401772924', '401772816', '401772826',
  ],
  week8: [
    '401772942', '401772760', '401772758', '401772868',
    '401772867', '401772865', '401772759', '401772866',
    '401772869', '401772762', '401772761', '401772925',
    '401772817',
  ],
  week9: [
    '401772943', '401772765', '401772871', '401772872',
    '401772764', '401772763', '401772767', '401772766',
    '401772870', '401772873', '401772874', '401772768',
    '401772926', '401772818',
  ],
  week10: [
    '401772944', '401772636', '401772875', '401772771',
    '401772876', '401772769', '401772772', '401772877',
    '401772770', '401772773', '401772879', '401772878',
    '401772927', '401772630',
  ],
  week11: [
    '401772945', '401772631', '401772882', '401772776',
    '401772881', '401772880', '401772883', '401772774',
    '401772775', '401772884', '401772885', '401772777',
    '401772778', '401772928', '401772819',
  ],
  week12: [
    '401772946', '401772780', '401772781', '401772888',
    '401772887', '401772886', '401772779', '401772782',
    '401772784', '401772783', '401772890', '401772889',
    '401772929', '401772820',
  ],
  week13: [
    '401772891', '401772694', '401772930', '401772621',
    '401772785', '401772786', '401772787', '401772892',
    '401772893', '401772895', '401772894', '401772896',
    '401772789', '401772788', '401772931', '401772821',
  ],
  week14: [
    '401772947', '401772900', '401772902', '401772898',
    '401772899', '401772790', '401772792', '401772793',
    '401772791', '401772794', '401772897', '401772901',
    '401772932', '401772822',
  ],
  week15: [
    '401772948', '401772904', '401772796', '401772798',
    '401772795', '401772905', '401772906', '401772797',
    '401772903', '401772800', '401772909', '401772908',
    '401772907', '401772799', '401772933', '401772823',
  ],
  week16: [
    '401772949', '401772612', '401772613', '401772802',
    '401772910', '401772803', '401772934', '401772801',
    '401772911', '401772912', '401772913', '401772914',
    '401772806', '401772805', '401772804', '401772824',
  ],
  week17: [
    '401772710', '401772711', '401772622', '401772951',
    '401772953', '401772954', '401772807', '401772809',
    '401772915', '401772916', '401772808', '401772952',
    '401772950', '401772917', '401772935', '401772825',
  ],
};

const ALL_IDS = Object.values(GAME_IDS).flat();

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
        if (attempt < retries) {
          await delay(2000 * attempt);
          continue;
        }
        return null;
      }
      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        console.error(`  FAILED ${gameId}: no items in response`);
        return null;
      }
      // Prefer ESPN BET provider if available, otherwise use first item
      let item = data.items[0];
      for (const candidate of data.items) {
        if (candidate.provider && candidate.provider.name === 'ESPN BET') {
          item = candidate;
          break;
        }
      }
      return {
        gameId,
        spread: item.spread,
        overUnder: item.overUnder,
        details: item.details || '',
      };
    } catch (err) {
      console.error(`  ERROR ${gameId} (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt < retries) {
        await delay(3000 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function main() {
  console.log(`Fetching odds for ${ALL_IDS.length} games...\n`);

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < ALL_IDS.length; i++) {
    const gameId = ALL_IDS[i];
    console.log(`[${i + 1}/${ALL_IDS.length}] Fetching ${gameId}...`);

    const odds = await fetchOdds(gameId);
    if (odds) {
      console.log(`  OK: spread=${odds.spread}, o/u=${odds.overUnder} (${odds.details})`);
      results.push(odds);
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between requests
    if (i < ALL_IDS.length - 1) {
      await delay(300);
    }
  }

  console.log(`\nDone fetching. Success: ${successCount}, Failed: ${failCount}`);

  // Build SQL
  const sqlLines = results.map((r) => {
    return `UPDATE nfl_games SET spread = ${r.spread}, over_under = ${r.overUnder} WHERE id = '${r.gameId}';`;
  });

  const sqlContent = sqlLines.join('\n') + '\n';
  const outPath = path.join(__dirname, 'backfill-odds.sql');
  fs.writeFileSync(outPath, sqlContent, 'utf-8');
  console.log(`\nWrote ${sqlLines.length} UPDATE statements to ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
