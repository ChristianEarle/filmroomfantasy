import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  columnReader,
  csvNumber,
  csvInt,
  csvText,
  readUsageRows,
  readPracticeRows,
  readCrosswalkRows,
  readGameRows,
  nflverseAssetUrl,
  nflverseAssets,
} from './nflverse';

describe('parseCsv', () => {
  it('parses quoted cells, doubled quotes, embedded commas and CRLF rows', () => {
    const text = 'a,b,c\r\n1,"x, y","he said ""hi"""\r\n2,,\r\n';
    const rows: string[][] = [];
    const header = parseCsv(text, (cells) => rows.push(cells));
    expect(header).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([
      ['1', 'x, y', 'he said "hi"'],
      ['2', '', ''],
    ]);
  });

  it('keeps embedded newlines inside quotes and skips blank lines', () => {
    const text = 'a,b\n"line1\nline2",2\n\n3,4';
    const rows: string[][] = [];
    parseCsv(text, (cells) => rows.push(cells));
    expect(rows).toEqual([['line1\nline2', '2'], ['3', '4']]);
  });

  it('hands the header to every row callback', () => {
    const seen: string[][] = [];
    parseCsv('x,y\n1,2\n3,4', (_cells, header) => seen.push(header));
    expect(seen).toEqual([['x', 'y'], ['x', 'y']]);
  });
});

describe('cell helpers', () => {
  it('reads by column name and tolerates missing columns', () => {
    const get = columnReader(['a', 'b']);
    expect(get(['1', '2'], 'b')).toBe('2');
    expect(get(['1'], 'b')).toBe('');
    expect(get(['1', '2'], 'zzz')).toBe('');
  });

  it('treats empty and NA as null', () => {
    expect(csvNumber('')).toBeNull();
    expect(csvNumber('NA')).toBeNull();
    expect(csvNumber('1.25')).toBe(1.25);
    expect(csvInt('2.6')).toBe(3);
    expect(csvText('  ')).toBeNull();
    expect(csvText(' KC ')).toBe('KC');
  });
});

// Trimmed to the columns the readers use, in the real files' names.
const USAGE_HEADER = 'player_id,player_name,position,position_group,season,week,season_type,team,opponent_team,completions,attempts,passing_yards,passing_tds,passing_interceptions,sacks_suffered,passing_air_yards,passing_yards_after_catch,passing_first_downs,passing_epa,passing_cpoe,pacr,carries,rushing_yards,rushing_tds,rushing_first_downs,rushing_epa,targets,receptions,receiving_yards,receiving_tds,receiving_air_yards,receiving_yards_after_catch,receiving_first_downs,receiving_epa,racr,target_share,air_yards_share,wopr,fantasy_points,fantasy_points_ppr';

function usageLine(over: Record<string, string>): string {
  const base: Record<string, string> = {
    player_id: '00-0036322', player_name: 'J.Jefferson', position: 'WR', position_group: 'WR',
    season: '2026', week: '2', season_type: 'REG', team: 'MIN', opponent_team: 'GB',
    completions: '0', attempts: '0', passing_yards: '0', passing_tds: '0', passing_interceptions: '0',
    sacks_suffered: '0', passing_air_yards: '0', passing_yards_after_catch: '0', passing_first_downs: '0',
    passing_epa: '', passing_cpoe: '', pacr: '',
    carries: '1', rushing_yards: '6', rushing_tds: '0', rushing_first_downs: '0', rushing_epa: '0.12345',
    targets: '11', receptions: '8', receiving_yards: '124', receiving_tds: '1', receiving_air_yards: '150',
    receiving_yards_after_catch: '40', receiving_first_downs: '6', receiving_epa: '5.6789012', racr: '0.826666',
    target_share: '0.3235294', air_yards_share: '0.4512', wopr: '0.80106', fantasy_points: '18.9', fantasy_points_ppr: '26.9',
  };
  return USAGE_HEADER.split(',').map((k) => over[k] ?? base[k] ?? '').join(',');
}

