/**
 * teamComposition — deterministic analysis of a roster's shape.
 *
 * Given a team's rostered players + their valuations, produces:
 *  - a sorted depth chart per position
 *  - a `rosterRole` label for each player (starter / flex / bench / depth / surplus)
 *  - a `needLevel` per position (premium / starter / depth / none)
 *  - flat helper lists (surplusByPos, needsByPos) for the matcher
 *
 * This is the algorithmic counterpart to the AI-generated Team Needs
 * narrative. The AI still writes the human summary; this module exists
 * so the MATCHER has a precise, machine-consumable view of every team.
 *
 * No AI calls, no DB calls. Pure function of inputs.
 */

import type { LeagueSettings } from './tradeContext';
import type { PlayerValuation, PlayerTier } from './playerValuation';

export type RosterRole =
  | 'starter'  // locks the starting lineup at this position
  | 'flex'     // best non-starter, expected to fill FLEX / SUPERFLEX
  | 'bench'    // meaningful depth behind the starter
  | 'depth'    // deep bench, insurance
  | 'surplus'; // extra beyond reasonable depth — most likely to be traded

export type NeedLevel =
  | 'premium'  // actively needs an elite/high-tier player here
  | 'starter'  // needs at least a mid-tier starter
  | 'depth'    // has a starter but needs reliable backup
  | 'none';    // fine at this position

export interface PlayerRosterSlot {
  playerId: string;
  position: string;
  tier: PlayerTier;
  finalValue: number;
  role: RosterRole;
}

export interface PositionSummary {
  position: string;
  players: PlayerRosterSlot[]; // sorted by finalValue desc
  starterCount: number;        // how many of these count as starters
  depthCount: number;          // meaningful depth behind starters
  surplusCount: number;        // extras beyond reasonable depth
  topTier: PlayerTier | null;
  needLevel: NeedLevel;
}

export interface TeamComposition {
  teamId: string;
  byPosition: Map<string, PositionSummary>;
  /** Flat list of "players the team is most willing to part with" */
  surplusPlayerIds: string[];
  /** Positions where the team has a real hole, ordered worst-first */
  needs: Array<{ position: string; level: NeedLevel }>;
  /** For each player id, their computed roster role */
  rolesByPlayer: Map<string, RosterRole>;
}

// ── Slot requirements per position ──────────────────────────────────
//
// How many "starter grade" players a team should have at each position.
// The FLEX slot is counted as "you need one extra RB/WR/TE from the
// surplus pool", which we express by giving each flex position +0.5
// expected starters beyond the hard minimum.

interface SlotRequirements {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;      // extra RB/WR/TE starters
  superflex: number; // extra QB/RB/WR/TE starters (counts toward QB first)
}

function defaultSlots(settings: LeagueSettings): SlotRequirements {
  const s = settings.rosterSlots ?? {};
  return {
    qb: s.qb ?? 1,
    rb: s.rb ?? 2,
    wr: s.wr ?? 2,
    te: s.te ?? 1,
    flex: s.flex ?? 1,
    superflex: s.superflex ?? (settings.superflex ? 1 : 0),
  };
}

// Minimum depth targets: how many players at each pos a healthy team
// should want, INCLUDING the starters. Anything beyond is "surplus".
function depthTarget(
  position: string,
  req: SlotRequirements,
  settings: LeagueSettings
): { starters: number; depth: number } {
  const pos = position.toUpperCase();
  switch (pos) {
    case 'QB': {
      const starters = req.qb + (settings.superflex ? req.superflex : 0);
      return { starters, depth: starters + 1 };
    }
    case 'RB': {
      const starters = req.rb;
      // Flex slot is usually filled with RB/WR → target 1 extra RB in depth
      return { starters, depth: starters + Math.ceil(req.flex / 2) + 2 };
    }
    case 'WR': {
      const starters = req.wr;
      return { starters, depth: starters + Math.ceil(req.flex / 2) + 2 };
    }
    case 'TE': {
      const starters = req.te;
      return {
        starters,
        depth: starters + (settings.tePremium ? 2 : 1),
      };
    }
    default:
      return { starters: 0, depth: 0 };
  }
}

// ── Role + need assignment ──────────────────────────────────────────

function assignRoles(
  players: PlayerValuation[],
  target: { starters: number; depth: number }
): PlayerRosterSlot[] {
  // players arrive pre-sorted by finalValue desc
  return players.map((p, idx) => {
    let role: RosterRole;
    if (idx < target.starters) role = 'starter';
    else if (idx < target.starters + 1) role = 'flex';
    else if (idx < target.depth) role = 'bench';
    else if (idx < target.depth + 1) role = 'depth';
    else role = 'surplus';

    return {
      playerId: p.playerId,
      position: p.position,
      tier: p.tier,
      finalValue: p.finalValue,
      role,
    };
  });
}

