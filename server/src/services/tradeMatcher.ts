/**
 * tradeMatcher — needs-aware candidate generator.
 *
 * Replaces the brute-force cartesian-product generator in candidateFilter.ts
 * for the recommendation pipeline. Given:
 *   - USER's team composition (needs + surplus)
 *   - PARTNER's team composition
 *   - A map of PlayerValuations
 *
 * produces a small list of MatchedCandidates where EVERY trade:
 *   1) Contains at least one player that addresses a real need on the
 *      receiving side, on BOTH sides.
 *   2) Stays within a value-imbalance tolerance (default: 25%).
 *   3) Comes with human-readable fit reasons explaining why it makes
 *      sense for each team — which the AI analyzer uses as context and
 *      the UI surfaces to the user.
 *
 * Philosophy: "surplus for need" is how real-world trades happen. The
 * old generator ignored need entirely and leaned on raw projection balance,
 * which is why it would surface obvious value-matched trades that neither
 * side would actually consider. This matcher changes the question from
 * "can these players have similar value?" to "does swapping them make
 * both teams better?".
 */

import type { PlayerFacts, LeagueSettings } from './tradeContext';
import type { PlayerValuation } from './playerValuation';
import { sumValue, valueImbalancePct } from './playerValuation';
import type {
  TeamComposition,
  NeedLevel,
  PositionSummary,
} from './teamComposition';

// ── Types ────────────────────────────────────────────────────────────

export interface MatchedCandidate {
  sendPlayerIds: string[];
  receivePlayerIds: string[];

  /** Per-side value totals from the deterministic model */
  userValue: number;
  partnerValue: number;
  /** (partner - user) / max(sent, received). Negative = user sends more */
  valueImbalancePct: number;

  /** Positions being addressed on each side (e.g. "RB", "WR") */
  userNeedsMet: string[];
  partnerNeedsMet: string[];

  /** Human-readable explanations. 2-3 short items each. */
  fitReasons: {
    forYou: string[];
    forThem: string[];
  };

  /** Combined pre-filter score; LOWER = better. Used for sorting. */
  score: number;
}

export interface MatchOptions {
  /** Max candidates to return across all combinations */
  maxCandidates?: number;
  /** Absolute value-imbalance tolerance [0-1]. Default 0.25 (25%). */
  imbalanceTolerance?: number;
  /** If set, only match against a specific position on the partner side */
  targetPosition?: string | null;
  /** If set, restrict user's send-side pool to these player ids */
  restrictUserAssets?: string[] | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Does the receiving side get a player that addresses a real need?
 * Returns the list of positions where a need is met ([] if none).
 */
function needsMetBy(
  receivingComposition: TeamComposition,
  incomingPlayerIds: string[],
  valuations: Map<string, PlayerValuation>
): string[] {
  const met = new Set<string>();
  for (const id of incomingPlayerIds) {
    const v = valuations.get(id);
    if (!v) continue;
    const summary = receivingComposition.byPosition.get(v.position.toUpperCase());
    if (!summary) continue;
    const need = summary.needLevel;
    if (need === 'none') continue;

    // Incoming player must meaningfully exceed the replacement level at
    // that position — we approximate "replacement" as the value of the
    // worst starter plus a small buffer. If the roster has no starter
    // yet (thin pos), any non-stash player counts.
    const starters = summary.players.filter((p) => p.role === 'starter');
    const replacement =
      starters.length > 0
        ? starters[starters.length - 1].finalValue
        : 0;
    const buffer = replacement * 0.1; // must be at least 10% better than worst starter
    if (v.finalValue >= replacement + buffer) {
      met.add(v.position.toUpperCase());
    } else if (need === 'premium' || need === 'starter') {
      // Premium/starter need + any non-stash addition still counts as
      // "addresses the need" even if below replacement — we're plugging
      // a hole, not upgrading.
      if (v.tier !== 'stash') met.add(v.position.toUpperCase());
    }
  }
  return Array.from(met);
}

/**
 * Describe a need level in a sentence fragment the UI can splice in.
 */
function needDescription(
  pos: string,
  level: NeedLevel,
  playerNames: string[]
): string {
  const who = playerNames.length > 0 ? `${playerNames.join(' + ')}` : 'adds';
  switch (level) {
    case 'premium':
      return `${who} fills a premium hole at ${pos}`;
    case 'starter':
      return `${who} gives you a stable starting ${pos}`;
    case 'depth':
      return `${who} adds needed depth at ${pos}`;
    case 'none':
      return `${who} adds surplus at ${pos}`;
  }
}

/**
 * Look up player names for a list of ids from facts. Used only for
 * building fit-reason strings — not for scoring.
 */
function namesForIds(
  ids: string[],
  factsById: Map<string, PlayerFacts>
): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const f = factsById.get(id);
    if (f) out.push(f.name);
  }
  return out;
}

