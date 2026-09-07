/**
 * Compact "player card" data assembly shared by GET /players/:id/analysis and
 * the Ask AI v2 tool-calling path (lookup_player / mentioned-player context).
 *
 * Extracted from the per-player prompt assembly that used to live inline in
 * routes/players.ts's :id/analysis handler. `buildPlayerCards` batches every
 * read across N players (chunked `inArray` <=50) so multi-player lookups
 * (Ask AI mentions, search_players results) never N+1 — a single call here
 * replaces what would otherwise be 6+ queries per player.
 *
 * The returned object is intentionally compact (~300 tokens as JSON) — it is
 * built to be dropped straight into an Anthropic message as a `Context:`
 * JSON block or a tool_result.
 */
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';

export interface PlayerCardNews {
  headline: string;
  impact: string | null;
  ageHours: number | null;
}

export interface PlayerCardSeason {
  games: number;
  points: number;
  ppg: number;
  totals: {
    passYards: number;
    passTDs: number;
    rushYards: number;
    rushTDs: number;
    receptions: number;
    receivingYards: number;
    receivingTDs: number;
    targets: number;
  };
}

export interface PlayerCardWeek {
  proj: number | null;
  opponent: string | null;
  home: boolean | null;
  spread: number | null;
  total: number | null;
  impliedTotal: number | null;
  kickoff: string | null;
}

export interface PlayerCardMarket {
  seasonPoints: number | null;
  rosPoints: number | null;
  marketRank: number | null;
  confidence: string | null;
}

export interface PlayerCardDraft {
  overallRank: number | null;
  tier: number | null;
  adp: number | null;
}

export interface PlayerCard {
  id: string;
  name: string;
  position: string;
  team: string;
  status: string;
  injury: string | null;
  depthChartOrder: number | null;
  byeWeek: number | null;
  age: number | null;
  yearsExp: number | null;
  season: PlayerCardSeason | null;
  last3: { week: number; opp: string | null; pts: number }[];
  thisWeek: PlayerCardWeek | null;
  market: PlayerCardMarket | null;
  draft: PlayerCardDraft | null;
  news: PlayerCardNews[];
  aiTake: string | null;
}

export interface PlayerCardOptions {
  season: number;
  week: number;
  scoringFormat?: 'ppr' | 'half-ppr' | 'standard';
}

type DrizzleD1 = ReturnType<typeof import('drizzle-orm/d1').drizzle<typeof schema>>;

const CHUNK = 50;

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Run an inArray-keyed query across every chunk of `ids` and flatten the results. */
async function batched<T>(ids: string[], run: (chunkIds: string[]) => Promise<T[]>): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks = chunk(ids);
  const results = await Promise.all(chunks.map(run));
  return results.flat();
}

/**
 * Build compact player cards for every id in `playerIds`, in one batched
 * round of queries (never N+1 per player). Order of the returned array
 * matches the order players are found, not the input order — callers that
 * need lookup-by-id should build a Map from the result.
 */
