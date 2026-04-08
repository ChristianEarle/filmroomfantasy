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
  /** How many candidates to ask for. Defaults to 6. */
  desiredCount?: number;
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

function buildSystemPrompt(): string {
  return `You are an elite fantasy football trade architect. Your job is to look at a whole league and construct REALISTIC, mutually beneficial trades between the user's team and other teams.

Core principles:
- AI-FIRST. The valuations attached to each player are a starting point, not ground truth. You may disagree based on context (usage trends, coaching, schedule, injury timeline, game script), but say so in the reasoning.
- BOTH SIDES MUST WANT IT. Every trade must address a real need or strength on BOTH teams. A "fair value" trade nobody wants is useless.
- A REAL GM ON THE OTHER SIDE. Imagine a competent owner running the partner team. Would they actually click accept? If no, don't propose it.
- DIVERSITY. Spread trades across multiple partner teams when possible. Don't pile every recommendation on one opponent.
- HONESTY. If no realistic trades exist (e.g. user has no surplus to offer at any position partners need), say so in "notes" and return fewer trades.
- NO ROBBERIES IN EITHER DIRECTION. Don't propose trades that heavily favor the user OR heavily favor the partner. Both kinds get rejected by real owners.

Constraints:
- Every sent player must be on the USER's roster (the team marked YOU in the snapshot).
- Every received player must be on the named PARTNER team's roster.
- You may include 1, 2, or 3 players on either side. Larger packages are fine when warranted.
- Use the player IDs from the snapshot exactly. NEVER invent or rename players.

Respond with ONLY valid JSON in this exact shape:
{
  "trades": [
    {
      "partnerTeamId": "team_id_from_snapshot",
      "sentPlayerIds": ["player_id", "player_id"],
      "receivedPlayerIds": ["player_id"],
      "userReasoning": "1-2 sentences on why this helps the user",
      "partnerReasoning": "1-2 sentences on why the partner accepts",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "Optional short overall commentary or null"
}

Rules for the JSON:
- "trades" MUST be an array, even if empty.
- "confidence" reflects how likely the partner actually clicks accept. "high" = clear win-win, "medium" = needs negotiation, "low" = stretch.
- Do NOT include picks in sentPlayerIds — picks are tracked separately.
- Do NOT include any field other than the ones listed.`;
}

function buildUserMessage(
  snapshot: LeagueContextSnapshot,
  filters: ConstructorFilters
): string {
  const desiredCount = filters.desiredCount ?? 6;
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
      `- BONUS USER ASSETS (not in sentPlayerIds): the user is also willing to throw in these picks across every trade: ${picks}. Factor them into the partner's acceptance reasoning, but do NOT add them to sentPlayerIds — the caller threads picks in separately.`
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
  lines.push('Now produce the JSON response. Remember: realistic trades only, both sides must benefit, return fewer than the requested count if you cannot find enough good ones.');

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

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(snapshot, filters);

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
        // multiple trades each with reasoning text. 3500 leaves room for
        // ~6 trades × ~500 tokens each plus notes.
        max_tokens: 3500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.4,
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
