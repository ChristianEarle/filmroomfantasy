/**
 * Trade Finder (Feature 2).
 *
 * Three-stage pipeline:
 *
 *  Stage 1 — deterministic scoping (no AI, ~50ms):
 *   1. Load rosters for every team in the league.
 *   2. Build a TradeContext with facts for every rostered player.
 *   3. Compute PlayerValuations (ROS pts × scarcity × schedule × injury).
 *   4. Build a TeamComposition for every team: who is a starter, who is
 *      depth, who is surplus, and which positions are a real need.
 *   5. Format the whole league as a compact snapshot for the AI prompt.
 *
 *  Stage 2 — single AI mega-call (constructTrades):
 *   6. Hand the whole league snapshot to Claude in ONE call. Claude
 *      compares every team holistically and constructs 5-6 mutually
 *      beneficial trades, with reasoning for both sides.
 *   7. Validate the AI output:
 *        a) ownership — every sent player on user roster, every
 *           received player on the named partner team
 *        b) value sanity — deterministic valuation delta within 30%
 *        c) drop hallucinations and robberies
 *
 *  Stage 3 — verification pass (parallel AI grading):
 *   8. Run each surviving constructed trade through analyzeCandidateWithAI
 *      — the trusted analyzer prompt — to get an independent fairness
 *      score, winner, and team grades.
 *   9. Filter trades whose fairness diff exceeds MAX_FAIRNESS_DIFF and
 *      return the survivors sorted most-fair-first.
 *
 * Fallback chain: if the constructor call fails or returns zero valid
 * trades, fall back to the deterministic needs-aware matcher; if that
 * also returns nothing, fall back to the legacy brute-force generator.
 * The user always sees something rather than an empty state.
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
  generateCandidates,
  topCandidates,
  pickDiverseTop,
  sortByProxy,
  scoreCandidate,
  type ScoredCandidate,
} from './candidateFilter';
import {
  buildValuationMap,
  valueImbalancePct,
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
  constructTrades,
  type ConstructedTrade,
} from './tradeConstructor';
import {
  type LeagueContextSnapshot,
} from './leagueContextFormatter';
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

  // 5. Build per-team standings + records for the snapshot. Sleeper
  //    teams already store wins/losses on the row, so this is just a
  //    cheap formatting step. Rank is by wins desc, points-for tiebreak.
  const standings = [...allTeams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.pointsFor ?? 0) - (a.pointsFor ?? 0);
  });
  const rankByTeam = new Map<string, number>();
  standings.forEach((t, i) => rankByTeam.set(t.id, i + 1));

  const partnerTeamIds = targetTeamId
    ? [targetTeamId]
    : allTeams.filter((t) => t.id !== userTeamId).map((t) => t.id);

  // Construct the league snapshot. If targetTeamId is set, we still
  // pass the WHOLE league to the AI but tell it via filters to focus
  // on that one partner — the constructor handles the constraint.
  const snapshot: LeagueContextSnapshot = {
    userTeamId,
    teams: allTeams.map((t) => ({
      id: t.id,
      name: t.name,
      record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`,
      rank: rankByTeam.get(t.id) ?? null,
      composition: compositionsByTeam.get(t.id)!,
    })),
    context: megaContext,
    valuations,
    factsById,
    settings: leagueSettings,
  };

  // 6. Stage 2 — call the constructor mega-call. ONE AI request that
  //    sees the whole league and returns candidate trades.
  //
  //    If the standard pass returns too few valid candidates (which
  //    happens most often when the user specified a draft pick, or
  //    when roster shape is unusual), we fire a CREATIVE retry that
  //    runs hotter and is explicitly prompted to explore less-obvious
  //    angles — positional arbitrage, bench-for-starter swaps,
  //    pick-centric deals, weaker partners, etc. Results are merged,
  //    deduped, and flow into the same validation pipeline.
  type ValidatedTrade = {
    targetTeamId: string;
    sendPlayerIds: string[];
    receivePlayerIds: string[];
    fit: TradeRecommendation['fit'];
  };

  const allowedPartnerIds = new Set(partnerTeamIds);
  const requiredAssetSet = restrictUserAssets
    ? new Set(restrictUserAssets)
    : null;
  const hasUserPicks = normalizedPicks.length > 0;

  const runAndValidate = async (
    mode: 'standard' | 'creative',
    desiredCount: number
  ): Promise<ValidatedTrade[]> => {
    const result = await constructTrades({
      anthropicKey,
      snapshot,
      filters: {
        targetPosition: targetPosition ?? null,
        requiredUserPlayerIds: restrictUserAssets,
        userPicks: hasUserPicks ? normalizedPicks : null,
        desiredCount,
        mode,
      },
    });
    const validated: ValidatedTrade[] = [];
    if (!result || result.trades.length === 0) {
      console.log(
        `[tradeFinder] constructor ${mode} returned 0 trades` +
          (result?.notes ? ` — notes: ${result.notes.slice(0, 120)}` : '')
      );
      return validated;
    }
    for (const trade of result.trades) {
      const reason = validateConstructedTrade(
        trade,
        userTeamId,
        userRosterPlayerIds,
        rosterByTeam,
        allowedPartnerIds,
        targetPosition ?? null,
        requiredAssetSet,
        valuations,
        factsById,
        hasUserPicks
      );
      if (reason !== null) {
        console.log(
          `[tradeFinder] dropped ${mode} constructed trade: ${reason}`,
          trade.sentPlayerIds,
          '→',
          trade.receivedPlayerIds
        );
        continue;
      }
      validated.push({
        targetTeamId: trade.partnerTeamId,
        sendPlayerIds: trade.sentPlayerIds,
        receivePlayerIds: trade.receivedPlayerIds,
        fit: {
          forYou: trade.userReasoning ? [trade.userReasoning] : [],
          forThem: trade.partnerReasoning ? [trade.partnerReasoning] : [],
          userNeedsMet: [],
          partnerNeedsMet: [],
        },
      });
    }
    return validated;
  };

  // Standard pass first. Always runs.
  let validatedFromConstructor = await runAndValidate(
    'standard',
    Math.max(maxRecommendations + 2, 8)
  );
  console.log(
    `[tradeFinder] standard pass produced ${validatedFromConstructor.length} valid candidates`
  );

  // Creative retry if the standard pass is thin. Threshold: fewer than
  // half of what the user asked for. The retry almost always fires
  // when picks are involved because the standard pass is more
  // conservative about pick-for-player packaging.
  const MIN_CANDIDATES_BEFORE_RETRY = Math.max(
    Math.ceil(maxRecommendations / 2),
    2
  );
  if (validatedFromConstructor.length < MIN_CANDIDATES_BEFORE_RETRY) {
    console.log(
      `[tradeFinder] only ${validatedFromConstructor.length} < ${MIN_CANDIDATES_BEFORE_RETRY} candidates — running creative retry`
    );
    const creativeResults = await runAndValidate(
      'creative',
      Math.max(maxRecommendations + 2, 8)
    );
    console.log(
      `[tradeFinder] creative pass added ${creativeResults.length} candidates`
    );

    // Dedupe by (send set, receive set, partner)
    const seenKeys = new Set<string>();
    const makeKey = (v: ValidatedTrade) =>
      `${v.targetTeamId}|${[...v.sendPlayerIds].sort().join(',')}|${[...v.receivePlayerIds].sort().join(',')}`;
    for (const v of validatedFromConstructor) seenKeys.add(makeKey(v));
    for (const v of creativeResults) {
      const k = makeKey(v);
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        validatedFromConstructor.push(v);
      }
    }
  }

  // 8. Decide which set of survivors moves to the verification pass.
  //    Primary: validated constructor output.
  //    Fallback 1: deterministic needs-aware matcher.
  //    Fallback 2: legacy brute-force generator.
  let topGlobal: ValidatedTrade[];

  if (validatedFromConstructor.length > 0) {
    topGlobal = validatedFromConstructor.slice(
      0,
      Math.max(maxRecommendations, 5)
    );
  } else {
    console.log(
      '[tradeFinder] constructor returned 0 valid trades, falling back to matcher'
    );
    topGlobal = runMatcherFallback({
      partnerTeamIds,
      compositionsByTeam,
      userComp,
      valuations,
      factsById,
      leagueSettings,
      targetPosition: targetPosition ?? null,
      restrictUserAssets,
      maxRecommendations,
    });

    if (topGlobal.length === 0) {
      console.log(
        '[tradeFinder] matcher fallback empty, using brute-force generator'
      );
      topGlobal = runBruteForceFallback({
        partnerTeamIds,
        rosterByTeam,
        userRoster,
        restrictUserAssets,
        targetPosition: targetPosition ?? null,
        factsById,
        maxRecommendations,
      });
    }
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
  // After the user complained about the finder surfacing
  // "Jaxson Dart for Lamar Jackson" — a trade that would
  // never be accepted because it's too good for the user —
  // the filter is now symmetric AND tight in BOTH directions:
  //
  //   A) The trusted analyzer must NOT say the partner is
  //      favored. Zero tolerance. (unchanged)
  //
  //   B) The user's letter grade must be B- or better.
  //      Catches sidegrades and structurally weak trades
  //      that happen to fairness-score 50/50. (unchanged)
  //
  //   C) If the USER is favored, diff must be <= 15 — the
  //      manual analyzer's "Slightly Favored" threshold.
  //      Anything beyond 15 is in "Favored" or "Heavily
  //      Favored" territory and the partner's GM would
  //      reject it in real life. Previously this was 30
  //      (way too lenient) which is how Dart-for-Lamar
  //      got through.
  //
  // The constructor is now explicitly told to pad the
  // user's side with additional players when needed to
  // reach this threshold, so trades near the 15 cap should
  // come with the extra-pad construction instead of raw
  // single-player robberies.
  const MAX_USER_FAVORED_DIFF = 15;
  const ACCEPTABLE_USER_GRADES = new Set([
    'A+', 'A', 'A-',
    'B+', 'B', 'B-',
  ]);

  const valid = results.filter((r): r is TradeRecommendation => r != null);

  return valid
    .filter((rec) => {
      const { diff, favored } = rec.analysis.fairnessScore;
      const partnerFavored = favored === rec.targetTeamName;

      // (A) Zero-tolerance partner-favored guard
      if (partnerFavored) {
        console.log(
          `[tradeFinder] dropped partner-favored trade: diff=${diff} favored=${favored}`
        );
        return false;
      }

      // (B) User grade must be acceptable
      const userGrade = rec.analysis.teamGrades.find(
        (g) => g.team === userTeam.name
      )?.grade;
      if (!userGrade || !ACCEPTABLE_USER_GRADES.has(userGrade)) {
        console.log(
          `[tradeFinder] dropped trade with weak user grade: ${userGrade ?? 'missing'}`
        );
        return false;
      }

      // (C) User-favored trades capped at diff <= 15
      //     (partner wouldn't accept anything beyond that)
      if (diff > MAX_USER_FAVORED_DIFF) {
        console.log(
          `[tradeFinder] dropped unrealistic user-favored trade: diff=${diff} (partner would reject)`
        );
        return false;
      }

      return true;
    })
    .sort((a, b) => a.analysis.fairnessScore.diff - b.analysis.fairnessScore.diff);
}

// ── Validation: constructor output ──────────────────────────────────

/**
 * Validate a single ConstructedTrade against the actual league state.
 * Returns null if the trade is valid, or a short reason string if it's
 * not (used only for debug logging — the user never sees these).
 *
 * Checks performed:
 *  1. Partner team is in the allowed partner set (respects targetTeamId
 *     filter).
 *  2. Every sentPlayerId is on the user's roster.
 *  3. Every receivedPlayerId is on the named partner team's roster.
 *  4. If targetPosition is set, the user must receive at least one
 *     player at that position.
 *  5. If requiredAssets is set, the trade must use at least one of them
 *     on the sent side.
 *  6. Deterministic value imbalance must be ≤ MAX_VALUE_DELTA_PLAYERS
 *     when NO picks are threaded, or ≤ MAX_VALUE_DELTA_WITH_PICKS when
 *     picks are being added to the user's side. The relaxed cap for
 *     pick trades exists because the valuation model doesn't know what
 *     picks are worth — a fair trade like "Player X + 2026 1st for
 *     Player Y" looks wildly imbalanced if we only count Player X vs
 *     Player Y. When picks are involved we rely on the trusted
 *     analyzer (which CAN reason about pick value) as the real guard.
 */