export async function buildPlayerCards(
  db: DrizzleD1,
  playerIds: string[],
  opts: PlayerCardOptions,
): Promise<PlayerCard[]> {
  const ids = [...new Set(playerIds)];
  if (ids.length === 0) return [];

  const { season, week } = opts;
  const scoringFormat = opts.scoringFormat ?? 'ppr';

  const [players, allSeasonStats, weekProjections, newsRows, marketRows, draftRows, aiRows] = await Promise.all([
    batched(ids, (c) => db.query.nflPlayers.findMany({ where: inArray(schema.nflPlayers.id, c) })),
    batched(ids, (c) =>
      db.query.playerWeeklyStats.findMany({
        where: and(inArray(schema.playerWeeklyStats.playerId, c), eq(schema.playerWeeklyStats.seasonYear, season)),
        orderBy: asc(schema.playerWeeklyStats.week),
      }),
    ),
    batched(ids, (c) =>
      db.query.playerProjections.findMany({
        where: and(
          inArray(schema.playerProjections.playerId, c),
          eq(schema.playerProjections.week, week),
          eq(schema.playerProjections.seasonYear, season),
          eq(schema.playerProjections.scoringFormat, scoringFormat),
        ),
      }),
    ),
    batched(ids, (c) =>
      db.query.playerNews.findMany({
        where: inArray(schema.playerNews.playerId, c),
        orderBy: desc(schema.playerNews.publishedAt),
      }),
    ),
    batched(ids, async (c) => {
      // Latest as_of_week for this season+format, then that snapshot's rows —
      // mirrors marketRankingsRoutes's "most recent snapshot" resolution but
      // scoped to just the players we need.
      const latest = await db.query.playerMarketProjections.findFirst({
        where: and(
          eq(schema.playerMarketProjections.seasonYear, season),
          eq(schema.playerMarketProjections.scoringFormat, scoringFormat),
        ),
        orderBy: desc(schema.playerMarketProjections.asOfWeek),
        columns: { asOfWeek: true },
      });
      if (!latest) return [];
      return db.query.playerMarketProjections.findMany({
        where: and(
          inArray(schema.playerMarketProjections.playerId, c),
          eq(schema.playerMarketProjections.seasonYear, season),
          eq(schema.playerMarketProjections.asOfWeek, latest.asOfWeek),
          eq(schema.playerMarketProjections.scoringFormat, scoringFormat),
        ),
      });
    }),
    batched(ids, (c) =>
      db.query.draftRankings.findMany({
        where: and(
          inArray(schema.draftRankings.playerId, c),
          eq(schema.draftRankings.rankingType, 'redraft'),
          eq(schema.draftRankings.scoringFormat, 'ppr'),
          eq(schema.draftRankings.superflex, false),
          eq(schema.draftRankings.seasonYear, season),
        ),
      }),
    ),
    batched(ids, (c) =>
      db.query.playerAiAnalyses.findMany({
        where: and(
          inArray(schema.playerAiAnalyses.playerId, c),
          eq(schema.playerAiAnalyses.seasonYear, season),
          eq(schema.playerAiAnalyses.week, week),
        ),
      }),
    ),
  ]);

  if (players.length === 0) return [];

  // Games + odds for this week, scoped to just the teams we need (batched by
  // distinct team, not per-player).
  const teams = [...new Set(players.map((p: any) => p.team).filter(Boolean))];
  const games = teams.length > 0
    ? await db.query.nflGames.findMany({
        where: and(eq(schema.nflGames.seasonYear, season), eq(schema.nflGames.week, week)),
      })
    : [];
  const gameByTeam = new Map<string, (typeof games)[number]>();
  for (const g of games) {
    if (teams.includes(g.homeTeam)) gameByTeam.set(g.homeTeam, g);
    if (teams.includes(g.awayTeam)) gameByTeam.set(g.awayTeam, g);
  }
  const gameIds = [...new Set([...gameByTeam.values()].map((g) => g.id))];
  const oddsRows = gameIds.length > 0
    ? await db.query.gameOdds.findMany({ where: inArray(schema.gameOdds.gameId, gameIds) })
    : [];
  const oddsByGame = new Map<string, typeof oddsRows>();
  for (const o of oddsRows) {
    const list = oddsByGame.get(o.gameId);
    if (list) list.push(o);
    else oddsByGame.set(o.gameId, [o]);
  }

  // Group per-player lookups.
  const statsByPlayer = new Map<string, typeof allSeasonStats>();
  for (const s of allSeasonStats) {
    const list = statsByPlayer.get(s.playerId);
    if (list) list.push(s);
    else statsByPlayer.set(s.playerId, [s]);
  }
  const projByPlayer = new Map(weekProjections.map((p: any) => [p.playerId, p]));
  const newsByPlayer = new Map<string, typeof newsRows>();
  for (const n of newsRows) {
    const list = newsByPlayer.get(n.playerId);
    if (list) list.push(n);
    else newsByPlayer.set(n.playerId, [n]);
  }
  const marketByPlayer = new Map(marketRows.map((m: any) => [m.playerId, m]));
  const draftByPlayer = new Map(draftRows.map((d: any) => [d.playerId, d]));
  const aiByPlayer = new Map(aiRows.map((a: any) => [a.playerId, a]));

  return players.map((player: any): PlayerCard =>
    assemblePlayerCard({
      player,
      week,
      scoringFormat,
      weeklyStats: statsByPlayer.get(player.id) ?? [],
      projRow: projByPlayer.get(player.id) ?? null,
      game: gameByTeam.get(player.team) ?? null,
      oddsRows: (() => {
        const game = gameByTeam.get(player.team);
        return game ? oddsByGame.get(game.id) ?? [] : [];
      })(),
      marketRow: marketByPlayer.get(player.id) ?? null,
      draftRow: draftByPlayer.get(player.id) ?? null,
      newsRows: newsByPlayer.get(player.id) ?? [],
      aiRow: aiByPlayer.get(player.id) ?? null,
    }),
  );
}

