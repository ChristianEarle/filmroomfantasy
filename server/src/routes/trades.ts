import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';
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

// ── Player Data Enrichment ────────────────────────────────────────────

interface EnrichedPlayerData {
  name: string;
  position: string;
  nflTeam: string;
  age: number | null;
  yearsExp: number | null;
  status: string;
  injuryNote: string | null;
  injuryBodyPart: string | null;
  depthChartOrder: number | null;
  byeWeek: number | null;
  seasonStats: {
    gamesPlayed: number;
    fantasyPointsPPR: number;
    avgPointsPPR: number;
    passYards: number;
    passTDs: number;
    passInterceptions: number;
    rushYards: number;
    rushTDs: number;
    targets: number;
    receptions: number;
    receivingYards: number;
    receivingTDs: number;
    avgSnapPct: number | null;
  } | null;
  recentWeeks: {
    week: number;
    pointsPPR: number;
    opponent: string | null;
  }[];
  projection: {
    projectedPoints: number;
    weekRank: number | null;
    positionRank: number | null;
  } | null;
  recentNews: {
    headline: string;
    aiSummary: string | null;
    impactLevel: string | null;
  }[];
}

async function fetchPlayerData(
  db: ReturnType<typeof import('drizzle-orm/d1').drizzle>,
  playerNames: string[]
): Promise<Map<string, EnrichedPlayerData>> {
  if (playerNames.length === 0) return new Map();

  // Find players by name (case-insensitive match)
  const allPlayers = await db.query.nflPlayers.findMany({
    columns: {
      id: true, name: true, position: true, team: true, age: true,
      yearsExp: true, status: true, injuryNote: true, injuryBodyPart: true,
      depthChartOrder: true, byeWeek: true,
    },
  });

  // Match by lowercase name
  const nameToLower = new Map(playerNames.map((n) => [n.toLowerCase(), n]));
  const matchedPlayers = allPlayers.filter((p) => nameToLower.has(p.name.toLowerCase()));

  if (matchedPlayers.length === 0) return new Map();

  const playerIds = matchedPlayers.map((p) => p.id);
  const currentYear = new Date().getFullYear();

  // Fetch all enrichment data in parallel
  const [weeklyStats, projections, news] = await Promise.all([
    // Season weekly stats (current year)
    db.query.playerWeeklyStats.findMany({
      where: and(
        inArray(schema.playerWeeklyStats.playerId, playerIds),
        eq(schema.playerWeeklyStats.seasonYear, currentYear),
      ),
      orderBy: [desc(schema.playerWeeklyStats.week)],
    }),

    // Current projections (latest week available)
    db.query.playerProjections.findMany({
      where: and(
        inArray(schema.playerProjections.playerId, playerIds),
        eq(schema.playerProjections.seasonYear, currentYear),
        eq(schema.playerProjections.scoringFormat, 'ppr'),
      ),
      orderBy: [desc(schema.playerProjections.week)],
    }),

    // Recent news (last 3 per player)
    db.query.playerNews.findMany({
      where: inArray(schema.playerNews.playerId, playerIds),
      orderBy: [desc(schema.playerNews.publishedAt)],
      limit: playerIds.length * 3,
    }),
  ]);

  // Group data by player ID
  const statsByPlayer = new Map<string, typeof weeklyStats>();
  for (const s of weeklyStats) {
    const list = statsByPlayer.get(s.playerId) || [];
    list.push(s);
    statsByPlayer.set(s.playerId, list);
  }

  const projByPlayer = new Map<string, typeof projections[0]>();
  for (const p of projections) {
    // Keep only the latest week's projection per player
    if (!projByPlayer.has(p.playerId)) {
      projByPlayer.set(p.playerId, p);
    }
  }

  const newsByPlayer = new Map<string, typeof news>();
  for (const n of news) {
    const list = newsByPlayer.get(n.playerId) || [];
    if (list.length < 3) list.push(n);
    newsByPlayer.set(n.playerId, list);
  }

  // Build enriched data
  const result = new Map<string, EnrichedPlayerData>();

  for (const player of matchedPlayers) {
    const stats = statsByPlayer.get(player.id) || [];
    const proj = projByPlayer.get(player.id);
    const playerNews = newsByPlayer.get(player.id) || [];

    // Compute season aggregates
    let seasonStats: EnrichedPlayerData['seasonStats'] = null;
    if (stats.length > 0) {
      // Filter to games actually played
      const played = stats.filter((s) => {
        if (player.position === 'DEF') return true;
        const off = (s.offSnaps ?? 0) as number;
        const hasActivity =
          ((s.passAttempts ?? 0) as number) > 0 ||
          ((s.rushAttempts ?? 0) as number) > 0 ||
          ((s.receptions ?? 0) as number) > 0 ||
          ((s.targets ?? 0) as number) > 0;
        return off > 0 || hasActivity;
      });

      const gamesPlayed = played.length;
      if (gamesPlayed > 0) {
        const totalPPR = played.reduce((sum, s) => sum + ((s.fantasyPointsPPR ?? 0) as number), 0);
        const totalPassYards = played.reduce((sum, s) => sum + ((s.passYards ?? 0) as number), 0);
        const totalPassTDs = played.reduce((sum, s) => sum + ((s.passTDs ?? 0) as number), 0);
        const totalINTs = played.reduce((sum, s) => sum + ((s.passInterceptions ?? 0) as number), 0);
        const totalRushYards = played.reduce((sum, s) => sum + ((s.rushYards ?? 0) as number), 0);
        const totalRushTDs = played.reduce((sum, s) => sum + ((s.rushTDs ?? 0) as number), 0);
        const totalTargets = played.reduce((sum, s) => sum + ((s.targets ?? 0) as number), 0);
        const totalReceptions = played.reduce((sum, s) => sum + ((s.receptions ?? 0) as number), 0);
        const totalRecYards = played.reduce((sum, s) => sum + ((s.receivingYards ?? 0) as number), 0);
        const totalRecTDs = played.reduce((sum, s) => sum + ((s.receivingTDs ?? 0) as number), 0);

        // Average snap percentage
        let snapPctSum = 0;
        let snapPctCount = 0;
        for (const s of played) {
          const off = (s.offSnaps ?? 0) as number;
          const tmOff = (s.tmOffSnaps ?? 0) as number;
          if (off > 0 && tmOff > 0) {
            snapPctSum += (off / tmOff) * 100;
            snapPctCount++;
          }
        }

        seasonStats = {
          gamesPlayed,
          fantasyPointsPPR: Math.round(totalPPR * 10) / 10,
          avgPointsPPR: Math.round((totalPPR / gamesPlayed) * 10) / 10,
          passYards: Math.round(totalPassYards),
          passTDs: totalPassTDs,
          passInterceptions: totalINTs,
          rushYards: Math.round(totalRushYards),
          rushTDs: totalRushTDs,
          targets: totalTargets,
          receptions: totalReceptions,
          receivingYards: Math.round(totalRecYards),
          receivingTDs: totalRecTDs,
          avgSnapPct: snapPctCount > 0 ? Math.round((snapPctSum / snapPctCount) * 10) / 10 : null,
        };
      }
    }

    // Last 3 weeks of scores for trend
    const recentWeeks = stats.slice(0, 3).map((s) => ({
      week: s.week,
      pointsPPR: Math.round(((s.fantasyPointsPPR ?? 0) as number) * 10) / 10,
      opponent: s.opponent,
    }));

    result.set(player.name.toLowerCase(), {
      name: player.name,
      position: player.position,
      nflTeam: player.team,
      age: player.age,
      yearsExp: player.yearsExp,
      status: player.status,
      injuryNote: player.injuryNote,
      injuryBodyPart: player.injuryBodyPart,
      depthChartOrder: player.depthChartOrder,
      byeWeek: player.byeWeek,
      seasonStats,
      recentWeeks,
      projection: proj
        ? {
            projectedPoints: (proj.projectedPoints ?? 0) as number,
            weekRank: proj.weekRank,
            positionRank: proj.positionRank,
          }
        : null,
      recentNews: playerNews.map((n) => ({
        headline: n.headline,
        aiSummary: n.aiSummary,
        impactLevel: n.impactLevel,
      })),
    });
  }

  return result;
}

