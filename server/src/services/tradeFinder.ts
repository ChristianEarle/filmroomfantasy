/**
 * Trade Finder (Feature 2).
 *
 * Workflow for finding recommendations:
 *  1. Load rosters for all teams in the league.
 *  2. Identify each team's best players (by facts — no judgment here).
 *  3. For each OPPONENT team, generate candidate packages between the user
 *     and that team using candidateFilter.generateCandidates.
 *  4. Pre-filter to the top ~10 across all opponents with scoreCandidate.
 *  5. Hand each surviving candidate to Claude in parallel for a full
 *     AI-graded analysis, then return the AI outputs to the caller.
 *
 * Team Needs Dashboard is also AI-generated, not hard-coded grades. We
 * build a per-team roster + TradeContext and ask Claude for a structured
 * {window, positionGrades, topNeeds, topStrengths} response.
 */

import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import {
  buildTradeContext,
  formatTradeContextForPrompt,
  type PlayerFacts,
  type LeagueSettings,
  type TradeContext,
} from './tradeContext';
import {
  generateCandidates,
  topCandidates,
  type ScoredCandidate,
} from './candidateFilter';

type DB = ReturnType<typeof drizzle<typeof schema>>;

// ── Types ────────────────────────────────────────────────────────────

export interface TeamNeeds {
  teamId: string;
  teamName: string;
  window: 'win-now' | 'contending' | 'mid' | 'fringe' | 'rebuilding';
  positionGrades: Record<string, string>; // QB: 'B+', RB: 'A-', etc.
  topNeeds: string[]; // human-readable, e.g. "Starting RB2"
  topStrengths: string[];
  summary: string;
}

export interface DraftPickAsset {
  year: number;
  round: number;
}

export interface TradeRecommendation {
  targetTeamId: string;
  targetTeamName: string;
  userSends: Array<{
    playerId: string;
    name: string;
    position: string;
  }>;
  userReceives: Array<{
    playerId: string;
    name: string;
    position: string;
  }>;
  /** Draft picks the user is throwing into every candidate (from the
   *  "required assets" input). Not valued by the candidate pre-filter
   *  — the AI reasons about them in the analysis step. */
  userSendsPicks: DraftPickAsset[];
  analysis: {
    winner: string;
    winnerExplanation: string;
    teamGrades: Array<{ team: string; grade: string; summary: string }>;
    fairnessScore: { score: number; diff: number; favored: string };
    improvements: string[];
    keyFactors: string[];
  };
}

// ── Needs Dashboard ───────────────────────────────────────────────────