/**
 * Build fit reasons for a candidate from both sides' perspectives.
 */
function buildFitReasons(
  candidate: { sendPlayerIds: string[]; receivePlayerIds: string[] },
  userComp: TeamComposition,
  partnerComp: TeamComposition,
  valuations: Map<string, PlayerValuation>,
  factsById: Map<string, PlayerFacts>,
  userNeedsMet: string[],
  partnerNeedsMet: string[]
): { forYou: string[]; forThem: string[] } {
  const forYou: string[] = [];
  const forThem: string[] = [];

  // User side: group incoming players by position
  const incomingByPos = new Map<string, string[]>();
  for (const id of candidate.receivePlayerIds) {
    const v = valuations.get(id);
    if (!v) continue;
    const arr = incomingByPos.get(v.position.toUpperCase()) || [];
    arr.push(id);
    incomingByPos.set(v.position.toUpperCase(), arr);
  }
  for (const pos of userNeedsMet) {
    const ids = incomingByPos.get(pos) || [];
    const names = namesForIds(ids, factsById);
    const summary = userComp.byPosition.get(pos);
    if (!summary) continue;
    forYou.push(needDescription(pos, summary.needLevel, names));
  }

  // If the user is sending from a surplus position, note it
  const sendingByPos = new Map<string, string[]>();
  for (const id of candidate.sendPlayerIds) {
    const v = valuations.get(id);
    if (!v) continue;
    const arr = sendingByPos.get(v.position.toUpperCase()) || [];
    arr.push(id);
    sendingByPos.set(v.position.toUpperCase(), arr);
  }
  for (const [pos, ids] of sendingByPos) {
    const summary = userComp.byPosition.get(pos);
    if (!summary) continue;
    if (summary.surplusCount >= ids.length) {
      const names = namesForIds(ids, factsById);
      forYou.push(`Sells from your ${pos} surplus (${names.join(', ')})`);
      break; // one surplus line is enough
    }
  }

  // Partner side: mirror the logic
  const partnerIncomingByPos = new Map<string, string[]>();
  for (const id of candidate.sendPlayerIds) {
    const v = valuations.get(id);
    if (!v) continue;
    const arr = partnerIncomingByPos.get(v.position.toUpperCase()) || [];
    arr.push(id);
    partnerIncomingByPos.set(v.position.toUpperCase(), arr);
  }
  for (const pos of partnerNeedsMet) {
    const ids = partnerIncomingByPos.get(pos) || [];
    const names = namesForIds(ids, factsById);
    const summary = partnerComp.byPosition.get(pos);
    if (!summary) continue;
    forThem.push(needDescription(pos, summary.needLevel, names));
  }

  return { forYou, forThem };
}

// ── Candidate builders ──────────────────────────────────────────────
//
// For each (userNeed, partnerSurplusAtUserNeed) we try to find a
// matching (userSurplus, partnerNeed) pair and pair them up into
// 1v1, 2v1, 1v2 packages that balance within tolerance.

interface Pair {
  send: string[];
  receive: string[];
}

