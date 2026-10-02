import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeTrade, buildTradeDescription, type AnalyzeTradeBody } from './tradeAnalyzer';
import { THINKING_HEADROOM_TOKENS } from '../utils/aiOutput';

const body: AnalyzeTradeBody = {
  teams: [
    { label: 'Team 1', sends: [{ type: 'player', name: 'Bijan Robinson', position: 'RB', team: 'ATL' }] },
    { label: 'Team 2', sends: [{ type: 'player', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' }] },
  ],
  leagueType: 'redraft',
};

const validResult = {
  winner: 'Team 1',
  winnerExplanation: 'Robinson is the better back.',
  teamGrades: [
    { team: 'Team 1', grade: 'B+', summary: 'Fine.' },
    { team: 'Team 2', grade: 'B-', summary: 'Fine.' },
  ],
  fairnessScore: { score: 55, diff: 5, favored: 'Team 1' },
  improvements: [],
  keyFactors: ['Volume'],
};

function anthropicReply(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function run(reply: Response) {
  const fetchMock = vi.fn().mockResolvedValue(reply);
  vi.stubGlobal('fetch', fetchMock);
  const outcome = analyzeTrade({
    anthropicKey: 'test-key',
    body,
    tradeDescription: buildTradeDescription(body),
    tradeContext: null,
  });
  return { outcome, fetchMock };
}

describe('analyzeTrade', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it('leaves room for Sonnet 5 thinking and bounds the effort', async () => {
    const { outcome, fetchMock } = run(
      anthropicReply({ content: [{ type: 'text', text: JSON.stringify(validResult) }], stop_reason: 'end_turn' })
    );
    await outcome;
    const req = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(req.model).toBe('claude-sonnet-5');
    expect(req.output_config).toEqual({ effort: 'medium' });
    // Visible budget (2048 + 512 per team) plus thinking headroom.
    expect(req.max_tokens).toBe(2048 + 2 * 512 + THINKING_HEADROOM_TOKENS);
    expect(req).not.toHaveProperty('temperature');
  });

  it('reports a thinking-only max_tokens reply as running out of room, not as empty', async () => {
    const { outcome } = run(anthropicReply({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' }));
    const result = await outcome;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.error).toMatch(/ran out of room/i);
    }
  });

  it('reports JSON cut off by max_tokens distinctly from malformed JSON', async () => {
    const truncated = JSON.stringify(validResult).slice(0, 80);
    const { outcome } = run(
      anthropicReply({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: truncated }], stop_reason: 'max_tokens' })
    );
    const result = await outcome;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cut off/i);
  });

  it('still rejects genuinely malformed JSON', async () => {
    const { outcome } = run(anthropicReply({ content: [{ type: 'text', text: 'Team 1 wins, easy.' }], stop_reason: 'end_turn' }));
    const result = await outcome;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid response/i);
  });

  it('parses JSON wrapped in fences with preamble and a trailing note', async () => {
    const text = `Here is my analysis:\n\n\`\`\`json\n${JSON.stringify(validResult)}\n\`\`\`\n\nHope that helps.`;
    const { outcome } = run(
      anthropicReply({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: 'end_turn' })
    );
    const result = await outcome;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.winner).toBe('Team 1');
      expect(result.result.teamGrades).toHaveLength(2);
    }
  });
});
