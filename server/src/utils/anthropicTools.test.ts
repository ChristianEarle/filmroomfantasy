import { describe, it, expect, vi } from 'vitest';
import { runAskWithTools, AnthropicApiError } from './anthropicTools';
import type { AnthropicToolSchema } from './anthropicTools';

const TOOLS: AnthropicToolSchema[] = [
  { name: 'lookup_player', description: 'look up a player', input_schema: { type: 'object', properties: {} } },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('runAskWithTools', () => {
  it('returns the final text answer directly when the model does not request a tool', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'Start CMC, he has a great matchup.' }], stop_reason: 'end_turn' }),
    );

    const result = await runAskWithTools({
      apiKey: 'test-key',
      model: 'claude-sonnet-5',
      system: 'system prompt',
      tools: TOOLS,
      messages: [{ role: 'user', content: 'Should I start CMC?' }],
      handlers: {},
      fetchImpl,
    });

    expect(result.answer).toBe('Start CMC, he has a great matchup.');
    expect(result.rounds).toBe(1);
    expect(result.toolCalls).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('runs a tool_use round, feeds the result back, and returns the follow-up answer', async () => {
    const handler = vi.fn().mockResolvedValue({ name: 'Puka Nacua', proj: 18.4 });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(
        jsonResponse({
          content: [
            { type: 'text', text: 'Let me look that up.' },
            { type: 'tool_use', id: 'tool_1', name: 'lookup_player', input: { name: 'Puka Nacua' } },
          ],
          stop_reason: 'tool_use',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'text', text: 'Puka is projected for 18.4 — start him.' }], stop_reason: 'end_turn' }),
      );

    const result = await runAskWithTools({
      apiKey: 'test-key',
      model: 'claude-sonnet-5',
      system: 'system prompt',
      tools: TOOLS,
      messages: [{ role: 'user', content: 'How is Puka Nacua looking?' }],
      handlers: { lookup_player: handler },
      fetchImpl,
    });

    const awaited = await result;
    expect(awaited.answer).toBe('Puka is projected for 18.4 — start him.');
    expect(awaited.rounds).toBe(2);
    expect(awaited.toolCalls).toEqual([{ name: 'lookup_player', input: { name: 'Puka Nacua' } }]);
    expect(handler).toHaveBeenCalledWith({ name: 'Puka Nacua' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // Second call's body should carry the tool_result back to the model.
    const secondCallBody = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    const toolResultMessage = secondCallBody.messages.find((m: any) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result');
    expect(toolResultMessage).toBeTruthy();
    expect(toolResultMessage.content[0].tool_use_id).toBe('tool_1');
    expect(JSON.parse(toolResultMessage.content[0].content)).toEqual({ name: 'Puka Nacua', proj: 18.4 });
  });

  it('omits tools on the final round, forcing a text answer even if the model would otherwise call a tool', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'tool_use', id: 't1', name: 'lookup_player', input: { name: 'A' } }], stop_reason: 'tool_use' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'tool_use', id: 't2', name: 'lookup_player', input: { name: 'B' } }], stop_reason: 'tool_use' }),
      )
      .mockResolvedValueOnce(
        // Final round has no `tools` in the request, so even a stop_reason
        // other than tool_use here is treated as the answer.
        jsonResponse({ content: [{ type: 'text', text: 'Best guess without further lookups.' }], stop_reason: 'end_turn' }),
      );

    const result = await runAskWithTools({
      apiKey: 'test-key',
      model: 'claude-sonnet-5',
      system: 'system prompt',
      tools: TOOLS,
      messages: [{ role: 'user', content: 'Compare A and B' }],
      handlers: { lookup_player: handler },
      maxRounds: 3,
      fetchImpl,
    });

    expect(result.answer).toBe('Best guess without further lookups.');
    expect(result.rounds).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Final round's request body must not include `tools`.
    const finalBody = JSON.parse((fetchImpl.mock.calls[2][1] as RequestInit).body as string);
    expect(finalBody.tools).toBeUndefined();
  });

  it('throws an AbortError once the time budget is exceeded before a round starts', async () => {
    const fetchImpl = vi.fn();
    await expect(
      runAskWithTools({
        apiKey: 'test-key',
        model: 'claude-sonnet-5',
        system: 'system prompt',
        tools: TOOLS,
        messages: [{ role: 'user', content: 'hi' }],
        handlers: {},
        budgetMs: -1,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces a non-2xx Anthropic response as AnthropicApiError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad request' }, false, 400));
    await expect(
      runAskWithTools({
        apiKey: 'test-key',
        model: 'claude-sonnet-5',
        system: 'system prompt',
        tools: TOOLS,
        messages: [{ role: 'user', content: 'hi' }],
        handlers: {},
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(AnthropicApiError);
  });

  it('turns a handler that throws into a tool_result error payload instead of failing the whole request', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('D1 unavailable'));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'tool_use', id: 't1', name: 'lookup_player', input: { name: 'X' } }], stop_reason: 'tool_use' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ type: 'text', text: 'Could not look that up, but here is general advice.' }], stop_reason: 'end_turn' }),
      );

    const result = await runAskWithTools({
      apiKey: 'test-key',
      model: 'claude-sonnet-5',
      system: 'system prompt',
      tools: TOOLS,
      messages: [{ role: 'user', content: 'How is X?' }],
      handlers: { lookup_player: handler },
      fetchImpl,
    });

    expect(result.answer).toBe('Could not look that up, but here is general advice.');
    const secondCallBody = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    const toolResultMessage = secondCallBody.messages.find((m: any) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result');
    expect(JSON.parse(toolResultMessage.content[0].content)).toEqual({ error: 'D1 unavailable' });
  });
});