function tryBuildPair(
  partnerPlayerAddressingUserNeed: string,
  partnerComp: TeamComposition,
  userComp: TeamComposition,
  valuations: Map<string, PlayerValuation>,
  tolerance: number
): Pair[] {
  const partnerV = valuations.get(partnerPlayerAddressingUserNeed);
  if (!partnerV) return [];
  const targetValue = partnerV.finalValue;

  const pairs: Pair[] = [];

  // Candidate user "surplus" pool: players the user would send.
  // Sorted by finalValue desc so we consider biggest trades first.
  const userPool: PlayerValuation[] = [];
  for (const [, summary] of userComp.byPosition) {
    for (const slot of summary.players) {
      if (slot.role === 'starter') continue;
      const v = valuations.get(slot.playerId);
      if (v) userPool.push(v);
    }
  }
  userPool.sort((a, b) => b.finalValue - a.finalValue);

  // Prefer users sending at positions that address a partner need
  const partnerNeedPositions = new Set(partnerComp.needs.map((n) => n.position));

  // ── 1-for-1 ──
  for (const userV of userPool) {
    if (Math.abs(userV.finalValue - targetValue) / Math.max(userV.finalValue, targetValue, 1) <= tolerance) {
      pairs.push({
        send: [userV.playerId],
        receive: [partnerPlayerAddressingUserNeed],
      });
    }
  }

  // ── 2-for-1 (user sends 2 smaller players for partner's 1 bigger player) ──
  // Only makes sense if partnerV is clearly stronger than any single user option
  const topUserValue = userPool[0]?.finalValue ?? 0;
  if (targetValue > topUserValue * 1.05) {
    for (let i = 0; i < Math.min(userPool.length, 8); i++) {
      for (let j = i + 1; j < Math.min(userPool.length, 8); j++) {
        const total = userPool[i].finalValue + userPool[j].finalValue;
        if (Math.abs(total - targetValue) / Math.max(total, targetValue, 1) <= tolerance) {
          pairs.push({
            send: [userPool[i].playerId, userPool[j].playerId],
            receive: [partnerPlayerAddressingUserNeed],
          });
        }
      }
    }
  }

  // ── 1-for-2 (partner throws in a second piece addressing a partner need we help with) ──
  // Only emit this when the user is giving up a top-tier player
  const userTopTier: PlayerValuation[] = userPool
    .filter((v) => v.tier === 'elite' || v.tier === 'high')
    .slice(0, 3);

  if (userTopTier.length > 0) {
    // Look for partner "throw-in" players at any position
    const partnerExtras: PlayerValuation[] = [];
    for (const [, summary] of partnerComp.byPosition) {
      for (const slot of summary.players) {
        if (slot.playerId === partnerPlayerAddressingUserNeed) continue;
        if (slot.role === 'starter') continue;
        const v = valuations.get(slot.playerId);
        if (v) partnerExtras.push(v);
      }
    }
    partnerExtras.sort((a, b) => b.finalValue - a.finalValue);

    for (const userV of userTopTier) {
      for (const extra of partnerExtras.slice(0, 6)) {
        const total = targetValue + extra.finalValue;
        if (Math.abs(userV.finalValue - total) / Math.max(userV.finalValue, total, 1) <= tolerance) {
          pairs.push({
            send: [userV.playerId],
            receive: [partnerPlayerAddressingUserNeed, extra.playerId],
          });
        }
      }
    }
  }

  // Prefer candidates whose sent player(s) are at a partner need position
  pairs.sort((a, b) => {
    const aAtNeed = a.send.some((id) => {
      const v = valuations.get(id);
      return v && partnerNeedPositions.has(v.position.toUpperCase());
    })
      ? 0
      : 1;
    const bAtNeed = b.send.some((id) => {
      const v = valuations.get(id);
      return v && partnerNeedPositions.has(v.position.toUpperCase());
    })
      ? 0
      : 1;
    return aAtNeed - bAtNeed;
  });

  return pairs;
}

// ── Main matcher entry point ────────────────────────────────────────

export interface MatchTradesArgs {
  userComp: TeamComposition;
  partnerComp: TeamComposition;
  valuations: Map<string, PlayerValuation>;
  factsById: Map<string, PlayerFacts>;
  settings: LeagueSettings;
  options?: MatchOptions;
}

