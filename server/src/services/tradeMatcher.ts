/**
 * tradeMatcher — needs-aware candidate generator.
 *
 * Enumerates concrete trade candidates between the user and a partner
 * team using deterministic logic (no AI). Produces a small scored
 * pool that the ranking constructor picks from.
 *
 * Shape support: 1v1, 2v1, 1v2, 2v2, 3v1.
 *
 * Pick-awareness: when the user is offering draft picks as part of
 * every trade, their estimated value is added to the user's send
 * side BEFORE the balance check. This means the matcher looks for
 * UPGRADES (partner players worth more than user players by the
 * pick value) instead of sidegrades — which is what the user
 * actually wants when they offer "Player X + 1st for an upgrade."
 *
 * Required-asset seeding: when restrictUserAssets is set, every
 * candidate starts with one of those assets on the sent side. This
 * guarantees the filter is satisfied structurally rather than via
 * post-filtering that can empty out the pool.
 *
 * Philosophy: "surplus for need" is how real-world trades happen.
 * The matcher changes the question from "can these players have
 * similar value?" to "does swapping them make both teams better?".
 */

import type { PlayerFacts, LeagueSettings } from './tradeContext';
import type { PlayerValuation } from './playerValuation';
import { sumValue } from './playerValuation';
import type {
  TeamComposition,
  NeedLevel,
} from './teamComposition';

// ── Types ────────────────────────────────────────────────────────────

export interface MatchedCandidate {
  sendPlayerIds: string[];
  receivePlayerIds: string[];

