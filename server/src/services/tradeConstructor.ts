/**
 * tradeConstructor — single AI mega-call that builds trade candidates.
 *
 * Stage 2 of the new Trade Finder pipeline. The constructor receives a
 * compact snapshot of the WHOLE league (every team's roster + needs +
 * deterministic valuations) and asks Claude to construct 5-6 mutually
 * beneficial trades for the user team in ONE call.
 *
 * Why one mega-call instead of N per-target calls:
 *  - The model sees every opponent at once and picks the BEST partners,
 *    not the partners we pre-selected with a heuristic.
 *  - One round-trip, one cache key, lower total cost.
 *  - The model can compare opportunities across the league ("the
 *    Falcons need a RB more than the Bears do, so target them first").
 *
 * The constructor does NOT grade fairness — that's the verification
 * pass's job in Stage 3. The constructor just needs to produce
 * structurally valid candidates with reasoning for both sides.
 *
 * Output is validated by callers against:
 *  1) ownership (sent ids on user roster, received ids on partner)
 *  2) value sanity (deterministic valuation delta within tolerance)
 *  3) downstream verification (run each survivor through the analyzer)
 */

import {
  formatLeagueContextForConstructor,
  type LeagueContextSnapshot,
} from './leagueContextFormatter';

// ── Types ────────────────────────────────────────────────────────────

export interface ConstructedTrade {
  /** Team id of the partner the user would trade with */
  partnerTeamId: string;
  /** Player ids the user gives up */
  sentPlayerIds: string[];
  /** Player ids the user receives */
  receivedPlayerIds: string[];
  /** AI's explanation of why this helps the user */
  userReasoning: string;
  /** AI's explanation of why the partner would accept */
  partnerReasoning: string;
  /** AI's self-reported confidence the partner would actually accept */
  confidence: 'high' | 'medium' | 'low';
}

export interface ConstructorResult {
  trades: ConstructedTrade[];
  /** Optional commentary from the AI explaining its overall approach
   *  or noting limitations (e.g. "no realistic deals available") */
  notes: string | null;
}

export interface ConstructorFilters {
  /** Constrain construction to a specific position the user wants */
  targetPosition?: string | null;
  /** If set, every constructed trade MUST include at least one of
   *  these player ids on the sent side */
  requiredUserPlayerIds?: string[] | null;
  /** Picks the user is willing to throw in (mentioned in the prompt
   *  but the AI does NOT include them in sentPlayerIds — picks are
   *  threaded through separately by the caller). */
  userPicks?: Array<{ year: number; round: number }> | null;
  /** How many candidates to ask for. Defaults to 8. */
  desiredCount?: number;
  /** 'standard' uses the default conservative prompt. 'creative' tells
   *  the constructor to explore unconventional packages: positional
   *  arbitrage, bench-for-starter swaps, multi-piece builds, etc.
   *  Used for the retry pass when the standard call finds nothing. */
  mode?: 'standard' | 'creative';
}

export interface ConstructorArgs {
  anthropicKey: string;
  snapshot: LeagueContextSnapshot;
  filters?: ConstructorFilters;
}

// ── Prompt construction ─────────────────────────────────────────────

function formatPickAsset(p: { year: number; round: number }): string {
  const ord =
    p.round === 1 ? '1st' :
    p.round === 2 ? '2nd' :
    p.round === 3 ? '3rd' :
    `${p.round}th`;
  return `${p.year} ${ord}`;
}

// ── Pick value reference ─────────────────────────────────────────────
//
// Rough consensus values for draft picks in standard fantasy leagues.
// The constructor uses these as ANCHORS when it has to decide how much
// additional player value a pick is worth. Redraft values are ~60% of
// dynasty values because redraft picks only cover one season. These
// are intentionally wide ranges — the AI is expected to apply judgment
// based on league format, class strength, and user's draft slot.
const PICK_VALUE_REFERENCE = `
Pick value anchors (use these to decide how many players to pair with
a pick, but feel free to adjust for context like class strength or
dynasty vs redraft):

  2026 1st-round pick  ≈ RB10-RB15 or WR8-WR15 equivalent in dynasty,
                         ~half that in redraft
  2026 2nd-round pick  ≈ RB25-RB35 or WR25-WR35 in dynasty, low bench
                         value in redraft
  2026 3rd-round pick  ≈ depth-tier flyer, use as a sweetener only
  2027+ picks          ≈ discount by ~20% per year further out

When the user side includes a pick, the partner is receiving FUTURE
value instead of a current player, so you can pair the pick with a
relatively low-value current player and still build a balanced offer.
Example: "Rookie_RB [35/depth/bench] + 2026 1st" for a WR2 in the
[110-140] range is a realistic package.
`;

