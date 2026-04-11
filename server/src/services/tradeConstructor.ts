/**
 * tradeConstructor — ranking primitive for the Trade Finder.
 *
 * Philosophy: generation is hard for LLMs, ranking is easy.
 *
 * The finder's Phase 1 (tradeMatcher) deterministically enumerates
 * ~30 concrete, balanced, pick-aware trade candidates from the
 * league. This module's job is Phase 2: give Claude the candidate
 * list and a bit of user context, and ask it to pick the best 5
 * with one-sentence reasons for each side.
 *
 * Claude never constructs trades from scratch, never echoes player
 * IDs, never juggles multiple hard constraints in one shot. It
 * picks candidates by a short string ID we generated and writes
 * reasoning. That's a task LLMs nail reliably.
 *
 * The validateRankedPicks step guards against hallucinated IDs so
 * if the model gets creative we fall through to top-by-score from
 * Phase 1.
 */

import type { MatchedCandidate } from './tradeMatcher';
import type { TeamComposition } from './teamComposition';
import type { PlayerFacts } from './tradeContext';
import type { PlayerValuation } from './playerValuation';

// ── Types ────────────────────────────────────────────────────────────

/**
 * A Phase 1 candidate carries everything needed to render it in the
 * Phase 2 prompt. It's the MatchedCandidate from tradeMatcher plus
 * partner team metadata and a stable per-request candidate id.
 */
export interface RankableCandidate extends MatchedCandidate {
  /** Short string ID we generate per-request (e.g. "c01"). The model
   *  echoes these back so we never have to parse player IDs from the
   *  AI response. */
  candidateId: string;
  /** The partner team this trade is against. */
  partnerTeamId: string;
  partnerTeamName: string;
  partnerNeeds: Array<{ position: string; level: string }>;
  partnerRecord: string | null;
}

/**
 * One pick the ranking call returns — a candidateId plus per-side
 * reasoning. Caller resolves the candidateId back to the full
 * RankableCandidate.
 */
export interface RankedPick {
  candidateId: string;
  userReasoning: string;
  partnerReasoning: string;
}

export interface RankCandidatesArgs {
  anthropicKey: string;
  /** Up to ~30 pre-enumerated candidates. */
  candidates: RankableCandidate[];
  /** User team context for the prompt. */
  userTeamName: string;
  userTeamRecord: string | null;
  userComp: TeamComposition;
  factsById: Map<string, PlayerFacts>;
  valuations: Map<string, PlayerValuation>;
  /** How many picks to ask the model to return. Defaults to 5. */
  desiredCount?: number;
  /** Optional goal hint derived from request filters (e.g. "user
   *  wants to use Tank Dell + 2026 1st to upgrade at WR"). Helps
   *  the model prioritize the right candidates. */
  goalHint?: string | null;
}

// Output: the ranked picks, or null if the model returned garbage.
// The finder falls back to heuristic top-N when this is null.
export interface RankCandidatesResult {
  picks: RankedPick[];
  notes: string | null;
}

// ── Prompt construction ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite fantasy football trade advisor. You are given a list of pre-generated candidate trades for a specific user team and asked to pick the BEST realistic trades from the list.

### Your job

For each candidate you choose, you must verify that BOTH sides would plausibly accept:
  - The USER is clearly upgrading at a position of need OR consolidating a surplus position. No sidegrades.
  - The PARTNER's GM would plausibly accept — they address one of their own needs, clear a logjam, or get clearly better value.

You MAY consider context the numbers miss (injury news, usage trends, dynasty vs redraft, remaining schedule strength, tier differences) when ranking candidates.

You MUST NOT invent new trades. Only pick from the numbered candidate list. Echo the exact candidateId string (e.g. "c07") for each pick — never invent candidate IDs, never echo player IDs.

### Return format

Respond with ONLY valid JSON in this exact shape:

{
  "picks": [
    {
      "candidateId": "c01",
      "userReasoning": "One sentence on why this upgrades the user's team.",
      "partnerReasoning": "One sentence on why the partner would accept."
    }
  ],
  "notes": "Optional short overall commentary, or null."
}