function formatPlayerDataBlock(data: EnrichedPlayerData): string {
  const lines: string[] = [];

  lines.push(`**${data.name}** (${data.position}, ${data.nflTeam})`);

  // Bio
  const bioDetails: string[] = [];
  if (data.age) bioDetails.push(`Age: ${data.age}`);
  if (data.yearsExp != null) bioDetails.push(`Experience: ${data.yearsExp} years`);
  if (data.depthChartOrder) bioDetails.push(`Depth chart: #${data.depthChartOrder}`);
  if (data.byeWeek) bioDetails.push(`Bye: Week ${data.byeWeek}`);
  if (bioDetails.length > 0) lines.push(bioDetails.join(' | '));

  // Injury status
  if (data.status !== 'active') {
    const injury = [data.status.toUpperCase()];
    if (data.injuryBodyPart) injury.push(data.injuryBodyPart);
    if (data.injuryNote) injury.push(`- ${data.injuryNote}`);
    lines.push(`Injury: ${injury.join(' ')}`);
  }

  // Season stats
  if (data.seasonStats) {
    const s = data.seasonStats;
    lines.push(`Season (${s.gamesPlayed} games): ${s.fantasyPointsPPR} total PPR pts, ${s.avgPointsPPR} PPR pts/game`);

    if (data.position === 'QB') {
      lines.push(`  Passing: ${s.passYards} yds, ${s.passTDs} TD, ${s.passInterceptions} INT | Rushing: ${s.rushYards} yds, ${s.rushTDs} TD`);
    } else if (data.position === 'RB') {
      lines.push(`  Rushing: ${s.rushYards} yds, ${s.rushTDs} TD | Receiving: ${s.receptions} rec/${s.targets} tgt, ${s.receivingYards} yds, ${s.receivingTDs} TD`);
    } else if (data.position === 'WR' || data.position === 'TE') {
      lines.push(`  Receiving: ${s.receptions} rec/${s.targets} tgt, ${s.receivingYards} yds, ${s.receivingTDs} TD | Rushing: ${s.rushYards} yds, ${s.rushTDs} TD`);
    }

    if (s.avgSnapPct != null) {
      lines.push(`  Snap %: ${s.avgSnapPct}% avg`);
    }
  }

  // Recent performance trend
  if (data.recentWeeks.length > 0) {
    const weekStrs = data.recentWeeks.map(
      (w) => `Wk${w.week}: ${w.pointsPPR}pts${w.opponent ? ` vs ${w.opponent}` : ''}`
    );
    lines.push(`Recent: ${weekStrs.join(', ')}`);
  }

  // Projection
  if (data.projection) {
    const p = data.projection;
    let projStr = `Next week projection: ${p.projectedPoints} PPR pts`;
    if (p.positionRank) projStr += ` (${data.position}${p.positionRank})`;
    if (p.weekRank) projStr += ` | Overall #${p.weekRank}`;
    lines.push(projStr);
  }

  // Recent news
  if (data.recentNews.length > 0) {
    lines.push('Recent news:');
    for (const n of data.recentNews) {
      const impact = n.impactLevel ? `[${n.impactLevel.toUpperCase()}]` : '';
      const text = n.aiSummary || n.headline;
      lines.push(`  ${impact} ${text}`);
    }
  }

  return lines.join('\n');
}

