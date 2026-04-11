/**
 * Trade Finder (Feature 2).
 *
 * Target-focused flow: the user picks a specific player they want to
 * acquire from any opponent, and the finder proposes 2-3 realistic
 * offer packages to send. No more "find me any trade" open-ended
 * discovery — that problem is too hard and kept returning empty.
 *
 * Pipeline:
 *   1. Setup — load teams, rosters, valuations, compositions (~50ms).
 *   2. Resolve target — find which partner team owns targetPlayerId.
 *      Bail if not found or the target is on the user's own team.
 *   3. constructOffersForTarget — one focused AI call that returns
 *      2-3 offer packages. Sees only two rosters (user + partner),
 *      never the whole league.
 *   4. Validate each returned offer — ownership, required-asset
 *      filter, target actually included, basic sanity.
 *   5. Verify each with analyzeCandidateWithAI — the trusted
 *      analyzer the manual route uses. Produces fairness + grades.
 *   6. Gate 4 filter — relaxed "opt-in" thresholds because the user
 *      has explicitly chosen this target flow.
 *
 * Team Needs Dashboard is a separate AI-generated narrative — see
 * buildTeamNeeds below. It uses the same Claude client but a different
 * prompt with no trade construction, and is persisted per week and
 * roster fingerprint in the team_scouting_reports table.
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
  type PlayerTier,
} from './playerValuation';
import {
  buildTeamComposition,
  type TeamComposition,
  type NeedLevel,
} from './teamComposition';
import {
  constructOffersForTarget,
  type ConstructedOffer,
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
  /** REQUIRED — the specific player the user wants to acquire. This
   *  is the target-focused flow's core input. An offer search is
   *  anchored to one player at a time. */
  targetPlayerId: string;
  maxRecommendations?: number;
  /** Optional: if set, the user's send-side candidate pool is
   *  restricted to these player IDs (must be on their roster).
   *  Used to narrow what the user is willing to give up. */
  userPlayerIds?: string[] | null;
  /** Optional: draft picks the user is throwing into every offer. */
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
    targetPlayerId,
    maxRecommendations = 3,
    userPlayerIds,
    userPicks,
  } = args;

  // Target flow: caller MUST provide a specific player to acquire.
  // This is enforced at the route but we guard defensively here too.
  if (!targetPlayerId) {
    console.log('[tradeFinder] target flow called without targetPlayerId');
    return [];
  }

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

  // 5. Resolve the target: find which partner team owns it.
  const partnerTeamId = (() => {
    for (const [teamId, roster] of rosterByTeam) {
      if (teamId === userTeamId) continue;
      if (roster.some((r) => r.playerId === targetPlayerId)) return teamId;
    }
    return null;
  })();
  if (!partnerTeamId) {
    console.log(
      `[tradeFinder] target ${targetPlayerId} not found on any opponent team — returning []`
    );
    return [];
  }
  const partnerTeam = allTeams.find((t) => t.id === partnerTeamId);
  const partnerComp = compositionsByTeam.get(partnerTeamId);
  const targetFacts = factsById.get(targetPlayerId);
  const targetValuation = valuations.get(targetPlayerId) ?? null;
  if (!partnerTeam || !partnerComp || !targetFacts) {
    console.log(
      `[tradeFinder] target ${targetPlayerId} found on team ${partnerTeamId} but context incomplete`
    );
    return [];
  }

  const hasUserPicks = normalizedPicks.length > 0;
  const pickValueSum = sumPickValues(
    hasUserPicks ? normalizedPicks : null,
    leagueType,
    seasonYear
  );

  console.log(
    `[tradeFinder] target flow: user=${userTeam.name} wants ${targetFacts.name} (${targetFacts.position}) from ${partnerTeam.name}` +
      (restrictUserAssets ? ` restrictAssets=${restrictUserAssets.length}` : '') +
      (hasUserPicks ? ` picks=${normalizedPicks.length}(val=${Math.round(pickValueSum)})` : '')
  );

  // 6. Construct 2-3 focused offer packages.
  const userRecord = `${userTeam.wins}-${userTeam.losses}${userTeam.ties ? `-${userTeam.ties}` : ''}`;
  const partnerRecord = `${partnerTeam.wins}-${partnerTeam.losses}${partnerTeam.ties ? `-${partnerTeam.ties}` : ''}`;

  const constructed = await constructOffersForTarget({
    anthropicKey,
    target: {
      id: targetPlayerId,
      name: targetFacts.name,
      position: targetFacts.position,
      nflTeam: targetFacts.nflTeam,
      valuation: targetValuation,
    },
    partnerTeam: {
      id: partnerTeamId,
      name: partnerTeam.name,
      record: partnerRecord,
      composition: partnerComp,
    },
    userTeam: {
      id: userTeamId,
      name: userTeam.name,
      record: userRecord,
      composition: userComp,
    },
    valuations,
    factsById,
    requiredUserPlayerIds: restrictUserAssets,
    userPicks: hasUserPicks ? normalizedPicks : null,
    desiredCount: Math.max(maxRecommendations, 3),
    pickValueSum,
  });

  if (!constructed || constructed.offers.length === 0) {
    console.log(
      `[tradeFinder] constructor returned 0 offers for ${targetFacts.name}` +
        (constructed?.notes ? ` — notes: ${constructed.notes.slice(0, 160)}` : '')
    );
    return [];
  }

  console.log(
    `[tradeFinder] constructor returned ${constructed.offers.length} raw offers — validating...`
  );

  // 7. Validate each offer: ownership, target inclusion, required assets.
  type ValidatedTrade = {
    targetTeamId: string;
    sendPlayerIds: string[];
    receivePlayerIds: string[];
    fit: TradeRecommendation['fit'];
  };

  const requiredAssetSet = restrictUserAssets
    ? new Set(restrictUserAssets)
    : null;
  const partnerRosterPlayerIds = new Set(
    (rosterByTeam.get(partnerTeamId) ?? []).map((r) => r.playerId)
  );

  const validated: ValidatedTrade[] = [];
  const seenKeys = new Set<string>();

  for (const offer of constructed.offers) {
    const reason = validateOffer(
      offer,
      userTeamId,
      partnerTeamId,
      userRosterPlayerIds,
      partnerRosterPlayerIds,
      targetPlayerId,
      requiredAssetSet
    );
    if (reason !== null) {
      console.log(
        `[tradeFinder] dropped offer: ${reason}`,
        offer.sentPlayerIds,
        '→',
        offer.receivedPlayerIds
      );
      continue;
    }
    const key = `${[...offer.sentPlayerIds].sort().join(',')}→${[...offer.receivedPlayerIds].sort().join(',')}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    validated.push({
      targetTeamId: partnerTeamId,
      sendPlayerIds: offer.sentPlayerIds,
      receivePlayerIds: offer.receivedPlayerIds,
      fit: {
        forYou: offer.userReasoning ? [offer.userReasoning] : [],
        forThem: offer.partnerReasoning ? [offer.partnerReasoning] : [],
        userNeedsMet: [],
        partnerNeedsMet: [],
      },
    });
  }

  console.log(
    `[tradeFinder] ${validated.length}/${constructed.offers.length} offers passed validation`
  );

  if (validated.length === 0) return [];

  const topGlobal: ValidatedTrade[] = validated.slice(0, maxRecommendations);

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

  // 9. Realistic-acceptance filter.
  //
  // Target flow is always opt-in: the user has explicitly picked a
  // player they want to acquire and implicitly accepted that a
  // realistic offer for a valuable player may run slightly in the
  // partner's favor. The thresholds below block obvious robberies
  // in either direction but leave breathing room for "reasonable
  // upgrade premium" trades.
  const MAX_PARTNER_FAVORED_DIFF = 15;
  const MAX_USER_FAVORED_DIFF = 30;
  const ACCEPTABLE_USER_GRADES = new Set([
    'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-',
  ]);

  console.log(
    `[tradeFinder] gate4 partnerMax=${MAX_PARTNER_FAVORED_DIFF} userMax=${MAX_USER_FAVORED_DIFF}`
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

  // Safety net: if gate 4 dropped everything but we DID have verified
  // candidates, return the least-lopsided ones with a debug note. The
  // user deserves SOMETHING to look at — they can decide whether to
  // offer it. Empty responses here have proven uniformly confusing.
  // We still ship the strict-mode grades so the UI's fairness meter
  // visibly marks the imperfection.
  if (filtered.length === 0 && valid.length > 0) {
    console.log(
      `[tradeFinder] gate4 SAFETY NET: returning ${Math.min(valid.length, 3)} least-lopsided candidates`
    );
    return [...valid]
      .sort((a, b) => a.analysis.fairnessScore.diff - b.analysis.fairnessScore.diff)
      .slice(0, 3);
  }

  return filtered.sort(
    (a, b) => a.analysis.fairnessScore.diff - b.analysis.fairnessScore.diff
  );
}

// ── Suggested Targets ───────────────────────────────────────────────
//
// "Here are 10 players on other rosters you should pursue." Pure
// deterministic scoring + filtering — no AI call. Powers the browse
// step of the Trade Finder: users open the finder, see suggested
// targets grouped by which need each one addresses, and click one
// to drop into the existing per-target offer flow.
//
// Scoring (higher = better):
//   score = urgency × value × availability × recordMult
//
//     urgency       — from the user's need level at this position
//                     (premium 3.0 / starter 2.0 / depth 1.0) or 1.0
//                     when the target is just a tier upgrade at a
//                     balanced position.
//     value         — target's finalValue (ROS projection × factors)
//     availability  — how moveable the target is from their current
//                     team: starter w/ no backup = 0.3, starter w/
//                     backup = 0.8, bench/flex = 1.0, surplus = 1.3
//     recordMult    — partner's record vs league average. Rebuilding
//                     teams get 1.3, middle 1.0, contenders 0.85.
//
// Filters:
//   - No K/DEF
//   - Skip players on the user's own roster
//   - Skip injured/IR players
//   - Skip tiny-value players (<20)
//   - Skip a partner's ONLY elite starter at a position (untouchable)
//   - Must address a user need OR be a real tier upgrade (>20% above
//     the user's worst starter at that position)
//
// Diversity caps:
//   - Max 2 targets per opponent team
//   - Max 3 targets per position

export interface SuggestedTarget {
  playerId: string;
  playerName: string;
  position: string;
  nflTeam: string;
  tier: PlayerTier;
  finalValue: number;
  partnerTeamId: string;
  partnerTeamName: string;
  partnerRecord: string;
  /** Short "why you should pursue" summary for the UI. */
  rationale: string;
  /** Which user need this target addresses — also the bucket key
   *  for the UI grouping. "upgrade" level means "no computed need
   *  but this is a clear tier upgrade." */
  addresses: {
    position: string;
    level: NeedLevel | 'upgrade';
    label: string;
  };
  /** Deterministic fit score, higher = better. UI sorts by this. */
  score: number;
}

export interface SuggestedTargetsResult {
  /** Top N targets across all needs, sorted by score. */
  targets: SuggestedTarget[];
  /** The distinct need buckets represented in the list. The UI uses
   *  these to render grouped sections and collects targets by
   *  matching the `addresses` field. */
  needs: Array<{
    position: string;
    level: NeedLevel | 'upgrade';
    label: string;
  }>;
}

interface FindSuggestedTargetsArgs {
  db: DB;
  leagueId: string;
  userTeamId: string;
  leagueSettings: LeagueSettings;
  seasonYear: number;
  currentWeek: number;
  leagueType?: 'redraft' | 'dynasty' | 'keeper';
  maxTargets?: number;
}

// Human-readable bucket label for a deterministic need.
function bucketLabel(position: string, level: NeedLevel | 'upgrade'): string {
  switch (level) {
    case 'premium':
      return `Premium ${position} need`;
    case 'starter':
      return `Starting ${position}`;
    case 'depth':
      return `${position} depth`;
    case 'none':
      return `${position}`;
    case 'upgrade':
      return `Tier upgrade at ${position}`;
  }
}

const NEED_URGENCY: Record<NeedLevel, number> = {
  premium: 3.0,
  starter: 2.0,
  depth: 1.0,
  none: 0.5,
};

export async function findSuggestedTargets(
  args: FindSuggestedTargetsArgs
): Promise<SuggestedTargetsResult> {
  const {
    db,
    leagueId,
    userTeamId,
    leagueSettings,
    seasonYear,
    currentWeek,
    maxTargets = 10,
  } = args;

  // unused suppressors
  void seasonYear;

  // 1. Load teams + rosters
  const allTeams = await db.query.teams.findMany({
    where: eq(schema.teams.leagueId, leagueId),
  });
  const userTeam = allTeams.find((t) => t.id === userTeamId);
  if (!userTeam) return { targets: [], needs: [] };

  const allRosterSpots = await db.query.rosterSpots.findMany({
    where: inArray(
      schema.rosterSpots.teamId,
      allTeams.map((t) => t.id)
    ),
    with: { player: true },
  });

  const rosterByTeam = new Map<
    string,
    Array<{ playerId: string; player: (typeof allRosterSpots)[number]['player'] }>
  >();
  for (const r of allRosterSpots) {
    const list = rosterByTeam.get(r.teamId) || [];
    list.push({ playerId: r.playerId, player: r.player });
    rosterByTeam.set(r.teamId, list);
  }

  // 2. Build trade context + valuations (same pipeline as finder)
  const allPlayerIds = Array.from(
    new Set(allRosterSpots.map((r) => r.playerId))
  );
  const megaContext = await buildTradeContext({
    db,
    playerIds: allPlayerIds,
    leagueSettings,
    seasonYear: args.seasonYear,
    currentWeek,
    leagueId,
    userTeamId,
  });
  const factsById = new Map<string, PlayerFacts>();
  for (const p of megaContext.players) factsById.set(p.id, p);

  const valuations = buildValuationMap(
    megaContext.players,
    leagueSettings,
    currentWeek
  );

  // 3. Build compositions
  const compositionsByTeam = new Map<string, TeamComposition>();
  for (const team of allTeams) {
    const roster = rosterByTeam.get(team.id) || [];
    compositionsByTeam.set(
      team.id,
      buildTeamComposition({
        teamId: team.id,
        rosteredPlayerIds: roster.map((r) => r.playerId),
        valuations,
        settings: leagueSettings,
      })
    );
  }
  const userComp = compositionsByTeam.get(userTeamId);
  if (!userComp) return { targets: [], needs: [] };

  const userRosterPlayerIds = new Set(
    (rosterByTeam.get(userTeamId) ?? []).map((r) => r.playerId)
  );

  // 4. Compute league average record (wins / total games) for the
  //    partner-record multiplier.
  const avgWinPct = (() => {
    let totalWins = 0;
    let totalGames = 0;
    for (const t of allTeams) {
      const games = (t.wins ?? 0) + (t.losses ?? 0) + (t.ties ?? 0);
      if (games === 0) continue;
      totalWins += t.wins ?? 0;
      totalGames += games;
    }
    return totalGames > 0 ? totalWins / totalGames : 0.5;
  })();

  // 5. For each user position, compute the worst-starter value so we
  //    can check tier-upgrade eligibility.
  const userWorstStarterByPos = new Map<string, number>();
  for (const [pos, summary] of userComp.byPosition) {
    const starters = summary.players.filter((p) => p.role === 'starter');
    if (starters.length === 0) {
      userWorstStarterByPos.set(pos, 0);
      continue;
    }
    const worst = starters[starters.length - 1];
    userWorstStarterByPos.set(pos, worst.finalValue);
  }

  // 6. Score every opponent player.
  interface Scored {
    target: SuggestedTarget;
  }
  const scored: Scored[] = [];

  for (const team of allTeams) {
    if (team.id === userTeamId) continue;
    const partnerComp = compositionsByTeam.get(team.id);
    if (!partnerComp) continue;

    // Partner's record multiplier. Weaker teams = more willing to trade.
    const partnerGames =
      (team.wins ?? 0) + (team.losses ?? 0) + (team.ties ?? 0);
    const partnerWinPct =
      partnerGames > 0 ? (team.wins ?? 0) / partnerGames : avgWinPct;
    const relWin = partnerWinPct - avgWinPct;
    const recordMult =
      relWin < -0.1 ? 1.3 : relWin > 0.1 ? 0.85 : 1.0;
    const partnerRecord = `${team.wins ?? 0}-${team.losses ?? 0}${(team.ties ?? 0) > 0 ? `-${team.ties}` : ''}`;

    for (const [pos, summary] of partnerComp.byPosition) {
      // How many elite starters does the partner have at this position?
      // A sole elite starter is usually untouchable.
      const elitePlayersAtPos = summary.players.filter(
        (p) => p.role === 'starter' && p.tier === 'elite'
      );
      const isSoleElite = (slotId: string) =>
        elitePlayersAtPos.length === 1 &&
        elitePlayersAtPos[0].playerId === slotId &&
        summary.players.length < 3;

      for (const slot of summary.players) {
        // Skip untouchables + bad data
        if (userRosterPlayerIds.has(slot.playerId)) continue;
        if (slot.finalValue < 20) continue;
        const facts = factsById.get(slot.playerId);
        if (!facts) continue;
        const status = facts.identity.status;
        if (status === 'out' || status === 'injured_reserve') continue;
        if (isSoleElite(slot.playerId)) continue;

        // Does this address a user need or is it a tier upgrade?
        const userNeed = userComp.needs.find((n) => n.position === pos);
        const userStarterValue = userWorstStarterByPos.get(pos) ?? 0;
        const isTierUpgrade =
          userStarterValue > 0 && slot.finalValue >= userStarterValue * 1.2;

        let addresses: SuggestedTarget['addresses'] | null = null;
        let urgency = 0;
        if (userNeed) {
          addresses = {
            position: pos,
            level: userNeed.level,
            label: bucketLabel(pos, userNeed.level),
          };
          urgency = NEED_URGENCY[userNeed.level];
        } else if (isTierUpgrade) {
          addresses = {
            position: pos,
            level: 'upgrade',
            label: bucketLabel(pos, 'upgrade'),
          };
          urgency = 1.0;
        } else {
          continue; // neither a need nor an upgrade — skip
        }

        // Availability multiplier from the slot's role on partner team
        let availability = 1.0;
        const sameStarterCount = summary.players.filter(
          (p) => p.role === 'starter'
        ).length;
        if (slot.role === 'starter') {
          availability = sameStarterCount >= 2 ? 0.8 : 0.3;
        } else if (slot.role === 'flex' || slot.role === 'bench') {
          availability = 1.0;
        } else if (slot.role === 'depth') {
          availability = 1.1;
        } else if (slot.role === 'surplus') {
          availability = 1.3;
        }

        const score = urgency * slot.finalValue * availability * recordMult;

        // Build a rationale string from the available signals.
        const rationaleParts: string[] = [];
        if (addresses.level === 'upgrade') {
          const jump = Math.round(
            ((slot.finalValue - userStarterValue) / userStarterValue) * 100
          );
          rationaleParts.push(`${jump}% upgrade over your current ${pos}`);
        } else {
          rationaleParts.push(
            `Addresses your ${addresses.label.toLowerCase()} need`
          );
        }
        if (slot.role === 'surplus') {
          rationaleParts.push(`partner has ${pos} surplus`);
        } else if (slot.role === 'flex' || slot.role === 'bench') {
          rationaleParts.push(`partner depth piece`);
        } else if (slot.role === 'starter' && sameStarterCount >= 2) {
          rationaleParts.push(`partner has 2+ starters at ${pos}`);
        }
        if (recordMult > 1.0) {
          rationaleParts.push(`rebuilding team (${partnerRecord})`);
        }
        const rationale = rationaleParts.join(' · ');

        scored.push({
          target: {
            playerId: slot.playerId,
            playerName: facts.name,
            position: pos,
            nflTeam: facts.nflTeam,
            tier: slot.tier,
            finalValue: Math.round(slot.finalValue),
            partnerTeamId: team.id,
            partnerTeamName: team.name,
            partnerRecord,
            rationale,
            addresses,
            score: Math.round(score * 10) / 10,
          },
        });
      }
    }
  }

  // 7. Sort by score descending, apply diversity caps.
  scored.sort((a, b) => b.target.score - a.target.score);

  const perTeam = new Map<string, number>();
  const perPosition = new Map<string, number>();
  const PER_TEAM_CAP = 2;
  const PER_POSITION_CAP = 3;
  const diverseTargets: SuggestedTarget[] = [];

  for (const s of scored) {
    if (diverseTargets.length >= maxTargets) break;
    const t = s.target;
    const teamCount = perTeam.get(t.partnerTeamId) ?? 0;
    const posCount = perPosition.get(t.position) ?? 0;
    if (teamCount >= PER_TEAM_CAP) continue;
    if (posCount >= PER_POSITION_CAP) continue;
    perTeam.set(t.partnerTeamId, teamCount + 1);
    perPosition.set(t.position, posCount + 1);
    diverseTargets.push(t);
  }

  // 8. Build the distinct needs list for the UI buckets.
  const needsMap = new Map<string, SuggestedTargetsResult['needs'][number]>();
  for (const t of diverseTargets) {
    const key = `${t.addresses.position}|${t.addresses.level}`;
    if (!needsMap.has(key)) {
      needsMap.set(key, t.addresses);
    }
  }
  // Sort needs by urgency (premium > starter > depth > upgrade > none)
  const NEED_ORDER: Record<NeedLevel | 'upgrade', number> = {
    premium: 0,
    starter: 1,
    depth: 2,
    upgrade: 3,
    none: 4,
  };
  const needs = Array.from(needsMap.values()).sort(
    (a, b) => NEED_ORDER[a.level] - NEED_ORDER[b.level]
  );

  console.log(
    `[tradeFinder.suggestTargets] scored ${scored.length}, returned ${diverseTargets.length} targets across ${needs.length} need buckets`
  );

  return {
    targets: diverseTargets,
    needs,
  };
}

// ── Validation ──────────────────────────────────────────────────────

/**
 * Validate a single constructed offer against the real roster state.
 * Returns null if valid, or a short reason string if not (logged for
 * debugging — never shown to the user).
 *
 * Checks:
 *  1. partnerTeamId matches the target's actual owner.
 *  2. All sent player ids are on the user's roster.
 *  3. All received player ids are on the partner's roster.
 *  4. The target player is in receivedPlayerIds.
 *  5. If requiredAssets is set, at least one is in sentPlayerIds.
 */
function validateOffer(
  offer: ConstructedOffer,
  userTeamId: string,
  expectedPartnerId: string,
  userRosterPlayerIds: Set<string>,
  partnerRosterPlayerIds: Set<string>,
  targetPlayerId: string,
  requiredAssets: Set<string> | null
): string | null {
  if (offer.partnerTeamId !== expectedPartnerId) {
    return `partner team mismatch: got ${offer.partnerTeamId} expected ${expectedPartnerId}`;
  }
  if (userTeamId === expectedPartnerId) {
    return 'partner is user team';
  }
  for (const id of offer.sentPlayerIds) {
    if (!userRosterPlayerIds.has(id)) {
      return `sent player ${id} not on user roster`;
    }
  }
  for (const id of offer.receivedPlayerIds) {
    if (!partnerRosterPlayerIds.has(id)) {
      return `received player ${id} not on partner roster`;
    }
  }
  if (!offer.receivedPlayerIds.includes(targetPlayerId)) {
    return `received players do not include the target ${targetPlayerId}`;
  }
  if (requiredAssets && requiredAssets.size > 0) {
    const usesRequired = offer.sentPlayerIds.some((id) => requiredAssets.has(id));
    if (!usesRequired) {
      return 'requiredUserPlayerIds set but offer uses none of them';
    }
  }
  return null;
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
