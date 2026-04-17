/**
 * draftRankings — generates AI-powered draft rankings via the Anthropic Batch API.
 *
 * Why batch: these rankings are a pre-computed cron job, not a real-time request.
 * The Batch API is 50% cheaper and lifts the 120s sync-fetch ceiling — ranking
 * generation with full analysis for 200 players can legitimately take several
 * minutes end-to-end.
 *
 * Flow:
 *  1. Weekly cron calls submitDraftRankingsBatch({ variants: [...] }).
 *  2. That builds one Claude request per variant (redraft-ppr, redraft-half-ppr,
 *     dynasty-rookie-ppr, dynasty-rookie-half-ppr), wraps them in a single
 *     POST /v1/messages/batches submission, records a row in ranking_batch_jobs,
 *     and returns immediately.
 *  3. An hourly cron calls processPendingBatches(), which polls
 *     GET /v1/messages/batches/:id for each non-terminal row. When a batch ends,
 *     it streams the .jsonl results, parses each variant's rankings, and writes
 *     them into draft_rankings.
 */

import { eq, and, desc, inArray, gte, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { generateId } from '../utils/id';

type DB = ReturnType<typeof drizzle<typeof schema>>;

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
// 200 redraft players × ~900 tokens each (rank + tier + projected points +
// 1-sentence rationale + 3-5 sentence analysis + JSON scaffolding) easily
// exceeds 32k, which silently truncates the model output mid-array. Sonnet
// 4.6 supports up to 64k output tokens; use the full ceiling.
const MAX_TOKENS = 64000;
const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches';

// ── ADP sources ─────────────────────────────────────────────────────
// Redraft ADP comes from FantasyPros — their public page defaults to 1-QB
// PPR/Half/Standard, which is what most fantasy users actually play. MFL's
// JSON endpoint is free and JSON but their pool is dominated by superflex
// drafts (Josh Allen @ ADP 2.21 instead of ~20), which pollutes 1-QB
// rankings badly.
//
// Dynasty rookie ADP still uses MFL's IS_KEEPER=R endpoint — it's the only
// free JSON source for rookie-draft ADP. Current matching is thin because
// Sleeper's player catalog doesn't yet have the 2026 NFL draft class;
// expected to self-correct once the NFL draft lands and sync-players picks
// up the new rookies.

/**
 * Normalize a player name for cross-feed matching. Strips punctuation and
 * generational suffixes (Jr./III/etc.) that vary between sources, so
 * "A.J. Brown" matches "AJ Brown", and "Kenneth Walker III" matches
 * "Kenneth Walker".
 */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    // Strip common punctuation (periods, apostrophes, hyphens, quotes).
    .replace(/[.'`’‘"“”\-]/g, '')
    // Drop generational suffixes.
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch FantasyPros 1-QB redraft ADP for the given scoring format. Returns
 * Map<normalizedName, adpRank>. We use table position (1, 2, 3, ...) as the
 * ADP value rather than parsing the avg-pick column — it's cleaner signal
 * for the model and robust to FantasyPros layout tweaks.
 */
async function fetchFantasyProsADP(
  scoringFormat: 'ppr' | 'half-ppr' | 'standard',
): Promise<Map<string, number>> {
  const url = scoringFormat === 'ppr'
    ? 'https://www.fantasypros.com/nfl/adp/ppr-overall.php'
    : scoringFormat === 'half-ppr'
    ? 'https://www.fantasypros.com/nfl/adp/half-point-ppr-overall.php'
    : 'https://www.fantasypros.com/nfl/adp/overall.php';

  try {
    const res = await fetch(url, {
      headers: {
        // FantasyPros 403s on bare fetches — a normal UA string unblocks it.
        'User-Agent': 'Mozilla/5.0 (compatible; FilmRoomFantasy/1.0)',
      },
    });
    if (!res.ok) {
      console.warn(`[draftRankings] FantasyPros ADP ${scoringFormat} HTTP ${res.status}`);
      return new Map();
    }

    const fullHtml = await res.text();
    // FantasyPros's main ADP table has id="data". Scope extraction to just
    // that <table>…</table> block so the regex doesn't scan sidebar widgets
    // and inline scripts (which pushes the worker over the CPU limit and
    // pollutes ranks with non-ADP players).
    const tableStart = fullHtml.indexOf('<table') !== -1
      ? fullHtml.indexOf('id="data"')
      : -1;
    let html: string;
    if (tableStart > 0) {
      const tableEnd = fullHtml.indexOf('</table>', tableStart);
      html = tableEnd > 0 ? fullHtml.slice(tableStart, tableEnd) : fullHtml.slice(tableStart, tableStart + 200_000);
    } else {
      // Fallback: bound the scan to a prefix if the id= attribute moves.
      html = fullHtml.slice(0, 200_000);
    }

    // Match anchors in the ADP table: each player row has
    //   <a class="player-name fp-player-link fp-id-XXXX" ... >Full Name</a>
    // Document order within the main table corresponds to ADP rank.
    const nameRegex = /<a class="player-name[^"]*"[^>]*>([^<]+)<\/a>/g;
    const result = new Map<string, number>();
    let match: RegExpExecArray | null;
    let rank = 0;
    while ((match = nameRegex.exec(html)) !== null) {
      const normalized = normalizePlayerName(match[1].trim());
      if (result.has(normalized)) continue;
      rank += 1;
      result.set(normalized, rank);
    }

    console.log(`[draftRankings] FantasyPros ADP (${scoringFormat}): ${result.size} entries`);
    return result;
  } catch (err) {
    console.error('[draftRankings] FantasyPros ADP fetch failed:', err);
    return new Map();
  }
}

type KeeperType = 'N' | 'R'; // N = redraft, R = rookie-only

async function fetchMFLADP(
  year: number,
  scoringFormat: 'ppr' | 'half-ppr' | 'standard',
  keeperType: KeeperType,
): Promise<Map<string, number>> {
  const isPpr = scoringFormat === 'ppr' ? '1' : scoringFormat === 'half-ppr' ? '0.5' : '0';
  const adpUrl = `https://api.myfantasyleague.com/${year}/export?TYPE=adp&IS_PPR=${isPpr}&IS_KEEPER=${keeperType}&IS_MOCK=-1&JSON=1`;
  const playersUrl = `https://api.myfantasyleague.com/${year}/export?TYPE=players&DETAILS=0&JSON=1`;

  try {
    const [adpRes, playersRes] = await Promise.all([
      fetch(adpUrl),
      fetch(playersUrl),
    ]);

    if (!adpRes.ok || !playersRes.ok) {
      console.warn(`[draftRankings] MFL ADP ${adpRes.status} / players ${playersRes.status}`);
      return new Map();
    }

    const adpData = (await adpRes.json()) as {
      adp?: { player?: Array<{ id: string; averagePick: string }> };
    };
    const playersData = (await playersRes.json()) as {
      players?: { player?: Array<{ id: string; name: string; position: string }> };
    };

    // MFL returns player names as "Last, First" — flip to "First Last".
    const idToName = new Map<string, string>();
    for (const p of playersData.players?.player ?? []) {
      const match = p.name.match(/^(.+?),\s*(.+)$/);
      const fullName = match ? `${match[2]} ${match[1]}` : p.name;
      idToName.set(p.id, fullName);
    }

    const result = new Map<string, number>();
    for (const entry of adpData.adp?.player ?? []) {
      const name = idToName.get(entry.id);
      if (!name) continue;
      const adp = parseFloat(entry.averagePick);
      if (Number.isFinite(adp)) {
        result.set(normalizePlayerName(name), adp);
      }
    }

    console.log(`[draftRankings] MFL ADP (${scoringFormat}, keeper=${keeperType}): ${result.size} entries`);
    return result;
  } catch (err) {
    console.error('[draftRankings] MFL ADP fetch failed:', err);
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
  adpByNormalizedName: Map<string, number>,
): Promise<PlayerContext[]> {
  const posFilter = ['QB', 'RB', 'WR', 'TE'];
  const allPlayers = await db.query.nflPlayers.findMany({
    where: inArray(schema.nflPlayers.position, posFilter),
  });

  let players = rankingType === 'dynasty_rookie'
    ? allPlayers.filter(p => p.yearsExp === 0)
    : allPlayers.filter(p => p.status !== 'inactive' && p.team !== 'FA');

  const prevSeason = seasonYear - 1;
  const pointsCol = scoringFormat === 'ppr'
    ? 'fantasyPointsPPR'
    : scoringFormat === 'half-ppr'
    ? 'fantasyPointsHalf'
    : 'fantasyPointsStd';

  const statsRows = await db.query.playerWeeklyStats.findMany({
    where: eq(schema.playerWeeklyStats.seasonYear, prevSeason),
  });

  const statsByPlayer = new Map<string, { totalPoints: number; gamesPlayed: number }>();
  for (const row of statsRows) {
    const pts = (row as any)[pointsCol] || 0;
    if (pts === 0) continue;
    const entry = statsByPlayer.get(row.playerId) || { totalPoints: 0, gamesPlayed: 0 };
    entry.totalPoints += pts;
    entry.gamesPlayed += 1;
    statsByPlayer.set(row.playerId, entry);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newsRows = await db.query.playerNews.findMany({
    columns: { playerId: true, headline: true, aiSummary: true },
    where: gte(schema.playerNews.publishedAt, thirtyDaysAgo),
    orderBy: desc(schema.playerNews.publishedAt),
    limit: 1000,
  });
  const newsByPlayer = new Map<string, string[]>();
  for (const n of newsRows) {
    const list = newsByPlayer.get(n.playerId) || [];
    if (list.length < 3) {
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
    adp: adpByNormalizedName.get(normalizePlayerName(p.name)) ?? null,
  }));
}

// ── Prompt builders ─────────────────────────────────────────────────

function buildRedraftPrompt(
  players: PlayerContext[],
  scoringFormat: string,
  superflex: boolean,
): string {
  const playerLines = players
    .filter(p => p.lastSeasonPoints !== null || p.adp !== null)
    .sort((a, b) => (a.adp ?? 999) - (b.adp ?? 999))
    .slice(0, 250)
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
    .slice(0, 100)
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

// ── Batch submission ────────────────────────────────────────────────

export interface RankingVariant {
  rankingType: 'redraft' | 'dynasty_rookie';
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  superflex: boolean;
}

export interface SubmitBatchArgs {
  db: DB;
  anthropicKey: string;
  variants: RankingVariant[];
  seasonYear: number;
}

export interface SubmitBatchResult {
  ok: boolean;
  batchId?: string;
  jobId?: string;
  error?: string;
}

interface BatchVariantMeta {
  customId: string;
  rankingType: 'redraft' | 'dynasty_rookie';
  scoringFormat: 'ppr' | 'half-ppr' | 'standard';
  superflex: boolean;
}

function variantCustomId(v: RankingVariant): string {
  return `${v.rankingType}-${v.scoringFormat}-${v.superflex ? 'sf' : 'std'}`;
}

/**
 * Build prompts for every variant and submit them as a single Anthropic batch.
 * Returns immediately with the batch id; use processPendingBatches() to ingest
 * results once the batch ends.
 */
export async function submitDraftRankingsBatch(
  args: SubmitBatchArgs,
): Promise<SubmitBatchResult> {
  const { db, anthropicKey, variants, seasonYear } = args;

  if (variants.length === 0) {
    return { ok: false, error: 'No variants to submit' };
  }

  const requests: Array<{ custom_id: string; params: unknown }> = [];
  const metas: BatchVariantMeta[] = [];

  for (const v of variants) {
    // Redraft → FantasyPros 1-QB ADP (MFL's ADP pool is dominated by
    // superflex drafts, which ranks QBs way too high for 1-QB leagues).
    // Dynasty rookie → MFL rookie-only ADP (FantasyPros doesn't expose
    // rookie ADP cleanly; MFL's is the only free structured source).
    const adp = v.rankingType === 'dynasty_rookie'
      ? await fetchMFLADP(seasonYear, v.scoringFormat, 'R')
      : await fetchFantasyProsADP(v.scoringFormat);
    const contexts = await buildPlayerContexts(db, v.rankingType, v.scoringFormat, seasonYear, adp);
    if (contexts.length === 0) {
      console.warn(`[draftRankings] No players found for ${v.rankingType}/${v.scoringFormat}; skipping`);
      continue;
    }
    const prompt = v.rankingType === 'redraft'
      ? buildRedraftPrompt(contexts, v.scoringFormat, v.superflex)
      : buildDynastyRookiePrompt(contexts, v.scoringFormat, v.superflex);

    const customId = variantCustomId(v);
    requests.push({
      custom_id: customId,
      params: {
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      },
    });
    metas.push({
      customId,
      rankingType: v.rankingType,
      scoringFormat: v.scoringFormat,
      superflex: v.superflex,
    });
  }

  if (requests.length === 0) {
    return { ok: false, error: 'All variants had zero eligible players' };
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_BATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'message-batches-2024-09-24',
      },
      body: JSON.stringify({ requests }),
    });
  } catch (err) {
    console.error('[draftRankings] Batch submit network error:', err);
    return { ok: false, error: 'Batch submission network failure' };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[draftRankings] Batch submit error:', res.status, errText);
    return { ok: false, error: `Batch submission failed: ${res.status}` };
  }

  let batch: { id: string; processing_status?: string };
  try {
    batch = (await res.json()) as { id: string; processing_status?: string };
  } catch {
    return { ok: false, error: 'Batch API returned malformed response' };
  }

  if (!batch.id) {
    return { ok: false, error: 'Batch API returned no id' };
  }

  const jobId = generateId();
  await db.insert(schema.rankingBatchJobs).values({
    id: jobId,
    anthropicBatchId: batch.id,
    status: 'submitted',
    seasonYear,
    variants: JSON.stringify(metas),
    submittedAt: new Date(),
  });

  console.log(`[draftRankings] Submitted batch ${batch.id} with ${requests.length} variants`);
  return { ok: true, batchId: batch.id, jobId };
}

// ── Batch processing ────────────────────────────────────────────────

interface BatchStatus {
  id: string;
  processing_status?: string; // 'in_progress' | 'canceling' | 'ended'
  results_url?: string | null;
  ended_at?: string | null;
}

interface BatchResultLine {
  custom_id: string;
  result:
    | { type: 'succeeded'; message: { content: Array<{ type: string; text?: string }> } }
    | { type: 'errored'; error: { message?: string } }
    | { type: 'canceled' | 'expired' };
}

export interface ProcessBatchesResult {
  checked: number;
  completedJobs: number;
  failedJobs: number;
  totalRankingsInserted: number;
}

export async function processPendingBatches(
  db: DB,
  anthropicKey: string,
): Promise<ProcessBatchesResult> {
  const pending = await db.query.rankingBatchJobs.findMany({
    where: or(
      eq(schema.rankingBatchJobs.status, 'submitted'),
      eq(schema.rankingBatchJobs.status, 'in_progress'),
    ),
  });

  let completedJobs = 0;
  let failedJobs = 0;
  let totalRankingsInserted = 0;

  // Process at most one ENDED batch per invocation. Writing a variant
  // rebuilds player contexts (a few hundred KB of string work) and runs a
  // ~201-statement atomic D1 batch, which is heavy enough that draining
  // multiple batches in one worker invocation trips the 30s CPU cap. Poll
  // the rest cheaply (status check only) so the job-state row stays fresh,
  // and pick them up on subsequent hourly ticks.
  let processedOneEnded = false;

  for (const job of pending) {
    let statusRes: Response;
    try {
      statusRes = await fetch(`${ANTHROPIC_BATCH_URL}/${job.anthropicBatchId}`, {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'message-batches-2024-09-24',
        },
      });
    } catch (err) {
      console.error(`[draftRankings] Poll error for ${job.anthropicBatchId}:`, err);
      continue;
    }

    if (!statusRes.ok) {
      console.error(`[draftRankings] Poll ${job.anthropicBatchId} HTTP ${statusRes.status}`);
      continue;
    }

    const status = (await statusRes.json()) as BatchStatus;

    if (status.processing_status !== 'ended') {
      // Still running; flip the row from submitted→in_progress for visibility.
      if (job.status === 'submitted' && status.processing_status === 'in_progress') {
        await db.update(schema.rankingBatchJobs)
          .set({ status: 'in_progress' })
          .where(eq(schema.rankingBatchJobs.id, job.id));
      }
      continue;
    }

    // Already processed one ended batch this invocation — skip heavy work and
    // let the next hourly tick handle remaining ended batches.
    if (processedOneEnded) {
      continue;
    }

    if (!status.results_url) {
      await db.update(schema.rankingBatchJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'Batch ended but no results_url',
        })
        .where(eq(schema.rankingBatchJobs.id, job.id));
      failedJobs += 1;
      continue;
    }

    let resultsRes: Response;
    try {
      resultsRes = await fetch(status.results_url, {
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'message-batches-2024-09-24',
        },
      });
    } catch (err) {
      console.error(`[draftRankings] Results fetch error:`, err);
      continue;
    }

    if (!resultsRes.ok) {
      console.error(`[draftRankings] Results ${job.anthropicBatchId} HTTP ${resultsRes.status}`);
      continue;
    }

    const bodyText = await resultsRes.text();
    const variantMetas = JSON.parse(job.variants) as BatchVariantMeta[];

    let inserted = 0;
    let jobErrored = false;

    for (const rawLine of bodyText.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      let parsed: BatchResultLine;
      try {
        parsed = JSON.parse(line) as BatchResultLine;
      } catch {
        console.warn(`[draftRankings] Skipping unparseable line in ${job.anthropicBatchId}`);
        continue;
      }

      const meta = variantMetas.find(m => m.customId === parsed.custom_id);
      if (!meta) {
        console.warn(`[draftRankings] Unknown custom_id ${parsed.custom_id}`);
        continue;
      }

      if (parsed.result.type !== 'succeeded') {
        console.error(`[draftRankings] Variant ${parsed.custom_id} ${parsed.result.type}`);
        jobErrored = true;
        continue;
      }

      const textBlock = parsed.result.message.content?.find(b => b.type === 'text');
      const rawText = textBlock?.text?.trim();
      if (!rawText) {
        console.error(`[draftRankings] Variant ${parsed.custom_id} returned empty text`);
        jobErrored = true;
        continue;
      }

      const writeResult = await writeVariantRankings({
        db,
        anthropicKey,
        meta,
        rawText,
        seasonYear: job.seasonYear,
      });

      if (!writeResult.ok) {
        console.error(`[draftRankings] Failed to write ${parsed.custom_id}: ${writeResult.error}`);
        jobErrored = true;
        continue;
      }
      inserted += writeResult.count;
    }

    await db.update(schema.rankingBatchJobs)
      .set({
        status: jobErrored ? 'failed' : 'completed',
        completedAt: new Date(),
        errorMessage: jobErrored ? 'One or more variants failed to parse or write' : null,
      })
      .where(eq(schema.rankingBatchJobs.id, job.id));

    if (jobErrored) failedJobs += 1;
    else completedJobs += 1;
    totalRankingsInserted += inserted;
    processedOneEnded = true;

    console.log(`[draftRankings] Batch ${job.anthropicBatchId} ${jobErrored ? 'partially failed' : 'completed'}; inserted ${inserted} rows`);
  }

  return {
    checked: pending.length,
    completedJobs,
    failedJobs,
    totalRankingsInserted,
  };
}

