// Shared output-budget and response-parsing helpers for the direct Anthropic
// Messages API calls in this codebase (trade analyzer, retro grade, league
// analyzer, player takes, follow-up chat, Ask AI).
//
// Why this exists: claude-sonnet-5 runs adaptive thinking by default, and its
// thinking tokens count toward `max_tokens` even though the thinking text is
// never returned (display defaults to "omitted"). A `max_tokens` sized for the
// visible answer alone is therefore a trap — on a hard prompt the model can
// spend the entire budget thinking and return either a `content` array with no
// text block at all ("AI returned an empty response") or a text block cut off
// mid-JSON ("AI returned an invalid response"). Reproduced 2026-10-01 on a
// three-team dynasty trade: 2 of 3 runs at the default effort burned all 3,584
// tokens on thinking (stop_reason=max_tokens, content=[thinking]).
//
// Two levers fix it together:
//   1. `output_config.effort` caps how much the model thinks (and therefore how
//      long the call takes — at the default effort the same prompt blew past the
//      45s fetch timeout once given room to think).
//   2. `max_tokens` gets explicit headroom for thinking on top of the visible
//      output we actually want back.

/**
 * Effort for calls whose answer is a graded judgment we show as-is (trade
 * analyzer, retro grade, league pulse). `medium` on Sonnet 5 is roughly
 * Sonnet 4.6 at `high` — the quality bar these prompts were tuned against —
 * and in the 2026-10-01 probe it kept a three-team dynasty analysis to
 * 800–2,050 thinking tokens and 20–35s end to end.
 */
export const EFFORT_REASONING = { effort: 'medium' } as const;

/**
 * Effort for short, latency-sensitive prose (per-player take, team narrative,
 * trade follow-up chat, Ask AI). These ran on Sonnet 4.6 with thinking off, so
 * `low` keeps their latency close to what the UI was designed around while
 * still giving the model a little room to reason.
 */
export const EFFORT_QUICK = { effort: 'low' } as const;

/**
 * Thinking headroom added on top of the visible output budget. Sized from the
 * probe above (≤ ~2,100 thinking tokens at `medium` on the hardest prompt we
 * have) with a comfortable margin. Costs nothing unless used — Anthropic bills
 * generated tokens, not the ceiling.
 */
export const THINKING_HEADROOM_TOKENS = 6144;

/** `max_tokens` for a call whose visible answer should fit in `visibleTokens`. */
export function maxTokensWithThinking(visibleTokens: number): number {
  return visibleTokens + THINKING_HEADROOM_TOKENS;
}

/** The subset of an Anthropic Messages response these helpers look at. */
export interface AnthropicTextResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string | null;
}

/** The first text block's trimmed text, or null when the response has none. */
export function firstText(data: AnthropicTextResponse): string | null {
  const text = data.content?.find((b) => b.type === 'text')?.text?.trim();
  return text ? text : null;
}

/**
 * True when the model stopped because it hit `max_tokens`. When this is true
 * and there is no text, the budget was consumed by thinking; when there is
 * text, it is almost certainly cut off and will not parse.
 */
export function hitMaxTokens(data: AnthropicTextResponse): boolean {
  return data.stop_reason === 'max_tokens';
}

/**
 * Pull the outermost JSON object out of a model reply. Tolerates ```json
 * fences, a sentence of preamble before the object and trailing commentary
 * after it — anything outside the first `{` and the last `}` is dropped.
 * Returns null when the text contains no object at all (or when the slice
 * still fails to parse, e.g. a response truncated mid-object).
 */
export function parseJsonObject<T = unknown>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

/** One-line diagnostic for logs: stop reason, block types and text length. */
export function describeResponse(data: AnthropicTextResponse): string {
  const types = (data.content ?? []).map((b) => b.type).join(',') || 'none';
  const textLength = firstText(data)?.length ?? 0;
  return `stop_reason=${data.stop_reason ?? 'unknown'} blocks=[${types}] textLength=${textLength}`;
}
