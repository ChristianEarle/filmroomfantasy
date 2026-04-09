/**
 * leagueContextFormatter — produces a compact "whole league" snapshot
 * for the trade constructor's mega-call prompt.
 *
 * Why this exists separately from tradeContext.formatTradeContextForPrompt:
 *  - That formatter is per-player verbose (Vegas, schedule, full props).
 *    Great for grading 2-4 players in an analyzer call.
 *  - The constructor needs ALL ~12 teams × ~15 players in one prompt
 *    and would blow the token budget if we used the verbose formatter.
 *  - Here we emit a tight 1-line-per-player view that highlights the
 *    structural data the AI actually needs to construct a trade:
 *      - position
 *      - finalValue (the deterministic ROS estimate)
 *      - tier (elite/high/mid/depth/stash)
 *      - rosterRole (starter/flex/bench/depth/surplus)
 *      - injury status if not active
 *
 * The output is instructions to the AI: "use these valuations as a
 * STARTING POINT for fairness, not a hard constraint. You may disagree
 * but justify it." We trust the LLM to reason about context the
 * formula can't encode (game script, coaching, opportunity changes).
 */

import type {
  PlayerFacts,
  TradeContext,
  LeagueSettings,
} from './tradeContext';
import type { PlayerValuation } from './playerValuation';
import type { TeamComposition } from './teamComposition';

export interface LeagueContextSnapshot {
  /** The user's team id — must match one of the teams in `teams` */
  userTeamId: string;
  /** Every team in the league, including the user's */
  teams: Array<{
    id: string;
    name: string;
    record: string | null;
    rank: number | null;
    composition: TeamComposition;
  }>;
  context: TradeContext;
  valuations: Map<string, PlayerValuation>;
  factsById: Map<string, PlayerFacts>;
  settings: LeagueSettings;
}

/**
 * Render the snapshot as a compact text block. Aim for ~10-15K tokens
 * total for a 12-team league with ~15 rostered skill players each.
 */
export function formatLeagueContextForConstructor(
  snap: LeagueContextSnapshot
): string {
  const lines: string[] = [];
  const ctx = snap.context;
  const settings = snap.settings;

  lines.push('=== LEAGUE CONTEXT (whole league snapshot) ===');
  lines.push(
    `Season ${ctx.seasonYear} W${ctx.currentWeek} (${ctx.seasonPhase}) | ` +
      `${settings.scoringFormat.toUpperCase()}` +
      (settings.superflex ? ' + Superflex' : '') +
      (settings.tePremium ? ' + TE Premium' : '') +
      ` | ${settings.teamCount} teams`
  );
  lines.push(
    `Data availability: projections=${ctx.dataAvailability.hasCurrentProjections}, ` +
      `stats=${ctx.dataAvailability.hasCurrentStats}, vegas=${ctx.dataAvailability.hasVegasLines}`
  );
  lines.push('');
  lines.push(
    'NOTE on values: each player has a [val/tier/role] tag.'
  );
  lines.push(
    '  val  = deterministic rest-of-season points estimate (scarcity-adjusted).'
  );
  lines.push(
    '  tier = elite | high | mid | depth | stash (by position rank).'
  );
  lines.push(
    '  role = starter | flex | bench | depth | surplus on the OWNING team.'
  );
  lines.push(
    'These are STARTING POINTS, not ground truth. You may disagree based on'
  );
  lines.push(
    'context (usage trends, coaching, schedule, injury timeline) — explain why.'
  );
  lines.push('');

  // Sort teams: user first, then everyone else by rank
  const sortedTeams = [...snap.teams].sort((a, b) => {
    if (a.id === snap.userTeamId) return -1;
    if (b.id === snap.userTeamId) return 1;
    return (a.rank ?? 99) - (b.rank ?? 99);
  });

  for (const team of sortedTeams) {
    const isUser = team.id === snap.userTeamId;
    const header = isUser
      ? `=== ${team.name} (YOU)`
      : `=== ${team.name}`;
    const meta: string[] = [];
    if (team.record) meta.push(team.record);
    if (team.rank != null) meta.push(`#${team.rank}`);
    lines.push(`${header}${meta.length ? ` [${meta.join(', ')}]` : ''} ===`);

    // Needs / strengths line
    const needs = team.composition.needs.length > 0
      ? team.composition.needs
          .map((n) => `${n.position}(${n.level})`)
          .join(', ')
      : '(none)';
    lines.push(`Needs: ${needs}`);

    const strengths = computeStrengths(team.composition);
    if (strengths.length > 0) {
      lines.push(`Strengths: ${strengths.join(', ')}`);
    }

    // Per-position roster — only positions that have players
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const summary = team.composition.byPosition.get(pos);
      if (!summary || summary.players.length === 0) continue;

      const playerLines = summary.players.map((slot) => {
        const facts = snap.factsById.get(slot.playerId);
        const name = facts?.name ?? slot.playerId;
        const status = facts?.identity.status;
        const statusTag =
          status && status !== 'active' ? ` [${status.toUpperCase()}]` : '';
        // Compact tag: [val/tier/role] with player ID so the AI can
        // echo it back exactly in sentPlayerIds / receivedPlayerIds.
        // Without this, the AI has no way to know the DB player ID
        // (a numeric Sleeper string like "4046") from the name alone.
        const tag = `[${Math.round(slot.finalValue)}/${slot.tier}/${slot.role}]`;
        return `${name} ${tag} id=${slot.playerId}${statusTag}`;
      });
      lines.push(`${pos}: ${playerLines.join(', ')}`);
    }
    lines.push('');
  }

  lines.push('=== END LEAGUE CONTEXT ===');
  return lines.join('\n');
}

/**
 * Compute a short list of "strength" positions for a team — positions
 * where the team has clear surplus or elite tier players. Used purely
 * for the prompt summary line.
 */
function computeStrengths(comp: TeamComposition): string[] {
  const strengths: string[] = [];
  for (const [pos, summary] of comp.byPosition) {
    // Surplus players → strength
    if (summary.surplusCount > 0) {
      strengths.push(`${pos}(surplus)`);
      continue;
    }
    // Elite-tier top player AND need is 'none' → strength
    if (summary.topTier === 'elite' && summary.needLevel === 'none') {
      strengths.push(`${pos}(elite)`);
    }
  }
  return strengths;
}

/**
 * Build a quick name lookup for use in error messages and validation.
 */
export function namesByPlayerId(
  factsById: Map<string, PlayerFacts>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id, facts] of factsById) {
    out.set(id, facts.name);
  }
  return out;
}
