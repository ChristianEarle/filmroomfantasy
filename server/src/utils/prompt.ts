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