  /** Per-side value totals from the deterministic model.
   *  userValue INCLUDES the estimated pick value when the caller
   *  passed pickValueSum — this matches what the partner actually
   *  receives when the pick gets stapled on at verification time. */
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
  /** If set, restrict user's send-side pool to these player ids.
   *  Every generated candidate will include at least one of these
   *  ids on the sent side (seeded, not post-filtered). */
  restrictUserAssets?: string[] | null;
  /** Estimated total value of picks the user is offering on every
   *  trade (added to user's send side before balance checks so the
   *  matcher finds upgrades instead of sidegrades). Default 0. */
  pickValueSum?: number;
  /** Max players per side. Default 3. Caps combinatorial explosion
   *  on 2v2 / 3v1 shapes. */
  maxPlayersPerSide?: number;
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
// For each (userNeed, partnerPlayerAtThatPosition) we try to find
// matching user-side packages at a balanced value (including pick
// value when the user has picks on offer). Supported shapes:
//   1v1, 2v1, 1v2, 2v2, 3v1
//
// Seed support: an optional seededUserPlayerId forces that id to be
// on the sent side for every pair emitted. Used to honor
// restrictUserAssets structurally.

interface Pair {
  send: string[];
  receive: string[];
}

interface BuildPairArgs {
  partnerPlayerAddressingUserNeed: string;
  partnerComp: TeamComposition;
  userComp: TeamComposition;
  valuations: Map<string, PlayerValuation>;
  tolerance: number;
  /** Extra virtual value on the user's side from draft picks. */
  pickValueSum: number;
  /** If set, every pair must include this player id on the sent side. */
  seededUserPlayerId: string | null;
  /** Max players per side across all shapes. */
  maxPlayersPerSide: number;
}

function balanced(sendTotal: number, receiveTotal: number, tolerance: number): boolean {
  const max = Math.max(sendTotal, receiveTotal, 1);
  return Math.abs(sendTotal - receiveTotal) / max <= tolerance;
}

function tryBuildPair(args: BuildPairArgs): Pair[] {
  const {
    partnerPlayerAddressingUserNeed,
    partnerComp,
    userComp,
    valuations,
    tolerance,
    pickValueSum,
    seededUserPlayerId,
    maxPlayersPerSide,
  } = args;

  const partnerV = valuations.get(partnerPlayerAddressingUserNeed);
  if (!partnerV) return [];
  const targetValue = partnerV.finalValue;

  const pairs: Pair[] = [];

  // Candidate user pool: non-starters. We allow starters at positions
  // where the user has 2+ starters (e.g. RB1/RB2 when both are
  // startable) because real rosters trade those in 2v2 shapes.
  const userPool: PlayerValuation[] = [];
  for (const [, summary] of userComp.byPosition) {
    const starterCount = summary.players.filter((p) => p.role === 'starter').length;
    for (const slot of summary.players) {
      if (slot.role === 'starter' && starterCount < 2) continue;
      const v = valuations.get(slot.playerId);
      if (v) userPool.push(v);
    }
  }
  userPool.sort((a, b) => b.finalValue - a.finalValue);

  // Seed: if a required asset is forced, pre-compute its valuation
  // and filter the rest of the pool to exclude it (we'll add it
  // back as the forced first element of every package).
  const seededV = seededUserPlayerId ? valuations.get(seededUserPlayerId) : null;
  if (seededUserPlayerId && !seededV) return []; // unknown seed id — bail
  const userPoolNonSeed = seededV
    ? userPool.filter((p) => p.playerId !== seededV.playerId)
    : userPool;

  // Convenience: add pick value to a player-value total.
  const withPicks = (playerTotal: number): number => playerTotal + pickValueSum;

  const pushIfNew = (pair: Pair) => {
    // Defensive dedup check handled by caller via seenKeys; we just
    // cap package size here.
    if (pair.send.length > maxPlayersPerSide) return;
    if (pair.receive.length > maxPlayersPerSide) return;
    pairs.push(pair);
  };

  // ── Shape: send only the seed (1 user player + picks) for target ──
  // When a seed is set and the seed + picks balance the target, emit
  // the single-seed trade. This is the "Tank Dell + 1st for CandidateWR"
  // canonical shape.
  if (seededV && balanced(withPicks(seededV.finalValue), targetValue, tolerance)) {
    pushIfNew({
      send: [seededV.playerId],
      receive: [partnerPlayerAddressingUserNeed],
    });
  }

  // ── 1-for-1 ── (no seed) or (seed is the only sent player)
  if (!seededV) {
    for (const userV of userPool) {
      if (balanced(withPicks(userV.finalValue), targetValue, tolerance)) {
        pushIfNew({ send: [userV.playerId], receive: [partnerPlayerAddressingUserNeed] });
      }
    }
  }

  // ── 2-for-1 (two user players for one partner player) ──
  // Top 10 from pool keeps O(100) per partner — manageable.
  const topPool = userPoolNonSeed.slice(0, 10);
  for (let i = 0; i < topPool.length; i++) {
    for (let j = i + 1; j < topPool.length; j++) {
      const sendIds = seededV
        ? [seededV.playerId, topPool[i].playerId, topPool[j].playerId]
        : [topPool[i].playerId, topPool[j].playerId];
      const sendTotal = withPicks(
        (seededV?.finalValue ?? 0) + topPool[i].finalValue + topPool[j].finalValue
      );
      if (balanced(sendTotal, targetValue, tolerance)) {
        pushIfNew({ send: sendIds, receive: [partnerPlayerAddressingUserNeed] });
      }
    }
  }

  // ── 1-for-2 (user sends one, partner sends target + one extra) ──
  // Only emit when user is giving up a top-tier player OR when the
  // seeded player is strong enough.
  const eligibleUserAnchors: PlayerValuation[] = seededV
    ? [seededV]
    : userPool.filter((v) => v.tier === 'elite' || v.tier === 'high').slice(0, 3);

  if (eligibleUserAnchors.length > 0) {
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

    for (const userV of eligibleUserAnchors) {
      for (const extra of partnerExtras.slice(0, 6)) {
        const sendTotal = withPicks(userV.finalValue);
        const receiveTotal = targetValue + extra.finalValue;
        if (balanced(sendTotal, receiveTotal, tolerance)) {
          pushIfNew({
            send: [userV.playerId],
            receive: [partnerPlayerAddressingUserNeed, extra.playerId],
          });
        }
      }
    }
  }

  // ── 2-for-2 (user sends two for partner target + partner extra) ──
  // Useful when both teams have logjams at different positions and
  // want to swap depth + starter on both sides.
  if (maxPlayersPerSide >= 2) {
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
    const topPartnerExtras = partnerExtras.slice(0, 5);

    // Pre-pick user "second piece" candidates
    const userSeconds = seededV ? userPoolNonSeed.slice(0, 8) : userPool.slice(0, 8);

    for (const extra of topPartnerExtras) {
      const receiveTotal = targetValue + extra.finalValue;
      for (const userV of userSeconds) {
        const anchor = seededV ?? userV;
        const otherUserV = seededV ? userV : null;
        if (anchor === otherUserV) continue;
        const userAnchorValue = anchor.finalValue;
        const userOtherValue = otherUserV?.finalValue ?? 0;
        const sendIds = otherUserV
          ? [anchor.playerId, otherUserV.playerId]
          : [anchor.playerId];
        const sendTotal = withPicks(userAnchorValue + userOtherValue);
        if (balanced(sendTotal, receiveTotal, tolerance)) {
          pushIfNew({
            send: sendIds,
            receive: [partnerPlayerAddressingUserNeed, extra.playerId],
          });
        }
      }
    }
  }

  // ── 3-for-1 (user sends three for one partner star) ──
  // For big upgrades where 2v1 doesn't reach. Only valid when the
  // target is clearly bigger than any 1v1 balance.
  if (maxPlayersPerSide >= 3) {
    const bigTarget = targetValue > (userPool[0]?.finalValue ?? 0) * 1.3;
    if (bigTarget) {
      const basePool = seededV ? userPoolNonSeed.slice(0, 8) : userPool.slice(0, 8);
      for (let i = 0; i < basePool.length; i++) {
        for (let j = i + 1; j < basePool.length; j++) {
          for (let k = j + 1; k < basePool.length; k++) {
            const sendIds = seededV
              ? [seededV.playerId, basePool[i].playerId, basePool[j].playerId, basePool[k].playerId]
              : [basePool[i].playerId, basePool[j].playerId, basePool[k].playerId];
            // 3v1 already consumes 3 slots on the sent side; if seeded,
            // that becomes 4 which exceeds maxPlayersPerSide. Skip in
            // that case and let 2v1/2v2 shapes cover it.
            if (sendIds.length > maxPlayersPerSide) continue;
            const sendTotal = withPicks(
              (seededV?.finalValue ?? 0) +
                basePool[i].finalValue +
                basePool[j].finalValue +
                basePool[k].finalValue
            );
            if (balanced(sendTotal, targetValue, tolerance)) {
              pushIfNew({ send: sendIds, receive: [partnerPlayerAddressingUserNeed] });
            }
          }
        }
      }
    }
  }

  // Prefer candidates whose sent player(s) include a position that
  // addresses a real partner need (same "mutual benefit" bias the
  // original matcher had).
  const partnerNeedPositions = new Set(partnerComp.needs.map((n) => n.position));
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
    pickValueSum = 0,
    maxPlayersPerSide = 3,
  } = options;