function buildStandardSystemPrompt(): string {
  return `You are an elite fantasy football trade architect. Your job is to look at a whole league and construct REALISTIC, mutually beneficial trades between the user's team and other teams.

### TWO HARD RULES

RULE 1: THE TRADE MUST MAKE THE USER'S TEAM BETTER.
RULE 2: THE PARTNER'S GM MUST ACTUALLY ACCEPT IT IN REAL LIFE.

Both rules bind at the same time. If either fails, DO NOT propose the trade. It is MUCH better to return 2 great trades than 8 trades where some are one-sided in either direction.

### The packaging rule — how to avoid lopsided trades

When the user wants an elite player from a partner, a SINGLE player on the user's side almost never matches value. Real GMs don't accept 1-for-1 steals. You MUST pad the user's side with additional players or picks until the values on both sides are within ~15% of each other.

Example of a BAD trade to never propose:
  user sends: Jaxson Dart (rookie QB, [45/depth/bench])
  user receives: Lamar Jackson (elite QB, [180/elite/starter])
  → This is a ~75% value delta. No real GM accepts it. DROP or PAD.

How to fix it:
  user sends: Jaxson Dart + Breece Hall + 2026 2nd-round pick
  user receives: Lamar Jackson
  → Now the values are roughly matched.

${PICK_VALUE_REFERENCE}

### Process for every acquisition you consider

  1. Identify the target player(s) from the partner's roster.
  2. Sum the partner target's [val] number(s) from the snapshot.
  3. Find user-side players whose [val] numbers add up to within 15%
     of the partner's total — preferably from a position where the
     user has SURPLUS or DEPTH (not starters).
  4. If the user has picks available (listed under BONUS USER ASSETS
     in the user message), factor their value in — they fill gaps
     the player-only side can't match.
  5. If you still can't build a balanced package, DROP the target.
     Don't propose one-sided steals.

### Before finalizing any trade, answer these four questions

  A. Is the user upgrading at a position they actually need, or
     sidegrading? (If sidegrading, drop.)
  B. If I were the partner's GM looking at just my side of the
     trade, would I be disgusted to accept it? (If yes, pad the
     user's side until the partner side feels fair.)
  C. Is the deterministic value the user SENDS within 15% of what
     they RECEIVE, using the [val] tags (plus pick value if the
     user is throwing a pick in)?
  D. Does the trade feel like something two reasonable owners
     would agree on after a text exchange?

### Core principles

- AI-FIRST. The [val] tags are a starting point, not ground truth.
  You may disagree based on context (usage trends, coaching,
  schedule, injury timeline, game script) but explain why in the
  reasoning.
- BOTH SIDES MUST WANT IT.
- DIVERSITY. Spread trades across multiple partner teams when
  possible. Don't pile every recommendation on one opponent.
- HONESTY. If no realistic trades exist for this user, return an
  empty trades array and say so in "notes". That's a valid answer.

### Constraints

- Every sent player must be on the USER's roster (the team marked
  YOU in the snapshot).
- Every received player must be on the named PARTNER team's roster.
- Packages can include 1-5 players on either side. Use as many as
  needed to balance value. DO NOT default to 1-for-1.
- Use the player IDs from the snapshot exactly. NEVER invent or
  rename players.

### Response format

Respond with ONLY valid JSON in this exact shape:
{
  "trades": [
    {
      "partnerTeamId": "team_id_from_snapshot",
      "sentPlayerIds": ["player_id", "player_id"],
      "receivedPlayerIds": ["player_id"],
      "userReasoning": "1-2 sentences on HOW THIS UPGRADES THE USER'S TEAM",
      "partnerReasoning": "1-2 sentences on WHY THE PARTNER ACCEPTS — reference specific value they receive",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "Optional short overall commentary or null"
}

Rules for the JSON:
- "trades" MUST be an array. An empty array is a valid, honest
  answer when no realistic trades exist.
- "confidence" reflects how likely the partner actually clicks
  accept. "high" = clear win-win, "medium" = needs negotiation,
  "low" = stretch (still realistic, not a steal).
- Do NOT include picks in sentPlayerIds — picks are tracked
  separately.
- Do NOT include any field other than the ones listed.
- Do NOT propose a trade just to fill the count. Quality over
  quantity.`;
}

