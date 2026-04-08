/**
 * candidateFilter — a lightweight heuristic pre-filter for trade candidates.
 *
 * IMPORTANT: This is NEVER user-facing. It is not a "value score". It exists
 * to cut hundreds of possible trade permutations down to the ~10 that Claude
 * will actually analyze. Anything that ends up in front of the user goes
 * through the AI analyzer — the scores this module produces never do.
 *
 * Honest naming: "candidate" and "prefilter", not "value" or "rank".
 */

import type { PlayerFacts } from './tradeContext';

/**
 * A very rough proxy for near-term fantasy expected value, based only on
 * facts already in the TradeContext. Returns a number — its magnitude is
 * meaningless; only ordering matters. Missing data returns 0 rather than
 * null so we can sort without special casing.
 */
function roughProxy(p: PlayerFacts): number {
  // Start from the next-week projection if we have one
  let x = p.projection?.nextWeek?.projectedPoints ?? 0;

  // Supplement with recent-form: add the 4-game average weighted lightly
  if (p.recentVolume && p.recentVolume.seasonFantasyPointsAvg > 0) {
    x = x * 0.6 + p.recentVolume.seasonFantasyPointsAvg * 0.4;
  }

  // Injury penalty (the AI will reason about this properly later)
  if (p.identity.status === 'out' || p.identity.status === 'injured_reserve') {
    x *= 0.3;
  } else if (p.identity.status === 'doubtful') {
    x *= 0.6;
  } else if (p.identity.status === 'questionable') {
    x *= 0.85;
  }

  return x;
}

/**
 * Score a candidate trade package as a rough proxy for AI-graded fairness.
 * Only used to sort. Never shown to users.
 */
export interface CandidatePackage {
  sendPlayerIds: string[];
  receivePlayerIds: string[];
}

export interface ScoredCandidate {
  candidate: CandidatePackage;
  /** |sentProxy - receivedProxy| — smaller = more likely to be balanced */
  imbalance: number;
  /** sentProxy + receivedProxy — larger = bigger trade, more interesting */
  magnitude: number;
  /** Our rough pre-filter score, smaller is better for presentation order */
  preFilterScore: number;
}

export function scoreCandidate(
  candidate: CandidatePackage,
  playerFacts: Map<string, PlayerFacts>
): ScoredCandidate {
  const sentProxy = candidate.sendPlayerIds.reduce((sum, id) => {
    const p = playerFacts.get(id);
    return sum + (p ? roughProxy(p) : 0);
  }, 0);
  const receivedProxy = candidate.receivePlayerIds.reduce((sum, id) => {
    const p = playerFacts.get(id);
    return sum + (p ? roughProxy(p) : 0);
  }, 0);

  const imbalance = Math.abs(sentProxy - receivedProxy);
  const magnitude = sentProxy + receivedProxy;

  // Prefer balanced + meaningful packages. Penalty for huge imbalance.
  const preFilterScore = imbalance * 2 - magnitude;

  return {
    candidate,
    imbalance,
    magnitude,
    preFilterScore,
  };
}

/**
 * Compute rough proxy values for a list of player ids. Exported so
 * callers can pre-sort their asset arrays before generating candidates
 * (keeps per-size caps preserving the strongest combos when they fire).
 */
export function proxyMap(
  ids: string[],
  playerFacts: Map<string, PlayerFacts>
): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids) {
    const p = playerFacts.get(id);
    out.set(id, p ? roughProxy(p) : 0);
  }
  return out;
}

/**
 * Sort a list of player ids by roughProxy desc. Returns a new array;
 * does NOT mutate the input.
 */
export function sortByProxy(
  ids: string[],
  playerFacts: Map<string, PlayerFacts>
): string[] {
  const proxies = proxyMap(ids, playerFacts);
  return [...ids].sort(
    (a, b) => (proxies.get(b) ?? 0) - (proxies.get(a) ?? 0)
  );
}

