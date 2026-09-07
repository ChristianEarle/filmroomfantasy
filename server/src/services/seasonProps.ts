import { normalizePlayerName } from '../utils/playerNames';
import { calculateFantasyPoints, type ProjectedStats } from './projections';

/**
 * Season-long sportsbook player prop lines (season O/U totals) have no API
 * source — The Odds API only carries weekly game props — so these are
 * imported by hand (JSON or CSV pasted into the admin UI) via
 * POST /api/admin/sync-season-props. This module parses/validates that
 * input, matches rows to our nfl_players rows, and turns the resulting
 * lines into season fantasy-point projections.
 */

export const SEASON_PROP_STATS = [
  'pass_yds',
  'pass_tds',
  'rush_yds',
  'rush_tds',
  'rec_yds',
  'receptions',
  'rec_tds',
  'interceptions',
] as const;

export type SeasonPropStat = (typeof SEASON_PROP_STATS)[number];

const SEASON_PROP_STAT_SET: ReadonlySet<string> = new Set(SEASON_PROP_STATS);

/** CSV header (and equivalent JSON object keys) accepted by parseSeasonPropsInput. */
const CSV_COLUMNS = [
  'playerName',
  'team',
  'position',
  'market',
  'line',
  'overOdds',
  'underOdds',
  'book',
  'sourceUrl',
  'capturedAt',
] as const;

export interface SeasonPropRow {
  playerName: string;
  team: string | null;
  position: string | null;
  stat: SeasonPropStat;
  line: number;
  overPrice: number | null;
  underPrice: number | null;
  book: string;
  sourceUrl: string | null;
  capturedAt: string; // YYYY-MM-DD
}

export interface SeasonPropParseError {
  /** 1-based row number in the input (header excluded for CSV). */
  row: number;
  message: string;
}