interface WriteVariantArgs {
  db: DB;
  anthropicKey: string;
  meta: BatchVariantMeta;
  rawText: string;
  seasonYear: number;
}

interface WriteVariantResult {
  ok: boolean;
  count: number;
  error?: string;
}

async function writeVariantRankings(args: WriteVariantArgs): Promise<WriteVariantResult> {
  const { db, meta, rawText, seasonYear } = args;

  // Models sometimes wrap the JSON in ```json fences, add preamble text, hit
  // their max_tokens ceiling mid-object, or all three. Start at the first '['
  // to drop any preamble, then walk forward to find the last top-level '}'
  // followed by ',' or ']' so we salvage every complete object even when the
  // array was truncated.
  const firstBracket = rawText.indexOf('[');
  let jsonStr: string;
  if (firstBracket < 0) {
    jsonStr = rawText;
  } else {
    const body = rawText.slice(firstBracket);
    const lastClosingBracket = body.lastIndexOf(']');
    if (lastClosingBracket > 0) {
      jsonStr = body.slice(0, lastClosingBracket + 1);
    } else {
      // Truncated mid-array: close at the last complete object boundary.
      const lastObjectEnd = Math.max(body.lastIndexOf('},'), body.lastIndexOf('}\n'));
      jsonStr = lastObjectEnd > 0 ? body.slice(0, lastObjectEnd + 1) + ']' : body;
    }
  }

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

  // Re-fetch ADP for adpDelta so it reflects current ADP at write time
  // rather than what was in effect hours ago when the batch was submitted.
  // Same source routing as the submit path.
  const adp = meta.rankingType === 'dynasty_rookie'
    ? await fetchMFLADP(seasonYear, meta.scoringFormat, 'R')
    : await fetchFantasyProsADP(meta.scoringFormat);
  const contexts = await buildPlayerContexts(
    db, meta.rankingType, meta.scoringFormat, seasonYear, adp,
  );

  const playerByName = new Map<string, PlayerContext>();
  for (const p of contexts) {
    playerByName.set(p.name.toLowerCase(), p);
  }

  const now = new Date();

  // Dedupe by playerId — occasionally the model lists the same player twice
  // or two distinct name strings collapse to the same DB player after
  // lowercasing (e.g. "Patrick Mahomes II" vs "Patrick Mahomes"). Keep the
  // first occurrence (best rank) to respect the unique index on the table.
  const seenPlayerIds = new Set<string>();
  const rows: schema.NewDraftRanking[] = [];
  for (const r of rankings) {
    const player = playerByName.get(r.name?.toLowerCase());
    if (!player) {
      console.warn(`[draftRankings] Could not match AI player "${r.name}" (${meta.customId})`);
      continue;
    }
    if (seenPlayerIds.has(player.id)) {
      console.warn(`[draftRankings] Duplicate player "${r.name}" in ${meta.customId}; skipping lower rank`);
      continue;
    }
    seenPlayerIds.add(player.id);
    rows.push({
      id: generateId(),
      playerId: player.id,
      rankingType: meta.rankingType,
      scoringFormat: meta.scoringFormat,
      superflex: meta.superflex,
      overallRank: r.overallRank,
      positionRank: r.positionRank,
      tier: Math.min(Math.max(r.tier, 1), 8),
      projectedPoints: r.projectedPoints,
      adp: player.adp,
      adpDelta: player.adp != null ? r.overallRank - player.adp : null,
      rationale: r.rationale || '',
      analysis: r.analysis || null,
      seasonYear,
      generatedAt: now,
    });
  }

  // Atomically wipe old rows + insert new rows in one D1 batch. Either every
  // statement lands or none do — no partial-list window where users see
  // rank 1-50 of a 200-row variant because the worker died mid-loop.
  const deleteStmt = db.delete(schema.draftRankings).where(
    and(
      eq(schema.draftRankings.rankingType, meta.rankingType),
      eq(schema.draftRankings.scoringFormat, meta.scoringFormat),
      eq(schema.draftRankings.superflex, meta.superflex),
      eq(schema.draftRankings.seasonYear, seasonYear),
    ),
  );

  // D1 enforces a tight bound on SQL variables (~100 total). With 16 columns
  // per draft_rankings row, even a 5-row multi-insert hits the ceiling once
  // combined with DELETE bindings in the same batch — so insert one row per
  // statement. The batch is still a single atomic unit; ~201 statements per
  // variant is well within D1's batch-size limit.
  const statements: unknown[] = [deleteStmt];
  for (const row of rows) {
    statements.push(db.insert(schema.draftRankings).values(row));
  }

  if (statements.length === 1) {
    // No rows to insert — just run the delete on its own.
    await deleteStmt;
    return { ok: true, count: 0 };
  }

  await db.batch(statements as any);

  console.log(`[draftRankings] Wrote ${rows.length} rows for ${meta.customId}`);
  return { ok: true, count: rows.length };
}

// ── Default variants helper ─────────────────────────────────────────

export const DEFAULT_VARIANTS: RankingVariant[] = [
  { rankingType: 'redraft', scoringFormat: 'ppr', superflex: false },
  { rankingType: 'redraft', scoringFormat: 'half-ppr', superflex: false },
  { rankingType: 'dynasty_rookie', scoringFormat: 'ppr', superflex: false },
  { rankingType: 'dynasty_rookie', scoringFormat: 'half-ppr', superflex: false },
];
