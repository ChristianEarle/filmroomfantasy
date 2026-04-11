/**
 * Trade Finder (Feature 2).
 *
 * Architecture: enumerate → rank → verify.
 *
 *  Phase 0 — setup (no AI, ~50ms):
 *   1. Load rosters for every team in the league.
 *   2. Build TradeContext with facts for every rostered player.
 *   3. Compute PlayerValuations (ROS pts × scarcity × schedule × injury).
 *   4. Build TeamComposition for every team: starter / depth / surplus
 *      / needs per position.
 *
 *  Phase 1 — deterministic enumeration (no AI):
 *   5. For each partner team, run tradeMatcher to produce balanced,
 *      pick-aware, needs-aware candidate trades. Shapes: 1v1, 2v1,
 *      1v2, 2v2, 3v1. When restrictUserAssets is set, every
 *      candidate is STRUCTURALLY seeded with one of those assets
 *      on the sent side. When hasUserPicks is true, estimated pick
 *      value is folded into the user's side so the matcher finds
 *      upgrades instead of sidegrades.
 *   6. Merge, dedupe, and cap to a small pool (~30 candidates). As
 *      long as any balanced trade exists in the league, Phase 1
 *      produces a non-empty pool. "AI returned 0 trades for
 *      mysterious reasons" is structurally impossible.
 *
 *  Phase 2 — Claude ranks the pool (one call):
 *   7. rankCandidates passes the top ~30 to Claude with user context
 *      and asks it to pick the best 5 with one-sentence per-side
 *      reasoning. Claude never constructs trades from scratch and
 *      never echoes player IDs — it just picks short candidateIds
 *      from the list we showed it.
 *   8. If Phase 2 returns an empty set or garbage, the finder falls
 *      back to the top 5 from Phase 1 by heuristic score. We always
 *      have something to serve as long as Phase 1 produced anything.
 *
 *  Phase 3 — trusted-analyzer verification (parallel AI):
 *   9. Each picked candidate goes through analyzeCandidateWithAI (the
 *      same trusted analyzer as the manual /analyze route) which
 *      independently grades fairness, winner, and team letter grades.
 *
 *  Phase 4 — realistic-acceptance filter:
 *  10. Default mode: zero-tolerance on partner-favored, user grade
 *      must be B- or better, user-favored capped at diff ≤ 15.
 *  11. Opt-in mode (when restrictUserAssets or userPicks is set):
 *      softer thresholds that respect the user's explicit choice to
 *      offer specific assets / accept a small premium for an upgrade.
 *
 * Team Needs Dashboard is a separate AI-generated narrative — see
 * buildTeamNeeds below. It uses the same Claude client but a different
 * prompt with no trade construction.
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
  buildValuationMap,
  sumPickValues,
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
import {
  rankCandidates,
  type RankableCandidate,
} from './tradeConstructor';
import {
  analyzeTrade,
  buildTradeDescription as buildTradeAnalyzerDescription,
  type AnalyzeTradeBody,
  type TradeAssetInput as TradeAnalyzerAssetInput,
} from './tradeAnalyzer';
import {
  fetchPlayerData,
  formatPlayerDataBlock,
  type EnrichedPlayerData,
} from './tradePlayerEnrichment';

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
  /** The league's actual type — threaded into the trusted analyzer so
   *  dynasty users get dynasty-calibrated grades (age and future-value
   *  reasoning) instead of redraft grades. Falls back to 'redraft' if
   *  unset. */
  leagueType?: 'redraft' | 'dynasty' | 'keeper';
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
    leagueType = 'redraft',
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

  const partnerTeamIds = targetTeamId
    ? [targetTeamId]
    : allTeams.filter((t) => t.id !== userTeamId).map((t) => t.id);

  // 6. Phase 1 — deterministic enumeration. For each partner team,
  //    run the matcher to generate a pool of balanced, pick-aware,
  //    needs-aware candidates. Merge, dedupe, and cap to ~30.
  type ValidatedTrade = {
    targetTeamId: string;
    sendPlayerIds: string[];
    receivePlayerIds: string[];
    fit: TradeRecommendation['fit'];
  };

  const hasUserPicks = normalizedPicks.length > 0;
  const pickValueSum = sumPickValues(
    hasUserPicks ? normalizedPicks : null,
    leagueType,
    seasonYear
  );
  if (hasUserPicks) {
    console.log(
      `[tradeFinder] user picks valued at ${pickValueSum} (${leagueType}, ${normalizedPicks.length} pick(s))`
    );
  }

  const enumeratedPool: Array<MatchedCandidate & { targetTeamId: string; targetTeamName: string }> = [];
  for (const partnerId of partnerTeamIds) {
    const partnerComp = compositionsByTeam.get(partnerId);
    if (!partnerComp) continue;
    const partnerTeam = allTeams.find((t) => t.id === partnerId);
    if (!partnerTeam) continue;

    const matched = matchTrades({
      userComp,
      partnerComp,
      valuations,
      factsById,
      settings: leagueSettings,
      options: {
        maxCandidates: 20,
        imbalanceTolerance: 0.25,
        targetPosition: targetPosition ?? null,
        restrictUserAssets,
        pickValueSum,
        maxPlayersPerSide: 3,
      },
    });

    for (const m of matched) {
      enumeratedPool.push({
        ...m,
        targetTeamId: partnerId,
        targetTeamName: partnerTeam.name,
      });
    }
  }

  console.log(
    `[tradeFinder] phase1 enumerated ${enumeratedPool.length} candidates across ${new Set(enumeratedPool.map((c) => c.targetTeamId)).size} partners`
  );

  if (enumeratedPool.length === 0) {
    console.log('[tradeFinder] phase1 empty — no balanced trade exists; returning []');
    return [];
  }

  // Sort by score (lower is better — see matcher scoring) and trim to
  // top 30 with per-player diversity so no single player dominates.
  enumeratedPool.sort((a, b) => a.score - b.score);
  const TOP_POOL_SIZE = 30;
  const diversePool = pickDiverseMatches(
    enumeratedPool.slice(0, TOP_POOL_SIZE * 2),
    TOP_POOL_SIZE,
    3
  );

  console.log(
    `[tradeFinder] phase1 diverse pool: ${diversePool.length} candidates after dedup`
  );

  // Tag each with a short candidateId the ranker can echo back.
  const rankablePool: RankableCandidate[] = diversePool.map((c, idx) => {
    const partnerComp = compositionsByTeam.get(c.targetTeamId);
    const partnerTeam = allTeams.find((t) => t.id === c.targetTeamId);
    return {
      ...c,
      candidateId: `c${String(idx + 1).padStart(2, '0')}`,
      partnerTeamId: c.targetTeamId,
      partnerTeamName: c.targetTeamName,
      partnerNeeds:
        partnerComp?.needs.map((n) => ({
          position: n.position,
          level: n.level,
        })) ?? [],
      partnerRecord: partnerTeam
        ? `${partnerTeam.wins}-${partnerTeam.losses}${partnerTeam.ties ? `-${partnerTeam.ties}` : ''}`
        : null,
    };
  });

  // 7. Phase 2 — one Claude call to rank the pool. If the model returns
  //    an empty set or garbage, fall back to the top 5 by heuristic
  //    score from Phase 1.
  const goalHintParts: string[] = [];
  if (restrictUserAssets && restrictUserAssets.length > 0) {
    const names = restrictUserAssets
      .map((id) => factsById.get(id)?.name ?? id)
      .join(' + ');
    goalHintParts.push(`User explicitly chose to offer ${names}`);
  }
  if (hasUserPicks) {
    const picksStr = normalizedPicks
      .map((p) => `${p.year} round ${p.round}`)
      .join(' + ');
    goalHintParts.push(`user is offering ${picksStr} as a bonus`);
  }
  if (targetPosition) {
    goalHintParts.push(`user wants to upgrade at ${targetPosition}`);
  }
  const goalHint = goalHintParts.length > 0 ? goalHintParts.join('; ') : null;

  const userRecord = `${userTeam.wins}-${userTeam.losses}${userTeam.ties ? `-${userTeam.ties}` : ''}`;
  const rankResult = await rankCandidates({
    anthropicKey,
    candidates: rankablePool,
    userTeamName: userTeam.name,
    userTeamRecord: userRecord,
    userComp,
    factsById,
    valuations,
    desiredCount: Math.max(maxRecommendations, 5),
    goalHint,
  });

  const rankedById = new Map(rankablePool.map((c) => [c.candidateId, c]));
  let topGlobal: ValidatedTrade[] = [];

  if (rankResult && rankResult.picks.length > 0) {
    for (const pick of rankResult.picks) {
      const source = rankedById.get(pick.candidateId);
      if (!source) continue;
      topGlobal.push({
        targetTeamId: source.partnerTeamId,
        sendPlayerIds: source.sendPlayerIds,
        receivePlayerIds: source.receivePlayerIds,
        fit: {
          forYou: pick.userReasoning
            ? [pick.userReasoning]
            : source.fitReasons.forYou,
          forThem: pick.partnerReasoning
            ? [pick.partnerReasoning]
            : source.fitReasons.forThem,
          userNeedsMet: source.userNeedsMet,
          partnerNeedsMet: source.partnerNeedsMet,
        },
      });
    }
    console.log(
      `[tradeFinder] phase2 ranker picked ${topGlobal.length} candidates`
    );
  }

  // Phase 2 fallback — if the model picked nothing useful, use the top
  // N from Phase 1 directly. We always have something as long as the
  // enumerated pool is non-empty.
  if (topGlobal.length === 0) {
    console.log(
      '[tradeFinder] phase2 produced 0 picks — falling back to top-by-score from phase1'
    );
    const fallbackCount = Math.max(maxRecommendations, 5);
    topGlobal = rankablePool.slice(0, fallbackCount).map((c) => ({
      targetTeamId: c.partnerTeamId,
      sendPlayerIds: c.sendPlayerIds,
      receivePlayerIds: c.receivePlayerIds,
      fit: {
        forYou: c.fitReasons.forYou,
        forThem: c.fitReasons.forThem,
        userNeedsMet: c.userNeedsMet,
        partnerNeedsMet: c.partnerNeedsMet,
      },
    }));
  }

  if (topGlobal.length === 0) return [];

  // 7. Pre-fetch enrichment (season stats, trend, news) for every
  //    player that appears in any surviving candidate. This matches
  //    the input the manual /analyze route provides to the trusted
  //    analyzer, including the recent-news block that catches
  //    "role reduced", "benched", "trade rumor" signals the
  //    structural TradeContext doesn't carry. One query batch,
  //    reused across all parallel verification calls.
  const allCandidatePlayerIds = new Set<string>();
  for (const surv of topGlobal) {
    for (const id of surv.sendPlayerIds) allCandidatePlayerIds.add(id);
    for (const id of surv.receivePlayerIds) allCandidatePlayerIds.add(id);
  }
  const allCandidatePlayerNames: string[] = [];
  for (const id of allCandidatePlayerIds) {
    const facts = factsById.get(id);
    if (facts) allCandidatePlayerNames.push(facts.name);
  }
  const enrichmentByName = await fetchPlayerData(
    db,
    allCandidatePlayerNames
  ).catch((err) => {
    console.error('[tradeFinder] enrichment fetch failed:', err);
    return new Map<string, EnrichedPlayerData>();
  });

  // 8. Run trusted analyzer verification on each survivor in parallel.
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
        leagueType,
        enrichmentByName,
      })
    )
  );

  // 9. Post-process: REALISTIC-ACCEPTANCE fairness filter.
  //
  // Default mode (no user-provided filters): strict symmetric filter
  // that killed "Jaxson Dart for Lamar Jackson" robberies.
  //   A) Zero partner-favored tolerance
  //   B) User grade must be B- or better
  //   C) User-favored diff ≤ 15
  //
  // Opt-in mode (user specified required assets OR picks): the user
  // is EXPLICITLY signaling "I want to move these specific assets to
  // get an upgrade." In this mode the user is volunteering some
  // premium, so partner-slightly-favored trades are legitimate and
  // the user-favored cap can breathe because the pick-shaped delta
  // often lands there. We still block frank robberies with a softer
  // set of thresholds.
  const userOptedIn = restrictUserAssets != null || hasUserPicks;

  // Partner-favored tolerance: 0 in default mode, 12 in opt-in mode.
  const MAX_PARTNER_FAVORED_DIFF = userOptedIn ? 12 : 0;
  // User-favored cap: 15 in default mode, 25 in opt-in mode (picks
  // often tip the analyzer's diff past 15 as a bonus on top of a
  // balanced player-for-player core).
  const MAX_USER_FAVORED_DIFF = userOptedIn ? 25 : 15;
  // Accept grades: default drops C+/C/C-/D/F. Opt-in mode also
  // allows C+ (and C, since a C user grade with the user-side
  // pick premium is a realistic upgrade trade).
  const ACCEPTABLE_USER_GRADES = userOptedIn
    ? new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'])
    : new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-']);

  console.log(
    `[tradeFinder] gate4 mode=${userOptedIn ? 'opt-in' : 'default'} partnerMax=${MAX_PARTNER_FAVORED_DIFF} userMax=${MAX_USER_FAVORED_DIFF}`
  );

  const valid = results.filter((r): r is TradeRecommendation => r != null);
  console.log(
    `[tradeFinder] gate4 input: ${valid.length} verified candidates`
  );

  const filtered = valid.filter((rec) => {
    const { diff, favored } = rec.analysis.fairnessScore;
    const partnerFavored = favored === rec.targetTeamName;
    const sendNames = rec.userSends.map((p) => p.name).join('+');
    const recvNames = rec.userReceives.map((p) => p.name).join('+');
    const userGrade = rec.analysis.teamGrades.find(
      (g) => g.team === userTeam.name
    )?.grade;

    // (A) Partner-favored cap
    if (partnerFavored && diff > MAX_PARTNER_FAVORED_DIFF) {
      console.log(
        `[tradeFinder] gate4 DROP partner-favored: ${sendNames} → ${recvNames} diff=${diff} (> ${MAX_PARTNER_FAVORED_DIFF})`
      );
      return false;
    }

    // (B) User grade must be in the acceptable set
    if (!userGrade || !ACCEPTABLE_USER_GRADES.has(userGrade)) {
      console.log(
        `[tradeFinder] gate4 DROP weak-user-grade: ${sendNames} → ${recvNames} grade=${userGrade ?? 'missing'}`
      );
      return false;
    }

    // (C) User-favored trades capped at MAX_USER_FAVORED_DIFF
    if (!partnerFavored && diff > MAX_USER_FAVORED_DIFF) {
      console.log(
        `[tradeFinder] gate4 DROP unrealistic-user-favored: ${sendNames} → ${recvNames} diff=${diff} (> ${MAX_USER_FAVORED_DIFF})`
      );
      return false;
    }

    console.log(
      `[tradeFinder] gate4 PASS: ${sendNames} → ${recvNames} diff=${diff} favored=${favored} userGrade=${userGrade}`
    );
    return true;
  });

  console.log(
    `[tradeFinder] gate4 output: ${filtered.length}/${valid.length} candidates passed`
  );

  return filtered.sort(
    (a, b) => a.analysis.fairnessScore.diff - b.analysis.fairnessScore.diff
  );
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
  /** Real league type — threaded into the analyzer body so dynasty
   *  trades get dynasty-calibrated grading. */
  leagueType: 'redraft' | 'dynasty' | 'keeper';
  /** Pre-fetched enrichment map (season stats, trend, news) keyed by
   *  lowercase player name. Same data source as the manual /analyze
   *  route so both grading paths see identical input. */
  enrichmentByName: Map<string, EnrichedPlayerData>;
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