  // If restrictUserAssets is set, we run one seed pass per asset so
  // every generated candidate structurally includes that asset. If
  // not, we run a single pass with no seed.
  const seeds: (string | null)[] =
    restrictUserAssets && restrictUserAssets.length > 0
      ? restrictUserAssets
      : [null];

  const candidates: MatchedCandidate[] = [];
  const seenKeys = new Set<string>(); // dedupe identical packages

  // Which partner positions should the matcher scan?
  //
  // Rule:
  //  - targetPosition set         → only that position
  //  - user has filters (restrict assets or picks) → ALL skill
  //    positions, because the user has explicitly opted in and
  //    wants to see what's possible, not just what their computed
  //    needs say. Without this, "I want to trade my WR + a pick
  //    for a better WR" dies silently when WR isn't in the
  //    computed needs list.
  //  - otherwise                  → computed needs list (or all
  //    skill positions if the user has no computed needs)
  const userHasFilters =
    (restrictUserAssets != null && restrictUserAssets.length > 0) ||
    pickValueSum > 0;

  const ALL_SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
  let userNeedsList: Array<{ position: string; level: NeedLevel }>;

  if (targetPosition) {
    const pos = targetPosition.toUpperCase();
    const existing = userComp.needs.find((n) => n.position === pos);
    userNeedsList = [{ position: pos, level: existing?.level ?? 'depth' }];
  } else if (userHasFilters || userComp.needs.length === 0) {
    // Opt-in mode OR no computed needs — scan every skill position.
    userNeedsList = ALL_SKILL_POSITIONS.map((pos) => {
      const existing = userComp.needs.find((n) => n.position === pos);
      return { position: pos, level: existing?.level ?? ('depth' as NeedLevel) };
    });
  } else {
    userNeedsList = userComp.needs;
  }

