import { and, eq, inArray, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { chunkedInArrayFetch, DEFAULT_ID_CHUNK } from '../utils/chunked';
import { rowChanged } from '../utils/rowDiff';
import { fetchCurrentOddsWithUsage, parseOddsResponse } from './odds';
import type { OddsApiUsage, ParsedOdds } from './odds';

type DB = ReturnType<typeof drizzle<typeof schema>>;

/** provider_state row that tracks The Odds API's credits. */
export const ODDS_API_PROVIDER = 'odds_api';

// Readers show one line per game and market, so three major books cover them.
const GAME_ODDS_BOOKMAKERS = ['draftkings', 'fanduel', 'betmgm'] as const;
const GAME_ODDS_MARKETS = ['spreads', 'totals', 'h2h'];
// Flexed and late-season Saturday games move a kickoff by up to about a day
// from the stored schedule.
const GAME_ODDS_MAX_KICKOFF_GAP_MS = 36 * 60 * 60 * 1000;
const GAME_ODDS_LINE_KEYS = [
  'homePoint', 'awayPoint', 'homePrice', 'awayPrice',
  'overPoint', 'underPoint', 'overPrice', 'underPrice',
] as const;
const INSERT_BATCH_SIZE = 50;

type GameLine = Record<(typeof GAME_ODDS_LINE_KEYS)[number], number | null>;
type StoredGameLine = { gameId: string; bookmaker: string; market: string } & GameLine;

// D1 bills every row a query scans, so the newest-line lookup reads only
// recent snapshots. A line unchanged for longer than this is written again
// once per window.
const GAME_ODDS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

interface SeasonGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  week: number;
  seasonYear: number;
  gameTime: Date;
}

interface MatchedOdds {
  odds: ParsedOdds;
  game: SeasonGame;
}

export interface GameOddsSyncOptions {
  apiKey: string;
  season: number;
  week?: number;
  now?: number;
  signal?: AbortSignal;
}

export interface GameOddsSyncResult {
  inserted: number;
  unchanged: number;
  skipped: number;
  total: number;
  usage: OddsApiUsage | null;
}

const lineKey = (gameId: string, bookmaker: string, market: string) => `${gameId}|${bookmaker}|${market}`;

function lineOf(odds: ParsedOdds): GameLine {
  return {
    homePoint: odds.home_point ?? null,
    awayPoint: odds.away_point ?? null,
    homePrice: odds.home_price ?? null,
    awayPrice: odds.away_price ?? null,
    overPoint: odds.over_point ?? null,
    underPoint: odds.under_point ?? null,
    overPrice: odds.over_price ?? null,
    underPrice: odds.under_price ?? null,
  };
}

/**
 * Newest stored line per (game, book, market) for the given games, keyed
 * `gameId|bookmaker|market`. game_odds keeps every earlier snapshot, so the
 * window function keeps the rows returned to one per key.
 */
async function latestGameOdds(db: DB, gameIds: string[], now: number): Promise<Map<string, StoredGameLine>> {
  const since = new Date(now - GAME_ODDS_LOOKBACK_MS).toISOString();
  const rows = await chunkedInArrayFetch(gameIds, DEFAULT_ID_CHUNK, (chunk) =>
    db.all<StoredGameLine>(sql`
      SELECT game_id AS gameId, bookmaker, market,
             home_point AS homePoint, away_point AS awayPoint, home_price AS homePrice, away_price AS awayPrice,
             over_point AS overPoint, under_point AS underPoint, over_price AS overPrice, under_price AS underPrice
      FROM (
        SELECT game_odds.*, ROW_NUMBER() OVER (
          PARTITION BY game_id, bookmaker, market ORDER BY snapshot_time DESC
        ) AS rn
        FROM game_odds
        WHERE ${inArray(schema.gameOdds.gameId, chunk)}
          AND ${inArray(schema.gameOdds.bookmaker, [...GAME_ODDS_BOOKMAKERS])}
          AND ${inArray(schema.gameOdds.market, GAME_ODDS_MARKETS)}
          AND ${schema.gameOdds.snapshotTime} >= ${since}
      )
      WHERE rn = 1
    `)
  );
  return new Map(rows.map((row) => [lineKey(row.gameId, row.bookmaker, row.market), row]));
}