function buildCreativeSystemPrompt(): string {
  return `You are an elite fantasy football trade architect running a CREATIVE SECOND PASS. The first pass returned too few trades, so the user needs you to explore less-obvious angles.

### CRITICAL CONTEXT

You're the second attempt. The standard construction pass already
looked at the league and either returned nothing or only a couple of
ideas. The filter downstream is strict — trades need to be balanced
AND mutually beneficial AND something the partner GM would actually
accept. But the user wants OPTIONS. Your job is to find creative
angles the standard pass missed, without lowering the bar on fairness.

### Creative angles to explore (use ALL of them)

1. POSITIONAL ARBITRAGE. A user's "starter" at a deep position (e.g.
   a mid-tier WR in a WR-heavy roster) can be treated as tradeable
   surplus. Pair that WR with a user need from a partner who is deep
   at the opposite position.

2. BENCH-FOR-STARTER SWAPS. A partner with a weak starter at a
   position of user strength might accept the user's backup/flex
   piece + a pick for their weak starter. The partner moves on from
   a player they're lukewarm on; the user gets a clear upgrade.

3. MULTI-PIECE BUILDS. Don't default to the smallest package that
   balances. If 3 user players + a pick lets you acquire 2 partner
   players where one is a clear upgrade and the other is a
   positional filler, go for it. Packages can be 1-5 players per side.

4. PARTNERS YOU MIGHT SKIP. The weakest teams in the league are
   usually willing to trade established veterans for younger assets
   or picks. Don't skip them just because they're worse. They're
   often the BEST trade partners for a contender user.

5. PICK-CENTRIC DEALS. If the user has a pick in their BONUS ASSETS,
   lead with it. Many partners will accept (user's cheap player +
   user's pick) for a mid-tier starter because the pick is the
   prize, not the player.

6. BUY-LOW ON SLUMPING PLAYERS. If the snapshot shows a player with
   a weak recent trend but strong positional value tag, they might
   be available at a discount because their owner is frustrated.

### Same hard rules as the standard pass

- RULE 1: The trade must make the user's team better.
- RULE 2: The partner's GM must actually accept it.
- Package values must balance within ~15% (including pick value).
- Drop the target if you can't build a balanced realistic package.

Refer to the pick value anchors in the user message for how to size
packages that include picks. Use the full 1-5 players per side range
when the packaging calls for it.

### Response format

Same JSON shape as the standard pass:
{
  "trades": [
    {
      "partnerTeamId": "team_id_from_snapshot",
      "sentPlayerIds": ["player_id", ...],
      "receivedPlayerIds": ["player_id", ...],
      "userReasoning": "1-2 sentences",
      "partnerReasoning": "1-2 sentences",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "Optional short overall commentary or null"
}

Return up to 8 trades. Quality still wins over quantity, but
creativity is explicitly valued here. Return fewer only if you
genuinely can't find realistic options.`;
}

function buildSystemPrompt(mode: 'standard' | 'creative' = 'standard'): string {
  return mode === 'creative'
    ? buildCreativeSystemPrompt()
    : buildStandardSystemPrompt();
}