function validateConstructedTrade(
  trade: ConstructedTrade,
  userTeamId: string,
  userRosterPlayerIds: Set<string>,
  rosterByTeam: Map<
    string,
    Array<{ playerId: string; player: { position: string } | null }>
  >,
  allowedPartnerIds: Set<string>,
  targetPosition: string | null,
  requiredAssets: Set<string> | null,
  valuations: Map<string, PlayerValuation>,
  factsById: Map<string, PlayerFacts>,
  hasUserPicks: boolean
): string | null {
  // 0. Defensive: trade must not target the user themselves
  if (trade.partnerTeamId === userTeamId) {
    return 'partner is user team';
  }
  // 1. Partner team allowed
  if (!allowedPartnerIds.has(trade.partnerTeamId)) {
    return `partner team ${trade.partnerTeamId} not in allowed set`;
  }
  // 2. Sent players on user roster
  for (const id of trade.sentPlayerIds) {
    if (!userRosterPlayerIds.has(id)) {
      return `sent player ${id} not on user roster`;
    }
  }
  // 3. Received players on partner roster
  const partnerRoster = rosterByTeam.get(trade.partnerTeamId) || [];
  const partnerRosterIds = new Set(partnerRoster.map((r) => r.playerId));
  for (const id of trade.receivedPlayerIds) {
    if (!partnerRosterIds.has(id)) {
      return `received player ${id} not on partner ${trade.partnerTeamId} roster`;
    }
  }
  // 4. targetPosition filter
  if (targetPosition) {
    const wantPos = targetPosition.toUpperCase();
    const receivedHasPos = trade.receivedPlayerIds.some((id) => {
      const facts = factsById.get(id);
      return facts?.position?.toUpperCase() === wantPos;
    });
    if (!receivedHasPos) {
      return `targetPosition=${wantPos} but no received player matches`;
    }
  }
  // 5. requiredAssets filter
  if (requiredAssets && requiredAssets.size > 0) {
    const usesRequired = trade.sentPlayerIds.some((id) => requiredAssets.has(id));
    if (!usesRequired) {
      return 'requiredUserPlayerIds set but trade uses none of them';
    }
  }
  // 6. Value sanity — asymmetric tolerance depending on whether picks
  //    are threaded into this trade. Without picks, 15% is strict. With
  //    picks the cap is effectively skipped because the player-only
  //    delta can look huge while the full package (player + pick) is
  //    balanced; we let the trusted analyzer handle the call instead.
  const MAX_VALUE_DELTA_PLAYERS = 0.15;
  const MAX_VALUE_DELTA_WITH_PICKS = 0.9; // effectively off; analyzer is the guard
  const cap = hasUserPicks ? MAX_VALUE_DELTA_WITH_PICKS : MAX_VALUE_DELTA_PLAYERS;
  const rawDelta = valueImbalancePct(
    trade.sentPlayerIds,
    trade.receivedPlayerIds,
    valuations
  );
  // When picks are on the user side, the user "sending less" is
  // EXPECTED (because the pick fills the gap). Only a trade where the
  // user is sending MORE than they receive is suspicious — the user
  // would be overpaying with players AND throwing in a pick. We
  // compute a directional delta instead of absolute, so the guard
  // only fires on "user overpaying" when picks are involved.
  let delta: number;
  if (hasUserPicks) {
    // rawDelta = (received - sent) / max. Negative = user sent more.
    // We only flag trades where user sent >> received by enough to
    // be suspicious EVEN WITH a pick filling the gap.
    delta = rawDelta < 0 ? Math.abs(rawDelta) : 0;
  } else {
    delta = Math.abs(rawDelta);
  }
  if (delta > cap) {
    return `value delta ${(delta * 100).toFixed(0)}% exceeds ${cap * 100}% guard${hasUserPicks ? ' (with picks)' : ''}`;
  }

  return null;
}

