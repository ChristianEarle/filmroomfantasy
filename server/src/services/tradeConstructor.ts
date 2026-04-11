/**
 * tradeConstructor — target-focused offer builder.
 *
 * New architecture: the user picks a specific player they want to
 * acquire from any opponent. This module makes ONE focused AI call
 * that proposes 2-3 realistic offer packages the user could send.
 *
 * This inverts the old "find me any trade" problem. Instead of
 * making the AI guess what the user wants AND what the partner
 * would accept simultaneously, the user provides the hard half
 * (the target) and the AI only has to solve package balance +
 * "would the partner accept this for this target specifically."
 *
 * Flow:
 *   findTradeRecommendations in tradeFinder.ts resolves the target
 *   → calls constructOffersForTarget with user roster + partner
 *     roster + target facts
 *   → this module builds one focused prompt and returns 2-3 offers
 *   → caller validates ownership, runs each through the trusted
 *     analyzer, applies gate 4, returns to UI.
 */

import type { PlayerFacts } from './tradeContext';
import type { PlayerValuation } from './playerValuation';
import type { TeamComposition } from './teamComposition';

// ── Types ────────────────────────────────────────────────────────────

export interface ConstructedOffer {
  /** Partner team id. Always the team that owns the target player. */
  partnerTeamId: string;
  /** Player ids the user gives up. */
  sentPlayerIds: string[];
  /** Player ids the user receives. MUST include the target. */
  receivedPlayerIds: string[];
  /** One sentence on why this upgrades the user. */
  userReasoning: string;
  /** One sentence on why the partner would accept. */
  partnerReasoning: string;
  /** AI self-assessment of how likely the partner would click accept. */
  confidence: 'high' | 'medium' | 'low';
}

export interface ConstructOffersResult {
  offers: ConstructedOffer[];
  notes: string | null;
}

export interface ConstructOffersArgs {
  anthropicKey: string;
  /** Target player facts for the header of the prompt. */
  target: {
    id: string;
    name: string;
    position: string;
    nflTeam: string;
    valuation: PlayerValuation | null;
  };
  /** Partner team metadata. */
  partnerTeam: {
    id: string;
    name: string;
    record: string | null;
    composition: TeamComposition;
  };
  /** User team metadata. */
  userTeam: {
    id: string;
    name: string;
    record: string | null;
    composition: TeamComposition;
  };
  /** Valuations and facts for all rostered players on both teams. */
  valuations: Map<string, PlayerValuation>;
  factsById: Map<string, PlayerFacts>;
  /** If set, every offer MUST include at least one of these on the
   *  sent side. Comes from the UI "Trade Assets" filter. */
  requiredUserPlayerIds?: string[] | null;
  /** If set, every offer treats these picks as added to the user's
   *  sent side. Not included in sentPlayerIds — the caller threads
   *  them separately through the trusted analyzer. */
  userPicks?: Array<{ year: number; round: number }> | null;
  /** Number of offers to ask for. Default 3. */
  desiredCount?: number;
  /** Estimated pick value in finalValue units, for the prompt. */
  pickValueSum?: number;
}

// ── Prompt building ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite fantasy football trade architect. The user has picked a specific target player they want to acquire from a specific partner team. Your job is to propose 2-3 realistic offer packages the user could send.

### What "realistic" means

Each offer must clear BOTH of these bars:
  1. The user's package values (player [val] tags + any pick value) are within ~20% of the target's value. Use multi-player packages when needed — 1-for-1 almost never balances against a valuable target.
  2. The partner's GM would plausibly accept the offer. That means: the package addresses one of the partner's needs, gives them clearly better value than what they're giving up, or includes a pick they'd value for rebuild purposes.

### How to build offers

  - Sum the target's [val]. That's your target package value.
  - On the user side, combine 1-3 players whose [val]s add up to within ~20% of the target, PLUS any pick value if the user is offering picks.
  - Prefer sending the user's SURPLUS or BENCH/DEPTH pieces, not their starters. Real trades move depth for starters.
  - If the required-assets filter is set, every offer MUST include at least one of those player IDs on the sent side.
  - Diversify: the 3 offers should differ in shape — e.g. one "cheap" (depth + pick), one "balanced" (bench starter + filler), one "premium" (top surplus piece). If you can't find three distinct shapes, two is fine.