function buildUserMessage(
  snapshot: LeagueContextSnapshot,
  filters: ConstructorFilters
): string {
  const desiredCount = filters.desiredCount ?? 8;
  const lines: string[] = [];

  lines.push(`Construct up to ${desiredCount} mutually beneficial trades for the YOU team in the league snapshot below.`);
  lines.push('');

  // Filters block
  const filterLines: string[] = [];
  if (filters.targetPosition) {
    filterLines.push(
      `- TARGET POSITION: only construct trades where the user RECEIVES at least one ${filters.targetPosition}.`
    );
  }
  if (filters.requiredUserPlayerIds && filters.requiredUserPlayerIds.length > 0) {
    const ids = filters.requiredUserPlayerIds.join(', ');
    filterLines.push(
      `- REQUIRED USER ASSETS: every trade you construct MUST include at least one of these player ids in sentPlayerIds: ${ids}`
    );
  }
  if (filters.userPicks && filters.userPicks.length > 0) {
    const picks = filters.userPicks.map(formatPickAsset).join(', ');
    filterLines.push(
      `- BONUS USER ASSETS: the user is offering these draft picks AS PART of every trade you construct: ${picks}.`
    );
    filterLines.push(
      `  * Do NOT add picks to sentPlayerIds — the caller threads them separately.`
    );
    filterLines.push(
      `  * DO factor the pick value into your packaging — see the pick value anchors in the system prompt. A 1st-round pick is real value.`
    );
    filterLines.push(
      `  * Because a pick is already on the user's side, the user-side PLAYER total can be LOWER than the partner-side player total. The pick fills the gap.`
    );
    filterLines.push(
      `  * Many trades here should lead with a pick-plus-small-player combo aimed at a partner starter the user actually wants.`
    );
  }
  if (filterLines.length > 0) {
    lines.push('USER FILTERS:');
    lines.push(...filterLines);
    lines.push('');
  }

  // The actual snapshot
  lines.push(formatLeagueContextForConstructor(snapshot));

  lines.push('');
  lines.push(
    `Now produce the JSON response. Aim for ${desiredCount} trades if realistic options exist. An empty array is a valid answer ONLY if you've genuinely exhausted the partner roster and can't build a single balanced package — don't give up early.`
  );

  return lines.join('\n');
}

// ── Validation ──────────────────────────────────────────────────────

interface RawTradeResponse {
  trades?: unknown;
  notes?: unknown;
}

interface RawTrade {
  partnerTeamId?: unknown;
  sentPlayerIds?: unknown;
  receivedPlayerIds?: unknown;
  userReasoning?: unknown;
  partnerReasoning?: unknown;
  confidence?: unknown;
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

function coerceConfidence(x: unknown): 'high' | 'medium' | 'low' {
  if (x === 'high' || x === 'medium' || x === 'low') return x;
  return 'medium';
}

/**
 * Coerce a raw AI response into a clean ConstructorResult. Drops any
 * trades that fail basic shape validation. Does NOT validate against
 * actual rosters — that's the caller's job (it has the roster data).
 */
function coerceResponse(raw: RawTradeResponse): ConstructorResult {
  const out: ConstructorResult = {
    trades: [],
    notes: typeof raw.notes === 'string' ? raw.notes : null,
  };
  if (!Array.isArray(raw.trades)) return out;

  for (const item of raw.trades as RawTrade[]) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.partnerTeamId !== 'string') continue;
    if (!isStringArray(item.sentPlayerIds)) continue;
    if (!isStringArray(item.receivedPlayerIds)) continue;
    if (item.sentPlayerIds.length === 0 || item.receivedPlayerIds.length === 0) continue;

    out.trades.push({
      partnerTeamId: item.partnerTeamId,
      sentPlayerIds: item.sentPlayerIds,
      receivedPlayerIds: item.receivedPlayerIds,
      userReasoning:
        typeof item.userReasoning === 'string' ? item.userReasoning : '',
      partnerReasoning:
        typeof item.partnerReasoning === 'string' ? item.partnerReasoning : '',
      confidence: coerceConfidence(item.confidence),
    });
  }

  return out;
}

// ── Main entry point ────────────────────────────────────────────────