// ── Fallback path 1: deterministic needs-aware matcher ──────────────

interface MatcherFallbackArgs {
  partnerTeamIds: string[];
  compositionsByTeam: Map<string, TeamComposition>;
  userComp: TeamComposition;
  valuations: Map<string, PlayerValuation>;
  factsById: Map<string, PlayerFacts>;
  leagueSettings: LeagueSettings;
  targetPosition: string | null;
  restrictUserAssets: string[] | null;
  maxRecommendations: number;
}

function runMatcherFallback(args: MatcherFallbackArgs): Array<{
  targetTeamId: string;
  sendPlayerIds: string[];
  receivePlayerIds: string[];
  fit: TradeRecommendation['fit'];
}> {
  const {
    partnerTeamIds,
    compositionsByTeam,
    userComp,
    valuations,
    factsById,
    leagueSettings,
    targetPosition,
    restrictUserAssets,
    maxRecommendations,
  } = args;

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
        targetPosition,
        restrictUserAssets,
      },
    });

    for (const m of matched) {
      allMatched.push({ ...m, targetTeamId: partnerId });
    }
  }

  if (allMatched.length === 0) return [];

  allMatched.sort((a, b) => a.score - b.score);
  const overFetch = Math.max(maxRecommendations * 3, 16);
  const diverse = pickDiverseMatches(
    allMatched.slice(0, overFetch),
    maxRecommendations,
    2
  );

  return diverse.map((m) => ({
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
}

// ── Fallback path 2: legacy brute-force generator ───────────────────

interface BruteForceFallbackArgs {
  partnerTeamIds: string[];
  rosterByTeam: Map<
    string,
    Array<{ playerId: string; player: { position: string } | null }>
  >;
  userRoster: Array<{ playerId: string; player: { position: string } | null }>;
  restrictUserAssets: string[] | null;
  targetPosition: string | null;
  factsById: Map<string, PlayerFacts>;
  maxRecommendations: number;
}

function runBruteForceFallback(args: BruteForceFallbackArgs): Array<{
  targetTeamId: string;
  sendPlayerIds: string[];
  receivePlayerIds: string[];
  fit: TradeRecommendation['fit'];
}> {
  const {
    partnerTeamIds,
    rosterByTeam,
    userRoster,
    restrictUserAssets,
    targetPosition,
    factsById,
    maxRecommendations,
  } = args;

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

  if (allScored.length === 0) return [];

  allScored.sort((a, b) => a.preFilterScore - b.preFilterScore);
  const overFetch = Math.max(maxRecommendations * 3, 16);
  const diverse = pickDiverseTop(
    allScored.slice(0, overFetch),
    maxRecommendations,
    2
  );

  return diverse.map((s) => {
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
