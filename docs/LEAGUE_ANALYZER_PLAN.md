# League Analyzer — Plan & Ideas

> Status: planning. Sidebar nav already exists as a "Coming Soon" placeholder
> (`Sidebar.tsx`: `{ label: 'League Analyzer', view: 'LeagueAnalyzer', comingSoon: true }`)
> and the `LeagueAnalyzer` view is already in the `activeView` union in `App.tsx`.

## 1. Vision

A single top-level page that audits the **whole league at a glance** — not just
the user's team. It answers the questions every manager actually asks:

- "Who's actually the strongest team, regardless of record?"
- "Where am I strong/weak vs. everyone else?"
- "Who should I be trading with, and what do they want?"
- "Who's a paper tiger (lucky record) and who's a sleeping giant?"
- "What are my real championship odds?"

The differentiator vs. Sleeper/ESPN/Yahoo is the **AI narrative layer** on top
of deterministic math: power rankings you can *argue with*, and a scout's report
for every team.

## 2. Data foundation — what we already have (huge reuse)

This feature is mostly **assembly**, not new infrastructure. The hard parts exist:

| Need | Existing piece | Location |
|------|----------------|----------|
| Per-player ROS value + tier | `valuePlayer()` → `finalValue`, `PlayerTier` | `server/src/services/playerValuation.ts` |
| Per-team roster construction (needs/surplus/roles) | `buildTeamComposition()` → `TeamComposition` | `server/src/services/teamComposition.ts` |
| Whole-league snapshot (all teams × players) | `LeagueContextSnapshot` + `formatLeagueContextForConstructor()` | `server/src/services/leagueContextFormatter.ts` |
| Championship / playoff odds | `runMonteCarloSimulation()` (10k sims) | `src/components/PlayoffPredictorView.tsx` |
| AI calls (Anthropic) | fetch pattern, sonnet/haiku models | `server/src/routes/trades.ts`, `server/src/services/ai.ts` |
| Standings / records / schedule | `/api/leagues/:id/standings`, matchups | `server/src/routes/leagues.ts`, `matchups.ts` |
| Pro/Elite gating | `user.subscriptionTier` | `TradeAnalyzerView.tsx`, `UpgradeModal.tsx` |

The Monte Carlo engine currently lives inside `PlayoffPredictorView`. **Action:**
extract it to `src/utils/monteCarlo.ts` (or `server/src/services/`) so both the
Playoff Predictor and League Analyzer share one implementation.

## 3. Core features (MVP)

### 3.1 Team Strength Score & Power Rankings
A deterministic strength score per team so rankings are explainable and instant:

```
strength = Σ(starter finalValue)
         + 0.4 · Σ(bench/depth finalValue)      // depth matters less
         + positionalBalanceBonus                // penalize holes, reward no-weak-spots
         − injuryDrag                            // active-roster injury load
```

- Rank all teams 1..N by strength.
- Show **rank vs. record divergence** (e.g. "#2 strength but 7th in standings"
  = unlucky / sleeping giant).
- **Week-over-week movement arrows** (▲3 / ▼1) — store a weekly snapshot so we
  can show trend (see §6 persistence).

### 3.2 AI Power Rankings (the headline feature)
Feed the deterministic ranking + `LeagueContextSnapshot` to Claude and ask it to
**re-rank with a one-line justification per team**. The deterministic score is
the "starting point, not ground truth" (same philosophy as the trade
constructor). Output: ranked list with a punchy blurb each — "Loaded at RB but
one Mahomes injury from collapse."