export async function constructTrades(
  args: ConstructorArgs
): Promise<ConstructorResult | null> {
  const { anthropicKey, snapshot, filters = {} } = args;
  const mode = filters.mode ?? 'standard';

  const systemPrompt = buildSystemPrompt(mode);
  const userMessage = buildUserMessage(snapshot, filters);

  // Standard pass runs at moderate temperature. Creative pass runs
  // hotter so the second-look actually explores different territory
  // rather than re-proposing the same ideas.
  const temperature = mode === 'creative' ? 0.7 : 0.5;

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
        // Larger budget than the analyzer pass — the constructor returns
        // multiple trades each with reasoning text. 4500 leaves room for
        // up to ~8 trades × ~500 tokens each plus notes.
        max_tokens: 4500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature,
      }),
      // Mega-call gets a longer timeout — it's doing more thinking than
      // the per-trade analyzer calls.
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      console.error(
        '[tradeConstructor] AI call failed:',
        res.status,
        await res.text().catch(() => '')
      );
      return null;
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === 'text');
    const rawText = textBlock?.text?.trim();
    if (!rawText) return null;

    // Strip code fences if the model wrapped its JSON
    const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

    let parsed: RawTradeResponse;
    try {
      parsed = JSON.parse(jsonStr) as RawTradeResponse;
    } catch (parseErr) {
      console.error('[tradeConstructor] JSON parse failed:', parseErr, jsonStr.slice(0, 200));
      return null;
    }

    return coerceResponse(parsed);
  } catch (err) {
    console.error('[tradeConstructor] construct failed:', err);
    return null;
  }
}

// ── Per-target focused construction (fan-out primitive) ─────────────
//
// constructTradeForTarget makes ONE focused call to construct the
// single best realistic package for acquiring a specific player.
// This is the primitive the trade finder fans out in parallel across
// ~20-30 deterministic targets, replacing the old whole-league
// mega-call. Much smaller prompt (one user roster + one partner roster
// instead of ~12 team rosters), so each call finishes faster and
// gives the model a much smaller attention budget per decision.

export interface ConstructTargetArgs {
  anthropicKey: string;
  snapshot: LeagueContextSnapshot;
  userTeamId: string;
  partnerTeamId: string;
  targetPlayerId: string;
  /** Optional rationale from the target-selection step. Threaded into
   *  the prompt so the model understands WHY we're targeting this
   *  player (e.g. "Addresses user RB starter need"). */
  rationale?: string | null;
  /** Optional required user-side asset ids. When set, every valid
   *  package must include at least one of these on the sent side. */
  requiredUserPlayerIds?: string[] | null;
  /** Optional user picks — the model is told they'll be threaded into
   *  the trade separately and factors their value into the package. */
  userPicks?: Array<{ year: number; round: number }> | null;
}

function buildTargetSystemPrompt(): string {
  return `You are an elite fantasy football trade architect. Your job is to construct the SINGLE BEST realistic trade package the user could offer to acquire one specific target player from one specific partner team.

### TWO HARD RULES

RULE 1: THE TRADE MUST MAKE THE USER'S TEAM BETTER.
RULE 2: THE PARTNER'S GM MUST ACTUALLY ACCEPT IT IN REAL LIFE.

Both rules bind at the same time. If you cannot satisfy both, return null — no trade. A null answer is the correct answer when the user simply can't afford the target, or when the partner would never trade this player.

### The packaging rule — avoid robberies

When the target is an elite player, a SINGLE player on the user's side almost never matches value. You MUST pad the user's side with additional players or picks until the values on both sides are within ~15% of each other. Packages can be 1-5 players per side — use as many as the math requires.

Example of a BAD package to never propose:
  user sends: Jaxson Dart (rookie QB, [45/depth/bench])
  user receives: Lamar Jackson (elite QB, [180/elite/starter])
  → This is a ~75% value delta. No real GM accepts it. Either PAD or return null.

${PICK_VALUE_REFERENCE}

### Before finalizing, answer these four questions

  A. Is the user clearly upgrading at a position they need, or
     sidegrading? (If sidegrading, return null.)
  B. If I were the partner's GM, would I be disgusted to accept
     this? (If yes, pad the user's side until it feels fair.)
  C. Is the deterministic value the user SENDS within 15% of what
     they RECEIVE, using the [val] tags plus pick value?
  D. Does the partner have a reason to say yes — addressing one of
     their own needs, clearing a logjam, or getting clear value?

### Core principles

- AI-FIRST. The [val] tags are starting points. You may disagree
  based on trends, coaching, or injury timeline — explain why in
  the reasoning.
- BOTH SIDES MUST WANT IT.
- HONESTY. If no realistic package exists from this user roster,
  return null. That's a valid, expected answer.

### Constraints

- Every sent player must be on the USER's roster (marked YOU).
- Every received player must be on the PARTNER team's roster,
  AND the target player MUST be included in receivedPlayerIds.
- Packages can include 1-5 players per side.
- Use the player IDs exactly as shown (id=... on each roster line).
  NEVER invent or rename player IDs.
- Do NOT include picks in sentPlayerIds — picks are threaded
  separately by the caller.

### Response format

Respond with ONLY valid JSON in one of these two shapes:

Shape A — a valid trade:
{
  "partnerTeamId": "team_id",
  "sentPlayerIds": ["player_id", "player_id"],
  "receivedPlayerIds": ["player_id"],
  "userReasoning": "1-2 sentences on HOW THIS UPGRADES THE USER",
  "partnerReasoning": "1-2 sentences on WHY THE PARTNER ACCEPTS",
  "confidence": "high" | "medium" | "low"
}

Shape B — no realistic package exists:
null

Return the JSON ONLY, no prose.`;
}