export interface ParsedSeasonProps {
  rows: SeasonPropRow[];
  errors: SeasonPropParseError[];
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas, and "" escapes. */
function parseCsvTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/**
 * Maps a lowercased/trimmed CSV header cell to its canonical field name.
 * Lets hand-pasted CSVs use header spellings other than our exact field
 * names (e.g. exported from a spreadsheet with "Player"/"Odds Over"/"URL").
 */
const HEADER_ALIASES: Record<string, string> = {
  playername: 'playerName',
  player: 'playerName',
  name: 'playerName',
  team: 'team',
  position: 'position',
  pos: 'position',
  market: 'market',
  stat: 'market',
  line: 'line',
  overodds: 'overOdds',
  odds_over: 'overOdds',
  over: 'overOdds',
  underodds: 'underOdds',
  odds_under: 'underOdds',
  under: 'underOdds',
  book: 'book',
  sportsbook: 'book',
  sourceurl: 'sourceUrl',
  url: 'sourceUrl',
  source: 'sourceUrl',
  capturedat: 'capturedAt',
  date: 'capturedAt',
  captured: 'capturedAt',
};

const REQUIRED_CSV_FIELDS = ['playerName', 'market', 'line'] as const;

/** Resolve a raw CSV header cell to its canonical field name, or null if unrecognized. */
function canonicalizeHeader(rawHeader: string): string | null {
  return HEADER_ALIASES[rawHeader.trim().toLowerCase()] ?? null;
}

function coerceString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  // Strip thousands separators ("3,950.5") and a leading "+" ("+120", common
  // in American odds) before parsing, so hand-pasted numbers still coerce.
  const cleaned = String(value).trim().replace(/,/g, '').replace(/^\+/, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Validate + normalize one raw record (from CSV or JSON) into a SeasonPropRow,
 * or return a validation error message.
 */
function toSeasonPropRow(record: Record<string, unknown>): SeasonPropRow | { error: string } {
  const playerName = coerceString(record.playerName);
  if (!playerName) return { error: 'playerName is required' };

  const marketRaw = coerceString(record.market);
  if (!marketRaw) return { error: 'market is required' };
  if (!SEASON_PROP_STAT_SET.has(marketRaw)) {
    return { error: `market "${marketRaw}" is not one of: ${SEASON_PROP_STATS.join(', ')}` };
  }

  const line = coerceNumber(record.line);
  if (line == null) return { error: 'line must be numeric' };

  const book = coerceString(record.book);
  if (!book) return { error: 'book is required' };

  const overOddsRaw = record.overOdds;
  const underOddsRaw = record.underOdds;
  let overPrice: number | null = null;
  let underPrice: number | null = null;
  if (overOddsRaw != null && overOddsRaw !== '') {
    const parsed = coerceNumber(overOddsRaw);
    if (parsed == null) return { error: 'overOdds must be numeric' };
    overPrice = Math.round(parsed);
  }
  if (underOddsRaw != null && underOddsRaw !== '') {
    const parsed = coerceNumber(underOddsRaw);
    if (parsed == null) return { error: 'underOdds must be numeric' };
    underPrice = Math.round(parsed);
  }

  const capturedAt = coerceString(record.capturedAt) ?? todayDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) {
    return { error: 'capturedAt must be formatted YYYY-MM-DD' };
  }

  return {
    playerName,
    team: coerceString(record.team)?.toUpperCase() ?? null,
    position: coerceString(record.position)?.toUpperCase() ?? null,
    stat: marketRaw as SeasonPropStat,
    line,
    overPrice,
    underPrice,
    book,
    sourceUrl: coerceString(record.sourceUrl) ?? null,
    capturedAt,
  };
}

/**
 * Parse season prop input, either a JSON array of objects or CSV text with
 * header: playerName,team,position,market,line,overOdds,underOdds,book,sourceUrl,capturedAt
 * (market is the stat key; overOdds/underOdds are optional; capturedAt
 * defaults to today when omitted). Returns valid rows plus per-row errors —
 * a row that fails validation is skipped from `rows` and reported in `errors`.
 */
export function parseSeasonPropsInput(input: string | unknown[]): ParsedSeasonProps {
  const rows: SeasonPropRow[] = [];
  const errors: SeasonPropParseError[] = [];
  const records: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

  if (Array.isArray(input)) {
    input.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        records.push({ rowNum: idx + 1, data: item as Record<string, unknown> });
      } else {
        errors.push({ row: idx + 1, message: 'Row must be an object' });
      }
    });
  } else {
    const trimmed = input.trim();
    if (!trimmed) return { rows, errors };

    if (trimmed.startsWith('[')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        errors.push({ row: 0, message: 'Invalid JSON input' });
        return { rows, errors };
      }
      if (!Array.isArray(parsed)) {
        errors.push({ row: 0, message: 'JSON input must be an array' });
        return { rows, errors };
      }
      parsed.forEach((item, idx) => {
        if (item && typeof item === 'object') {
          records.push({ rowNum: idx + 1, data: item as Record<string, unknown> });
        } else {
          errors.push({ row: idx + 1, message: 'Row must be an object' });
        }
      });
    } else {
      const table = parseCsvTable(trimmed);
      if (table.length === 0) return { rows, errors };
      const header = table[0].map((h) => canonicalizeHeader(h) ?? h.trim());

      const missing = REQUIRED_CSV_FIELDS.filter((field) => !header.includes(field));
      if (missing.length > 0) {
        errors.push({ row: 0, message: `missing required column(s): ${missing.join(', ')}` });
        return { rows, errors };
      }

      for (let i = 1; i < table.length; i++) {
        const data: Record<string, unknown> = {};
        header.forEach((col, colIdx) => {
          data[col] = table[i][colIdx];
        });
        records.push({ rowNum: i, data });
      }
    }
  }

  for (const { rowNum, data } of records) {
    const result = toSeasonPropRow(data);
    if ('error' in result) {
      errors.push({ row: rowNum, message: result.error });
    } else {
      rows.push(result);
    }
  }

  return { rows, errors };
}

export interface MatchablePlayer {
  id: string;
  name: string;
  position: string | null;
  team: string | null;
}

export interface ResolvedSeasonPropRow extends SeasonPropRow {
  playerId: string;
}

export interface MatchSeasonPropsResult {
  matched: ResolvedSeasonPropRow[];
  unmatched: SeasonPropRow[];
}

/**
 * Resolve each row's player_id by normalized-name lookup against our
 * nfl_players table. When multiple players share a normalized name,
 * disambiguate first by position (if the row has one), then by team.
 * Rows that can't be resolved to exactly one player land in `unmatched`.
 */
