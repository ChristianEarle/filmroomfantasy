import { describe, it, expect } from 'vitest';
import { extractMentionedPlayers, type MentionCandidate } from './playerMentions';

const board: MentionCandidate[] = [
  { id: 'p1', name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
  { id: 'p2', name: 'Justin Jefferson', position: 'WR', team: 'MIN' },
  { id: 'p3', name: 'Puka Nacua', position: 'WR', team: 'LAR' },
  { id: 'p4', name: 'Travis Kelce', position: 'TE', team: 'KC' },
  { id: 'p5', name: 'Josh Allen', position: 'QB', team: 'BUF' },
  { id: 'p6', name: 'Saquon Barkley', position: 'RB', team: 'PHI' },
  { id: 'p7', name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
  { id: 'p8', name: 'A.J. Brown', position: 'WR', team: 'PHI' },
];

describe('extractMentionedPlayers', () => {
  it('resolves an alias (cmc) to the matching board candidate', () => {
    const result = extractMentionedPlayers('Should I start cmc this week?', [], board);
    expect(result.map((r) => r.id)).toContain('p1');
  });

  it('resolves a multi-word alias target (puka) that is itself an alias key', () => {
    const result = extractMentionedPlayers('Is puka a must-start?', [], board);
    expect(result.map((r) => r.id)).toContain('p3');
  });

  it('matches a full capitalized name exactly', () => {
    const result = extractMentionedPlayers('Compare Justin Jefferson vs Travis Kelce', [], board);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['p2', 'p4']));
  });

  it('falls back to a unique last name on the board', () => {
    const result = extractMentionedPlayers('How does Nacua look this week?', [], board);
    expect(result.map((r) => r.id)).toContain('p3');
  });

  it('does not use the last-name fallback when the last name is ambiguous', () => {
    // Two "Brown"s on the board would be ambiguous; simulate with a second Brown.
    const ambiguousBoard: MentionCandidate[] = [
      ...board,
      { id: 'p9', name: 'Marquise Brown', position: 'WR', team: 'KC' },
    ];
    const result = extractMentionedPlayers('What about Brown this week?', [], ambiguousBoard);
    expect(result.map((r) => r.id)).not.toContain('p8');
    expect(result.map((r) => r.id)).not.toContain('p9');
  });

  it('fuzzy-matches via token overlap when a name is preceded/followed by extra words', () => {
    // "Saquon Barkley Jr" shares both of "Saquon Barkley"'s tokens; the Dice
    // overlap (2*2/(3+2) = 0.8) clears the threshold even though the span has
    // an extra word the board name doesn't.
    const result = extractMentionedPlayers('What do you think about Saquon Barkley Jr this week', [], board);
    expect(result.map((r) => r.id)).toContain('p6');
  });

  it('caps mentions at 6', () => {
    const question = board.map((b) => b.name).join(', ') + ' — rank them all';
    const result = extractMentionedPlayers(question, [], board);
    expect(result.length).toBeLessThanOrEqual(6);
  });

  it('returns no matches for a question naming nobody on the board', () => {
    const result = extractMentionedPlayers('What is the weather like today?', [], board);
    expect(result).toEqual([]);
  });

  it('falls back to conversation history when the question has no mentions', () => {
    const history = [
      { role: 'user' as const, content: 'How is Josh Allen looking?' },
      { role: 'assistant' as const, content: 'Josh Allen has a great matchup.' },
    ];
    const result = extractMentionedPlayers('Is he a must-start?', history, board);
    expect(result.map((r) => r.id)).toContain('p5');
  });

  it('dedupes a player mentioned multiple times', () => {
    const result = extractMentionedPlayers('CMC or Christian McCaffrey — same guy, right?', [], board);
    const ids = result.map((r) => r.id);
    expect(ids.filter((id) => id === 'p1')).toHaveLength(1);
  });

  it('returns an empty array when there are no candidates', () => {
    const result = extractMentionedPlayers('cmc', [], []);
    expect(result).toEqual([]);
  });
});