// Compact per-team format for the focused prompt. Like
// formatLeagueContextForConstructor but rendered for exactly one team,
// with player IDs inline (id=...) so the model can echo them back
// exactly in sentPlayerIds / receivedPlayerIds, and with the target
// marked visually.
function formatTeamForFocusedPrompt(
  snap: LeagueContextSnapshot,
  teamId: string,
  opts: { label: 'YOU' | 'PARTNER'; markPlayerId?: string | null }
): string {
  const team = snap.teams.find((t) => t.id === teamId);
  if (!team) return `(team ${teamId} not found)`;

  const lines: string[] = [];
  const labelSuffix = opts.label === 'YOU' ? ' (YOU)' : ' (PARTNER)';
  const meta: string[] = [];
  if (team.record) meta.push(team.record);
  if (team.rank != null) meta.push(`#${team.rank}`);
  lines.push(
    `=== ${team.name}${labelSuffix}${meta.length ? ` [${meta.join(', ')}]` : ''} ===`
  );

  const needs = team.composition.needs.length > 0
    ? team.composition.needs.map((n) => `${n.position}(${n.level})`).join(', ')
    : '(none)';
  lines.push(`Needs: ${needs}`);

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const summary = team.composition.byPosition.get(pos);
    if (!summary || summary.players.length === 0) continue;
    lines.push(`${pos}:`);
    for (const slot of summary.players) {
      const facts = snap.factsById.get(slot.playerId);
      const name = facts?.name ?? slot.playerId;
      const status = facts?.identity.status;
      const statusTag =
        status && status !== 'active' ? ` [${status.toUpperCase()}]` : '';
      const tag = `[${Math.round(slot.finalValue)}/${slot.tier}/${slot.role}]`;
      const marker =
        opts.markPlayerId && slot.playerId === opts.markPlayerId
          ? ' <<< TARGET'
          : '';
      lines.push(`  - ${name} ${tag} id=${slot.playerId}${statusTag}${marker}`);
    }
  }
  return lines.join('\n');
}

