import { describe, expect, it } from 'vitest';
import { buildRedraftPrompt, buildDynastyPrompt, type PlayerContext } from './draftRankings';

// ── Fixtures ─────────────────────────────────────────────────────────

function makePlayer(over: Partial<PlayerContext> & { name: string; position: string }): PlayerContext {
  return {
    id: over.name,
    externalId: null,
    name: over.name,
    position: over.position,
    team: over.team ?? 'KC',
    age: over.age ?? 25,
    yearsExp: over.yearsExp ?? 3,
    status: over.status ?? 'active',
    injuryNote: over.injuryNote ?? null,
    depthChartOrder: over.depthChartOrder ?? 1,
    lastSeasonPoints: over.lastSeasonPoints ?? 250,
    lastSeasonGames: over.lastSeasonGames ?? 16,
    recentNews: over.recentNews ?? [],
    adp: over.adp ?? null,
    marketRank: over.marketRank ?? null,
    marketProjection: over.marketProjection ?? null,
    marketTier: over.marketTier ?? null,
  };
}

// ── buildRedraftPrompt — market anchor ─────────────────────────────────

describe('buildRedraftPrompt — market anchor present', () => {
  const players = [
    makePlayer({ name: 'Market Star', position: 'WR', adp: 5, marketRank: 3, marketProjection: 310.4, marketTier: 1 }),
    makePlayer({ name: 'No Market Guy', position: 'RB', adp: 40, marketRank: null }),
  ];
  const prompt = buildRedraftPrompt(players, 'ppr', false);

  it('includes the per-player Market line with rank and projection', () => {
    expect(prompt).toContain('Market Star');
    expect(prompt).toContain('| Market: #3 (proj 310.4)');
  });

  it('omits a Market segment for a player with no market rank', () => {
    // "No Market Guy"'s own line should not contain a Market: token.
    const line = prompt.split('\n').find(l => l.startsWith('No Market Guy'));
    expect(line).toBeTruthy();
    expect(line).not.toContain('Market:');
  });

  it('states MARKET RANK is the primary anchor, with ADP secondary', () => {
    expect(prompt).toMatch(/MARKET RANK.*primary anchor/s);
    expect(prompt).toMatch(/ADP is secondary/);
  });

  it('requires justification for deviations of more than 10 spots from Market rank', () => {
    expect(prompt).toMatch(/Deviating more than ±10 from Market rank/);
  });

  it('keeps the positional-scarcity backstop and anchors it on Market rank', () => {
    expect(prompt).toContain('POSITIONAL SCARCITY BACKSTOP');
    expect(prompt).toMatch(/Market rank \(when present\) is the anchor/);
  });
});

describe('buildRedraftPrompt — no market data falls back to ADP-only wording', () => {
  const players = [
    makePlayer({ name: 'Plain Player', position: 'WR', adp: 12, marketRank: null }),
  ];
  const prompt = buildRedraftPrompt(players, 'ppr', false);

  it('never mentions Market anywhere in the prompt', () => {
    expect(prompt).not.toMatch(/Market/);
  });

  it('keeps ADP as the anchor language, unchanged from the pre-market-anchor prompt', () => {
    expect(prompt).toMatch(/ADP is your primary anchor/);
    expect(prompt).toMatch(/Deviating more than ±10 from ADP requires/);
    expect(prompt).toMatch(/ADP \(when present\) is the anchor/);
  });
});

describe('buildRedraftPrompt — superflex variant still carries the 1-QB market signal', () => {
  it('includes the Market line even in the superflex prompt', () => {
    const players = [
      makePlayer({ name: 'SF QB', position: 'QB', adp: 8, marketRank: 5, marketProjection: 340 }),
    ];
    const prompt = buildRedraftPrompt(players, 'ppr', true);
    expect(prompt).toContain('| Market: #5 (proj 340.0)');
    expect(prompt).toMatch(/MARKET RANK.*primary anchor/s);
    // Superflex branch swaps out the 1-QB positional scarcity backstop text.
    expect(prompt).toContain('SUPERFLEX OVERRIDE');
    // Market rank is a 1-QB number: the ±10 anchor must be waived for QBs in superflex.
    expect(prompt).toContain('Market rank reflects 1-QB value');
    expect(prompt).toMatch(/do NOT apply the ±10 rule against Market rank/);
  });

  it('omits the superflex caveat for 1-QB variants and when no market data exists', () => {
    const withMarket = buildRedraftPrompt(
      [makePlayer({ name: 'One QB', position: 'QB', adp: 8, marketRank: 5, marketProjection: 340 })],
      'ppr',
      false,
    );
    expect(withMarket).not.toContain('Market rank reflects 1-QB value');
    const noMarketSuperflex = buildRedraftPrompt(
      [makePlayer({ name: 'SF QB', position: 'QB', adp: 8 })],
      'ppr',
      true,
    );
    expect(noMarketSuperflex).not.toContain('Market rank reflects 1-QB value');
  });
});

// ── buildDynastyPrompt — market projection as this-season signal only ──

describe('buildDynastyPrompt — market projection is a this-season signal, not the anchor', () => {
  it('surfaces Market Proj (this season) in the player line without a rank', () => {
    const players = [
      makePlayer({ name: 'Dynasty Vet', position: 'RB', adp: 10, marketProjection: 275.6 }),
    ];
    const prompt = buildDynastyPrompt(players, 'ppr', false);
    expect(prompt).toContain('Market Proj (this season): 275.6 pts');
    // Never presented as a ranked "#N" anchor the way the redraft prompt does.
    expect(prompt).not.toMatch(/Market:\s*#/);
  });

  it('keeps Dynasty ADP as the stated anchor even when market data is present', () => {
    const players = [
      makePlayer({ name: 'Dynasty Vet', position: 'RB', adp: 10, marketProjection: 275.6 }),
    ];
    const prompt = buildDynastyPrompt(players, 'ppr', false);
    expect(prompt).toMatch(/Dynasty ADP.*is your primary anchor/);
    expect(prompt).toMatch(/cross-check on current-year production/);
    expect(prompt).toMatch(/never as a dynasty rank anchor; Dynasty ADP remains the anchor/);
  });

  it('omits the Market Proj feature wording when no player has a market projection', () => {
    const players = [
      makePlayer({ name: 'No Market Vet', position: 'WR', adp: 20, marketProjection: null }),
    ];
    const prompt = buildDynastyPrompt(players, 'ppr', false);
    // Pre-existing prose ("dynasty ADP already prices in the market's
    // forward-looking view") uses the generic lowercase word "market" — only
    // the capitalized "Market Proj" feature wording must be gated on data.
    expect(prompt).not.toContain('Market Proj');
    expect(prompt).not.toMatch(/cross-check on current-year production/);
  });
});