export function matchTrades(args: MatchTradesArgs): MatchedCandidate[] {
  const {
    userComp,
    partnerComp,
    valuations,
    factsById,
    settings,
    options = {},
  } = args;
  // settings is reserved for future league-aware tuning (TE premium,
  // superflex tier weighting, etc). Scarcity is already baked into the
  // valuations themselves, so we don't need it here yet.
  void settings;
  const {
    maxCandidates = 12,
    imbalanceTolerance = 0.25,
    targetPosition = null,
    restrictUserAssets = null,
  } = options;

  // Helper to check if an id is in the user's allowed asset set
  const userAssetAllowed = (id: string): boolean => {
    if (!restrictUserAssets || restrictUserAssets.length === 0) return true;
    return restrictUserAssets.includes(id);
  };

  // 1) Identify the partner's "offerable" players that could address a
  //    user need. We iterate the user's needs (worst-first) and for each
  //    we look at the partner's roster at that position.
  const candidates: MatchedCandidate[] = [];

  const seenKeys = new Set<string>(); // dedupe identical packages

  const userNeedPositions = new Set(userComp.needs.map((n) => n.position));
  const userNeedsList = userComp.needs.length > 0 ? userComp.needs : [
    // If user has zero needs, still try to upgrade starters via tier jumps
    ...Array.from(userComp.byPosition.values())
      .filter((s): s is PositionSummary => !!s)
      .map((s) => ({ position: s.position, level: 'depth' as NeedLevel })),
  ];

  for (const need of userNeedsList) {
    // If the user filtered by targetPosition, only consider that position
    if (targetPosition && need.position !== targetPosition.toUpperCase()) continue;

    const partnerSummary = partnerComp.byPosition.get(need.position);
    if (!partnerSummary) continue;

    // Partner must have someone at this position we could plausibly acquire.
    // We skip their single best player at this position (they won't move
    // their RB1 for our RB3) UNLESS the user's top surplus tier is
    // comparable — we let tryBuildPair's tolerance gate that.
    const partnerCandidates = partnerSummary.players.filter(
      (p) => p.role !== 'starter' || partnerSummary.surplusCount > 0 || partnerSummary.players.length > partnerSummary.starterCount
    );

    // Also allow the partner's starter if they have 2+ starters at the
    // position (e.g. RB1/RB2) — one of them is movable for the right price.
    const startersAtPos = partnerSummary.players.filter((p) => p.role === 'starter');
    if (startersAtPos.length >= 2) {
      // include the WORST starter as a candidate — they have stable depth
      partnerCandidates.push(startersAtPos[startersAtPos.length - 1]);
    }

    for (const partnerPlayer of partnerCandidates) {
      const pairs = tryBuildPair(
        partnerPlayer.playerId,
        partnerComp,
        userComp,
        valuations,
        imbalanceTolerance
      );

      for (const pair of pairs) {
        // Respect userPlayerIds restriction (all sent player ids must be allowed)
        if (!pair.send.every(userAssetAllowed)) continue;

        const key = `${[...pair.send].sort().join(',')}→${[...pair.receive].sort().join(',')}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const userNeedsMet = needsMetBy(userComp, pair.receive, valuations);
        const partnerNeedsMet = needsMetBy(partnerComp, pair.send, valuations);

        // Mutual benefit guard — both sides must address at least one
        // need. Without this, trades would regress into "value matched
        // but nobody wants it". Exception: partner has zero needs (a
        // juggernaut team) — we allow one-sided "they have surplus,
        // you have need" deals since the partner might move depth for
        // a marginal upgrade.
        if (userNeedsMet.length === 0) continue;
        if (partnerComp.needs.length > 0 && partnerNeedsMet.length === 0) continue;

        const userValue = sumValue(pair.send, valuations);
        const partnerValue = sumValue(pair.receive, valuations);
        const imbalance = valueImbalancePct(pair.send, pair.receive, valuations);

        const reasons = buildFitReasons(
          { sendPlayerIds: pair.send, receivePlayerIds: pair.receive },
          userComp,
          partnerComp,
          valuations,
          factsById,
          userNeedsMet,
          partnerNeedsMet
        );

        // Score: lower = better.
        // - absolute imbalance matters (close to 0 is best)
        // - mutual fit matters MORE (|userNeedsMet| + |partnerNeedsMet|)
        // - slight preference for non-trivial total value
        const totalValue = userValue + partnerValue;
        const fitBonus = (userNeedsMet.length + partnerNeedsMet.length) * 30;
        const imbalancePenalty = Math.abs(imbalance) * 100;
        const magnitudeBonus = Math.log(1 + totalValue) * 2;
        const score = imbalancePenalty - fitBonus - magnitudeBonus;

        candidates.push({
          sendPlayerIds: pair.send,
          receivePlayerIds: pair.receive,
          userValue: Math.round(userValue * 10) / 10,
          partnerValue: Math.round(partnerValue * 10) / 10,
          valueImbalancePct: Math.round(imbalance * 1000) / 1000,
          userNeedsMet,
          partnerNeedsMet,
          fitReasons: reasons,
          score: Math.round(score * 10) / 10,
        });
      }
    }
  }

  // Sort by score ascending and return top N
  candidates.sort((a, b) => a.score - b.score);
  void userNeedPositions; // reserved for future use
  return candidates.slice(0, maxCandidates);
}

/**
 * Apply a per-player diversity cap across a sorted list of matched
 * candidates. Prevents any single player id from dominating the final
 * slate (the same diversity idea the old candidateFilter used, but
 * operating on MatchedCandidates so we preserve fit metadata).
 *
 * Generic over the candidate type so callers can attach fields like
 * `targetTeamId` and have them flow through unchanged.
 */
export function pickDiverseMatches<T extends MatchedCandidate>(
  candidates: T[],
  topN: number,
  maxPerPlayer = 2
): T[] {
  const count = new Map<string, number>();
  const out: T[] = [];
  for (const c of candidates) {
    if (out.length >= topN) break;
    const involved = [...c.sendPlayerIds, ...c.receivePlayerIds];
    const hitCap = involved.some(
      (pid) => (count.get(pid) ?? 0) >= maxPerPlayer
    );
    if (hitCap) continue;
    out.push(c);
    for (const pid of involved) count.set(pid, (count.get(pid) ?? 0) + 1);
  }
  return out;
}
