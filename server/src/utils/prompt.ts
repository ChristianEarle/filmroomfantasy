// Shared helpers for AI prompt construction and per-day usage keys, used by the
// trade analyzer, trade history, and draft-rankings "ask" routes.

/** Max length for individual user-supplied text fields injected into prompts. */
export const MAX_FIELD_LENGTH = 200;

/**
 * Sanitize user-supplied text before injecting into AI prompts. Strips patterns
 * commonly used in prompt-injection attacks and enforces a length limit to
 * reduce attack surface.
 */
export function sanitizePromptInput(input: string, maxLength = MAX_FIELD_LENGTH): string {
  let s = input.slice(0, maxLength);

  // Collapse multi-newlines (used to fake message boundaries) to a space.
  s = s.replace(/(\r?\n){2,}/g, ' ');
  // Defuse role/instruction injection patterns (case-insensitive).
  s = s.replace(/\b(system|assistant|human|user|ignore|forget|disregard|override)\s*:/gi, '$1 -');
  // Strip XML-style tags that could mimic system/tool boundaries.
  s = s.replace(/<\/?[a-z_-]+>/gi, '');
  // Strip markdown header injection.
  s = s.replace(/^#{1,6}\s/gm, '');

  return s.trim();
}

/** Today's date as a YYYY-MM-DD key for daily usage grouping. */
export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A single turn in an AI conversation (alternating user/assistant). */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// ── Anthropic prompt caching ─────────────────────────────────────────
//
// All direct Anthropic Messages API calls in this codebase send `system`
// as a content-block array so the static/reusable prefix can carry a
// `cache_control` marker. Prompt caching is a strict prefix match: the
// cached block must be byte-identical across requests, so anything
// request-specific belongs in the second (uncached) block or in the
// user message — never interpolated into the static block.

/** Anthropic `system` content block (the subset our direct API calls use). */
export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * Build a `system` content-block array with prompt caching enabled on the
 * static prefix. `staticText` gets an ephemeral cache marker (5-minute TTL);
 * optional `dynamicText` goes in a second, uncached block so per-request
 * variation never invalidates the cached prefix.
 *
 * Note: prefixes below the model's minimum cacheable size silently won't
 * cache (no error) — the marker is still harmless in that case.
 */
export function buildCachedSystemBlocks(
  staticText: string,
  dynamicText?: string,
): AnthropicSystemBlock[] {
  const blocks: AnthropicSystemBlock[] = [
    { type: 'text', text: staticText, cache_control: { type: 'ephemeral' } },
  ];
  if (dynamicText && dynamicText.trim().length > 0) {
    blocks.push({ type: 'text', text: dynamicText });
  }
  return blocks;
}