describe('readUsageRows', () => {
  const csv = [
    USAGE_HEADER,
    usageLine({}),
    usageLine({ week: '1', targets: '7' }),
    usageLine({ season_type: 'POST', week: '2' }),
    usageLine({ season: '2025', week: '2' }),
    usageLine({ player_id: '00-0099999', position: 'LB', position_group: 'LB' }),
  ].join('\n');

  it('keeps regular-season offense rows for the requested weeks and rounds the floats', () => {
    const rows = readUsageRows(csv, { seasonYear: 2026, weeks: [2] });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.gsisId).toBe('00-0036322');
    expect(row.week).toBe(2);
    expect(row.team).toBe('MIN');
    expect(row.opponent).toBe('GB');
    expect(row.targets).toBe(11);
    expect(row.targetShare).toBe(0.3235);
    expect(row.airYardsShare).toBe(0.4512);
    expect(row.wopr).toBe(0.8011);
    expect(row.racr).toBe(0.8267);
    expect(row.recEpa).toBe(5.679);
    expect(row.passEpa).toBeNull();
    expect(row.fantasyPointsPPR).toBe(26.9);
  });

  it('returns every regular-season week when no week filter is given', () => {
    const rows = readUsageRows(csv, { seasonYear: 2026 });
    expect(rows.map((r) => r.week).sort()).toEqual([1, 2]);
  });
});

describe('readPracticeRows', () => {
  const header = 'season,season_type,game_type,team,week,gsis_id,position,full_name,first_name,last_name,report_primary_injury,report_secondary_injury,report_status,practice_primary_injury,practice_secondary_injury,practice_status';
  const csv = [
    header,
    '2026,REG,REG,KC,3,00-0033873,QB,Patrick Mahomes,Patrick,Mahomes,Ankle,,Questionable,Ankle,,Limited Participation in Practice',
    '2026,REG,REG,KC,3,00-0033873,QB,Patrick Mahomes,Patrick,Mahomes,Ankle,,,Ankle,,Full Participation in Practice',
    '2026,REG,REG,ARI,1,00-0034381,LB,Josh Sweat,Josh,Sweat,,,,Not injury related - resting player,Knee,Full Participation in Practice',
    '2026,POST,POST,KC,3,00-0033873,QB,Patrick Mahomes,Patrick,Mahomes,,,,,,',
  ].join('\n');

  it('keeps one row per player-week, last row winning, with empty designations as null', () => {
    const rows = readPracticeRows(csv, { seasonYear: 2026, weeks: [3] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gsisId: '00-0033873',
      week: 3,
      team: 'KC',
      reportStatus: null,
      reportPrimaryInjury: 'Ankle',
      practiceStatus: 'Full Participation in Practice',
      practiceSecondaryInjury: null,
    });
  });
});

describe('readCrosswalkRows', () => {
  const header = 'season,team,position,depth_chart_position,jersey_number,status,full_name,gsis_id,espn_id,sleeper_id,week';
  const csv = [
    header,
    '2026,PIT,QB,QB,8,ACT,Aaron Rodgers,00-0023459,8439,96,1',
    '2026,PIT,QB,QB,8,ACT,Aaron Rodgers,00-0023459,8439,96,2',
    '2026,KC,WR,LWR,,ACT,Nobody Yet,00-0088888,,,2',
    '2025,KC,TE,TE,87,ACT,Travis Kelce,00-0030506,15847,1466,18',
  ].join('\n');

  it('yields one sleeper->gsis pair per player from the requested season, skipping rows without both ids', () => {
    const rows = readCrosswalkRows(csv, 2026);
    expect(rows).toEqual([{ sleeperId: '96', gsisId: '00-0023459', week: 2 }]);
  });
});

describe('readGameRows', () => {
  const header = 'game_id,season,game_type,week,away_team,home_team,espn,away_moneyline,home_moneyline,spread_line,total_line,roof,surface,temp,wind';
  const csv = [
    header,
    '2026_01_ATL_PIT,2026,REG,1,ATL,PIT,401772510,140,-165,3.5,44.5,outdoors,grass,68,7',
    '2026_01_DAL_PHI,2026,REG,1,DAL,PHI,,150,-180,7,47,outdoors,grass,,',
    '2026_19_KC_BUF,2026,WC,19,KC,BUF,401772999,120,-140,2.5,50,outdoors,grass,20,10',
    '2025_01_ATL_PIT,2025,REG,1,ATL,PIT,401671111,140,-165,3.5,44.5,dome,fieldturf,,',
  ].join('\n');

  it('keeps the season\'s regular-season games that carry an ESPN id', () => {
    const rows = readGameRows(csv, 2026);
    expect(rows).toEqual([{
      espnId: '401772510', seasonYear: 2026, week: 1,
      roof: 'outdoors', surface: 'grass', temp: 68, wind: 7,
      homeMoneyline: -165, awayMoneyline: 140, totalLine: 44.5,
    }]);
  });
});

describe('asset urls', () => {
  it('points at the nflverse-data release downloads', () => {
    expect(nflverseAssetUrl(nflverseAssets.playerWeekStats(2026)))
      .toBe('https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv');
    expect(nflverseAssets.games()).toBe('schedules/games.csv');
  });
});