  for (const seed of seeds) {
    for (const need of userNeedsList) {
      const partnerSummary = partnerComp.byPosition.get(need.position);
      if (!partnerSummary) continue;

      // Partner candidates at this position:
      //  - any non-starter (depth/bench/surplus are movable)
      //  - the partner's #2 starter when they have 2+ starters
      //    (stable depth, worth moving for the right price)
      const partnerCandidates = partnerSummary.players.filter(
        (p) =>
          p.role !== 'starter' ||
          partnerSummary.surplusCount > 0 ||
          partnerSummary.players.length > partnerSummary.starterCount
      );
      const startersAtPos = partnerSummary.players.filter(
        (p) => p.role === 'starter'
      );
      if (startersAtPos.length >= 2) {
        partnerCandidates.push(startersAtPos[startersAtPos.length - 1]);
      }

      for (const partnerPlayer of partnerCandidates) {
        const pairs = tryBuildPair({
          partnerPlayerAddressingUserNeed: partnerPlayer.playerId,
          partnerComp,
          userComp,
          valuations,
          tolerance: imbalanceTolerance,
          pickValueSum,
          seededUserPlayerId: seed,
          maxPlayersPerSide,
        });

        for (const pair of pairs) {
          const key = `${[...pair.send].sort().join(',')}→${[...pair.receive].sort().join(',')}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const userNeedsMet = needsMetBy(userComp, pair.receive, valuations);
          const partnerNeedsMet = needsMetBy(partnerComp, pair.send, valuations);

          // Mutual benefit guard — relaxed in opt-in mode.
          //
          // Default mode: both sides must address at least one need.
          //   Otherwise every search would return "value-matched
          //   but nobody wants it" trades.
          //
          // Opt-in (user has filters): skip the user-side check —
          //   the user already said "I want to move these assets."
          //   Requiring their received player to meet a computed
          //   need blocks "upgrade at a position you already have
          //   coverage at" trades.
          //
          // Opt-in (user offers picks): also skip the partner-side
          //   check — the pick is the sweetener. Many partners
          //   accept a pick + filler for their spare starter without
          //   the filler itself addressing a partner need.
          const userCheckOk = userHasFilters || userNeedsMet.length > 0;
          const partnerCheckOk =
            partnerComp.needs.length === 0 ||
            partnerNeedsMet.length > 0 ||
            pickValueSum > 0;
          if (!userCheckOk) continue;
          if (!partnerCheckOk) continue;

          // Pick-aware value totals: pickValueSum is added to the user
          // side because that's what the partner actually receives
          // (picks get stapled on at verification time).
          const rawUserValue = sumValue(pair.send, valuations);
          const partnerValue = sumValue(pair.receive, valuations);
          const userValue = rawUserValue + pickValueSum;
          const maxSide = Math.max(userValue, partnerValue, 1);
          const imbalance = (partnerValue - userValue) / maxSide;

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
          // - absolute pick-aware imbalance matters (0 is best)
          // - mutual fit matters MORE (sum of needs met on both sides)
          // - slight magnitude bonus so we don't prefer tiny balanced deals
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
  }

  // Sort by score ascending and return top N
  candidates.sort((a, b) => a.score - b.score);
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
