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
 * Generate candidate packages from a set of assets the user holds and a
 * set of assets a target team holds. Produces 1-for-1, 2-for-1, 1-for-2,
 * and 2-for-2 combinations, bounded by maxCombos to prevent explosion.
 */
export function generateCandidates(
  userAssetIds: string[],
  targetAssetIds: string[],
  maxCombos = 50
): CandidatePackage[] {
  const out: CandidatePackage[] = [];

  // 1-for-1
  for (const u of userAssetIds) {
    for (const t of targetAssetIds) {
      out.push({ sendPlayerIds: [u], receivePlayerIds: [t] });
      if (out.length >= maxCombos) return out;
    }
  }

  // 2-for-1 (user sends 2)
  for (let i = 0; i < userAssetIds.length; i++) {
    for (let j = i + 1; j < userAssetIds.length; j++) {
      for (const t of targetAssetIds) {
        out.push({
          sendPlayerIds: [userAssetIds[i], userAssetIds[j]],
          receivePlayerIds: [t],
        });
        if (out.length >= maxCombos) return out;
      }
    }
  }

  // 1-for-2 (target sends 2)
  for (const u of userAssetIds) {
    for (let i = 0; i < targetAssetIds.length; i++) {
      for (let j = i + 1; j < targetAssetIds.length; j++) {
        out.push({
          sendPlayerIds: [u],
          receivePlayerIds: [targetAssetIds[i], targetAssetIds[j]],
        });
        if (out.length >= maxCombos) return out;
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