// Compute the need at a position from how strong the current starters
// are AND whether depth is thin. A team with an elite RB1 and nobody
// else at RB still needs a "starter" because flex / bye weeks exist.
function computeNeed(
  slots: PlayerRosterSlot[],
  target: { starters: number; depth: number }
): NeedLevel {
  if (slots.length === 0) return 'premium';

  const topTier = slots[0].tier;
  const startersActual = slots.slice(0, target.starters);
  const startersHaveElite = startersActual.some(
    (s) => s.tier === 'elite' || s.tier === 'high'
  );

  // Not enough bodies to fill the starting lineup at this position → premium need
  if (slots.length < target.starters) return 'premium';

  // Fewer than target.depth bodies → at minimum a depth need
  const missingDepth = Math.max(0, target.depth - slots.length);

  // No high-end starter at a scoring position → starter need
  if (!startersHaveElite && (topTier === 'mid' || topTier === 'depth' || topTier === 'stash')) {
    return 'starter';
  }

  if (missingDepth > 0) return 'depth';

  // Everything comfortable: explicit 'none'
  return 'none';
}

// ── Main entry point ────────────────────────────────────────────────

export interface BuildTeamCompositionArgs {
  teamId: string;
  rosteredPlayerIds: string[];
  valuations: Map<string, PlayerValuation>;
  settings: LeagueSettings;
}

export function buildTeamComposition(
  args: BuildTeamCompositionArgs
): TeamComposition {
  const { teamId, rosteredPlayerIds, valuations, settings } = args;
  const req = defaultSlots(settings);

  // Bucket players by position
  const byPos = new Map<string, PlayerValuation[]>();
  for (const id of rosteredPlayerIds) {
    const v = valuations.get(id);
    if (!v) continue;
    // Skip K/DEF entirely — the finder never trades them
    const pos = v.position.toUpperCase();
    if (pos === 'K' || pos === 'DEF' || pos === 'DST') continue;
    const arr = byPos.get(pos) || [];
    arr.push(v);
    byPos.set(pos, arr);
  }

  // Sort each bucket by finalValue desc
  for (const [, arr] of byPos) {
    arr.sort((a, b) => b.finalValue - a.finalValue);
  }

  const summaries = new Map<string, PositionSummary>();
  const rolesByPlayer = new Map<string, RosterRole>();
  const allSurplus: string[] = [];

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const players = byPos.get(pos) || [];
    const target = depthTarget(pos, req, settings);
    const slots = assignRoles(players, target);
    const needLevel = computeNeed(slots, target);

    const starterCount = Math.min(slots.length, target.starters);
    const depthCount = Math.max(
      0,
      Math.min(slots.length, target.depth) - target.starters
    );
    const surplusCount = Math.max(0, slots.length - target.depth);

    for (const s of slots) {
      rolesByPlayer.set(s.playerId, s.role);
      if (s.role === 'surplus') allSurplus.push(s.playerId);
    }

    summaries.set(pos, {
      position: pos,
      players: slots,
      starterCount,
      depthCount,
      surplusCount,
      topTier: slots[0]?.tier ?? null,
      needLevel,
    });
  }

  // Needs ordered worst-first (premium > starter > depth > none)
  const needPriority: Record<NeedLevel, number> = {
    premium: 3,
    starter: 2,
    depth: 1,
    none: 0,
  };
  const needs = Array.from(summaries.values())
    .filter((s) => s.needLevel !== 'none')
    .sort((a, b) => needPriority[b.needLevel] - needPriority[a.needLevel])
    .map((s) => ({ position: s.position, level: s.needLevel }));

  return {
    teamId,
    byPosition: summaries,
    surplusPlayerIds: allSurplus,
    needs,
    rolesByPlayer,
  };
}

// ── Helpers for the matcher ─────────────────────────────────────────

/**
 * Players on this team who could plausibly be offered in a trade: the
 * flex/bench/depth/surplus tiers at any position. Starters are excluded
 * by default since moving a starter creates a hole.
 *
 * The matcher may still include a starter if the received package
 * clearly replaces them — that's the matcher's job, not this one's.
 */
export function tradeableAssetsFor(comp: TeamComposition): string[] {
  const out: string[] = [];
  for (const [, summary] of comp.byPosition) {
    for (const slot of summary.players) {
      if (slot.role !== 'starter') out.push(slot.playerId);
    }
  }
  return out;
}

/**
 * All rostered player ids at a specific position (any role), sorted
 * by finalValue desc. Useful when the user filters by targetPosition.
 */
export function playersAtPosition(
  comp: TeamComposition,
  position: string
): string[] {
  const pos = position.toUpperCase();
  const summary = comp.byPosition.get(pos);
  if (!summary) return [];
  return summary.players.map((p) => p.playerId);
}