Rules:
- "picks" is an array. An empty array is valid if NO candidate on the list would be accepted by both sides.
- Pick each candidateId at most once.
- Order picks best-first.
- No prose outside the JSON.`;

function formatCandidateLine(
  c: RankableCandidate,
  factsById: Map<string, PlayerFacts>,
  valuations: Map<string, PlayerValuation>
): string {
  const fmtPlayer = (id: string): string => {
    const f = factsById.get(id);
    const v = valuations.get(id);
    const name = f?.name ?? id;
    const pos = f?.position ?? '?';
    const tag = v
      ? `[${Math.round(v.finalValue)}/${v.tier}]`
      : '[?]';
    return `${name} (${pos}) ${tag}`;
  };

  const sentNames = c.sendPlayerIds.map(fmtPlayer).join(' + ');
  const recvNames = c.receivePlayerIds.map(fmtPlayer).join(' + ');
  const fit = [
    c.userNeedsMet.length > 0 ? `user-need: ${c.userNeedsMet.join(',')}` : null,
    c.partnerNeedsMet.length > 0 ? `partner-need: ${c.partnerNeedsMet.join(',')}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
  const imbalance = `imbalance ${(c.valueImbalancePct * 100).toFixed(0)}%`;
  const partnerMeta = [c.partnerRecord, ...c.partnerNeeds.map((n) => `${n.position}(${n.level})`)]
    .filter(Boolean)
    .join(', ');

  return [
    `[${c.candidateId}] ${c.partnerTeamName}${partnerMeta ? ` — ${partnerMeta}` : ''}`,
    `    You send:    ${sentNames}`,
    `    You receive: ${recvNames}`,
    `    user ${Math.round(c.userValue)} vs partner ${Math.round(c.partnerValue)} (${imbalance})`,
    fit ? `    ${fit}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildUserMessage(args: RankCandidatesArgs): string {
  const {
    candidates,
    userTeamName,
    userTeamRecord,
    userComp,
    factsById,
    valuations,
    desiredCount = 5,
    goalHint,
  } = args;

  const lines: string[] = [];

  // User context block
  const needsStr =
    userComp.needs.length > 0
      ? userComp.needs.map((n) => `${n.position}(${n.level})`).join(', ')
      : '(none)';
  const strengthsStr: string[] = [];
  for (const [, summary] of userComp.byPosition) {
    if (summary.surplusCount > 0) strengthsStr.push(`${summary.position}(surplus)`);
  }
  lines.push(`USER CONTEXT:`);
  lines.push(`  Team: "${userTeamName}"${userTeamRecord ? ` (${userTeamRecord})` : ''}`);
  lines.push(`  Needs: ${needsStr}`);
  if (strengthsStr.length > 0) {
    lines.push(`  Strengths: ${strengthsStr.join(', ')}`);
  }
  if (goalHint) {
    lines.push(`  Goal: ${goalHint}`);
  }
  lines.push('');

  // Candidates
  lines.push(`CANDIDATES (${candidates.length} pre-generated, balanced, pick-aware):`);
  lines.push('');
  for (const c of candidates) {
    lines.push(formatCandidateLine(c, factsById, valuations));
    lines.push('');
  }

  lines.push(
    `Pick the ${desiredCount} best. Return JSON ONLY — no prose.`
  );

  return lines.join('\n');
}

// ── Parsing + validation ────────────────────────────────────────────

interface RawPick {
  candidateId?: unknown;
  userReasoning?: unknown;
  partnerReasoning?: unknown;
}

interface RawResponse {
  picks?: unknown;
  notes?: unknown;
}

/**
 * Coerce + validate the AI response. Unknown candidateIds are dropped
 * silently (defensive — the model should only echo what it was shown).
 */
function coerceResponse(
  raw: RawResponse,
  candidateIds: Set<string>
): RankCandidatesResult {
  const out: RankCandidatesResult = {
    picks: [],
    notes: typeof raw.notes === 'string' ? raw.notes : null,
  };
  if (!Array.isArray(raw.picks)) return out;

  const seen = new Set<string>();
  for (const item of raw.picks as RawPick[]) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.candidateId !== 'string') continue;
    const id = item.candidateId.trim();
    if (!candidateIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.picks.push({
      candidateId: id,
      userReasoning:
        typeof item.userReasoning === 'string' ? item.userReasoning : '',
      partnerReasoning:
        typeof item.partnerReasoning === 'string' ? item.partnerReasoning : '',
    });
  }
  return out;
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Rank a pool of pre-generated candidates with one focused Claude
 * call. Returns the picks (or null on total failure, which the
 * caller handles by falling back to top-N by heuristic score).
 */
export async function rankCandidates(
  args: RankCandidatesArgs
): Promise<RankCandidatesResult | null> {
  const { anthropicKey, candidates, desiredCount = 5 } = args;

  if (candidates.length === 0) return { picks: [], notes: null };

  const userMessage = buildUserMessage(args);
  const candidateIds = new Set(candidates.map((c) => c.candidateId));

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
        // Ranking output is small: 5 picks × ~100 tokens = ~500 tokens.
        // Plus a little slack for notes.
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      console.error(
        '[tradeConstructor.rank] AI call failed:',
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

    let parsed: RawResponse;
    try {
      parsed = JSON.parse(jsonStr) as RawResponse;
    } catch (parseErr) {
      console.error(
        '[tradeConstructor.rank] JSON parse failed:',
        parseErr,
        jsonStr.slice(0, 200)
      );
      return null;
    }

    const result = coerceResponse(parsed, candidateIds);
    console.log(
      `[tradeConstructor.rank] model returned ${result.picks.length}/${desiredCount} valid picks` +
        (result.notes ? ` — notes: ${result.notes.slice(0, 120)}` : '')
    );
    return result;
  } catch (err) {
    console.error('[tradeConstructor.rank] call failed:', err);
    return null;
  }
}
