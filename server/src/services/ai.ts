/**
 * AI service for filtering and summarizing player news.
 * Uses OpenAI API to determine relevance of tweets/articles to specific players.
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
 * Returns null if OPENAI_API_KEY is not configured.
 */
export async function checkNewsRelevance(
  text: string,
  playerNames: string[],
  apiKey: string | undefined
): Promise<RelevanceResult | null> {
  if (!apiKey || !apiKey.trim()) return null;
  if (playerNames.length === 0) return null;

  const prompt = `You are a fantasy football assistant. Given this sports news or tweet, determine which of the listed NFL players this news is RELEVANT to for fantasy purposes.

RELEVANT means: injury/status update, performance, role change, trade, contract, lineup decision, snap count, targets, or other news that directly affects that player's fantasy value.
NOT RELEVANT: player is only mentioned in passing (e.g., "Team A beat Team B" where the player is just on the losing side), or the news is about someone else entirely.

News/tweet:
"""
${text.slice(0, 600)}
"""

Players mentioned (check each for relevance): ${playerNames.join(', ')}

Respond with ONLY valid JSON, no other text:
{"relevantPlayerNames": ["Name1", "Name2"], "summary": "One sentence fantasy-relevant summary of this news", "playerSummaries": {"Name1": "Summary specific to Name1", "Name2": "Summary specific to Name2"}}

Rules: relevantPlayerNames must be a subset of the listed players. summary must be 1-2 sentences as an overall summary. playerSummaries must have a key for EACH relevant player with a 1-sentence summary explaining what this news means specifically for that player's fantasy value. If no players are relevant, use empty array [] and empty object {}.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI API error:', res.status, err);
      return null;
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
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
