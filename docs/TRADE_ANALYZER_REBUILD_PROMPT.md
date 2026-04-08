# Trade Analyzer Major Upgrade — FilmRoomFantasy

## Project

FilmRoomFantasy.com — fantasy football platform. Stack: React + Vite + TS
frontend (`src/`), Hono on Cloudflare Workers + D1 + Drizzle ORM backend
(`server/src/`). Sleeper API for league sync, The Odds API for Vegas data,
Claude Sonnet 4 for AI analysis. JWT auth via httpOnly cookies. Existing Trade
Analyzer lives at `src/components/TradeAnalyzerView.tsx` and
`server/src/routes/trades.ts` — already functional with Claude integration,
player stat enrichment, tier-based rate limiting.

Before coding anything, read the existing code in
`src/components/TradeAnalyzerView.tsx`, `server/src/routes/trades.ts`,
`server/src/db/schema.ts`, `server/src/index.ts`,
`src/context/LeaguesContext.tsx`, and a couple of existing route files
(`server/src/routes/leagues.ts`, `server/src/routes/players.ts`) to understand
existing patterns — naming, auth middleware usage, response shapes, UI
primitives in `src/components/ui/`. Follow existing patterns. Do not introduce
new libraries without asking.

## Core design principle: AI-first, NOT deterministic

Every other trade analyzer on the market uses formulas: "dynasty age penalty =
20% for RBs over 30", "playoff schedule boost = 5% in weeks 13+", etc. Every
rule creates edge cases the rule gets wrong. Do not do this. The whole point
of this rebuild is to beat the competition by leveraging Claude's judgment
instead of hard-coding rules.

**The division of labor is strict:**

- The server gathers **facts**, never judgments. Projections, recent volume,
  Vegas lines (team implied totals from `gameOdds`, player props from
  `playerProps`), upcoming schedule, injury status, the user's team
  record/standing/roster — clean structured data, all pulled from tables that
  already exist in D1. No valuation scores. No weights. No "dynasty adjust"
  multipliers.
- Claude does **all** the weighting. Given the facts, Claude decides whether
  playoff schedule matters (depends on whether the user is actually
  contending), how much age matters (depends on Win-Now vs Rebuild), whether a
  bye week is relevant (almost never for ROS value), whether an injury changes
  things (depends on roster depth and contention window).
- The fairness score is a Claude **output**, not a pre-computed number.
  Produced in the same structured JSON response as the letter grade so they're
  coherent by construction.

### Edge cases the AI-first approach must handle naturally

Prompt the AI to reason about them, don't hard-code them:

- **Offseason** — no weekly projections exist. Fall back to season totals /
  last-season stats; tag data absence in the facts block; let Claude
  explicitly acknowledge the uncertainty rather than invent numbers.
- **Bye weeks** — should barely move ROS value for stars.
- **Short-term injuries** — impact depends on the user's roster depth and
  contention window.
- **Playoff schedule (weeks 15–17)** — matters only if the user is actually in
  playoff contention. A 2-8 rebuilder trading for "playoff schedule" should
  have the AI call out that playoff schedule is irrelevant for them. A 7-3
  Win-Now team should get heavy weighting.
- **Stated strategy vs reality** — if a self-described "Win Now" team is 2-8,
  the AI should call that out and weight accordingly.
- **League settings matter** — a mid-tier QB in a 1-QB league is a bench
  piece; in superflex it's a starter. TE-premium makes TEs significantly more
  valuable. Scoring format (PPR/half/standard) affects receivers vs runners.

## Features to build (in order)

### Feature 1 — Improved analyzer logic

**Trade context module** (`server/src/services/tradeContext.ts`) — one async
function that takes a list of player IDs + league settings and returns a
structured `TradeContext` object containing per-player facts: identity (age,
yearsExp, status, injury, depth chart), recentVolume (last 4 games played,
with dataSource tag), projection (ROS + next-week, with source tag),
marketSignal (team implied total for next game, player props, team season win
total), schedule (next four weeks + weeks 15–17 with opponent + implied
totals). Every field nullable — the AI reads absence as information. Also
returns `userContext` when a connected league is selected: team record,
standing (rank, gamesBack), and full roster by position. No scores. No
weights. Pure facts.