### ID echo rules

  - Each player line is shown as "Name [val/tier/role] id=PLAYER_ID".
  - In sentPlayerIds and receivedPlayerIds, echo ONLY the raw PLAYER_ID value (e.g. "4046"), never the name or the "id=" prefix.
  - NEVER invent IDs. Only use IDs visible in the roster blocks below.
  - The partnerTeamId is the value shown after "id=" in the partner team header.
  - The target player MUST appear in receivedPlayerIds for every offer.

### Response format

Respond with ONLY valid JSON in this exact shape:

{
  "offers": [
    {
      "partnerTeamId": "team_id",
      "sentPlayerIds": ["player_id", "player_id"],
      "receivedPlayerIds": ["target_player_id"],
      "userReasoning": "1 sentence on why this upgrades the user",
      "partnerReasoning": "1 sentence on why the partner would accept",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "optional short commentary or null"
}

Rules:
  - "offers" is an array. Prefer 2-3 offers; 1 is acceptable; 0 (empty array) is acceptable only when no realistic package exists from this user roster.
  - Each offer must pass both bars above.
  - No prose outside the JSON.`;

function formatPickAsset(p: { year: number; round: number }): string {
  const ord =
    p.round === 1 ? '1st' :
    p.round === 2 ? '2nd' :
    p.round === 3 ? '3rd' :
    `${p.round}th`;
  return `${p.year} ${ord}`;
}

function formatTeamRoster(
  team: { name: string; id: string; record: string | null; composition: TeamComposition },
  label: 'YOU' | 'PARTNER',
  factsById: Map<string, PlayerFacts>,
  valuations: Map<string, PlayerValuation>,
  markPlayerId: string | null = null
): string {
  const lines: string[] = [];
  const recordTag = team.record ? ` [${team.record}]` : '';
  lines.push(`=== ${team.name} (${label})${recordTag} id=${team.id} ===`);

  const needsStr =
    team.composition.needs.length > 0
      ? team.composition.needs.map((n) => `${n.position}(${n.level})`).join(', ')
      : '(none)';
  lines.push(`Needs: ${needsStr}`);

  const strengths: string[] = [];
  for (const [, summary] of team.composition.byPosition) {
    if (summary.surplusCount > 0) strengths.push(`${summary.position}(surplus)`);
    else if (summary.topTier === 'elite' && summary.needLevel === 'none') {
      strengths.push(`${summary.position}(elite)`);
    }
  }
  if (strengths.length > 0) {
    lines.push(`Strengths: ${strengths.join(', ')}`);
  }

  for (const pos of ['QB', 'RB', 'WR', 'TE']) {
    const summary = team.composition.byPosition.get(pos);
    if (!summary || summary.players.length === 0) continue;
    lines.push(`${pos}:`);
    for (const slot of summary.players) {
      const facts = factsById.get(slot.playerId);
      const v = valuations.get(slot.playerId);
      const name = facts?.name ?? slot.playerId;
      const val = v ? Math.round(v.finalValue) : '?';
      const tier = v?.tier ?? '?';
      const status = facts?.identity.status;
      const statusTag = status && status !== 'active' ? ` [${status.toUpperCase()}]` : '';
      const marker = slot.playerId === markPlayerId ? ' <<< TARGET' : '';
      lines.push(`  - ${name} [${val}/${tier}/${slot.role}] id=${slot.playerId}${statusTag}${marker}`);
    }
  }

  return lines.join('\n');
}

function buildUserMessage(args: ConstructOffersArgs): string {
  const {
    target,
    partnerTeam,
    userTeam,
    valuations,
    factsById,
    requiredUserPlayerIds,
    userPicks,
    desiredCount = 3,
    pickValueSum = 0,
  } = args;

  const lines: string[] = [];

  lines.push(
    `Propose ${desiredCount} realistic offer packages the user could send to acquire the TARGET below. Return JSON only.`
  );
  lines.push('');

  // Target block
  lines.push('=== TARGET ===');
  const tValTag = target.valuation
    ? `[${Math.round(target.valuation.finalValue)}/${target.valuation.tier}]`
    : '[?]';
  lines.push(`${target.name} (${target.position}, ${target.nflTeam}) ${tValTag}`);
  lines.push(`id=${target.id}`);
  lines.push(`on team: ${partnerTeam.name} id=${partnerTeam.id}`);
  lines.push('');

  // Filter block
  const filterLines: string[] = [];
  if (requiredUserPlayerIds && requiredUserPlayerIds.length > 0) {
    filterLines.push(
      `- REQUIRED USER ASSETS: every offer MUST include at least one of these player ids in sentPlayerIds: ${requiredUserPlayerIds.join(', ')}`
    );
  }
  if (userPicks && userPicks.length > 0) {
    const picksStr = userPicks.map(formatPickAsset).join(', ');
    filterLines.push(
      `- BONUS USER ASSETS: the user is offering these draft picks as part of every offer: ${picksStr}.`
    );
    filterLines.push(
      `  * Do NOT add picks to sentPlayerIds. The caller threads them separately.`
    );
    if (pickValueSum > 0) {
      filterLines.push(
        `  * Estimated pick value: ${Math.round(pickValueSum)} in the same units as the [val] tags. Factor this into the user's side — the user-side PLAYER total can be LOWER than the target value by about this much, because the pick fills the gap.`
      );
    }
  }
  if (filterLines.length > 0) {
    lines.push('USER FILTERS:');
    lines.push(...filterLines);
    lines.push('');
  }

  lines.push(
    'NOTE: Every player line below includes id=... — echo those raw IDs in sentPlayerIds/receivedPlayerIds. Never echo names or the "id=" prefix.'
  );
  lines.push('');

  // User roster
  lines.push(formatTeamRoster(userTeam, 'YOU', factsById, valuations));
  lines.push('');

  // Partner roster with target marked
  lines.push(formatTeamRoster(partnerTeam, 'PARTNER', factsById, valuations, target.id));
  lines.push('');

  lines.push(
    `Now produce the JSON response with ${desiredCount} diverse realistic offers for ${target.name}. JSON only.`
  );

  return lines.join('\n');
}