export async function buildTeamNeeds(
  db: DB,
  anthropicKey: string,
  leagueId: string,
  teamId: string,
  leagueSettings: LeagueSettings,
  seasonYear: number,
  currentWeek: number
): Promise<TeamNeeds | null> {
  // Get the team's full roster + some TradeContext facts
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
  });
  if (!team) return null;

  const rosterSpots = await db.query.rosterSpots.findMany({
    where: eq(schema.rosterSpots.teamId, teamId),
    with: { player: true },
  });
  const playerIds = rosterSpots.map((r) => r.playerId);

  const ctx = await buildTradeContext({
    db,
    playerIds,
    leagueSettings,
    seasonYear,
    currentWeek,
    leagueId,
    userTeamId: teamId,
  });

  const systemPrompt = `You are an expert fantasy football roster analyst. Given a team's full roster and context, produce a needs assessment in JSON.

Principles:
- AI-first. Do not apply rigid rules like "2 RBs needed = B-". Reason from the facts you're given.
- A "need" depends on league settings (superflex, TE premium, PPR, etc.), roster construction, and the team's actual standing/record.
- A team that is 2-8 needs different things than a team that is 8-2. Weight accordingly.
- Do not invent data. If projections are sparse (offseason), reason with what you have and acknowledge the limitation in the summary.

Respond with ONLY valid JSON:
{
  "window": "win-now" | "contending" | "mid" | "fringe" | "rebuilding",
  "positionGrades": { "QB": "B+", "RB": "A-", "WR": "C", "TE": "B", "K": "C", "DEF": "B" },
  "topNeeds": ["Starting RB2 with stable volume", "..."],
  "topStrengths": ["Elite WR corps", "..."],
  "summary": "2-3 sentences on the team's overall position and what they should prioritize."
}

Rules:
- Do NOT output letter grades as an average of some formula. Use holistic judgment.
- topNeeds should be 1-3 items, concrete. topStrengths 1-3 items.
- Any grade from A+ to F is valid. Not every team is mediocre.`;

  const userMessage = `Analyze this team's roster and return the JSON needs assessment.

${formatTradeContextForPrompt(ctx)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === 'text');
    const rawText = textBlock?.text?.trim();
    if (!rawText) return null;
    const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as Omit<TeamNeeds, 'teamId' | 'teamName'>;
    return {
      teamId,
      teamName: team.name,
      ...parsed,
    };
  } catch (err) {
    console.error('[tradeFinder] needs assessment failed:', err);
    return null;
  }
}

// ── Recommendations ──────────────────────────────────────────────────

interface FindRecommendationsArgs {
  db: DB;
  anthropicKey: string;
  leagueId: string;
  userTeamId: string;
  leagueSettings: LeagueSettings;
  seasonYear: number;
  currentWeek: number;
  targetPosition?: string | null;
  targetTeamId?: string | null;
  maxRecommendations?: number;
  /** Optional: if set, the user's candidate pool is restricted to
   *  these player IDs (all must be on their roster). Picks are not
   *  scored in the pre-filter but are threaded through to every
   *  surviving candidate as mandatory "user sends" assets. */
  userPlayerIds?: string[] | null;
  userPicks?: DraftPickAsset[] | null;
}

export async function findTradeRecommendations(
  args: FindRecommendationsArgs
): Promise<TradeRecommendation[]> {
  const {
    db,
    anthropicKey,
    leagueId,
    userTeamId,
    leagueSettings,
    seasonYear,
    currentWeek,
    targetPosition,
    targetTeamId,
    maxRecommendations = 5,
    userPlayerIds,
    userPicks,
  } = args;

  // 1. Load ALL teams in the league + their rosters
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });
  const userTeam = allTeams.find((t) => t.id === userTeamId);
  if (!userTeam) return [];

  const allRosterSpots = await db.query.rosterSpots.findMany({
    where: inArray(
      schema.rosterSpots.teamId,
      allTeams.map((t) => t.id)
    ),
    with: { player: true },
  });

  // Map: teamId -> player rows
  const rosterByTeam = new Map<
    string,
    Array<{ playerId: string; player: (typeof allRosterSpots)[number]['player'] }>
  >();
  for (const r of allRosterSpots) {
    const list = rosterByTeam.get(r.teamId) || [];
    list.push({ playerId: r.playerId, player: r.player });
    rosterByTeam.set(r.teamId, list);
  }

  // 2. Build one big TradeContext containing facts for every rostered player
  // (fetched together so we don't hammer D1)
  const allPlayerIds = Array.from(
    new Set(allRosterSpots.map((r) => r.playerId))
  );
  const megaContext = await buildTradeContext({
    db,
    playerIds: allPlayerIds,
    leagueSettings,
    seasonYear,
    currentWeek,
    leagueId,
    userTeamId,
  });

  // Map: playerId -> PlayerFacts
  const factsById = new Map<string, PlayerFacts>();
  for (const p of megaContext.players) factsById.set(p.id, p);

  // 3. Pick user's "tradeable" assets.
  //    - By default: every rostered player minus K/DEF. The AI decides
  //      who is untouchable.
  //    - If userPlayerIds is provided: restrict to those IDs (but still
  //      drop anything not actually on the user's roster, defensively).
  const userRoster = rosterByTeam.get(userTeamId) || [];
  const userRosterPlayerIds = new Set(userRoster.map((r) => r.playerId));
  const fullUserAssetIds = userRoster
    .filter((r) => r.player && !['K', 'DEF'].includes(r.player.position))
    .map((r) => r.playerId);

  const requestedIds = (userPlayerIds || []).filter((id) =>
    userRosterPlayerIds.has(id)
  );
  const userAssetIds =
    requestedIds.length > 0 ? requestedIds : fullUserAssetIds;

  // Normalize the pick list (only numeric year + round, dedup by year+round)
  const normalizedPicks: DraftPickAsset[] = Array.isArray(userPicks)
    ? userPicks
        .filter(
          (p) =>
            p && Number.isFinite(p.year) && Number.isFinite(p.round) &&
            p.round >= 1 && p.round <= 10 && p.year >= 2020 && p.year <= 2040
        )
        .map((p) => ({ year: Math.trunc(p.year), round: Math.trunc(p.round) }))
    : [];

  // 4. For each potential partner team, generate candidates and pre-filter
  const partnerTeamIds = targetTeamId
    ? [targetTeamId]
    : allTeams.filter((t) => t.id !== userTeamId).map((t) => t.id);

  const allScored: Array<ScoredCandidate & { targetTeamId: string }> = [];

  for (const partnerId of partnerTeamIds) {
    const partnerRoster = rosterByTeam.get(partnerId) || [];
    const partnerAssetIds = partnerRoster
      .filter((r) => r.player && !['K', 'DEF'].includes(r.player.position))
      .filter((r) => {
        if (!targetPosition) return true;
        return r.player?.position === targetPosition;
      })
      .map((r) => r.playerId);

    if (partnerAssetIds.length === 0) continue;

    const candidates = generateCandidates(userAssetIds, partnerAssetIds, 100);
    const scored = topCandidates(candidates, factsById, 5);
    for (const s of scored) {
      allScored.push({ ...s, targetTeamId: partnerId });
    }
  }

  // 5. Global top-N across partners by pre-filter score
  allScored.sort((a, b) => a.preFilterScore - b.preFilterScore);
  const topGlobal = allScored.slice(0, maxRecommendations);

  if (topGlobal.length === 0) return [];

  // 6. Run AI analysis on each survivor in parallel
  const results = await Promise.all(
    topGlobal.map((scored) =>
      analyzeCandidateWithAI({
        anthropicKey,
        userTeam,
        targetTeam: allTeams.find((t) => t.id === scored.targetTeamId)!,
        candidate: scored,
        factsById,
        context: megaContext,
        extraUserPicks: normalizedPicks,
      })
    )
  );

  return results.filter((r): r is TradeRecommendation => r != null);
}

interface AnalyzeArgs {
  anthropicKey: string;
  userTeam: { id: string; name: string };
  targetTeam: { id: string; name: string };
  candidate: ScoredCandidate & { targetTeamId: string };
  factsById: Map<string, PlayerFacts>;
  context: TradeContext;
  /** Picks appended to the user's send side for every candidate
   *  (from the "required assets" input). Passed to the AI as context
   *  and echoed back on the TradeRecommendation. */
  extraUserPicks?: DraftPickAsset[];
}

function formatPick(pick: DraftPickAsset): string {
  const ord =
    pick.round === 1
      ? '1st'
      : pick.round === 2
      ? '2nd'
      : pick.round === 3
      ? '3rd'
      : `${pick.round}th`;
  return `${pick.year} ${ord} Round Pick`;
}

async function analyzeCandidateWithAI(
  args: AnalyzeArgs
): Promise<TradeRecommendation | null> {
  const {
    anthropicKey,
    userTeam,
    targetTeam,
    candidate,
    factsById,
    context,
    extraUserPicks = [],
  } = args;

  const sendFacts = candidate.candidate.sendPlayerIds
    .map((id) => factsById.get(id))
    .filter((p): p is PlayerFacts => p != null);
  const receiveFacts = candidate.candidate.receivePlayerIds
    .map((id) => factsById.get(id))
    .filter((p): p is PlayerFacts => p != null);

  const sendPlayerLabels = sendFacts.map(
    (p) => `${p.name} (${p.position}, ${p.nflTeam})`
  );
  const sendPickLabels = extraUserPicks.map(formatPick);
  const sendLabels = [...sendPlayerLabels, ...sendPickLabels];

  const tradeDescription =
    `${userTeam.name} sends: ${sendLabels.join(', ') || '(nothing)'}\n` +
    `${targetTeam.name} sends: ${receiveFacts
      .map((p) => `${p.name} (${p.position}, ${p.nflTeam})`)
      .join(', ')}`;

  // Build a subset TradeContext containing only the players in this trade
  const relevantFacts = [...sendFacts, ...receiveFacts];
  const subsetContext: TradeContext = {
    ...context,
    players: relevantFacts,
  };

  const systemPrompt = `You are an expert fantasy football trade analyst scoring a proposed trade that the Trade Finder pre-filtered as a potentially interesting candidate. Apply the same AI-first principles you always use: no rigid rules, reason about context, use the TRADE CONTEXT facts as ground truth.