function buildTargetUserMessage(args: ConstructTargetArgs): string {
  const {
    snapshot,
    userTeamId,
    partnerTeamId,
    targetPlayerId,
    rationale,
    requiredUserPlayerIds,
    userPicks,
  } = args;

  const targetFacts = snapshot.factsById.get(targetPlayerId);
  const targetValuation = snapshot.valuations.get(targetPlayerId);
  const partnerTeam = snapshot.teams.find((t) => t.id === partnerTeamId);

  const lines: string[] = [];
  lines.push(
    `Construct the single best realistic trade package the user could offer to acquire this target player. Return JSON (trade or null) ONLY.`
  );
  lines.push('');
  lines.push('=== TARGET ===');
  if (targetFacts) {
    const tag = targetValuation
      ? ` [${Math.round(targetValuation.finalValue)}/${targetValuation.tier}]`
      : '';
    lines.push(
      `${targetFacts.name} (${targetFacts.position}, ${targetFacts.nflTeam})${tag}`
    );
    lines.push(`id=${targetPlayerId}`);
  } else {
    lines.push(`Player id=${targetPlayerId} (facts unavailable)`);
  }
  lines.push(`On team: ${partnerTeam?.name ?? partnerTeamId}`);
  if (rationale) {
    lines.push(`Why we're targeting: ${rationale}`);
  }
  lines.push('');

  // Filter block
  const filterLines: string[] = [];
  if (requiredUserPlayerIds && requiredUserPlayerIds.length > 0) {
    filterLines.push(
      `- REQUIRED USER ASSETS: every trade you construct MUST include at least one of these player ids in sentPlayerIds: ${requiredUserPlayerIds.join(', ')}`
    );
  }
  if (userPicks && userPicks.length > 0) {
    const picksStr = userPicks.map(formatPickAsset).join(', ');
    filterLines.push(
      `- BONUS USER ASSETS: the user is offering these draft picks as part of this trade: ${picksStr}.`
    );
    filterLines.push(
      `  * Do NOT include picks in sentPlayerIds — the caller threads them separately.`
    );
    filterLines.push(
      `  * DO factor the pick value into packaging. Because a pick is already on the user's side, the user-side PLAYER total can be LOWER than the partner-side player total — the pick fills the gap.`
    );
  }
  if (filterLines.length > 0) {
    lines.push('USER FILTERS:');
    lines.push(...filterLines);
    lines.push('');
  }

  lines.push(
    'NOTE: use the player IDs shown as id=... on each roster line. Echo them exactly in sentPlayerIds / receivedPlayerIds.'
  );
  lines.push('');
  lines.push(
    formatTeamForFocusedPrompt(snapshot, userTeamId, { label: 'YOU' })
  );
  lines.push('');
  lines.push(
    formatTeamForFocusedPrompt(snapshot, partnerTeamId, {
      label: 'PARTNER',
      markPlayerId: targetPlayerId,
    })
  );
  lines.push('');
  lines.push(
    `Now produce JSON: either one balanced trade package that acquires the TARGET, or null if no realistic package exists from this user roster. JSON ONLY.`
  );

  return lines.join('\n');
}

// Parse the single-trade response. Unlike constructTrades, this call
// returns ONE trade or null — not a trades array.
function coerceSingleTradeResponse(raw: unknown): ConstructedTrade | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object') return null;
  const item = raw as RawTrade;
  if (typeof item.partnerTeamId !== 'string') return null;
  if (!isStringArray(item.sentPlayerIds)) return null;
  if (!isStringArray(item.receivedPlayerIds)) return null;
  if (item.sentPlayerIds.length === 0 || item.receivedPlayerIds.length === 0) {
    return null;
  }
  return {
    partnerTeamId: item.partnerTeamId,
    sentPlayerIds: item.sentPlayerIds,
    receivedPlayerIds: item.receivedPlayerIds,
    userReasoning:
      typeof item.userReasoning === 'string' ? item.userReasoning : '',
    partnerReasoning:
      typeof item.partnerReasoning === 'string' ? item.partnerReasoning : '',
    confidence: coerceConfidence(item.confidence),
  };
}

export async function constructTradeForTarget(
  args: ConstructTargetArgs
): Promise<ConstructedTrade | null> {
  const { anthropicKey } = args;

  const systemPrompt = buildTargetSystemPrompt();
  const userMessage = buildTargetUserMessage(args);

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
        // Single trade + reasoning fits comfortably in 800 tokens.
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.5,
      }),
      // Per-target calls are small; 30s is plenty.
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(
        '[tradeConstructor.target] AI call failed:',
        res.status,
        await res.text().catch(() => '')
      );
      return null;
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === 'text');
    const rawText = textBlock?.text?.trim();
    if (!rawText) return null;

    // Strip code fences and any "null" literal the model might emit.
    const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    if (jsonStr === 'null' || jsonStr === '') return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error(
        '[tradeConstructor.target] JSON parse failed:',
        parseErr,
        jsonStr.slice(0, 200)
      );
      return null;
    }

    return coerceSingleTradeResponse(parsed);
  } catch (err) {
    console.error('[tradeConstructor.target] construct failed:', err);
    return null;
  }
}