/** The season's regular-season games, keyed by `AWAY_HOME` pairing. */
async function seasonGamesByPair(db: DB, season: number): Promise<Map<string, SeasonGame[]>> {
  const games = await db.query.nflGames.findMany({
    where: and(eq(schema.nflGames.seasonYear, season), eq(schema.nflGames.seasonType, 'regular')),
    columns: { id: true, homeTeam: true, awayTeam: true, week: true, seasonYear: true, gameTime: true },
  });
  const byPair = new Map<string, SeasonGame[]>();
  for (const game of games) {
    const pair = `${game.awayTeam}_${game.homeTeam}`;
    byPair.set(pair, [...(byPair.get(pair) ?? []), game]);
  }
  return byPair;
}

/** The pairing's game whose kickoff is closest to the event's, if close enough to be the same game. */
function matchGame(gamesByPair: Map<string, SeasonGame[]>, pair: string, commenceTime: string): SeasonGame | undefined {
  const kickoff = Date.parse(commenceTime);
  let best: SeasonGame | undefined;
  let bestGap = Infinity;
  for (const game of gamesByPair.get(pair) ?? []) {
    const gap = Math.abs(game.gameTime.getTime() - kickoff);
    if (gap < bestGap) {
      best = game;
      bestGap = gap;
    }
  }
  return bestGap <= GAME_ODDS_MAX_KICKOFF_GAP_MS ? best : undefined;
}

async function insertLines(db: DB, lines: MatchedOdds[], now: number): Promise<void> {
  const inserts = lines.map(({ odds, game }) =>
    db.insert(schema.gameOdds).values({
      id: odds.id,
      gameId: game.id,
      sportKey: odds.sport_key,
      homeTeam: odds.home_team,
      awayTeam: odds.away_team,
      commenceTime: odds.commence_time,
      bookmaker: odds.bookmaker,
      market: odds.market,
      ...lineOf(odds),
      snapshotTime: odds.snapshot_time,
      season: game.seasonYear,
      week: game.week,
      createdAt: new Date(now),
    }).onConflictDoNothing()
  );
  for (let i = 0; i < inserts.length; i += INSERT_BATCH_SIZE) {
    const [first, ...rest] = inserts.slice(i, i + INSERT_BATCH_SIZE);
    await db.batch([first, ...rest]);
  }
}

async function recordUsage(db: DB, usage: OddsApiUsage, now: number): Promise<void> {
  const values = { quotaUsed: usage.used, quotaRemaining: usage.remaining, lastCost: usage.last, observedAt: now };
  try {
    await db.insert(schema.providerState).values({ provider: ODDS_API_PROVIDER, ...values })
      .onConflictDoUpdate({ target: schema.providerState.provider, set: values });
  } catch (err) {
    // The credits are already spent; failing to record them must not cost the sync its odds.
    console.error('[odds] recording Odds API usage failed:', err);
  }
}

/**
 * Fetches current NFL odds from The Odds API and appends a game_odds row for
 * each (game, bookmaker, market) whose line changed since its latest row,
 * then records the credit counters the response reported in provider_state.
 */
export async function syncGameOdds(
  db: DB,
  { apiKey, season, week, now = Date.now(), signal }: GameOddsSyncOptions,
): Promise<GameOddsSyncResult> {
  const { games, usage } = await fetchCurrentOddsWithUsage(apiKey, GAME_ODDS_BOOKMAKERS, { signal });
  if (usage) await recordUsage(db, usage, now);
  const parsed = parseOddsResponse(games, week, new Date(now).toISOString(), season);

  // Week and season come from the matched game row, not the odds payload.
  // A team pairing repeats across seasons, so matching is limited to this
  // season's regular-season games and to a game whose kickoff is close to
  // the event's.
  const gamesByPair = await seasonGamesByPair(db, season);
  const matched: MatchedOdds[] = [];
  let skipped = 0;
  for (const odds of parsed) {
    // After kickoff the feed carries live in-game lines, not the game's line.
    const game = Date.parse(odds.commence_time) > now ? matchGame(gamesByPair, odds.game_id, odds.commence_time) : undefined;
    if (game) matched.push({ odds, game });
    else skipped++;
  }

  const latest = await latestGameOdds(db, [...new Set(matched.map(({ game }) => game.id))], now);
  const changed = matched.filter(({ odds, game }) =>
    rowChanged(latest.get(lineKey(game.id, odds.bookmaker, odds.market)), lineOf(odds), GAME_ODDS_LINE_KEYS));
  await insertLines(db, changed, now);

  return { inserted: changed.length, unchanged: matched.length - changed.length, skipped, total: parsed.length, usage };
}