Respond with ONLY valid JSON:
{
  "winner": "Team name (must match an input team name exactly)",
  "winnerExplanation": "2 sentences",
  "teamGrades": [{ "team": "...", "grade": "A+..F", "summary": "..." }],
  "fairnessScore": { "score": 0-100, "diff": 0, "favored": "..." },
  "improvements": ["..."],
  "keyFactors": ["factor 1", "factor 2"]
}

Teams in this trade: ${userTeam.name}, ${targetTeam.name}.`;

  const userMessage = `Analyze this trade the Trade Finder surfaced:

${tradeDescription}

${formatTradeContextForPrompt(subsetContext)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === 'text');
    const rawText = textBlock?.text?.trim();
    if (!rawText) return null;
    const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as TradeRecommendation['analysis'];

    // Clamp + validate
    parsed.fairnessScore = parsed.fairnessScore || {
      score: 50,
      diff: 0,
      favored: parsed.winner,
    };
    parsed.fairnessScore.score = Math.max(
      0,
      Math.min(100, Math.round(parsed.fairnessScore.score))
    );
    parsed.fairnessScore.diff = Math.abs(parsed.fairnessScore.score - 50);
    parsed.improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.slice(0, 4)
      : [];
    parsed.keyFactors = Array.isArray(parsed.keyFactors)
      ? parsed.keyFactors.slice(0, 6)
      : [];

    return {
      targetTeamId: targetTeam.id,
      targetTeamName: targetTeam.name,
      userSends: sendFacts.map((p) => ({
        playerId: p.id,
        name: p.name,
        position: p.position,
      })),
      userReceives: receiveFacts.map((p) => ({
        playerId: p.id,
        name: p.name,
        position: p.position,
      })),
      userSendsPicks: extraUserPicks,
      analysis: parsed,
    };
  } catch (err) {
    console.error('[tradeFinder] candidate analysis failed:', err);
    return null;
  }
}
