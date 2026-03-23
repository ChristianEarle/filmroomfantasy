import { Hono } from 'hono';
import type { Env, Variables } from '../index';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const tradesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Types ──────────────────────────────────────────────────────────────

interface TradeAssetInput {
  type: 'player' | 'pick';
  name: string;
  position?: string;
  team?: string;
  /** For 3+ team trades: which team this asset goes to */
  destinationTeam?: string;
}

interface TradeTeamInput {
  label: string;
  sends: TradeAssetInput[];
}

interface AnalyzeTradeBody {
  teams: TradeTeamInput[];
  leagueType: 'redraft' | 'dynasty' | 'keeper';
  strategy?: 'win-now' | 'rebuilding' | 'balanced';
  context?: string;
}

interface TeamGrade {
  team: string;
  grade: string;
  summary: string;
}

interface TradeAnalysisResult {
  winner: string;
  winnerExplanation: string;
  teamGrades: TeamGrade[];
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildTradeDescription(body: AnalyzeTradeBody): string {
  const isMultiTeam = body.teams.length > 2;

  const teamDescriptions = body.teams.map((t) => {
    if (isMultiTeam) {
      // Group assets by destination team
      const byDest = new Map<string, string[]>();
      for (const a of t.sends) {
        const dest = a.destinationTeam || 'unknown';
        const desc = a.type === 'player'
          ? `${a.name}${a.position ? ` (${a.position}` : ''}${a.team ? `, ${a.team})` : a.position ? ')' : ''}`
          : a.name;
        const list = byDest.get(dest) || [];
        list.push(desc);
        byDest.set(dest, list);
      }
      const lines = Array.from(byDest.entries())
        .map(([dest, assets]) => `  → ${dest}: ${assets.join(', ')}`)
        .join('\n');
      return `${t.label} sends:\n${lines}`;
    } else {
      const assets = t.sends
        .map((a) => {
          if (a.type === 'player') {
            return `${a.name}${a.position ? ` (${a.position}` : ''}${a.team ? `, ${a.team})` : a.position ? ')' : ''}`;
          }
          return a.name;
        })
        .join(', ');
      return `${t.label} sends: ${assets}`;
    }
  });

  return teamDescriptions.join('\n');
}

function buildSystemPrompt(body: AnalyzeTradeBody): string {
  const leagueLabel =
    body.leagueType === 'redraft'
      ? 'Redraft'
      : body.leagueType === 'dynasty'
      ? 'Dynasty'
      : 'Keeper';

  const strategyNote =
    body.strategy && body.leagueType !== 'redraft'
      ? `\nThe user's team strategy: ${body.strategy === 'win-now' ? 'Win Now (prioritize current season production)' : body.strategy === 'rebuilding' ? 'Rebuilding (prioritize youth, upside, and future assets)' : 'Balanced (equal weight on present and future value)'}.`
      : '';

  return `You are an expert fantasy football trade analyst. You have deep knowledge of NFL players, their current values, injury histories, injury timelines, team situations, depth charts, coaching schemes, and fantasy football strategy.

When evaluating trades you MUST consider:
- Current player value and recent performance trends
- Injury status, injury history, and expected return timelines
- Age and long-term outlook (especially important for dynasty/keeper)
- NFL team changes that affect player value (coaching changes, offensive line changes, QB changes, new skill position additions via draft/FA)
- Target share, snap counts, and opportunity metrics
- Strength of schedule and upcoming matchups
- Positional scarcity and replacement-level value
- Draft pick value based on round and year (future picks are inherently uncertain)
- The specific league format impacts how players should be valued

League format: ${leagueLabel}${strategyNote}

You must respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "winner": "Team name that wins the trade",
  "winnerExplanation": "2-3 sentence explanation of why this team wins the trade overall",
  "teamGrades": [
    {
      "team": "Team label",
      "grade": "Letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F)",
      "summary": "2-3 sentence analysis of what this team gains/loses and why they got this grade"
    }
  ]
}

Rules:
- teamGrades MUST have one entry for EACH team in the trade
- Grades should be realistic — not every trade is great for everyone
- The winner field must match one of the team labels exactly
- Be specific: reference actual player strengths, weaknesses, injuries, and situations
- If draft picks are involved, assess their value relative to the players being traded
- Consider the current NFL landscape and fantasy football context`;
}

// ── Route ──────────────────────────────────────────────────────────────

tradesRoutes.post(
  '/analyze',
  authMiddleware,
  rateLimit(10, 60_000), // 10 requests per minute per user
  async (c) => {
    const anthropicKey = c.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return c.json({ error: 'Trade analysis is not configured. Missing API key.' }, 503);
    }

    let body: AnalyzeTradeBody;
    try {
      body = await c.req.json<AnalyzeTradeBody>();
    } catch {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    // Validate
    if (!body.teams || !Array.isArray(body.teams) || body.teams.length < 2 || body.teams.length > 4) {
      return c.json({ error: 'Trade must involve 2-4 teams' }, 400);
    }

    for (const team of body.teams) {
      if (!team.sends || !Array.isArray(team.sends) || team.sends.length === 0) {
        return c.json({ error: `Each team must send at least one asset` }, 400);
      }
      if (team.sends.length > 10) {
        return c.json({ error: 'Maximum 10 assets per team' }, 400);
      }
    }

    if (!['redraft', 'dynasty', 'keeper'].includes(body.leagueType)) {
      return c.json({ error: 'Invalid league type' }, 400);
    }

    // Truncate context to prevent prompt injection abuse
    const userContext = body.context ? body.context.slice(0, 1000) : '';

    const tradeDescription = buildTradeDescription(body);
    const systemPrompt = buildSystemPrompt(body);

    const userMessage = `Analyze this ${body.teams.length}-team fantasy football trade:

${tradeDescription}${userContext ? `\n\nAdditional context from the user:\n${userContext}` : ''}

Provide your analysis as JSON.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Anthropic API error:', res.status, errText);
        return c.json({ error: 'AI analysis failed. Please try again later.' }, 502);
      }

      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };

      const textBlock = data.content?.find((b) => b.type === 'text');
      const rawText = textBlock?.text?.trim();
      if (!rawText) {
        return c.json({ error: 'AI returned an empty response. Please try again.' }, 502);
      }

      // Parse JSON (handle potential markdown wrapping)
      const jsonStr = rawText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      let parsed: TradeAnalysisResult;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse AI response:', rawText.slice(0, 500));
        return c.json({ error: 'AI returned an invalid response. Please try again.' }, 502);
      }

      // Validate shape
      if (
        !parsed.winner ||
        !parsed.winnerExplanation ||
        !Array.isArray(parsed.teamGrades) ||
        parsed.teamGrades.length !== body.teams.length
      ) {
        console.error('AI response missing fields:', JSON.stringify(parsed).slice(0, 500));
        return c.json({ error: 'AI returned an incomplete response. Please try again.' }, 502);
      }

      return c.json(parsed);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return c.json({ error: 'Analysis timed out. Please try again.' }, 504);
      }
      console.error('Trade analysis error:', err);
      return c.json({ error: 'An unexpected error occurred during analysis.' }, 500);
    }
  }
);

export { tradesRoutes };
