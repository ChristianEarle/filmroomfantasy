/**
 * AI service for filtering and summarizing player news.
 * Uses Claude API to determine relevance of tweets/articles to specific players.
 */

export interface RelevanceResult {
  relevantPlayerNames: string[];
  summary: string;
  /** Per-player summaries keyed by player name (lowercase). Falls back to shared summary if absent. */
  playerSummaries?: Record<string, string>;
}

/**
 * Check which of the mentioned players are actually relevant to this news item,
 * and get a brief fantasy-relevant summary.
 * Returns null if ANTHROPIC_API_KEY is not configured.
 */
export async function checkNewsRelevance(
  text: string,
  playerNames: string[],
  apiKey: string | undefined
): Promise<RelevanceResult | null> {
  if (!apiKey || !apiKey.trim()) return null;
  if (playerNames.length === 0) return null;

  const prompt = `You are a fantasy football news analyst. Given a sports news article or tweet, determine which of the listed NFL players this news is DIRECTLY RELEVANT to for fantasy football purposes.

A player is RELEVANT only if the news:
- Is specifically ABOUT that player (injury update, status change, suspension, trade, signing)
- Directly affects that player's role, usage, or opportunity (e.g. the starter ahead of them got injured)
- Contains a performance detail specific to that player (snap count, target share, usage change)
- Involves a coaching or scheme decision that specifically impacts that player

A player is NOT RELEVANT if:
- They are only mentioned in passing or for context (e.g. "Team A, led by [Player], beat Team B")
- The news is about their team generally but doesn't affect their individual value
- Their name appears only because they played in the same game being discussed
- They are mentioned as a comparison or reference point for another player's news

Be strict — only mark a player as relevant if the news would change how a fantasy manager values them.

News/tweet:
"""
${text.slice(0, 600)}
"""

Players to evaluate (check EACH one): ${playerNames.join(', ')}

Respond with ONLY valid JSON, no other text:
{"relevantPlayerNames": ["Name1", "Name2"], "summary": "One sentence fantasy-relevant summary of this news", "playerSummaries": {"name1": "Summary specific to Name1", "name2": "Summary specific to Name2"}}

Rules:
- relevantPlayerNames must be a subset of the listed players. Use exact names as provided.
- summary: 1-2 sentence overall summary of the fantasy impact.
- playerSummaries: keys are LOWERCASE player names, each with a 1-sentence summary explaining what this news means for that specific player's fantasy value.
- If no players are truly relevant, return {"relevantPlayerNames": [], "summary": "", "playerSummaries": {}}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude API error:', res.status, err);
      return null;
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const content = data.content?.find((c) => c.type === 'text')?.text?.trim();
    if (!content) return null;

    // Parse JSON (handle potential markdown code block)
    const jsonStr = content.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(jsonStr) as RelevanceResult;
    if (!parsed || !Array.isArray(parsed.relevantPlayerNames)) {
      return null;
    }
    parsed.summary = (parsed.summary || '').trim() || text.slice(0, 150);
    // Normalize playerSummaries keys to lowercase for reliable lookup
    if (parsed.playerSummaries && typeof parsed.playerSummaries === 'object') {
      const normalized: Record<string, string> = {};
      for (const [name, summary] of Object.entries(parsed.playerSummaries)) {
        if (typeof summary === 'string' && summary.trim()) {
          normalized[name.trim().toLowerCase()] = summary.trim();
        }
      }
      parsed.playerSummaries = normalized;
    } else {
      parsed.playerSummaries = {};
    }
    return parsed;
  } catch (e) {
    console.error('AI relevance check error:', e instanceof Error ? e.message : 'Unknown error');
    return null;
  }
}