export interface AssemblePlayerCardInput {
  /** Raw nflPlayers row. */
  player: any;
  week: number;
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  /** Every playerWeeklyStats row for this player's season (any week). */
  weeklyStats: any[];
  /** This week's playerProjections row in `scoringFormat`, if any. */
  projRow?: any | null;
  /** This week's nflGames row for the player's team, if any. */
  game?: any | null;
  /** gameOdds rows for `game`, if any. */
  oddsRows?: any[];
  /** Latest playerMarketProjections row for this player, if any. */
  marketRow?: any | null;
  /** Redraft/PPR draftRankings row for this player, if any. */
  draftRow?: any | null;
  /** playerNews rows for this player, most recent first. */
  newsRows?: any[];
  /** Cached playerAiAnalyses row for (player, season, week), if any. */
  aiRow?: any | null;
  /** Injectable "now" for deterministic news ageHours in tests. Defaults to Date.now(). */
  now?: number;
}

/**
 * Pure per-player card assembly: every computed field (season totals, recent
 * form, this-week matchup/Vegas math, market/draft/news summaries) from
 * already-fetched rows, with no DB access. `buildPlayerCards` is the I/O
 * shell around this — kept separate so the formatting logic is unit
 * testable against fixture rows without D1/Miniflare.
 */