/**
 * Generate candidate packages from a set of assets the user holds and a
 * set of assets a target team holds. Produces 1-for-1, 2-for-1, and
 * 1-for-2 combinations, each with its OWN cap — so a cheap 1-for-1
 * explosion can't starve the multi-player variants.
 *
 * Callers should pass asset lists already sorted by roughProxy desc
 * (see sortByProxy) so that when a per-size cap fires, the strongest
 * combos are still preserved.
 */
export function generateCandidates(
  userAssetIds: string[],
  targetAssetIds: string[],
  options: {
    max1v1?: number;
    max2v1?: number;
    max1v2?: number;
  } = {}
): CandidatePackage[] {
  const { max1v1 = 40, max2v1 = 25, max1v2 = 25 } = options;
  const out: CandidatePackage[] = [];

  // 1-for-1
  let count1v1 = 0;
  outer1: for (const u of userAssetIds) {
    for (const t of targetAssetIds) {
      if (count1v1 >= max1v1) break outer1;
      out.push({ sendPlayerIds: [u], receivePlayerIds: [t] });
      count1v1++;
    }
  }

  // 2-for-1 (user sends 2) — favor pairing top user players first
  let count2v1 = 0;
  outer2: for (let i = 0; i < userAssetIds.length; i++) {
    for (let j = i + 1; j < userAssetIds.length; j++) {
      for (const t of targetAssetIds) {
        if (count2v1 >= max2v1) break outer2;
        out.push({
          sendPlayerIds: [userAssetIds[i], userAssetIds[j]],
          receivePlayerIds: [t],
        });
        count2v1++;
      }
    }
  }

  // 1-for-2 (target sends 2)
  let count1v2 = 0;
  outer3: for (const u of userAssetIds) {
    for (let i = 0; i < targetAssetIds.length; i++) {
      for (let j = i + 1; j < targetAssetIds.length; j++) {
        if (count1v2 >= max1v2) break outer3;
        out.push({
          sendPlayerIds: [u],
          receivePlayerIds: [targetAssetIds[i], targetAssetIds[j]],
        });
        count1v2++;
      }
    }
  }

  return out;
}

/**
 * Given a list of candidates + their facts, return the top N candidates
 * sorted by preFilterScore ascending (lower = better pre-filter).
 */
export function topCandidates(
  candidates: CandidatePackage[],
  playerFacts: Map<string, PlayerFacts>,
  topN: number
): ScoredCandidate[] {
  const scored = candidates.map((c) => scoreCandidate(c, playerFacts));
  scored.sort((a, b) => a.preFilterScore - b.preFilterScore);
  return scored.slice(0, topN);
}

/**
 * Pick the top N candidates while enforcing diversity: each user player
 * and each target player may only appear in up to `maxPerPlayer` of the
 * selected candidates. Without this, the single best user player will
 * dominate every slot (e.g. "My RB1 for player A, My RB1 for player B,
 * My RB1 for player C…") which is boring output.
 *
 * Candidates are considered in score order (best first). When the
 * per-player cap is hit the candidate is skipped and we continue down
 * the list. Returns exactly up to topN survivors.
 */
export function pickDiverseTop(
  scored: ScoredCandidate[],
  topN: number,
  maxPerPlayer = 2
): ScoredCandidate[] {
  const sorted = [...scored].sort(
    (a, b) => a.preFilterScore - b.preFilterScore
  );
  const playerUseCount = new Map<string, number>();
  const out: ScoredCandidate[] = [];
  for (const c of sorted) {
    if (out.length >= topN) break;

    const involved = [
      ...c.candidate.sendPlayerIds,
      ...c.candidate.receivePlayerIds,
    ];
    const hitCap = involved.some(
      (pid) => (playerUseCount.get(pid) ?? 0) >= maxPerPlayer
    );
    if (hitCap) continue;

    out.push(c);
    for (const pid of involved) {
      playerUseCount.set(pid, (playerUseCount.get(pid) ?? 0) + 1);
    }
  }
  return out;
}
