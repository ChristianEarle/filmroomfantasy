/**
 * Minimal Anthropic Messages API tool-use loop for Ask AI v2.
 *
 * Runs up to `maxRounds` round trips: the model may respond with
 * `stop_reason: 'tool_use'`, in which case every tool_use block in that
 * round is dispatched (in parallel) through `handlers`, appended back as
 * `tool_result` blocks, and the conversation is re-sent. Tools are omitted
 * from the final allowed round so the model is forced to answer in text
 * instead of requesting yet another tool call. A wall-clock budget
 * (`budgetMs`) bounds the whole loop independently of `maxRounds`, since a
 * slow tool handler could otherwise blow past a caller's own timeout.
 */

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: string; [key: string]: unknown };

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicSystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export interface RunAskWithToolsOptions {
  apiKey: string;
  model: string;
  system: AnthropicSystemBlock[] | string;
  tools: AnthropicToolSchema[];
  messages: AnthropicMessage[];
  handlers: Record<string, ToolHandler>;
  maxRounds?: number;
  budgetMs?: number;
  maxTokens?: number;
  /** Override for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
}

export interface RunAskWithToolsResult {
  answer: string;
  rounds: number;
  toolCalls: ToolCallRecord[];
}

class AnthropicApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Anthropic API error ${status}: ${body}`);
  }
}

async function callMessages(
  fetchImpl: typeof fetch,
  apiKey: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ content: AnthropicContentBlock[]; stop_reason: string | null }> {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AnthropicApiError(res.status, text);
  }

  const data = (await res.json()) as { content?: AnthropicContentBlock[]; stop_reason?: string };
  return { content: data.content ?? [], stop_reason: data.stop_reason ?? null };
}

export { AnthropicApiError };

/**
 * Run the tool-use loop. Throws AnthropicApiError on a non-2xx response, or
 * a DOMException('AbortError') if the shared 30s-per-call signal or the
 * overall `budgetMs` fires first.
 */
export async function runAskWithTools(opts: RunAskWithToolsOptions): Promise<RunAskWithToolsResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRounds = opts.maxRounds ?? 3;
  const budgetMs = opts.budgetMs ?? 25000;
  const maxTokens = opts.maxTokens ?? 1500;
  const deadline = Date.now() + budgetMs;

  const messages: AnthropicMessage[] = [...opts.messages];
  const toolCalls: ToolCallRecord[] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new DOMException('Ask AI tool loop exceeded its time budget', 'AbortError');
    }

    const isFinalRound = round === maxRounds;
    const body: Record<string, unknown> = {
      model: opts.model,
      max_tokens: maxTokens,
      system: opts.system,
      messages,
    };
    // Tools are omitted on the final allowed round so the model must answer
    // in text rather than requesting another round we won't service.
    if (!isFinalRound) {
      body.tools = opts.tools;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(30000, remaining));
    let response: { content: AnthropicContentBlock[]; stop_reason: string | null };
    try {
      response = await callMessages(fetchImpl, opts.apiKey, body, controller.signal);
    } finally {
      clearTimeout(timeout);
    }

    const toolUseBlocks = response.content.filter(
      (b): b is AnthropicToolUseBlock => b.type === 'tool_use',
    );

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0 || isFinalRound) {
      const text = response.content
        .filter((b): b is AnthropicTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { answer: text, rounds: round, toolCalls };
    }

    // Record the assistant turn (including its tool_use blocks) before
    // dispatching handlers, then run every tool call in this round in
    // parallel and append the results as one user turn.
    messages.push({ role: 'assistant', content: response.content });

    const results = await Promise.all(
      toolUseBlocks.map(async (block) => {
        toolCalls.push({ name: block.name, input: block.input });
        const handler = opts.handlers[block.name];
        let content: unknown;
        if (!handler) {
          content = { error: `Unknown tool: ${block.name}` };
        } else {
          try {
            content = await handler(block.input);
          } catch (err) {
            content = { error: err instanceof Error ? err.message : 'Tool execution failed' };
          }
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: typeof content === 'string' ? content : JSON.stringify(content),
        };
      }),
    );

    messages.push({ role: 'user', content: results });
  }

  // Unreachable given the isFinalRound short-circuit above, but keeps the
  // function total for TypeScript.
  throw new Error('Ask AI tool loop ended without a final answer');
}