// ── Parsing + validation ────────────────────────────────────────────

interface RawOffer {
  partnerTeamId?: unknown;
  sentPlayerIds?: unknown;
  receivedPlayerIds?: unknown;
  userReasoning?: unknown;
  partnerReasoning?: unknown;
  confidence?: unknown;
}

interface RawResponse {
  offers?: unknown;
  notes?: unknown;
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

function coerceConfidence(x: unknown): 'high' | 'medium' | 'low' {
  if (x === 'high' || x === 'medium' || x === 'low') return x;
  return 'medium';
}

/**
 * Sanitize a player or team ID the model returned. Handles the common
 * case of the model echoing "id=4046" instead of "4046" and strips
 * whitespace or surrounding quotes.
 */
function sanitizeId(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('id=')) s = s.slice(3);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function coerceResponse(raw: RawResponse): ConstructOffersResult {
  const out: ConstructOffersResult = {
    offers: [],
    notes: typeof raw.notes === 'string' ? raw.notes : null,
  };
  if (!Array.isArray(raw.offers)) return out;

  for (const item of raw.offers as RawOffer[]) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.partnerTeamId !== 'string') continue;
    if (!isStringArray(item.sentPlayerIds)) continue;
    if (!isStringArray(item.receivedPlayerIds)) continue;
    if (item.sentPlayerIds.length === 0 || item.receivedPlayerIds.length === 0) continue;

    out.offers.push({
      partnerTeamId: sanitizeId(item.partnerTeamId),
      sentPlayerIds: item.sentPlayerIds.map(sanitizeId),
      receivedPlayerIds: item.receivedPlayerIds.map(sanitizeId),
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

export async function constructOffersForTarget(
  args: ConstructOffersArgs
): Promise<ConstructOffersResult | null> {
  const { anthropicKey, desiredCount = 3 } = args;

  const systemPrompt = SYSTEM_PROMPT;
  const userMessage = buildUserMessage(args);

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
        // 3 offers × ~300 tokens each + notes = ~1200 tokens plus slack
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(45000),
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

    const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

    let parsed: RawResponse;
    try {
      parsed = JSON.parse(jsonStr) as RawResponse;
    } catch (parseErr) {
      console.error(
        '[tradeConstructor.target] JSON parse failed:',
        parseErr,
        jsonStr.slice(0, 200)
      );
      return null;
    }

    const result = coerceResponse(parsed);
    console.log(
      `[tradeConstructor.target] returned ${result.offers.length}/${desiredCount} offers` +
        (result.notes ? ` — notes: ${result.notes.slice(0, 120)}` : '')
    );
    return result;
  } catch (err) {
    console.error('[tradeConstructor.target] call failed:', err);
    return null;
  }
}