**Analyzer backend upgrade** (`server/src/routes/trades.ts`) — extend the
request body with `leagueSettings` (scoringFormat, superflex, tePremium,
teamCount, rosterSlots), `connectedLeagueId`, `userTeamId`,
`conversationHistory`, `followUpQuestion`. Inject the `TradeContext` into the
Claude system prompt as ground truth. Extend the Claude JSON response schema
with `fairnessScore: {score: 0-100, diff, favored}`, `improvements: string[]`,
`keyFactors: string[]` (AI shows its work — which factors it weighted and
why). Add a follow-up path that reuses conversation history with a lighter
prompt. Make the system prompt explicit about the AI-first philosophy: "Do
NOT apply rigid rules. Judgment is context-dependent."

**Roster endpoint** (`server/src/routes/rosters.ts`) —
`GET /api/rosters/:leagueId/mine` and `GET /api/rosters/:leagueId/all`. DB
reads over `teams` + `rosterSpots` + `nflPlayers`. Auth required.

**Frontend additions to `TradeAnalyzerView.tsx`** — keep existing League
Format + Team Strategy toggles and their styling untouched. Add above them: a
League selector dropdown (fed by `useLeaguesContext()`, persists to
localStorage, options are connected leagues + "Custom Scenario"). Add below: a
collapsible "Advanced Settings" block (scoring format, superflex, TE premium,
team count, roster slot counts). Add a collapsible "My Roster" section that
auto-fills from `/api/rosters/:id/mine`, grouped by position, starters
highlighted. Add to the results view: a fairness score meter (0–100
horizontal bar with 50 midpoint), an improvements bullet list, a collapsible
"Key Factors Considered" section, a follow-up chat input (Pro/Elite gated).

### Feature 3 — Historical trade tracking (via Sleeper auto-ingest)

**Moved ahead of Feature 2** because auto-ingest is mostly plumbing and
unlocks a huge UX win immediately.

The `trades` and `tradeItems` tables already exist in
`server/src/db/schema.ts` (lines ~335-354) but are not written to by any
current code (verify this — only admin cleanup touches them). Reuse them. Add
columns via migration: `source ('sleeper'|'yahoo'|'espn'|'manual')`,
`external_id`, `executed_at`, `season_year`, `week_executed`,
`ai_fairness_score`, `ai_grade`, `ai_analysis_json`, `ai_graded_at`,
`trade_context_snapshot_json`. Unique index on `(league_id, source,
external_id)`.

**`tradeIngest.ts` service** — `ingestSleeperTrades(db, leagueId)` calls
Sleeper `/league/:externalId/transactions/:week` for all weeks, filters
`type === 'trade'`, idempotently upserts into `trades` + `trade_items`, maps
Sleeper user IDs → internal `teams.id` via `teams.externalOwnerId`, maps
Sleeper player IDs → `nflPlayers.id` via `nflPlayers.externalId`. Hook this
into the existing Sleeper league sync flow in `server/src/routes/leagues.ts`
so it runs on every sync. Also: `reconstructRosterAt(teamId, asOfTimestamp)`
— walks current roster + transactions backward to rebuild the user's roster
as of any date (needed for retroactive grading).

**`tradeOutcomes.ts` service** — `computeOutcome(tradeId)` sums weekly points
for players sent vs received from `playerWeeklyStats` starting at
`executedAt`. `computeRecordImpact(leagueId, userId)` rebuilds each weekly
matchup with the user's hypothetical "never traded" lineup and compares to
actual results from `matchups`. Pure SQL + in-memory math, no AI — cheap
enough to run on every history page load.

**`tradeHistory.ts` routes** (`/api/trades/history`) — `GET /?leagueId=` lists
ingested trades with outcomes joined (free tier). `POST /:id/grade` runs AI
retroactive grading (Pro limited, Elite unlimited). `POST /grade-all` (Elite
only). `GET /:leagueId/record-impact` (free). `POST /manual` and
`DELETE /:id` for manually-logged trades.

