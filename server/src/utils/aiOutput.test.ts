import { describe, expect, it } from 'vitest';
import {
  EFFORT_QUICK,
  EFFORT_REASONING,
  THINKING_HEADROOM_TOKENS,
  describeResponse,
  firstText,
  hitMaxTokens,
  maxTokensWithThinking,
  parseJsonObject,
} from './aiOutput';

describe('parseJsonObject', () => {
  it('parses a bare object', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('drops preamble and trailing commentary around the object', () => {
    const text = 'Here is the analysis you asked for:\n\n{"winner":"Team 1","n":2}\n\nLet me know if you want more.';
    expect(parseJsonObject(text)).toEqual({ winner: 'Team 1', n: 2 });
  });

  it('keeps braces inside string values intact', () => {
    expect(parseJsonObject('{"s":"a } b { c"}')).toEqual({ s: 'a } b { c' });
  });

  it('returns null when there is no object', () => {
    expect(parseJsonObject('no json here')).toBeNull();
    expect(parseJsonObject('')).toBeNull();
  });

  it('returns null for an object truncated mid-way (max_tokens cut-off)', () => {
    expect(parseJsonObject('{"winner":"Team 1","teamGrades":[{"team":"Team 1","gra')).toBeNull();
  });
});

describe('response helpers', () => {
  const thinkingOnly = { content: [{ type: 'thinking' }], stop_reason: 'max_tokens' };
  const withText = { content: [{ type: 'thinking' }, { type: 'text', text: '  {"a":1}  ' }], stop_reason: 'end_turn' };

  it('firstText returns the trimmed text block or null', () => {
    expect(firstText(withText)).toBe('{"a":1}');
    expect(firstText(thinkingOnly)).toBeNull();
    expect(firstText({ content: [{ type: 'text', text: '   ' }] })).toBeNull();
  });

  it('hitMaxTokens reflects stop_reason', () => {
    expect(hitMaxTokens(thinkingOnly)).toBe(true);
    expect(hitMaxTokens(withText)).toBe(false);
    expect(hitMaxTokens({})).toBe(false);
  });

  it('describeResponse summarises stop reason, blocks and text length', () => {
    expect(describeResponse(thinkingOnly)).toBe('stop_reason=max_tokens blocks=[thinking] textLength=0');
    expect(describeResponse(withText)).toBe('stop_reason=end_turn blocks=[thinking,text] textLength=7');
    expect(describeResponse({})).toBe('stop_reason=unknown blocks=[none] textLength=0');
  });

  it('maxTokensWithThinking adds the headroom', () => {
    expect(maxTokensWithThinking(2048)).toBe(2048 + THINKING_HEADROOM_TOKENS);
    expect(THINKING_HEADROOM_TOKENS).toBeGreaterThanOrEqual(4096);
  });

  it('effort presets are valid output_config values', () => {
    expect(EFFORT_REASONING).toEqual({ effort: 'medium' });
    expect(EFFORT_QUICK).toEqual({ effort: 'low' });
  });
});