export function matchSeasonPropsToPlayers(
  rows: SeasonPropRow[],
  players: MatchablePlayer[]
): MatchSeasonPropsResult {
  const byName = new Map<string, MatchablePlayer[]>();
  for (const p of players) {
    const key = normalizePlayerName(p.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }

  const matched: ResolvedSeasonPropRow[] = [];
  const unmatched: SeasonPropRow[] = [];

  for (const row of rows) {
    const candidates = byName.get(normalizePlayerName(row.playerName)) ?? [];
    let pool = candidates;

    if (pool.length > 1 && row.position) {
      const byPosition = pool.filter((p) => p.position === row.position);
      if (byPosition.length > 0) pool = byPosition;
    }
    if (pool.length > 1 && row.team) {
      const byTeam = pool.filter((p) => p.team === row.team);
      if (byTeam.length > 0) pool = byTeam;
    }

    if (pool.length === 1) {
      matched.push({ ...row, playerId: pool[0].id });
    } else {
      unmatched.push(row);
    }
  }

  return { matched, unmatched };
}

export interface SeasonProjectionStats {
  passYds: number;
  passTds: number;
  rushYds: number;
  rushTds: number;
  recYds: number;
  receptions: number;
  recTds: number;
  interceptions: number;
}

export interface SeasonProjection {
  ppr: number;
  halfPpr: number;
  standard: number;
  stats: SeasonProjectionStats;
  /** Number of distinct stat markets (pass_yds, rec_tds, etc.) that had at least one line. */
  marketsUsed: number;
  /** Distinct sportsbooks whose lines contributed to this projection. */
  books: string[];
  /**
   * Which stat markets actually had at least one season-prop line — as
   * opposed to `stats` above, which defaults every uncovered stat to 0.
   * Consumers (see marketRankings.ts's mergeSeasonStatVector) need this to
   * tell "no line, defaulted to 0" apart from "the line's value was 0".
   */
  presentStats: SeasonPropStat[];
}

const EMPTY_STAT_TOTALS: Record<SeasonPropStat, number> = {
  pass_yds: 0,
  pass_tds: 0,
  rush_yds: 0,
  rush_tds: 0,
  rec_yds: 0,
  receptions: 0,
  rec_tds: 0,
  interceptions: 0,
};

/**
 * Turn matched season prop rows into per-player season projections.
 *
 * For each player + stat, the LATEST capturedAt line per book is kept
 * (so re-imports that refresh a book's number replace the stale one
 * instead of double-counting it), then lines are averaged across books.
 * Averaged stats are run through the same calculateFantasyPoints formula
 * used for weekly prop-based projections. Missing stats default to 0.
 */
export function buildSeasonProjectionsFromSeasonProps(
  rows: ResolvedSeasonPropRow[]
): Map<string, SeasonProjection> {
  const byPlayer = new Map<string, ResolvedSeasonPropRow[]>();
  for (const row of rows) {
    if (!byPlayer.has(row.playerId)) byPlayer.set(row.playerId, []);
    byPlayer.get(row.playerId)!.push(row);
  }

  const result = new Map<string, SeasonProjection>();

  for (const [playerId, playerRows] of byPlayer) {
    // stat -> book -> latest row for that (stat, book) pair
    const byStat = new Map<SeasonPropStat, Map<string, ResolvedSeasonPropRow>>();
    for (const row of playerRows) {
      if (!byStat.has(row.stat)) byStat.set(row.stat, new Map());
      const byBook = byStat.get(row.stat)!;
      const existing = byBook.get(row.book);
      if (!existing || row.capturedAt > existing.capturedAt) {
        byBook.set(row.book, row);
      }
    }

    const statTotals: Record<SeasonPropStat, number> = { ...EMPTY_STAT_TOTALS };
    let marketsUsed = 0;
    const booksUsed = new Set<string>();

    for (const [stat, byBook] of byStat) {
      const latestLines = Array.from(byBook.values());
      if (latestLines.length === 0) continue;
      const avg = latestLines.reduce((sum, r) => sum + r.line, 0) / latestLines.length;
      statTotals[stat] = avg;
      marketsUsed++;
      for (const r of latestLines) booksUsed.add(r.book);
    }

    const projectedStats: ProjectedStats = {
      projPassYards: statTotals.pass_yds,
      projPassTDs: statTotals.pass_tds,
      projRushYards: statTotals.rush_yds,
      projRushTDs: statTotals.rush_tds,
      projReceptions: statTotals.receptions,
      projRecYards: statTotals.rec_yds,
      projRecTDs: statTotals.rec_tds,
      interceptions: statTotals.interceptions,
    };

    result.set(playerId, {
      ppr: calculateFantasyPoints(projectedStats, 'ppr'),
      halfPpr: calculateFantasyPoints(projectedStats, 'half-ppr'),
      standard: calculateFantasyPoints(projectedStats, 'standard'),
      stats: {
        passYds: statTotals.pass_yds,
        passTds: statTotals.pass_tds,
        rushYds: statTotals.rush_yds,
        rushTds: statTotals.rush_tds,
        recYds: statTotals.rec_yds,
        receptions: statTotals.receptions,
        recTds: statTotals.rec_tds,
        interceptions: statTotals.interceptions,
      },
      marketsUsed,
      books: Array.from(booksUsed).sort(),
      presentStats: Array.from(byStat.keys()),
    });
  }

  return result;
}

export { CSV_COLUMNS };