**`TradeHistoryView.tsx`** — new tab. Season summary card at top (actual vs
hypothetical record, total point differential, headline "flipped X losses
into wins"). Week-by-week record impact chart (use whatever chart lib is
already in `package.json`; no new deps). Trade history table with
sortable/filterable columns. Expandable rows for full detail. "Grade this
trade" button per row (Pro/Elite).

**Retroactive AI grading nuance:** projections at trade-time are gone
(Sleeper doesn't serve historical ones). Use current projections, reconstruct
roster at trade-time via `reconstructRosterAt`, and in the system prompt
explicitly tell Claude this is retroactive and that projections reflect
current knowledge, not what was known at the time. The AI reasons about the
information asymmetry better than a formula would.

### Feature 2 — Trade Finder & Recommender

**`candidateFilter.ts`** — lightweight heuristic scorer, never user-facing.
Cuts hundreds of possible trade permutations down to ~10 that Claude actually
analyzes. Honest naming — it's a pre-filter, not a value.

**`tradeFinder.ts`** — fetches all rosters in a league, identifies
surplus/need per team using `TradeContext` facts, generates asset combinations
(1-for-1, 2-for-1, 2-for-2, picks-for-players in dynasty), scores candidates
with `candidateFilter`, runs Claude analysis on top ~10 in parallel. Team
Needs Dashboard is AI-generated too, not hard-coded A-F grades — Claude reads
the full roster and outputs `{window, positionGrades, topNeeds,
topStrengths}`. Cache results per `(leagueId, userId, filters)` for 10
minutes via `caches.default`.

**`tradeFinder.ts` routes** (`/api/trade-finder`) — `POST /needs`,
`POST /recommendations`. Pro/Elite only.

**`TradeFinderView.tsx`** — new tab. Team Needs Dashboard at top. Ranked
recommendations list with "Send to Analyzer" button that pre-fills the main
analyzer. Filters for position + partner team.

### Shell refactor (comes with F2/F3)

Extract tabs into `src/components/TradeAnalyzerShell.tsx` that hosts the
shared league selector + advanced settings + tab bar (Analyzer / Finder /
History) and passes state via a new `src/context/TradeAnalyzerContext.tsx`.
The existing `TradeAnalyzerView` becomes just the "Analyzer" tab's content.

## Tier gating

| Feature | Free | Pro | Elite |
|---|---|---|---|
| Basic analyzer + fairness score + improvements + key factors | ✓ (1/week anon, 1/day auth) | ✓ (5/day) | ✓ |
| League sync dropdown | ✓ | ✓ | ✓ |
| My Roster auto-fill | ✓ | ✓ | ✓ |
| Auto-ingested trade history (raw + outcomes + record impact) | ✓ | ✓ | ✓ |
| Follow-up questions | — | ✓ | ✓ |
| AI retroactive grading of historical trades | — | ✓ (limited) | ✓ (unlimited + batch) |
| Trade Finder | — | ✓ | ✓ |

**Rule:** DB reads and pure computation are free. Anything that costs a Claude
call is gated. Enforced server-side matching the existing `TRADE_LIMITS`
pattern at `server/src/routes/trades.ts:46`.

## Technical rules

- TypeScript strict, no `any`.
- Existing patterns: Hono routes return Drizzle query results;
  `authMiddleware` / `optionalAuthMiddleware` from
  `server/src/middleware/auth.ts`; `rateLimit` middleware for expensive
  endpoints; frontend uses the `api` wrapper from `src/services/api.ts`.
- Reuse `sanitizePromptInput` from `trades.ts` for any new user-supplied
  strings going to Claude.
- Existing Anthropic fetch pattern at `server/src/routes/trades.ts:~711` —
  clone that for any new Claude calls.
- All mobile-responsive; test at 375px width.
- Commit per feature with descriptive messages. Do not bundle unrelated
  changes.
- Verify with `cd server && npx tsc --noEmit` after each feature — zero new
  errors.

## Start by

1. Reading the key existing files listed at the top.
2. Checking `package.json` and running `npm install` if `node_modules` is
   stale — the repo may need a fresh install.
3. Entering plan mode and presenting your plan for **Feature 1 first** (not
   all three at once — the plan itself should describe all three, but focus
   detail on F1 which is the foundation).
