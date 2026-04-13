/**
 * draftRankings — generates AI-powered draft rankings.
 *
 * Two modes:
 *  1. Redraft: Pulls Sleeper ADP as a baseline, enriches with player context
 *     (age, stats, injury, depth chart, news), and asks Claude to generate
 *     tiers, rationale, and value flags where it disagrees with ADP.
 *  2. Dynasty Rookie: Filters to rookies (yearsExp === 0), and asks Claude
 *     to generate full rankings from player context since rookies lack
 *     extensive fantasy history.
 *
 * Rankings are pre-computed and stored in the draft_rankings table.
 * They are NOT generated per-request — an admin trigger or cron job
 * calls generateDraftRankings() and results are served from the DB.
 */

import { eq, and, desc, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';

type DB = ReturnType<typeof drizzle<typeof schema>>;

// ── Sleeper ADP ─────────────────────────────────────────────────────

interface SleeperADPEntry {
  player_id: string;
  adp: number;
}

/**
 * Fetch ADP data from Sleeper's undocumented ADP endpoint.
 * Returns a map of sleeper_player_id → adp value.
 */
async function fetchSleeperADP(
  scoringFormat: 'ppr' | 'half-ppr' | 'standard',
): Promise<Map<string, number>> {
  // Sleeper ADP endpoint: players/nfl/trending/add (past 24h activity as proxy)
  // More reliable: use their draft ADP endpoint
  const scoringParam = scoringFormat === 'ppr' ? 'ppr' : scoringFormat === 'half-ppr' ? 'half_ppr' : 'std';
  const url = `https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=720&limit=200`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[draftRankings] Sleeper trending API returned ${res.status}`);
      return new Map();
    }
    const data = (await res.json()) as { player_id: string; count: number }[];
    // Use the ranking order as a rough ADP proxy (most-added = highest demand)
    const adpMap = new Map<string, number>();
    data.forEach((entry, idx) => {
      adpMap.set(entry.player_id, idx + 1);
    });
    return adpMap;
  } catch (err) {
    console.error('[draftRankings] Failed to fetch Sleeper ADP:', err);
    return new Map();
  }
}

// ── Player context builder ──────────────────────────────────────────

interface PlayerContext {
  id: string;
  externalId: string | null;
  name: string;
  position: string;
  team: string;
  age: number | null;
  yearsExp: number | null;
  status: string;
  injuryNote: string | null;
  depthChartOrder: number | null;
  lastSeasonPoints: number | null;
  lastSeasonGames: number | null;
  recentNews: string[];
  adp: number | null;
}

async function buildPlayerContexts(
  db: DB,
  rankingType: 'redraft' | 'dynasty_rookie',
  scoringFormat: 'ppr' | 'half-ppr' | 'standard',
  seasonYear: number,
  sleeperADP: Map<string, number>,
): Promise<PlayerContext[]> {
  // Fetch players
  const posFilter = ['QB', 'RB', 'WR', 'TE'];
  const allPlayers = await db.query.nflPlayers.findMany({
    where: inArray(schema.nflPlayers.position, posFilter),
  });

  // Filter for dynasty rookie: only players with 0 years experience
  let players = rankingType === 'dynasty_rookie'
    ? allPlayers.filter(p => p.yearsExp === 0)
    : allPlayers.filter(p => p.status !== 'inactive' && p.team !== 'FA');

  // Get last season stats for each player
  const prevSeason = seasonYear - 1;
  const pointsCol = scoringFormat === 'ppr'
    ? 'fantasyPointsPPR'
    : scoringFormat === 'half-ppr'
    ? 'fantasyPointsHalf'
    : 'fantasyPointsStd';

  const statsRows = await db.query.playerWeeklyStats.findMany({
    where: eq(schema.playerWeeklyStats.seasonYear, prevSeason),
  });

  // Group stats by player
  const statsByPlayer = new Map<string, { totalPoints: number; gamesPlayed: number }>();
  for (const row of statsRows) {
    const pts = (row as any)[pointsCol] || 0;
    if (pts === 0) continue;
    const entry = statsByPlayer.get(row.playerId) || { totalPoints: 0, gamesPlayed: 0 };
    entry.totalPoints += pts;
    entry.gamesPlayed += 1;
    statsByPlayer.set(row.playerId, entry);
  }

  // Get recent news (last 30 days worth)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newsRows = await db.query.playerNews.findMany({
    columns: { playerId: true, headline: true, aiSummary: true },
    orderBy: desc(schema.playerNews.publishedAt),
  });
  const newsByPlayer = new Map<string, string[]>();
  for (const n of newsRows) {
    const list = newsByPlayer.get(n.playerId) || [];
    if (list.length < 3) { // max 3 news items per player
      list.push(n.aiSummary || n.headline);
    }
    newsByPlayer.set(n.playerId, list);
  }

  return players.map(p => ({
    id: p.id,
    externalId: p.externalId,
    name: p.name,
    position: p.position,
    team: p.team,
    age: p.age,
    yearsExp: p.yearsExp,
    status: p.status,
    injuryNote: p.injuryNote,
    depthChartOrder: p.depthChartOrder,
    lastSeasonPoints: statsByPlayer.get(p.id)?.totalPoints ?? null,
    lastSeasonGames: statsByPlayer.get(p.id)?.gamesPlayed ?? null,
    recentNews: newsByPlayer.get(p.id) || [],
    adp: p.externalId ? (sleeperADP.get(p.externalId) ?? null) : null,
  }));
}

// ── Claude prompt builders ──────────────────────────────────────────

function buildRedraftPrompt(
  players: PlayerContext[],
  scoringFormat: string,
  superflex: boolean,
): string {
  const playerLines = players
    .filter(p => p.lastSeasonPoints !== null || p.adp !== null)
    .sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999))
    .slice(0, 250) // cap to keep within token limits
    .map(p => {
      const ppg = p.lastSeasonPoints && p.lastSeasonGames
        ? (p.lastSeasonPoints / p.lastSeasonGames).toFixed(1)
        : 'N/A';
      const newsStr = p.recentNews.length > 0 ? ` | News: ${p.recentNews.join('; ')}` : '';
      return `${p.name} (${p.position}, ${p.team}) | Age: ${p.age ?? '?'} | Exp: ${p.yearsExp ?? '?'}yr | Status: ${p.status}${p.injuryNote ? ` (${p.injuryNote})` : ''} | Depth: ${p.depthChartOrder ?? '?'} | Last Season: ${p.lastSeasonPoints?.toFixed(1) ?? 'N/A'} pts in ${p.lastSeasonGames ?? 0} games (${ppg} ppg) | ADP: ${p.adp ?? 'N/A'}${newsStr}`;
    })
    .join('\n');

  return `You are an expert fantasy football analyst generating ${scoringFormat.toUpperCase()} redraft rankings for the upcoming NFL season.${superflex ? ' This is a SUPERFLEX league (QBs are significantly more valuable).' : ''}

TASK: Rank these players for a full-season redraft draft. Use ADP as a starting reference but adjust based on your analysis of each player's situation, age, injury risk, depth chart position, and recent news.

PLAYER DATA:
${playerLines}

RESPOND WITH ONLY VALID JSON — an array of objects, one per ranked player. Rank the top 200 players:
[
  {
    "name": "Player Name",
    "position": "QB|RB|WR|TE",
    "overallRank": 1,
    "positionRank": 1,
    "tier": 1,
    "projectedPoints": 320.5,
    "rationale": "1 concise sentence summarizing rank and ADP value",
    "analysis": "3-5 sentence detailed breakdown covering: key strengths, primary risks/concerns, situation/opportunity outlook, and fantasy upside/ceiling vs floor. Reference specific stats, coaching changes, depth chart battles, or scheme fit."
  }
]

TIER RULES:
- Tier 1: Elite studs (top ~8-10 overall)
- Tier 2: High-end starters (top ~20)
- Tier 3: Solid starters (top ~40)
- Tier 4: Starter-quality (top ~70)
- Tier 5: Flex-worthy starters (top ~100)
- Tier 6: Bench players with upside (top ~140)
- Tier 7: Late-round fliers (top ~180)
- Tier 8: Deep sleepers (180+)

IMPORTANT:
- projectedPoints is the full-season total for ${scoringFormat} scoring
- Tiers should have natural breakpoints — don't force exact counts
- Flag players where you meaningfully disagree with ADP in the rationale
- Account for injury risk, age, opportunity changes, and coaching/scheme changes
- rationale: 1 punchy sentence (shown inline in the rankings table)
- analysis: 3-5 sentences of real scouting — strengths, weaknesses, situation, fantasy outlook. This is the main value-add. Be specific: reference stats, scheme, coaching, age curves, injury history. "Elite volume" is lazy; "led NFL with 178 targets at age 24, now gets a healthy Dak back after relying on Cooper Rush for 6 games" is good.`;
}

function buildDynastyRookiePrompt(
  players: PlayerContext[],
  scoringFormat: string,
  superflex: boolean,
): string {
  const playerLines = players
    .slice(0, 100) // rookies list is smaller
    .map(p => {
      const newsStr = p.recentNews.length > 0 ? ` | News: ${p.recentNews.join('; ')}` : '';
      return `${p.name} (${p.position}, ${p.team}) | Age: ${p.age ?? '?'} | Status: ${p.status}${p.injuryNote ? ` (${p.injuryNote})` : ''} | Depth: ${p.depthChartOrder ?? '?'}${newsStr}`;
    })
    .join('\n');

  return `You are an expert fantasy football dynasty analyst generating rookie rankings for the upcoming NFL season in ${scoringFormat.toUpperCase()} scoring.${superflex ? ' This is a SUPERFLEX league (rookie QBs are significantly more valuable).' : ''}

TASK: Rank these rookies for a dynasty rookie draft. Focus on:
- NFL draft capital (round drafted — higher picks get more opportunity)
- Landing spot and path to playing time (depth chart position)
- Team offensive scheme and coaching staff
- Athletic profile and college production trajectory
- Recent news (OTA reports, training camp buzz, injuries)

ROOKIE PLAYER DATA:
${playerLines}

RESPOND WITH ONLY VALID JSON — an array of objects, one per ranked rookie:
[
  {
    "name": "Player Name",
    "position": "QB|RB|WR|TE",
    "overallRank": 1,
    "positionRank": 1,
    "tier": 1,
    "projectedPoints": null,
    "rationale": "1 concise sentence on rank and value",
    "analysis": "3-5 sentence detailed breakdown covering: draft capital and what it signals, landing spot quality (scheme, coaching, offensive line), path to playing time (who's ahead, competition), college production profile, and realistic year-1 vs long-term dynasty outlook."
  }
]

TIER RULES (dynasty rookie context):
- Tier 1: Consensus top picks — elite draft capital + premium landing spot (top ~3-5)
- Tier 2: Strong starters — high draft capital or great situation (top ~10-12)
- Tier 3: Solid picks with clear path (top ~18-20)
- Tier 4: Upside picks with some risk (top ~24-28)
- Tier 5: Dart throws — late-round NFL picks or crowded backfields (28+)

IMPORTANT:
- projectedPoints can be null for rookies with high uncertainty, or a rough estimate if you're confident
- rationale: 1 punchy sentence (shown inline in the rankings table)
- analysis: 3-5 sentences of real scouting — draft capital, landing spot, depth chart, college production, year-1 vs long-term outlook. Be specific: "Day 2 pick in a run-heavy offense behind an aging Derrick Henry, with the offensive line ranked 5th in run blocking" is good. "Good prospect with upside" is worthless.
- Landing spot matters MORE than college tape for year-1 fantasy value`;
}

// ── Core generation function ────────────────────────────────────────

export interface GenerateRankingsArgs {
  db: DB;
  anthropicKey: string;
  rankingType: 'redraft' | 'dynasty_rookie';
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  superflex: boolean;
  seasonYear: number;
}

export interface GenerateRankingsResult {
  ok: boolean;
  count: number;
  error?: string;
}

export async function generateDraftRankings(
  args: GenerateRankingsArgs,
): Promise<GenerateRankingsResult> {
  const { db, anthropicKey, rankingType, scoringFormat, superflex, seasonYear } = args;

  // 1. Fetch ADP data (for redraft only)
  const sleeperADP = rankingType === 'redraft'
    ? await fetchSleeperADP(scoringFormat)
    : new Map<string, number>();

  // 2. Build player contexts
  const playerContexts = await buildPlayerContexts(
    db, rankingType, scoringFormat, seasonYear, sleeperADP,
  );

  if (playerContexts.length === 0) {
    return { ok: false, count: 0, error: `No players found for ${rankingType}` };
  }

  // 3. Build prompt and call Claude
  const prompt = rankingType === 'redraft'
    ? buildRedraftPrompt(playerContexts, scoringFormat, superflex)
    : buildDynastyRookiePrompt(playerContexts, scoringFormat, superflex);

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for large ranking generation
    });
  } catch (err) {
    console.error('[draftRankings] Claude API fetch failed:', err);
    return { ok: false, count: 0, error: 'AI ranking generation network failure' };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[draftRankings] Claude API error:', res.status, errText);
    return { ok: false, count: 0, error: `AI API error: ${res.status}` };
  }

  let data: { content?: { type: string; text?: string }[] };
  try {
    data = (await res.json()) as { content?: { type: string; text?: string }[] };
  } catch {
    return { ok: false, count: 0, error: 'AI returned malformed response' };
  }

  const textBlock = data.content?.find(b => b.type === 'text');
  const rawText = textBlock?.text?.trim();
  if (!rawText) {
    return { ok: false, count: 0, error: 'AI returned empty response' };
  }

  // Parse JSON (strip markdown fences if present)
  const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  let rankings: Array<{
    name: string;
    position: string;
    overallRank: number;
    positionRank: number;
    tier: number;
    projectedPoints: number | null;
    rationale: string;
    analysis?: string;
  }>;

  try {
    rankings = JSON.parse(jsonStr);
  } catch {
    console.error('[draftRankings] JSON parse failed:', rawText.slice(0, 500));
    return { ok: false, count: 0, error: 'AI returned invalid JSON' };
  }

  if (!Array.isArray(rankings) || rankings.length === 0) {
    return { ok: false, count: 0, error: 'AI returned empty rankings array' };
  }

  // 4. Match AI output back to player IDs
  // Build name→player lookup (case-insensitive)
  const playerByName = new Map<string, PlayerContext>();
  for (const p of playerContexts) {
    playerByName.set(p.name.toLowerCase(), p);
  }

  const now = new Date();
  const superflexInt = superflex ? 1 : 0;

  // 5. Delete old rankings for this combination
  await db.delete(schema.draftRankings).where(
    and(
      eq(schema.draftRankings.rankingType, rankingType),
      eq(schema.draftRankings.scoringFormat, scoringFormat),
      eq(schema.draftRankings.superflex, superflex),
      eq(schema.draftRankings.seasonYear, seasonYear),
    ),
  );

  // 6. Insert new rankings in batches
  const BATCH_SIZE = 50;
  let inserted = 0;

  const rows: schema.NewDraftRanking[] = [];
  for (const r of rankings) {
    const player = playerByName.get(r.name?.toLowerCase());
    if (!player) {
      console.warn(`[draftRankings] Could not match AI player "${r.name}" to DB`);
      continue;
    }

    rows.push({
      id: generateId(),
      playerId: player.id,
      rankingType,
      scoringFormat,
      superflex,
      overallRank: r.overallRank,
      positionRank: r.positionRank,
      tier: Math.min(Math.max(r.tier, 1), 8), // clamp 1-8
      projectedPoints: r.projectedPoints,
      adp: player.adp,
      adpDelta: player.adp != null ? r.overallRank - player.adp : null,
      rationale: r.rationale || '',
      analysis: r.analysis || null,
      seasonYear,
      generatedAt: now,
    });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(schema.draftRankings).values(batch);
    inserted += batch.length;
  }

  console.log(`[draftRankings] Generated ${inserted} ${rankingType} rankings (${scoringFormat}, sf=${superflex})`);
  return { ok: true, count: inserted };
}
