/**
 * nflverse ingest: the free, community-maintained NFL data releases at
 * https://github.com/nflverse/nflverse-data/releases. Four CSVs are used:
 *
 *   stats_player/stats_player_week_{season}.csv  per-player-week usage and
 *       efficiency (target share, air-yards share, WOPR, RACR, EPA, ...)
 *   injuries/injuries_{season}.csv               the official practice report
 *       and game-status designation per player-week
 *   weekly_rosters/roster_weekly_{season}.csv    the id crosswalk (sleeper_id
 *       -> gsis_id) that joins nflverse rows to nfl_players
 *   schedules/games.csv                           roof/surface/temp/wind and
 *       moneylines per game, keyed to nfl_games by ESPN event id
 *
 * The files are keyed on the NFL GSIS id, so the crosswalk runs first and
 * fills nfl_players.gsis_id; usage and practice rows for players without a
 * gsis id are counted as unmatched and skipped.
 *
 * Every writer here compares against the stored row and skips identical
 * ones (see utils/rowDiff.ts) so the 4-hourly cron only spends D1 writes on
 * data that changed. The CSVs are parsed with a streaming row callback and
 * filtered by week before any row object is built: the full-season stats
 * file grows to ~9 MB by week 18 and a Worker has 128 MB.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';
import { rowChanged } from '../utils/rowDiff';

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const NFLVERSE_RELEASE_BASE = 'https://github.com/nflverse/nflverse-data/releases/download';

export function nflverseAssetUrl(asset: string): string {
  return `${NFLVERSE_RELEASE_BASE}/${asset}`;
}

export const nflverseAssets = {
  playerWeekStats: (season: number) => `stats_player/stats_player_week_${season}.csv`,
  injuries: (season: number) => `injuries/injuries_${season}.csv`,
  weeklyRosters: (season: number) => `weekly_rosters/roster_weekly_${season}.csv`,
  games: () => 'schedules/games.csv',
};

/** Fetch a release CSV as text. Throws on a non-2xx so the caller can report it. */
export async function fetchNflverseCsv(asset: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(nflverseAssetUrl(asset), {
    headers: { Accept: 'text/csv', 'User-Agent': 'filmroomfantasy-sync' },
  });
  if (!res.ok) {
    throw new Error(`nflverse ${asset}: HTTP ${res.status}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * RFC 4180 parser with a per-row callback. Handles quoted cells, doubled
 * quotes inside them, embedded newlines, and CRLF line endings. Returns the
 * header row; `onRow` gets every data row's cells in header order plus the
 * header itself. Blank lines are skipped; a row's trailing empty cells are
 * kept so indexes stay aligned.
 */
export function parseCsv(text: string, onRow: (cells: string[], header: string[]) => void): string[] {
  let header: string[] | null = null;
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  const len = text.length;

  const endRow = () => {
    cells.push(cell);
    cell = '';
    if (!header) {
      header = cells;
    } else if (cells.length > 1 || cells[0] !== '') {
      onRow(cells, header);
    }
    cells = [];
  };

  for (let i = 0; i < len; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n') {
      endRow();
    } else if (ch === '\r') {
      // Part of CRLF (or a bare CR): treat as the row end, skip the LF.
      if (text[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || cells.length > 0) endRow();
  return header ?? [];
}

/** Column lookup by header name; missing columns resolve to ''. */
export function columnReader(header: string[]): (cells: string[], name: string) => string {
  const index = new Map(header.map((name, i) => [name, i]));
  return (cells, name) => {
    const i = index.get(name);
    return i === undefined ? '' : (cells[i] ?? '');
  };
}

export function csvNumber(value: string): number | null {
  if (value === '' || value === 'NA') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function csvInt(value: string): number | null {
  const n = csvNumber(value);
  return n == null ? null : Math.round(n);
}

export function csvText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'NA' ? null : trimmed;
}

/** Round a float column to a stable precision so a re-download compares equal. */
function round(value: number | null, places: number): number | null {
  if (value == null) return null;
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

export interface UsageRow {
  gsisId: string;
  seasonYear: number;
  week: number;
  team: string | null;
  opponent: string | null;
  completions: number | null;
  passAttempts: number | null;
  passYards: number | null;
  passTDs: number | null;
  passInterceptions: number | null;
  sacksSuffered: number | null;
  passAirYards: number | null;
  passYardsAfterCatch: number | null;
  passFirstDowns: number | null;
  passEpa: number | null;
  passCpoe: number | null;
  pacr: number | null;
  carries: number | null;
  rushYards: number | null;
  rushTDs: number | null;
  rushFirstDowns: number | null;
  rushEpa: number | null;
  targets: number | null;
  receptions: number | null;
  recYards: number | null;
  recTDs: number | null;
  recAirYards: number | null;
  recYardsAfterCatch: number | null;
  recFirstDowns: number | null;
  recEpa: number | null;
  racr: number | null;
  targetShare: number | null;
  airYardsShare: number | null;
  wopr: number | null;
  fantasyPoints: number | null;
  fantasyPointsPPR: number | null;
}

export const USAGE_COMPARE_KEYS = [
  'team', 'opponent',
  'completions', 'passAttempts', 'passYards', 'passTDs', 'passInterceptions', 'sacksSuffered',
  'passAirYards', 'passYardsAfterCatch', 'passFirstDowns', 'passEpa', 'passCpoe', 'pacr',
  'carries', 'rushYards', 'rushTDs', 'rushFirstDowns', 'rushEpa',
  'targets', 'receptions', 'recYards', 'recTDs', 'recAirYards', 'recYardsAfterCatch', 'recFirstDowns',
  'recEpa', 'racr', 'targetShare', 'airYardsShare', 'wopr',
  'fantasyPoints', 'fantasyPointsPPR',
] as const;

export interface WeekFilter {
  seasonYear: number;
  /** Regular-season weeks to keep; every week when omitted. */
  weeks?: readonly number[];
}

/**
 * Parse stats_player_week_{season}.csv down to the regular-season rows for
 * the requested weeks. Offense-only: defensive players and specialists
 * have nothing fantasy views read here and would triple the row count.
 */
export function readUsageRows(csv: string, filter: WeekFilter): UsageRow[] {
  const weeks = filter.weeks ? new Set(filter.weeks) : null;
  const rows: UsageRow[] = [];
  let get: ReturnType<typeof columnReader> | null = null;

  parseCsv(csv, (cells, header) => {
    if (!get) get = columnReader(header);
    const g = get;
    if (g(cells, 'season_type') !== 'REG') return;
    const seasonYear = csvInt(g(cells, 'season'));
    const week = csvInt(g(cells, 'week'));
    if (seasonYear !== filter.seasonYear || week == null) return;
    if (weeks && !weeks.has(week)) return;
    const gsisId = g(cells, 'player_id');
    if (!gsisId) return;
    const positionGroup = g(cells, 'position_group');
    if (!OFFENSE_POSITION_GROUPS.has(positionGroup)) return;

    rows.push({
      gsisId,
      seasonYear,
      week,
      team: csvText(g(cells, 'team')),
      opponent: csvText(g(cells, 'opponent_team')),
      completions: csvInt(g(cells, 'completions')),
      passAttempts: csvInt(g(cells, 'attempts')),
      passYards: csvNumber(g(cells, 'passing_yards')),
      passTDs: csvInt(g(cells, 'passing_tds')),
      passInterceptions: csvInt(g(cells, 'passing_interceptions')),
      sacksSuffered: csvInt(g(cells, 'sacks_suffered')),
      passAirYards: csvNumber(g(cells, 'passing_air_yards')),
      passYardsAfterCatch: csvNumber(g(cells, 'passing_yards_after_catch')),
      passFirstDowns: csvInt(g(cells, 'passing_first_downs')),
      passEpa: round(csvNumber(g(cells, 'passing_epa')), 3),
      passCpoe: round(csvNumber(g(cells, 'passing_cpoe')), 3),
      pacr: round(csvNumber(g(cells, 'pacr')), 4),
      carries: csvInt(g(cells, 'carries')),
      rushYards: csvNumber(g(cells, 'rushing_yards')),
      rushTDs: csvInt(g(cells, 'rushing_tds')),
      rushFirstDowns: csvInt(g(cells, 'rushing_first_downs')),
      rushEpa: round(csvNumber(g(cells, 'rushing_epa')), 3),
      targets: csvInt(g(cells, 'targets')),
      receptions: csvInt(g(cells, 'receptions')),
      recYards: csvNumber(g(cells, 'receiving_yards')),
      recTDs: csvInt(g(cells, 'receiving_tds')),
      recAirYards: csvNumber(g(cells, 'receiving_air_yards')),
      recYardsAfterCatch: csvNumber(g(cells, 'receiving_yards_after_catch')),
      recFirstDowns: csvInt(g(cells, 'receiving_first_downs')),
      recEpa: round(csvNumber(g(cells, 'receiving_epa')), 3),
      racr: round(csvNumber(g(cells, 'racr')), 4),
      targetShare: round(csvNumber(g(cells, 'target_share')), 4),
      airYardsShare: round(csvNumber(g(cells, 'air_yards_share')), 4),
      wopr: round(csvNumber(g(cells, 'wopr')), 4),
      fantasyPoints: round(csvNumber(g(cells, 'fantasy_points')), 2),
      fantasyPointsPPR: round(csvNumber(g(cells, 'fantasy_points_ppr')), 2),
    });
  });
  return rows;
}

const OFFENSE_POSITION_GROUPS = new Set(['QB', 'RB', 'WR', 'TE', 'SPEC']);

export interface PracticeRow {
  gsisId: string;
  seasonYear: number;
  week: number;
  team: string | null;
  reportStatus: string | null;
  reportPrimaryInjury: string | null;
  reportSecondaryInjury: string | null;
  practiceStatus: string | null;
  practicePrimaryInjury: string | null;
  practiceSecondaryInjury: string | null;
}

export const PRACTICE_COMPARE_KEYS = [
  'team', 'reportStatus', 'reportPrimaryInjury', 'reportSecondaryInjury',
  'practiceStatus', 'practicePrimaryInjury', 'practiceSecondaryInjury',
] as const;

/** Parse injuries_{season}.csv to one row per player-week (the last row wins on duplicates). */
export function readPracticeRows(csv: string, filter: WeekFilter): PracticeRow[] {
  const weeks = filter.weeks ? new Set(filter.weeks) : null;
  const byKey = new Map<string, PracticeRow>();
  let get: ReturnType<typeof columnReader> | null = null;

  parseCsv(csv, (cells, header) => {
    if (!get) get = columnReader(header);
    const g = get;
    if (g(cells, 'season_type') !== 'REG') return;
    const seasonYear = csvInt(g(cells, 'season'));
    const week = csvInt(g(cells, 'week'));
    if (seasonYear !== filter.seasonYear || week == null) return;
    if (weeks && !weeks.has(week)) return;
    const gsisId = g(cells, 'gsis_id');
    if (!gsisId) return;
    byKey.set(`${gsisId}:${week}`, {
      gsisId,
      seasonYear,
      week,
      team: csvText(g(cells, 'team')),
      reportStatus: csvText(g(cells, 'report_status')),
      reportPrimaryInjury: csvText(g(cells, 'report_primary_injury')),
      reportSecondaryInjury: csvText(g(cells, 'report_secondary_injury')),
      practiceStatus: csvText(g(cells, 'practice_status')),
      practicePrimaryInjury: csvText(g(cells, 'practice_primary_injury')),
      practiceSecondaryInjury: csvText(g(cells, 'practice_secondary_injury')),
    });
  });
  return Array.from(byKey.values());
}

export interface CrosswalkRow {
  sleeperId: string;
  gsisId: string;
  week: number;
}

/**
 * Parse roster_weekly_{season}.csv down to one sleeper_id -> gsis_id pair
 * per player, keeping the most recent week's row. Players without a
 * sleeper id (practice squad, long snappers) are skipped.
 */
export function readCrosswalkRows(csv: string, seasonYear: number): CrosswalkRow[] {
  const bySleeper = new Map<string, CrosswalkRow>();
  let get: ReturnType<typeof columnReader> | null = null;

  parseCsv(csv, (cells, header) => {
    if (!get) get = columnReader(header);
    const g = get;
    if (csvInt(g(cells, 'season')) !== seasonYear) return;
    const sleeperId = csvText(g(cells, 'sleeper_id'));
    const gsisId = csvText(g(cells, 'gsis_id'));
    const week = csvInt(g(cells, 'week')) ?? 0;
    if (!sleeperId || !gsisId) return;
    const prev = bySleeper.get(sleeperId);
    if (!prev || prev.week <= week) bySleeper.set(sleeperId, { sleeperId, gsisId, week });
  });
  return Array.from(bySleeper.values());
}

export interface GameEnrichRow {
  espnId: string;
  seasonYear: number;
  week: number;
  roof: string | null;
  surface: string | null;
  temp: number | null;
  wind: number | null;
  homeMoneyline: number | null;
  awayMoneyline: number | null;
  totalLine: number | null;
}

export const GAME_ENRICH_KEYS = ['roof', 'surface', 'temp', 'wind', 'homeMoneyline', 'awayMoneyline'] as const;

/** Parse games.csv (all seasons) down to one season's regular-season rows that carry an ESPN id. */
export function readGameRows(csv: string, seasonYear: number): GameEnrichRow[] {
  const rows: GameEnrichRow[] = [];
  let get: ReturnType<typeof columnReader> | null = null;

  parseCsv(csv, (cells, header) => {
    if (!get) get = columnReader(header);
    const g = get;
    if (csvInt(g(cells, 'season')) !== seasonYear) return;
    if (g(cells, 'game_type') !== 'REG') return;
    const espnId = csvText(g(cells, 'espn'));
    const week = csvInt(g(cells, 'week'));
    if (!espnId || week == null) return;
    rows.push({
      espnId,
      seasonYear,
      week,
      roof: csvText(g(cells, 'roof')),
      surface: csvText(g(cells, 'surface')),
      temp: csvInt(g(cells, 'temp')),
      wind: csvInt(g(cells, 'wind')),
      homeMoneyline: csvInt(g(cells, 'home_moneyline')),
      awayMoneyline: csvInt(g(cells, 'away_moneyline')),
      totalLine: csvNumber(g(cells, 'total_line')),
    });
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Writers (compare-before-write, batched 50 statements per db.batch)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;

async function runBatches(db: DB, statements: unknown[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    // db.batch needs a non-empty tuple; chunks are never empty here.
    await db.batch(chunk as [any, ...any[]]);
  }
}

export interface CrosswalkResult {
  updated: number;
  unchanged: number;
  /** Sleeper ids in the roster file that are not in nfl_players (non-fantasy positions, mostly). */
  unmatched: number;
}

/** Stamp gsis ids on nfl_players by Sleeper id. Only rows whose stored id differs are written. */
export async function applyGsisCrosswalk(db: DB, pairs: readonly CrosswalkRow[]): Promise<CrosswalkResult> {
  const players = await db.query.nflPlayers.findMany({
    columns: { id: true, externalId: true, gsisId: true },
  });
  const bySleeper = new Map(players.filter((p) => p.externalId).map((p) => [p.externalId as string, p]));

  const statements: unknown[] = [];
  let unchanged = 0;
  let unmatched = 0;
  for (const pair of pairs) {
    const player = bySleeper.get(pair.sleeperId);
    if (!player) {
      unmatched++;
      continue;
    }
    if (player.gsisId === pair.gsisId) {
      unchanged++;
      continue;
    }
    statements.push(db.update(schema.nflPlayers).set({ gsisId: pair.gsisId }).where(eq(schema.nflPlayers.id, player.id)));
  }
  await runBatches(db, statements);
  return { updated: statements.length, unchanged, unmatched };
}

/** Map gsis id -> nfl_players.id for every player that has one. */
export async function loadPlayerIdsByGsis(db: DB): Promise<Map<string, string>> {
  const players = await db.query.nflPlayers.findMany({
    columns: { id: true, gsisId: true },
  });
  const map = new Map<string, string>();
  for (const p of players) {
    if (p.gsisId) map.set(p.gsisId, p.id);
  }
  return map;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
  /** Rows whose gsis id has no nfl_players match (run the crosswalk first). */
  unmatched: number;
}

function weeksOf(rows: readonly { week: number }[]): number[] {
  return Array.from(new Set(rows.map((r) => r.week)));
}

export async function upsertUsageRows(
  db: DB,
  rows: readonly UsageRow[],
  playerIdByGsis: ReadonlyMap<string, string>,
  seasonYear: number,
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0, unmatched: 0 };
  if (rows.length === 0) return result;

  const stored = await db.query.playerUsageWeekly.findMany({
    where: and(eq(schema.playerUsageWeekly.seasonYear, seasonYear), inArray(schema.playerUsageWeekly.week, weeksOf(rows))),
  });
  const storedByKey = new Map(stored.map((r) => [`${r.playerId}:${r.week}`, r]));

  const now = new Date();
  const statements: unknown[] = [];
  for (const row of rows) {
    const playerId = playerIdByGsis.get(row.gsisId);
    if (!playerId) {
      result.unmatched++;
      continue;
    }
    const existing = storedByKey.get(`${playerId}:${row.week}`);
    if (existing) {
      if (!rowChanged(existing as Record<string, unknown>, row as unknown as Record<string, unknown>, USAGE_COMPARE_KEYS)) {
        result.unchanged++;
        continue;
      }
      statements.push(
        db.update(schema.playerUsageWeekly).set({ ...row, playerId, updatedAt: now }).where(eq(schema.playerUsageWeekly.id, existing.id)),
      );
      result.updated++;
    } else {
      statements.push(db.insert(schema.playerUsageWeekly).values({ id: generateId(), playerId, ...row, updatedAt: now }));
      result.inserted++;
    }
  }
  await runBatches(db, statements);
  return result;
}

export async function upsertPracticeRows(
  db: DB,
  rows: readonly PracticeRow[],
  playerIdByGsis: ReadonlyMap<string, string>,
  seasonYear: number,
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0, unmatched: 0 };
  if (rows.length === 0) return result;

  const stored = await db.query.playerPracticeReports.findMany({
    where: and(eq(schema.playerPracticeReports.seasonYear, seasonYear), inArray(schema.playerPracticeReports.week, weeksOf(rows))),
  });
  const storedByKey = new Map(stored.map((r) => [`${r.playerId}:${r.week}`, r]));

  const now = new Date();
  const statements: unknown[] = [];
  for (const row of rows) {
    const playerId = playerIdByGsis.get(row.gsisId);
    if (!playerId) {
      result.unmatched++;
      continue;
    }
    const existing = storedByKey.get(`${playerId}:${row.week}`);
    if (existing) {
      if (!rowChanged(existing as Record<string, unknown>, row as unknown as Record<string, unknown>, PRACTICE_COMPARE_KEYS)) {
        result.unchanged++;
        continue;
      }
      statements.push(
        db.update(schema.playerPracticeReports).set({ ...row, playerId, updatedAt: now }).where(eq(schema.playerPracticeReports.id, existing.id)),
      );
      result.updated++;
    } else {
      statements.push(db.insert(schema.playerPracticeReports).values({ id: generateId(), playerId, ...row, updatedAt: now }));
      result.inserted++;
    }
  }
  await runBatches(db, statements);
  return result;
}

export interface GameEnrichResult {
  updated: number;
  unchanged: number;
  /** ESPN ids in the schedule file with no nfl_games row (weeks sync-games has not stored yet). */
  unmatched: number;
}

/**
 * Fill roof/surface/temp/wind and the moneylines on nfl_games. The ESPN
 * spread and total stay authoritative; the nflverse total only fills a
 * missing over/under.
 */
export async function enrichGames(db: DB, rows: readonly GameEnrichRow[], seasonYear: number): Promise<GameEnrichResult> {
  const result: GameEnrichResult = { updated: 0, unchanged: 0, unmatched: 0 };
  if (rows.length === 0) return result;

  const stored = await db.query.nflGames.findMany({
    where: eq(schema.nflGames.seasonYear, seasonYear),
  });
  const storedById = new Map(stored.map((g) => [g.id, g]));

  const statements: unknown[] = [];
  for (const row of rows) {
    const game = storedById.get(row.espnId);
    if (!game) {
      result.unmatched++;
      continue;
    }
    const patch: Record<string, unknown> = {
      roof: row.roof,
      surface: row.surface,
      temp: row.temp,
      wind: row.wind,
      homeMoneyline: row.homeMoneyline,
      awayMoneyline: row.awayMoneyline,
    };
    const keys: string[] = [...GAME_ENRICH_KEYS];
    if (game.overUnder == null && row.totalLine != null) {
      patch.overUnder = row.totalLine;
      keys.push('overUnder');
    }
    if (!rowChanged(game as Record<string, unknown>, patch, keys)) {
      result.unchanged++;
      continue;
    }
    statements.push(db.update(schema.nflGames).set(patch).where(eq(schema.nflGames.id, game.id)));
    result.updated++;
  }
  await runBatches(db, statements);
  return result;
}