// ── Trade Description ─────────────────────────────────────────────────

function buildTradeDescription(
  body: AnalyzeTradeBody,
  playerData: Map<string, EnrichedPlayerData>
): string {
  const isMultiTeam = body.teams.length > 2;

  const teamDescriptions = body.teams.map((t) => {
    if (isMultiTeam) {
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

  let description = teamDescriptions.join('\n');

  // Add enriched player data section
  const allPlayerAssets = body.teams.flatMap((t) =>
    t.sends.filter((a) => a.type === 'player')
  );
  const enrichedBlocks: string[] = [];
  const seen = new Set<string>();

  for (const asset of allPlayerAssets) {
    const key = asset.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const data = playerData.get(key);
    if (data) {
      enrichedBlocks.push(formatPlayerDataBlock(data));
    }
  }

  if (enrichedBlocks.length > 0) {
    description += '\n\n--- CURRENT PLAYER DATA (from our database) ---\n\n';
    description += enrichedBlocks.join('\n\n');
  }

  return description;
}

// ── System Prompt ─────────────────────────────────────────────────────

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

You will be provided with CURRENT PLAYER DATA pulled from our live database. This data is authoritative and up-to-date — use it as the primary basis for your analysis. It includes:
- Season stats, fantasy points per game, and snap percentages
- Injury status and injury details
- Age, experience, and depth chart position
- Recent weekly performance (last 3 games)
- Next week's projected fantasy points and positional rank
- Recent news with AI-tagged impact level (HIGH/MEDIUM/LOW)

When evaluating trades you MUST consider:
- The provided stats and performance data as ground truth for current value
- Injury status and its impact on short-term and long-term outlook
- Age and years of experience (especially important for dynasty/keeper)
- Snap percentage trends as indicators of workload and opportunity
- Recent weekly scores to identify hot/cold streaks and trajectory
- Projected points and positional rankings for upcoming value
- Recent news items and their impact levels
- Positional scarcity and replacement-level value
- Draft pick value based on round and year (future picks are inherently uncertain)

League format: ${leagueLabel}${strategyNote}

You must respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "winner": "Team name that wins the trade",
  "winnerExplanation": "2-3 sentence explanation of why this team wins the trade overall",
  "teamGrades": [
    {
      "team": "Team label",
      "grade": "Letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F)",
      "summary": "2-3 sentence analysis of what this team gains/loses and why they got this grade. Reference specific stats, projections, and data points."
    }
  ]
}

Rules:
- teamGrades MUST have one entry for EACH team in the trade
- Grades should be realistic — not every trade is great for everyone
- The winner field must match one of the team labels exactly
- Reference actual stats, points per game, snap %, injury status, and projections from the provided data
- If a player has a concerning injury or trend, call it out specifically
- If draft picks are involved, assess their value relative to the players being traded`;
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
        return c.json({ error: 'Each team must send at least one asset' }, 400);
      }
      if (team.sends.length > 10) {
        return c.json({ error: 'Maximum 10 assets per team' }, 400);
      }
    }

    if (!['redraft', 'dynasty', 'keeper'].includes(body.leagueType)) {
      return c.json({ error: 'Invalid league type' }, 400);
    }

    // Collect all player names from the trade
    const playerNames = body.teams
      .flatMap((t) => t.sends)
      .filter((a) => a.type === 'player')
      .map((a) => a.name);

    // Fetch enriched player data from DB
    const db = c.get('db');
    let playerData = new Map<string, EnrichedPlayerData>();
    try {
      playerData = await fetchPlayerData(db as any, playerNames);
    } catch (err) {
      console.error('Failed to fetch player data for trade analysis:', err);
      // Continue without enrichment — AI will fall back to training data
    }

    // Truncate context to prevent prompt injection abuse
    const userContext = body.context ? body.context.slice(0, 1000) : '';

    const tradeDescription = buildTradeDescription(body, playerData);
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