### 3.3 AI Team Scouting Report (per team)
Click any team → AI-generated scout card:
- **Biggest strength** / **Biggest hole**
- **Most likely to fall off** (age, injury risk, unsustainable usage)
- **Best trade-target fit** (cross-reference their `needs` with others' `surplus`)
- **Outlook** (1–2 sentence ROS narrative)

Reuses `TeamComposition.needs` / `surplusPlayerIds` so the AI reasons over real
structure, not raw rosters.

### 3.4 Championship Odds
Monte Carlo → playoff %, bye %, title % per team, shown inline in the table.
Pure reuse of the extracted simulator.

### 3.5 Positional Heatmap (teams × positions grid)
A color-graded matrix: rows = teams, columns = QB/RB/WR/TE/FLEX (+ K/DST).
Cell color = positional strength tier. Instantly shows the whole league's
positional landscape — who's RB-rich, who's QB-desperate. This is the single
most "screenshot-and-share" view and drives trade activity.

## 4. AI features (deeper)

- **League Scout (free-text Q&A)** — reuse `AiChatModal` pattern, scoped to the
  league snapshot. "Who should I trade with for a WR?" / "Is the #1 team
  beatable?"
- **Weekly AI Power Poll recap** — a commissioner-style narrative ("Week 7:
  The Juggernaut stumbles, the basement stirs..."). Could post to Home feed.
- **Rivalry / matchup previews** — for the user's upcoming opponent, an AI edge
  breakdown by position.
- **Trade market map** — deterministic pass that pairs each team's `needs` with
  others' `surplus`, then an AI layer suggests the 3 most realistic league-wide
  trades.

## 5. Cool views / stretch ideas

- **Luck Index** — points-for rank vs. wins rank. Surfaces who's overperforming
  their roster ("3–4 but 2nd in scoring = buy-low panic-seller incoming").
- **Strength of Schedule (ROS)** — sum opponent strength for remaining weeks;
  flag the easiest/hardest road to the playoffs.
- **Draft Report Card** — if we have draft data, grade each team's draft vs.
  current value (where did value come from — draft, waivers, trades?).
- **"If the season ended today" bracket** — playoff bracket preview wired to
  current standings + Monte Carlo seeds.
- **Trophy case / superlatives** — Best Roster, Most Boom/Bust, Deepest Bench,
  Glass Cannon, Best Bench (most points left on bench — needs lineup data).
- **Power ranking history chart** — line chart (recharts, already a dep) of each
  team's weekly power rank over the season.

## 6. Backend API design

New route `server/src/routes/leagueAnalysis.ts`, mounted at `/api/leagues/:id/analysis`:

```
GET  /api/leagues/:id/analysis
       → { teams: [{ id, name, record, strengthScore, powerRank,
                      rankMovement, oddsPlayoff, oddsTitle, luckIndex,
                      sosRemaining, composition: {strengths, needs} }],
           heatmap: { positions, cells } }
       (deterministic, fast, cacheable — no AI)

POST /api/leagues/:id/analysis/ai
       → { powerRankings: [{teamId, rank, blurb}],
           scoutReports: {teamId: {...}} }
       (AI, Pro/Elite gated, cached by league+week, rate-limited)

POST /api/leagues/:id/analysis/chat   (League Scout Q&A, Elite)
```

Notes:
- Cache the AI output keyed by `(leagueId, week)` — the snapshot only changes
  meaningfully week to week. Avoids re-billing Claude on every page load.
- Persist a **weekly strength snapshot** (new small table or reuse a JSON blob)
  to power movement arrows + history chart.
- Follow existing AI guardrails: return null/deterministic-only when
  `ANTHROPIC_API_KEY` is unset; reuse `rateLimit` middleware.

## 7. Frontend

- `src/components/LeagueAnalyzerView.tsx` — lazy-loaded like the others in
  `App.tsx`; flip `comingSoon: false` in `Sidebar.tsx`.
- `src/services/leagueAnalysis.ts` — client for the new endpoints.
- Layout: header (league name, week) → power-rankings table (sortable: strength /
  record / odds / luck) → positional heatmap → selected-team scout drawer.
- Deterministic data renders instantly; AI sections stream/lazy-load with a
  skeleton and a "Generate AI analysis" affordance for free users (gated → upgrade).

## 8. Monetization / gating

- **Free**: deterministic power rankings + record + basic standings.
- **Pro**: full strength scores, heatmap, championship odds, luck/SOS.
- **Elite**: AI power-ranking blurbs, per-team scout reports, League Scout chat.

(Mirrors the existing TradeAnalyzer tiering.)

## 9. Phased build plan

**Phase 1 — Deterministic core (no AI)**
1. Extract Monte Carlo to a shared module.
2. `leagueAnalysis.ts` route: strength score, power rank, odds, luck, SOS, heatmap.
3. `LeagueAnalyzerView`: power-rankings table + heatmap. Un-stub the nav.

**Phase 2 — AI layer**
4. `/analysis/ai`: AI power-ranking blurbs + per-team scout reports (cached).
5. Wire scout drawer + AI blurbs into the view; Pro/Elite gating + upgrade modal.

**Phase 3 — Engagement extras**
6. Weekly strength-snapshot persistence → movement arrows + history chart.
7. Trade market map, Luck Index polish, superlatives, League Scout chat.

## 10. Open questions

- **Scope of "team strength"** — roster-only (ROS value) vs. blended with actual
  scoring/record? Recommend roster-only for v1 (record is shown separately; the
  *divergence* is the insight).
- **AI cost ceiling** — one batched call per league per week (all teams in one
  prompt) vs. per-team calls? Recommend one batched sonnet call (the snapshot
  formatter already targets ~10–15K tokens for a full league).
- **Lineup/bench data availability** — gates "points left on bench" superlatives.
- **Cross-platform parity** — confirm Sleeper/ESPN/MFL/Yahoo all populate the
  fields `buildTeamComposition` needs.
