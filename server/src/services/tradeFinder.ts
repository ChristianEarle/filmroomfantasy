/**
 * Trade Finder (Feature 2).
 *
 * Two-stage pipeline:
 *
 *  Stage A — deterministic structure (no AI):
 *   1. Load rosters for every team in the league.
 *   2. Build a single TradeContext with facts for every rostered player.
 *   3. Compute PlayerValuations (ROS pts × scarcity × schedule × injury).
 *   4. Build a TeamComposition for every team: who is a starter, who is
 *      depth, who is surplus, and which positions are a real need.
 *   5. Run the needs-aware matcher — for each partner, pair the user's
 *      surplus with their needs AND the partner's surplus with theirs.
 *      Every surviving candidate has mutual-benefit fit reasons attached.
 *
 *  Stage B — qualitative AI analysis (per survivor, in parallel):
 *   6. Hand each candidate to Claude with the matcher's fit reasons as
 *      a HINT block. Claude reasons about real-world trade dynamics
 *      (injury timing, schedule, playoff leverage, strategy) and
 *      returns a fairness score + team grades + winner explanation.
 *   7. Filter trades whose fairness diff exceeds MAX_FAIRNESS_DIFF and
 *      return the survivors sorted most-fair-first.
 *
 * If the matcher returns nothing (edge case: over-filtered), we fall
 * back to the legacy brute-force generator in candidateFilter.ts so
 * the user still sees something.
 *
 * Team Needs Dashboard is still AI-generated narrative — the matcher
 * operates on a separate deterministic need model (teamComposition.ts)
 * that produces machine-readable surplus/need data.
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
  pickDiverseTop,
  sortByProxy,
  scoreCandidate,
  type ScoredCandidate,
} from './candidateFilter';
import {
  buildValuationMap,
  type PlayerValuation,
} from './playerValuation';
import {
  buildTeamComposition,
  type TeamComposition,
} from './teamComposition';
import {
  matchTrades,
  pickDiverseMatches,
  type MatchedCandidate,
} from './tradeMatcher';

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
  /** Deterministic pre-AI fit metadata surfaced by the matcher. The AI
   *  agrees/disagrees in its analysis, but these reasons give the user
   *  a clear explanation of WHY the trade is on the list in the first
   *  place. Arrays are never null — empty means "no matcher rationale". */
  fit: {
    /** Short phrases like "Fills a starter-level hole at RB" */
    forYou: string[];
    /** Phrases describing why the partner would consider it */
    forThem: string[];
    /** Positions the matcher considered "addressed" on each side */
    userNeedsMet: string[];
    partnerNeedsMet: string[];
  };
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

  // 3. Build deterministic valuations for every rostered player once.
  //    These power both the team-composition analysis and the matcher.
  const valuations = buildValuationMap(
    megaContext.players,
    leagueSettings,
    currentWeek
  );

  // 4. Build a TeamComposition for every team in the league. This gives
  //    us needs / surplus / role per player — the structure the matcher
  //    needs to pair trades intelligently instead of brute-forcing.
  const compositionsByTeam = new Map<string, TeamComposition>();
  for (const team of allTeams) {
    const roster = rosterByTeam.get(team.id) || [];
    const comp = buildTeamComposition({
      teamId: team.id,
      rosteredPlayerIds: roster.map((r) => r.playerId),
      valuations,
      settings: leagueSettings,
    });
    compositionsByTeam.set(team.id, comp);
  }
  const userComp = compositionsByTeam.get(userTeamId);
  if (!userComp) return [];

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

  // Respect the "Trade Assets" restriction: user only willing to send
  // these specific player ids. Defensively drop anything not on the
  // user's roster so a stale client payload can't smuggle in foreign ids.
  const userRoster = rosterByTeam.get(userTeamId) || [];
  const userRosterPlayerIds = new Set(userRoster.map((r) => r.playerId));
  const restrictUserAssets =
    userPlayerIds && userPlayerIds.length > 0
      ? userPlayerIds.filter((id) => userRosterPlayerIds.has(id))
      : null;

  // 5. Run the needs-aware matcher against each potential partner.
  const partnerTeamIds = targetTeamId
    ? [targetTeamId]
    : allTeams.filter((t) => t.id !== userTeamId).map((t) => t.id);

  const allMatched: Array<MatchedCandidate & { targetTeamId: string }> = [];

  for (const partnerId of partnerTeamIds) {
    const partnerComp = compositionsByTeam.get(partnerId);
    if (!partnerComp) continue;

    const matched = matchTrades({
      userComp,
      partnerComp,
      valuations,
      factsById,
      settings: leagueSettings,
      options: {
        maxCandidates: 10,
        imbalanceTolerance: 0.25,
        targetPosition: targetPosition ?? null,
        restrictUserAssets,
      },
    });

    for (const m of matched) {
      allMatched.push({ ...m, targetTeamId: partnerId });
    }
  }

  // 6. Fallback: if the needs-aware matcher produced nothing (e.g.
  //    extreme filter combination), fall back to the legacy brute-force
  //    generator so the user still sees SOMETHING rather than an empty
  //    state. We mark these as "no fit rationale".
  let topGlobal: Array<{
    targetTeamId: string;
    sendPlayerIds: string[];
    receivePlayerIds: string[];
    fit: TradeRecommendation['fit'];
  }>;

  if (allMatched.length > 0) {
    // Primary path: sort by matcher score (lower = better) and apply
    // a per-player diversity cap so no single player dominates output.
    // The generic pickDiverseMatches preserves the attached targetTeamId.
    allMatched.sort((a, b) => a.score - b.score);
    const overFetch = Math.max(maxRecommendations * 3, 16);
    const diverse = pickDiverseMatches(
      allMatched.slice(0, overFetch),
      maxRecommendations,
      2
    );
    topGlobal = diverse.map((m) => ({
      targetTeamId: m.targetTeamId,
      sendPlayerIds: m.sendPlayerIds,
      receivePlayerIds: m.receivePlayerIds,
      fit: {
        forYou: m.fitReasons.forYou,
        forThem: m.fitReasons.forThem,
        userNeedsMet: m.userNeedsMet,
        partnerNeedsMet: m.partnerNeedsMet,
      },
    }));
  } else {
    // Fallback path: the old brute-force generator. Kept as a safety net.
    const fullUserAssetIds = userRoster
      .filter((r) => r.player && !['K', 'DEF'].includes(r.player.position))
      .map((r) => r.playerId);
    const userAssetIds = restrictUserAssets ?? fullUserAssetIds;
    const sortedUserAssetIds = sortByProxy(userAssetIds, factsById);
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
      const sortedPartnerAssetIds = sortByProxy(partnerAssetIds, factsById);
      const candidates = generateCandidates(
        sortedUserAssetIds,
        sortedPartnerAssetIds,
        { max1v1: 40, max2v1: 25, max1v2: 25 }
      );
      const scored = candidates.map((c) => scoreCandidate(c, factsById));
      scored.sort((a, b) => a.preFilterScore - b.preFilterScore);
      for (const s of scored.slice(0, 12)) {
        allScored.push({ ...s, targetTeamId: partnerId });
      }
    }
    // Silence unused-import warning; topCandidates is still exported
    // from candidateFilter for other callers.
    void topCandidates;

    allScored.sort((a, b) => a.preFilterScore - b.preFilterScore);
    const overFetch = Math.max(maxRecommendations * 3, 16);
    const diverse = pickDiverseTop(
      allScored.slice(0, overFetch),
      maxRecommendations,
      2
    );
    topGlobal = diverse.map((s) => {
      const fallback = s as ScoredCandidate & { targetTeamId: string };
      return {
        targetTeamId: fallback.targetTeamId,
        sendPlayerIds: fallback.candidate.sendPlayerIds,
        receivePlayerIds: fallback.candidate.receivePlayerIds,
        fit: {
          forYou: [],
          forThem: [],
          userNeedsMet: [],
          partnerNeedsMet: [],
        },
      };
    });
  }

  if (topGlobal.length === 0) return [];

  // 7. Run AI analysis on each survivor in parallel, passing the fit
  //    reasons as additional context so Claude can agree/disagree with
  //    the matcher's rationale rather than reasoning from raw rosters.
  const results = await Promise.all(
    topGlobal.map((surv) =>
      analyzeCandidateWithAI({
        anthropicKey,
        userTeam,
        targetTeam: allTeams.find((t) => t.id === surv.targetTeamId)!,
        sendPlayerIds: surv.sendPlayerIds,
        receivePlayerIds: surv.receivePlayerIds,
        fit: surv.fit,
        factsById,
        context: megaContext,
        extraUserPicks: normalizedPicks,
        valuations,
      })
    )
  );

  // 8. Post-process: drop wildly unfair trades and sort by fairness.
  //
  // Because the matcher already enforces a 25% value tolerance AND
  // needs-mutual-benefit, the AI almost never returns a "robbery"
  // now. We keep a looser MAX_FAIRNESS_DIFF (30) as a belt-and-braces
  // filter — anything beyond that is truly one-sided and would be
  // rejected in real life.
  const MAX_FAIRNESS_DIFF = 30;
  const valid = results.filter((r): r is TradeRecommendation => r != null);

  return valid
    .filter((rec) => rec.analysis.fairnessScore.diff <= MAX_FAIRNESS_DIFF)
    .sort((a, b) => a.analysis.fairnessScore.diff - b.analysis.fairnessScore.diff);
}