/**
 * Verify a candidate trade by running it through the TRUSTED analyzer
 * — the exact same AI prompt and validation logic as the manual
 * /analyze route. The trusted analyzer knows nothing about the
 * upstream constructor, matcher, or fit reasons — it grades the trade
 * on its own merits and will tell us when a proposed trade hurts
 * the user even if the constructor thought it was fair.
 *
 * The `fit` argument is preserved on the returned TradeRecommendation
 * (so the UI still shows the constructor's reasoning) but is NEVER
 * passed to the trusted analyzer itself. This avoids the defense
 * bias we were seeing where the verification pass would agree with
 * the upstream reasoning instead of evaluating skeptically.
 */
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
    leagueType,
    enrichmentByName,
  } = args;

  const sendFacts = sendPlayerIds
    .map((id) => factsById.get(id))
    .filter((p): p is PlayerFacts => p != null);
  const receiveFacts = receivePlayerIds
    .map((id) => factsById.get(id))
    .filter((p): p is PlayerFacts => p != null);

  // Build the AnalyzeTradeBody shape the trusted analyzer expects.
  // Team labels use the actual team names from the league — the
  // analyzer validates that its response references these exact
  // labels, which catches any team-name hallucinations.
  const body: AnalyzeTradeBody = {
    teams: [
      {
        label: userTeam.name,
        sends: [
          ...sendFacts.map(
            (p): TradeAnalyzerAssetInput => ({
              type: 'player',
              name: p.name,
              position: p.position,
              team: p.nflTeam,
            })
          ),
          ...extraUserPicks.map(
            (pick): TradeAnalyzerAssetInput => ({
              type: 'pick',
              name: formatPick(pick),
            })
          ),
        ],
      },
      {
        label: targetTeam.name,
        sends: receiveFacts.map(
          (p): TradeAnalyzerAssetInput => ({
            type: 'player',
            name: p.name,
            position: p.position,
            team: p.nflTeam,
          })
        ),
      },
    ],
    // Thread the REAL league type so dynasty users get dynasty
    // calibration (age reasoning, future-value of picks, etc.)
    // instead of redraft-calibrated grades.
    leagueType,
    leagueSettings: context.leagueSettings,
  };

  // Build a subset TradeContext containing only the players in this trade
  const relevantFacts = [...sendFacts, ...receiveFacts];
  const subsetContext: TradeContext = {
    ...context,
    players: relevantFacts,
  };

  // Build the enrichment block (season stats, trend, recent news)
  // from the pre-fetched enrichment map. This matches the exact
  // block the manual /analyze route appends — critically including
  // recent news, which catches "role reduced" / "benched" /
  // "trade rumor" signals the TradeContext alone doesn't surface.
  const enrichmentBlocks: string[] = [];
  const seenEnrichment = new Set<string>();
  for (const facts of [...sendFacts, ...receiveFacts]) {
    const key = facts.name.toLowerCase();
    if (seenEnrichment.has(key)) continue;
    seenEnrichment.add(key);
    const enriched = enrichmentByName.get(key);
    if (enriched) {
      enrichmentBlocks.push(formatPlayerDataBlock(enriched));
    }
  }
  const enrichmentBlock =
    enrichmentBlocks.length > 0 ? enrichmentBlocks.join('\n\n') : null;

  const tradeDescription = buildTradeAnalyzerDescription(body, enrichmentBlock);

  const outcome = await analyzeTrade({
    anthropicKey,
    body,
    tradeDescription,
    tradeContext: subsetContext,
  });

  if (!outcome.ok) {
    console.error('[tradeFinder] verification failed:', outcome.error);
    return null;
  }

  // Raw-response logging so we can investigate when a trade slips
  // through the filter. Keys included: user team, partner team,
  // sent/received player names, score, winner, diff. One line.
  const sendNames = sendFacts.map((p) => p.name).join('+');
  const recvNames = receiveFacts.map((p) => p.name).join('+');
  console.log(
    `[tradeFinder.verify] ${userTeam.name} sends [${sendNames}] -> ${targetTeam.name} sends [${recvNames}] | winner=${outcome.result.winner} score=${outcome.result.fairnessScore.score} favored=${outcome.result.fairnessScore.favored} diff=${outcome.result.fairnessScore.diff}`
  );

  // fit is carried through unchanged so the UI still renders the
  // constructor's "Why it helps you / Why they'd accept" panels.
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
    analysis: outcome.result,
  };
}