export function assemblePlayerCard(input: AssemblePlayerCardInput): PlayerCard {
  const { player, week, scoringFormat } = input;
  const weeklyStats = input.weeklyStats ?? [];
  const oddsRows = input.oddsRows ?? [];
  const newsRows = input.newsRows ?? [];
  const now = input.now ?? Date.now();

  const priorStats = weeklyStats.filter((s: any) => s.week < week);

  const totals = weeklyStats.reduce(
    (acc: any, s: any) => ({
      games: acc.games + 1,
      ppr: acc.ppr + (s.fantasyPointsPPR || 0),
      half: acc.half + (s.fantasyPointsHalf || 0),
      std: acc.std + (s.fantasyPointsStd || 0),
      passYards: acc.passYards + (s.passYards || 0),
      passTDs: acc.passTDs + (s.passTDs || 0),
      rushYards: acc.rushYards + (s.rushYards || 0),
      rushTDs: acc.rushTDs + (s.rushTDs || 0),
      receptions: acc.receptions + (s.receptions || 0),
      receivingYards: acc.receivingYards + (s.receivingYards || 0),
      receivingTDs: acc.receivingTDs + (s.receivingTDs || 0),
      targets: acc.targets + (s.targets || 0),
    }),
    { games: 0, ppr: 0, half: 0, std: 0, passYards: 0, passTDs: 0, rushYards: 0, rushTDs: 0, receptions: 0, receivingYards: 0, receivingTDs: 0, targets: 0 },
  );
  const ptsTotal = scoringFormat === 'half-ppr' ? totals.half : scoringFormat === 'standard' ? totals.std : totals.ppr;
  const season: PlayerCardSeason | null = totals.games > 0
    ? {
        games: totals.games,
        points: Math.round(ptsTotal * 10) / 10,
        ppg: Math.round((ptsTotal / totals.games) * 10) / 10,
        totals: {
          passYards: totals.passYards,
          passTDs: totals.passTDs,
          rushYards: totals.rushYards,
          rushTDs: totals.rushTDs,
          receptions: totals.receptions,
          receivingYards: totals.receivingYards,
          receivingTDs: totals.receivingTDs,
          targets: totals.targets,
        },
      }
    : null;

  const ptsCol = scoringFormat === 'half-ppr' ? 'fantasyPointsHalf' : scoringFormat === 'standard' ? 'fantasyPointsStd' : 'fantasyPointsPPR';
  const last3 = priorStats.slice(-3).map((s: any) => ({
    week: s.week,
    opp: s.opponent ?? null,
    pts: Math.round(((s[ptsCol] ?? 0) as number) * 10) / 10,
  }));

  const projRow = input.projRow;
  const game = input.game;
  let thisWeek: PlayerCardWeek | null = null;
  if (projRow || game) {
    let opponent: string | null = null;
    let home: boolean | null = null;
    let spread: number | null = null;
    let total: number | null = null;
    let impliedTotal: number | null = null;
    let kickoff: string | null = null;
    if (game) {
      home = game.homeTeam === player.team;
      opponent = home ? game.awayTeam : game.homeTeam;
      kickoff = game.gameTime instanceof Date ? game.gameTime.toISOString() : (game.gameTime as any) ?? null;
      const odds = oddsRows.slice().sort(
        (a: any, b: any) => new Date(b.snapshotTime).getTime() - new Date(a.snapshotTime).getTime(),
      );
      const spreadRow = odds.find((o: any) => o.homePoint != null || o.awayPoint != null);
      const totalRow = odds.find((o: any) => o.overPoint != null);
      spread = spreadRow ? (home ? spreadRow.homePoint : spreadRow.awayPoint) ?? null : null;
      total = totalRow?.overPoint ?? null;
      if (spread == null && game.spread != null) spread = home ? game.spread : -game.spread;
      if (total == null && game.overUnder != null) total = game.overUnder;
      if (spread != null && total != null) {
        impliedTotal = Math.round((total / 2 - spread / 2) * 10) / 10;
      }
    }
    thisWeek = {
      proj: projRow ? Math.round(projRow.projectedPoints * 10) / 10 : null,
      opponent,
      home,
      spread,
      total,
      impliedTotal,
      kickoff,
    };
  }

  const marketRow = input.marketRow;
  const market: PlayerCardMarket | null = marketRow
    ? {
        seasonPoints: marketRow.seasonPoints ?? null,
        rosPoints: marketRow.rosPoints ?? null,
        marketRank: marketRow.marketRank ?? null,
        confidence: marketRow.confidence ?? null,
      }
    : null;

  const draftRow = input.draftRow;
  const draft: PlayerCardDraft | null = draftRow
    ? { overallRank: draftRow.overallRank ?? null, tier: draftRow.tier ?? null, adp: draftRow.adp ?? null }
    : null;

  const newsForPlayer = newsRows.slice(0, 3).map((n: any): PlayerCardNews => {
    const published = n.publishedAt instanceof Date ? n.publishedAt.getTime() : new Date(n.publishedAt).getTime();
    const ageHours = isNaN(published) ? null : Math.round(((now - published) / (1000 * 60 * 60)) * 10) / 10;
    return { headline: n.headline, impact: n.impactLevel ?? null, ageHours };
  });

  const aiRow = input.aiRow;
  const aiTake: string | null = aiRow ? String(aiRow.analysis).slice(0, 300) : null;

  return {
    id: player.id,
    name: player.name,
    position: player.position,
    team: player.team,
    status: player.status ?? 'active',
    injury: player.injuryNote ?? null,
    depthChartOrder: player.depthChartOrder ?? null,
    byeWeek: player.byeWeek ?? null,
    age: player.age ?? null,
    yearsExp: player.yearsExp ?? null,
    season,
    last3,
    thisWeek,
    market,
    draft,
    news: newsForPlayer,
    aiTake,
  };
}

/** Single-player convenience wrapper over buildPlayerCards. Returns null if the id isn't found. */
export async function buildPlayerCard(
  db: DrizzleD1,
  playerId: string,
  opts: PlayerCardOptions,
): Promise<PlayerCard | null> {
  const [card] = await buildPlayerCards(db, [playerId], opts);
  return card ?? null;
}
