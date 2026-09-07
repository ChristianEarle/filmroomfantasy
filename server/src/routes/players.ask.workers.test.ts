import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { playerRoutes } from './players';
import { authRoutes } from './auth';
import * as schema from '../db/schema';
import { mountWithDb } from '../../test/testApp';

/**
 * End-to-end coverage for POST /api/players/ask (Ask AI v2): a real
 * registered+authenticated Pro user, real seeded D1 rows, and a mocked
 * Anthropic `fetch` that first requests a tool call, then answers — without
 * ever hitting the real Anthropic API. Verifies (1) a mentioned player who is
 * already on the board gets pre-fetched into the first request's user turn
 * as a Context: JSON block, and (2) a player NOT on the board is resolved
 * via a real `lookup_player` tool call in a second round.
 */
describe('POST /api/players/ask (workers pool, mocked Anthropic)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pre-fetches a board-mentioned player into context and resolves a second player via lookup_player', async () => {
    const db = drizzle(env.DB, { schema });
    const authApp = mountWithDb(authRoutes);
    const playerApp = mountWithDb(playerRoutes);
    const envWithKey = { ...env, ANTHROPIC_API_KEY: 'test-anthropic-key' } as typeof env;

    // ── Register + promote to Pro (requireTier gate) ──
    const registerRes = await authApp.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ask-ai-v2-test@example.com',
        password: 'correct-horse-battery-staple',
        username: 'ask_ai_v2_test',
      }),
    }, env);
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json() as { token: string; user: { id: string } };
    const { token } = registerBody;
    await db.update(schema.users).set({ subscriptionTier: 'pro' }).where(eq(schema.users.id, registerBody.user.id));

    // ── Seed players: Puka Nacua is on the board (has a projection), so
    // extractMentionedPlayers finds him without a tool call. Ja'Marr Chase
    // has no projection — he can only be resolved via lookup_player. ──
    await db.insert(schema.nflPlayers).values([
      {
        id: 'ask-v2-puka', externalId: 'ext-ask-v2-puka', name: 'Puka Nacua',
        team: 'LAR', position: 'WR', status: 'active',
      },
      {
        id: 'ask-v2-chase', externalId: 'ext-ask-v2-chase', name: "Ja'Marr Chase",
        team: 'CIN', position: 'WR', status: 'active',
      },
    ]);
    await db.insert(schema.playerProjections).values({
      id: 'ask-v2-puka-proj',
      playerId: 'ask-v2-puka',
      week: 1,
      seasonYear: 2026,
      projectedPoints: 17.8,
      scoringFormat: 'ppr',
      source: 'sleeper',
    });

    // ── Mock the Anthropic Messages API: round 1 requests lookup_player for
    // Chase, round 2 answers in text. ──
    const fetchCalls: { url: string; body: any }[] = [];
    const mockFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      fetchCalls.push({ url: String(url), body });
      if (fetchCalls.length === 1) {
        return new Response(JSON.stringify({
          content: [
            { type: 'text', text: 'Let me check on Chase too.' },
            { type: 'tool_use', id: 'tool_ask_v2_1', name: 'lookup_player', input: { name: "Ja'Marr Chase" } },
          ],
          stop_reason: 'tool_use',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'Start Puka Nacua over Chase this week — better matchup.' }],
        stop_reason: 'end_turn',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', mockFetch);

    const askRes = await playerApp.request('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        question: 'How does Puka Nacua look this week compared to Ja\'Marr Chase?',
        season: 2026,
        week: 1,
        scoringFormat: 'ppr',
      }),
    }, envWithKey);

    const askBody = await askRes.json() as { answer: string; toolCalls?: { name: string; input: any }[]; error?: string };
    expect(askRes.status, JSON.stringify(askBody)).toBe(200);
    expect(askBody.answer).toBe('Start Puka Nacua over Chase this week — better matchup.');
    expect(askBody.toolCalls).toEqual([{ name: 'lookup_player', input: { name: "Ja'Marr Chase" } }]);

    // Two Anthropic calls: the initial round + the tool-result follow-up.
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[0].url).toBe('https://api.anthropic.com/v1/messages');

    // Round 1's user turn carries the pre-fetched Puka Nacua card as a
    // Context: JSON block — never a tool call needed for a board player.
    const firstUserMessage = fetchCalls[0].body.messages.at(-1);
    expect(firstUserMessage.role).toBe('user');
    expect(firstUserMessage.content).toContain('Context:');
    expect(firstUserMessage.content).toContain('Puka Nacua');
    expect(firstUserMessage.content).toContain('17.8');
    const contextJson = firstUserMessage.content.split('Context:\n')[1];
    const contextCards = JSON.parse(contextJson);
    expect(contextCards).toHaveLength(1);
    expect(contextCards[0].name).toBe('Puka Nacua');

    // Round 2 carries the tool_result for the real lookup_player execution
    // against seeded D1 data — Chase's card, resolved by name lookup.
    const toolResultMessage = fetchCalls[1].body.messages.find(
      (m: any) => Array.isArray(m.content) && m.content[0]?.type === 'tool_result',
    );
    expect(toolResultMessage).toBeTruthy();
    const toolResultPayload = JSON.parse(toolResultMessage.content[0].content);
    expect(toolResultPayload.name).toBe("Ja'Marr Chase");
    expect(toolResultPayload.team).toBe('CIN');
  });
});