interface AnalyzeArgs {
  anthropicKey: string;
  userTeam: { id: string; name: string };
  targetTeam: { id: string; name: string };
  /** Exact player ids to send/receive for this candidate */
  sendPlayerIds: string[];
  receivePlayerIds: string[];
  /** Pre-computed fit reasons from the matcher. Empty arrays if the
   *  fallback brute-force generator produced this candidate. */
  fit: TradeRecommendation['fit'];
  factsById: Map<string, PlayerFacts>;
  context: TradeContext;
  /** Picks appended to the user's send side for every candidate
   *  (from the "required assets" input). Passed to the AI as context
   *  and echoed back on the TradeRecommendation. */
  extraUserPicks?: DraftPickAsset[];
  /** Deterministic valuations — used only to surface debug numbers
   *  in the AI prompt for transparency; the AI is still the authority. */
  valuations?: Map<string, PlayerValuation>;
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
    sendPlayerIds,
    receivePlayerIds,
    fit,
    factsById,
    context,
    extraUserPicks = [],
  } = args;

  const sendFacts = sendPlayerIds
    .map((id) => factsById.get(id))
    .filter((p): p is PlayerFacts => p != null);
  const receiveFacts = receivePlayerIds
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

  // If the matcher produced fit reasons, format them into a block the
  // AI can reference. The AI is free to agree or disagree — these are
  // hints, not facts.
  const hasFitReasons =
    fit.forYou.length > 0 || fit.forThem.length > 0 ||
    fit.userNeedsMet.length > 0 || fit.partnerNeedsMet.length > 0;
  const fitBlock = hasFitReasons
    ? `\n--- MATCHER RATIONALE (why this trade was surfaced) ---\n` +
      (fit.forYou.length > 0
        ? `Reasons for ${userTeam.name}:\n${fit.forYou.map((r) => `  - ${r}`).join('\n')}\n`
        : '') +
      (fit.forThem.length > 0
        ? `Reasons for ${targetTeam.name}:\n${fit.forThem.map((r) => `  - ${r}`).join('\n')}\n`
        : '') +
      (fit.userNeedsMet.length > 0
        ? `Positions addressed for ${userTeam.name}: ${fit.userNeedsMet.join(', ')}\n`
        : '') +
      (fit.partnerNeedsMet.length > 0
        ? `Positions addressed for ${targetTeam.name}: ${fit.partnerNeedsMet.join(', ')}\n`
        : '') +
      `Note: the matcher uses a deterministic surplus/need model. You are the final judge — agree or disagree with the rationale based on the player facts.\n`
    : '';

  const systemPrompt = `You are an expert fantasy football trade analyst scoring a proposed trade that the Trade Finder pre-filtered as a potentially interesting candidate. Apply the same AI-first principles you always use: no rigid rules, reason about context, use the TRADE CONTEXT facts as ground truth.

The Trade Finder's matcher surfaces trades by pairing one team's SURPLUS with the other team's NEED. When you see a "MATCHER RATIONALE" block in the user message, treat it as a HINT about why the trade was proposed — you may confirm, refine, or reject the reasoning. Your fairness score and winner judgment are what the user sees.

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
${fitBlock}
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
      fit,
      analysis: parsed,
    };
  } catch (err) {
    console.error('[tradeFinder] candidate analysis failed:', err);
    return null;
  }
}
