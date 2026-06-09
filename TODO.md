# FilmRoom Fantasy — TODO

Every outstanding item from `BACKLOG.md`, re-prioritized end-to-end. Completed work and historical context live in `BACKLOG.md`; this file is what's left to finish.

Snapshot: 2026-05-20.

Priority tiers:
- **P0** — Launch blockers. Must ship before public.
- **P1** — Core feature gaps. Visible holes a user will hit.
- **P2** — Quality, polish, audits.
- **P3** — Feature expansion (AI surfaces, new pages, finder/rankings depth).
- **P4** — SEO follow-through (standalone player page is live; the rest of the org-search lever isn't).
- **P5** — Monetization infrastructure. Hard prereq for any paid feature.
- **P6** — Premium features and future / optional work.

---

## Current Focus

Active sprint — work these next, in roughly this order. Each links into the detailed entries below.

1. **AI systems foundation** — Ask AI chat assistant, AI post-game analysis, ROS rankings from AI, per-player AI take. (see P3 — AI Surfaces)
2. **Implement League Analyzer** — Real page replacing the "Coming Soon" placeholder. (see P3 — AI Surfaces)
3. **Fix draft rankings** — ✅ Mostly shipped: removed the fabricated `Math.sin`-derived columns/panels, fixed the misleading "moved today" header copy, sourced dynasty-rookie ADP from FantasyCalc, removed the ungenerated superflex toggle, wired four buttons (Export, Compare, Add to compare, Trade value), and added an admin Generate UI + `ranking-batch-jobs` endpoint. Remaining: wire the Ask AI + Watch buttons (backend) and the data-infrastructure items. (see P3 — Draft Rankings)
4. **Fix Trends page** — Page is broken / incomplete. Audit + add "Recent Best Performers" as a new tab alongside Roster Trends / Projection Movers / Odds Movement. (see P2 audit + new P3 item below)
5. **Polish Game Slate + GameDetailModal** — Audit + visual polish pass. (see P2 audit)
6. **Polish standalone player page + Player modules** — PlayerCard, PlayerProfileView, PlayerAvatar, projection breakdown, FilmRoom Insights, quick actions. (see P1 player card + P2 audits)
7. **Consistent UI / design system pass** — Establish shared tokens (spacing, type, color, radius, shadow, focus, motion) and apply across every view. (see new P2 entry)

---

## P0 — Launch Blockers

- [ ] **Finish Google OAuth setup** — Obtain real Google OAuth Client ID from Google Cloud Console, set `GOOGLE_CLIENT_ID` in `server/.dev.vars` and `VITE_GOOGLE_CLIENT_ID` in `.env`, configure authorized origins/redirect URIs, run `wrangler secret put GOOGLE_CLIENT_ID` for production. Code is wired; only the credential is missing.
- [ ] **Mobile optimization** — Comprehensive pass: touch targets, table scrolling, modal sizing, bottom nav, responsive breakpoints across every view. Largest single user-experience risk for launch.

---

## P1 — Core Feature Gaps

### Player Card
- [ ] **Quick actions (Alert / Pin / Compare / Share)** — Re-add the four action buttons with real functionality. Were removed because they were non-functional stubs.
- [ ] **FilmRoom Insights working** — Wire up the FilmRoom Insights section on player cards to display real analysis data.
- [ ] **Projection breakdown working** — Real breakdown of projected points by stat category (pass yards, rush yards, receptions, TDs, etc.).
- [ ] **Matchup page insights working** — Re-add the FilmRoom Edge Analysis section on the Matchup page with real data-driven insights (position advantages, start/sit suggestions, injury alerts). Was removed because it was hardcoded fake content.

### Notifications
- [ ] **Working notifications** — Real push/in-app notifications for injuries, lineup locks, trade offers, waiver results. Bell icon already in header with "coming soon" tooltip; needs backend + delivery.

### Data & Rankings
- [ ] **Draft rankings** — Pre-draft player rankings with tiers, positional scarcity, ADP comparison. Sidebar nav item removed for beta — re-add `{ icon: Medal, label: 'Draft Rankings', view: 'DraftRankings' }` to `Sidebar.tsx` menuItems. Route and `ComingSoonView` still exist in `App.tsx`.
- [ ] **Season projections** — Full-season projected stats and fantasy point totals for all players, updated weekly.
- [ ] **Top waiver pickups from multiple platforms** — Source trending waiver pickups from Sleeper, ESPN, and Yahoo for better consensus recommendations.

---

## P2 — Quality, Polish, Audits

### Code audits — views
Each component: bugs, hardcoded/fake data, unused code, missing error handling, a11y (aria, keyboard nav), type safety, performance (memoization, key props), memory leaks.

- [ ] **TeamView** — Roster display, player cards, team stats
- [ ] **WaiversView** — Waiver claims, player search, bid management
- [ ] **GameSlateView + GameDetailModal** — NFL schedule, live scores, game detail overlay
- [ ] **TrendsView** — Roster trends, projection movers
- [ ] **AllPlayersView** — Full player list with filters, pagination
- [ ] **ProfileView** — User profile, password change, Google link status
- [ ] **LoginView + RegisterView + ForgotPasswordView** — Auth forms, rate limiting, Google OAuth
- [ ] **PlayerCard** — Player detail modal, game log, stats, matchup grade, projections

### Code audits — shared components
- [ ] **Sidebar** — Navigation, responsive collapse, active state
- [ ] **Header + LeagueManager** — Search bar, league switcher dropdown, notifications bell
- [ ] **PlayerAvatar** — Image loading, fallback initials
- [ ] **NewsPanel + NewsSnippet + BiggestMovers** — News feed, player movers widget
- [ ] **ErrorBoundary** — Error catch/display, recovery
- [ ] **App.tsx** — Routing, state management, context wiring, page transitions

### Polish
- [ ] **Consistent UI / design system pass** — Establish a shared token set and apply across every view before doing the per-page polish below. Tokens to nail down: spacing scale (4/8/12/16/24/32/48), type ramp (display / h1 / h2 / h3 / body / caption / mono), color tokens (surface tiers, border tiers, text primary/secondary/muted, semantic success/warning/error/info, accent), radius scale (sm/md/lg/pill), elevation/shadow tiers, focus-ring style, motion duration + easing presets. Codify in `src/styles/tokens.css` (CSS vars) + a Tailwind config mapping. Then sweep every component to remove ad-hoc spacing, ad-hoc grays, ad-hoc font sizes, and ad-hoc shadows. Specific consistency targets: card surfaces (background + border + radius identical across HomeView, Board, Matchup, Settings, Profile, TradeAnalyzer, DraftRankings, etc.), table chrome (header row, divider, hover, selected), button heights and padding, modal chrome, empty-state pattern, loading skeleton pattern, error-banner pattern. This is the foundation that makes the per-page polish below trivial.
- [ ] **Page-by-page polish pass** — After the design-system pass lands. Tighten loading states, empty states, error messages, micro-animations, hover states, focus rings, typography/spacing consistency. Audit each view for "feels finished vs. feels prototype" gaps across HomeView, Board, Matchup, GameSlate, Trends, AllPlayers, Team, Waivers, PlayoffPredictor, TradeAnalyzer, TradeHistory, TradeFinder, DraftRankings, Settings, Profile, LeagueAnalyzer (new), standalone player page.

---

## P3 — Trade Finder: API Cost & Rate-Limit Hardening — ❌ SCRAPPED

> **Scrapped + removed (2026-06):** The Trade Finder feature is abandoned. Dead code deleted: `TradeFinderView.tsx`, `server/src/routes/tradeFinder.ts`, `server/src/services/tradeFinder.ts`, `server/src/services/tradeConstructor.ts`, and the `/api/trade-finder` route registration. **Kept** (shared, NOT finder-only): `tradeAnalyzer` / `tradeContext` / `tradePlayerEnrichment` (Trade Analyzer), and `tradeIngest` / `tradeOutcomes` (league sync + Trade History). Leftover follow-up: the `team_scouting_reports` table + its `schema.ts` comment are now orphaned and could be dropped in a later migration. Items below retained for historical context only. (Distinct from the Trade **Analyzer**, which stays.)

Reduce Anthropic API pressure on `/trade-finder/recommendations` (currently 6–10 parallel Claude calls per cold request). Ordered by impact-vs-effort.

- [ ] **Enable Anthropic prompt caching on static system prompts** (~1h) — Biggest win, ~50-60% input token reduction. Add `cache_control: { type: 'ephemeral' }` to system prompt blocks in `tradeConstructor.ts` (`constructTrades`), `tradeAnalyzer.ts` (`analyzeTrade`), and `tradeFinder.ts` (`buildTeamNeeds`). Requires converting `system:` strings to content-block arrays.
- [ ] **Drop `maxRecommendations` from 8 to 5** (~5min) — `routes/tradeFinder.ts:354`. Cuts verification calls by 37%.
- [ ] **Split rate limits per trade-finder endpoint** (~10min) — `/needs` keeps 20/min, `/recommendations` drops to 5/min per user.
- [ ] **Persist verification results in `trade_verifications` table** (~2h) — Key by `(sortedSendIds + sortedReceiveIds + picksHash + leagueType + seasonYear + currentWeek)`. Look up the hash before calling `analyzeTrade`. Kills redundant grading across searches.
- [ ] **Share `LeagueContextSnapshot` across users in the same league** (~half day) — Cache in D1 or KV keyed by `(leagueId, latestSyncTimestamp)`. Saves ~50–100ms D1 per request and reduces multi-user load.
- [ ] **Lazy verification** (~half day) — Verify top 3 by deterministic `valueImbalancePct` first, stream them back. Lazy-verify next 5 only on "show more." Cuts verification calls ~60% for non-scrollers.
- [ ] **Move constructor to Haiku** (~30min + regression testing) — Constructor reasoning is simpler than verification. Test that Haiku follows ID-echo and packaging rules reliably. Keep Sonnet for the analyzer.
- [ ] **Cloudflare Queues for verification fan-out** (~1 day) — Move verification calls behind a queue with producer rate cap. Only needed at real scale.

---

## P3 — Trade Finder: Discovery Enhancements — ❌ SCRAPPED

> **Scrapped (2026-06):** Trade Finder is abandoned — see the note in the section above. Items below are historical only.

- [ ] **"Target a specific player" UI entry point** (~half day) — Collapsible panel in `TradeFinderView.tsx` with searchable combobox of every non-user player. Runs a single focused construction call for that exact player. Extend `RecommendationsBody` with `targetPlayerId`, thread through `findTradeRecommendations`, bump `CACHE_VERSION`.
- [ ] **Historical league-specific trade anchors** (~1 day) — `tradeIngest.ts` + `tradeOutcomes.ts` already ingest accepted trades into the `trades` table but finder never reads them. Pull 3 most recent accepted trades for the user's league and inject as calibration examples in the constructor prompt. Add `getRecentAcceptedTradesForLeague(leagueId, limit)` helper.
- [ ] **Per-target parallel fan-out discovery** (~1–2 days) — Scrapped in commits c638590/cfbe354 (reverted in ef13304) because the prompt was too aggressive about returning null. Retry once mega-call path is stable and prompt caching is enabled. Lessons: (a) per-target prompt needs encouraging framing not "null is valid"; (b) gate 4 must relax with required assets; (c) same ID-echo bug applies and must be fixed per call.
- [ ] **Expand matcher package shapes beyond 2-for-1** (~half day) — `tradeMatcher.ts` only builds 1-for-1, 2-for-1, 1-for-2. Extend `tryBuildPair()` for 2-for-2, 3-for-1, 3-for-2 with size cap (~5 per side). Deterministic, doesn't hit AI.
- [ ] **Follow-up conversation refinement for finder results** (~1 day) — Reuse the existing `/follow-up` endpoint from `TradeFinderView` so users can iterate ("show me cheaper options", "don't touch my RB1") without re-running the pipeline.
- [ ] **Empty-state diagnostic surface** (~2h) — When finder returns zero trades, expose stage counts (raw constructor output, validation drops, gate 4 drops) in response as a `diagnostics` field. Collapsible "Why no trades?" panel.
- [ ] **Manual refresh button for scouting report** (~30min) — Small refresh icon next to "Your Team Needs" heading in `TradeFinderView.tsx` that clears the saved row and triggers a fresh scout. Escape hatch after injury news or wrong assessment.

---

## P3 — Trade Analyzer: Draft Pick Inventory

Click-to-add real draft picks (with original-owner info) in the builder, instead of typing them via the year/round modal. Caveat: Sleeper/MFL don't expose exact pick slots mid-season — only year + round + original owner. UI should show `2026 1st (originally Team Y's)`.

- [ ] **Phase 1 — Sleeper MVP** (~400–500 LOC across schema + service + routes + UI):
  - New `team_draft_picks` table keyed on `(leagueId, draftYear, draftRound, originalOwnerId)` with mutating `ownerId` so pick chains collapse to current ownership. Columns: `id`, `leagueId`, `ownerId`, `originalOwnerId`, `draftYear`, `draftRound`, `acquiredVia` ('native' | 'trade'), timestamps.
  - New `syncDraftPicks(leagueId, externalLeagueId)` in `server/src/services/sleeper.ts`: seed native ownership for current + 3 future years × rounds 1–N, then overlay `/league/{externalId}/traded_picks`. Comment scaffold already at `sleeper.ts:1-5`.
  - Wire into existing league-refresh in `server/src/routes/leagues.ts:6-26` alongside rosters/schedule. Optional `POST /api/admin/sync-draft-picks/:leagueId`.
  - Extend `buildTeamRoster()` in `server/src/routes/rosters.ts` so `TeamRosterOut` gains sorted `picks: Array<{ year, round, originalOwnerId, originalOwnerName, isNative }>`. Same `/api/rosters/:leagueId/all` endpoint.
  - Frontend: extend `TradeTeamCard` in `src/components/TradeAnalyzerView.tsx` with "Roster & picks" collapsible (expanded on user's card, collapsed on opponents). Two chip rows: Players (click → sends) and Picks (`2026 1st` or `2026 1st (via Team Y)`). Add optional `originalOwnerName` to `TradeAsset`.
- [ ] **Phase 2 — MFL parity** (~200 LOC) — MFL has `?TYPE=futureDraftPicks&JSON=1` but `server/src/services/mfl.ts` doesn't call it. Mirror Phase 1. Verify response schema against a real MFL league first.
- [ ] **Phase 3 — ESPN / Yahoo** (DEFERRED) — Neither platform has league sync today (ESPN is NFL game data only, Yahoo is OAuth-only). Pick sync becomes a small additive step once broader integration lands.

---

## P3 — Draft Rankings: Enhancements

> **Status (post-cleanup sprint):** The cleanup sprint ripped out `Math.sin`-derived fake data columns. **All six buttons are now wired** (Export, Compare, Add to compare, Trade value, Watch, Ask AI). Watchlist is deployed (migration `0036` applied to remote D1); Ask AI ships in its own PR and needs a worker deploy. Next up: the data-infrastructure items below.

### Button wiring (visible dead UI — do first)
- [x] **Compare basket (up to 4)** — `Compare (N)` header button opens a comparison modal with 2–4 players side-by-side; per-row "Add to compare" toggles membership. Client-side basket in `DraftRankingsView`, resets on variant change. (Done.)
- [x] **Export rankings** — CSV download of the current filtered rankings via `src/utils/csvExport.ts` (formula-injection guarded). (Done.)
- [x] **Trade value link** — Per-row "Trade value" seeds the player via `src/utils/tradeSeed.ts` and navigates to the Trade Analyzer, which consumes the seed on mount onto team 0. (Done.)
- [x] **"Ask AI about draft" button** — Implemented: shared AI helpers extracted to `server/src/utils/prompt.ts`; `POST /api/draft-rankings/ask` (Pro/Elite gated, daily-capped, server-built ranking context); a self-contained `src/components/AiChatModal.tsx` wired to the Ask AI button with login→`Login` / free→`Pricing` gating. Merged + deployed (endpoint returns 401 unauthenticated in prod). **⚠️ Live verification pending:** the authed Pro/Elite question→answer round-trip has NOT been confirmed end-to-end (tests mock Anthropic). Needs a Pro/Elite login to exercise once; the Anthropic call is byte-for-byte identical to the live `POST /api/trades/follow-up`, so the integration is expected to work. (Note: implemented as a standalone modal rather than refactoring TradeAnalyzer's `FollowUpChat`, to avoid regressing the trade flow; free-tier routes to Pricing instead of an in-context UpgradeModal.) Implementation steps were:
  - **A0 — extract shared AI helpers (prereq, ~30m):** move `sanitizePromptInput`, `getTodayKey`, and the `ConversationTurn` interface out of `trades.ts` into a new `server/src/utils/prompt.ts`; import them in `trades.ts` and `tradeHistory.ts` (drops its duplicate `getTodayKey`). Pure refactor; server `tsc` is the gate.
  - **A1 — backend `POST /api/draft-rankings/ask`** in `server/src/routes/draftRankings.ts`: `authMiddleware` + `rateLimit(20, 60_000)`; free tier → `403 { code: 'TIER_REQUIRED' }`; daily cap via the existing `tradeAnalysisUsage` table keyed `draftask:${user.id}` (Pro 20/day, Elite ∞ — **no new table**). Body `{ conversationHistory, question, type, scoring, season }` — client sends only variant selectors; **server** queries `draftRankings` (top ~50 for that variant) and builds the context string so it can't be spoofed. Sanitize `question` (1000 chars), cap history to last 10 turns. Anthropic call identical to follow-up (`claude-sonnet-4-20250514`, `max_tokens` 1024, `temperature` 0.4, 30s timeout) with `buildDraftAskSystemPrompt(context)`; returns `{ answer }`. Security: tier check server-side only, rate-limit + daily cap, treat `question` as untrusted (ranking data is the only authoritative context).
  - **A2 — frontend modal + gating:** extract `FollowUpChat` (`TradeAnalyzerView` ~894-1010 + `handleFollowUp`) into a shared `src/components/AiChatModal.tsx` (`isOpen`, `onClose`, `endpoint`, `contextParams`, `title`, quick-actions, `isDarkMode`) and refactor TradeAnalyzer to consume it. Wire the Ask AI button to open it with `{ type, scoring, season }`; add `useAuth` → logged-out routes to login, free tier shows `UpgradeModal`. Tests: `buildDraftAskSystemPrompt` + request validation; component test for open-modal (Pro) / UpgradeModal (free) / login (logged-out).
- [x] **Watch / watchlist** — Implemented: `user_player_watchlist` table + migration `0036`, IDOR-scoped `GET/POST/DELETE /api/watchlist` routes, a `useWatchlist` hook (optimistic + revert), the per-row Watch button (login-gated), and a "Watching only" filter pill. **Deploy step still pending: apply migration `0036` to remote D1 + deploy the worker.** Implementation steps were:
  - **B1 — backend table + routes:** schema `userPlayerWatchlist` (`id`, `userId` FK `users.id` cascade, `playerId` FK `nflPlayers.id` cascade, `createdAt`) with a **unique index on `(userId, playerId)`** + index on `userId`. Migration `0036_add_player_watchlist.sql` (`CREATE TABLE IF NOT EXISTS user_player_watchlist ... REFERENCES users(id) ON DELETE CASCADE`, mirrors `0021_add_trade_usage.sql`; apply with `wrangler d1 migrations apply filmroom-db --remote`). New `src/routes/watchlist.ts` registered `app.route('/api/watchlist', watchlistRoutes)` in `server/src/index.ts`: `GET /api/watchlist` (auth, joins `nflPlayers`), `POST /api/watchlist` (auth, `rateLimit`, validate player exists, `insert().onConflictDoNothing()`), `DELETE /api/watchlist/:playerId` (auth). Security: scope **every** query to `user.id` from the JWT (no client userId → no IDOR); unique constraint + `onConflictDoNothing` for idempotency.
  - **B2 — frontend hook + UI:** `src/hooks/useWatchlist.ts` (fetch `GET /watchlist` when authed, expose `watchedIds: Set<string>`, `toggle(playerId)` with optimistic update + revert, `isWatched`). Wire the Watch button to `toggle(player.id)` with a filled-heart saved state; logged-out → login prompt; optional "Watching only" filter chip. Built generically so `PlayerCard`/Board can reuse the hook. Tests: `useWatchlist` (toggle + optimistic revert, mocked api) and a Watch-button toggle/login-gate component test.
  - **Deploy note:** the migration must be applied to remote D1, and both features need a worker deploy, before they work in prod.

### Data infrastructure (real metrics behind the columns we removed)
- [ ] **4-week trend sparkline** (~half day frontend + 1-day backend) — `rank_history` table keyed on `(playerId, scoringFormat, superflex, rankingType, snapshotDate)`, daily cron snapshots from `draft_rankings`. Extend `/draft-rankings` to return `recentRanks: number[]`. Inline 60×20 SVG path in TREND slot.
- [ ] **24h / 7d / 30d / Preseason Open rank movement** (~4h frontend if rank_history exists) — Four deltas in expanded row's `Rank Movement` panel. Green up, red down. Depends on sparkline task landing first.
- [ ] **Ceiling / Floor** (~half day backend) — Extend AI generator in `server/src/services/draftRankings.ts` to emit `ceilingRank` and `floorRank`, store on `draft_rankings`, surface in response.
- [ ] **Detailed projection breakdown in expanded row** (~1 day) — PPG, Rush Yds, Rush TDs, Rec, Rec Yds per player. Either join `player_projections` at query time or snapshot stats onto `draft_rankings` row at generation.
- [ ] **ECR (Expert Consensus Rank) + Best Ball ADP** (~2 days) — New `player_external_ranks` table. ECR via FantasyPros API (gated). Best Ball ADP via Underdog (friendly) or DraftKings (fragile). Surface in `Draft Value` panel.
- [ ] **Redraft / Dynasty / Rookie three-way split** (~3h backend + 1h frontend) — Current backend bundles Dynasty + Rookie as `dynasty_rookie`. Split into three independent ranking types. Existing rows stay until regenerated.
- [ ] **Superflex variants + re-add toggle** (~2h backend + 30m frontend) — Superflex ranking variants aren't generated (only `superflex=false` is in `DEFAULT_VARIANTS`), so the cleanup sprint removed the Superflex toggle from `DraftRankingsView.tsx` and hardcoded the fetch to `superflex=0` to avoid an empty result. To restore: add `superflex: true` variants to `DEFAULT_VARIANTS` in `server/src/services/draftRankings.ts`, regenerate, then re-add the toggle + wire `superflex` back into the fetch URL and `useCallback` deps.

---

## P3 — Player Rankings: Enhancements

- [ ] **4-week trend sparkline in TREND column** (~half day frontend + 1-day backend) — Extend `/players` response with `recentWeeklyScores: number[]` (last 4, most recent last). 60×20 SVG path in TREND. Falls back to existing delta pill when empty.
- [ ] **Expanded player row with stat breakdown + AI take** (~1–2 days) — In-place row expand with 4 columns: PASSING/RUSHING/RECEIVING (per position), SEASON AVG (PPG + position rank), FILMROOM AI TAKE (1–2 paragraph analysis + Trade value / Full game log buttons). Two pieces: (a) expose per-player weekly stats in `/players` list, (b) weekly board-scoped AI analysis endpoint. AI take Pro/Elite gated.
- [ ] **"Your Roster" right sidebar on Board view** (~1 day frontend + small LeagueContext plumbing) — Swap the existing 1/3 right column (`NewsPanel` + `BiggestMovers`) for `RosterWeekPanel` (starters + current scores + position rank + Full lineup link) and `RosterOverUnderPanel` (boom/bust tally for current week) when user has a connected league. Keep existing sidebar as fallback for un-synced users.
- [ ] **"YOUR TEAM" row highlight + badge** (~2h) — Blue left-border + "YOUR TEAM" pill on owned-player rows. Derive from `LeagueContext.roster`. Pure frontend.
- [ ] **Week prev/next arrows + "Full Season" toggle** (~3h) — Replace week dropdown with `< Week N >` chevrons + Full Season pill (flips to season totals via existing `seasonStats` support).
- [ ] **Header action buttons: Export + Ask AI** (~3h total) — Export (~1h) CSV of filtered rankings. Ask AI (~2h) chat modal seeded with current week + scoring format + filtered players. New `/players/ask` endpoint. Pro/Elite gated.
- [ ] **Page breadcrumb: "Rankings / Player Rankings"** (~1h) — Small `Breadcrumb` component mapping `activeView` → parent section. Useful beyond just this view.
- [ ] **Header subtitle with player count + week context** (~1h) — "2025 Season · Week 1 (Final) · Actual points scored · 883 players". Pull `totalPlayers` from existing `/players` response.

---

## P3 — AI Surfaces & New Pages

- [ ] **League Analyzer page with AI team analyzer** — New top-level view auditing the user's league: team-by-team strength grades, positional surplus/deficit, schedule difficulty ROS, championship odds, AI-generated narrative per team ("biggest strength", "biggest hole", "most likely to fall off", "trade target fits"). Reuses Monte Carlo from PlayoffPredictorView + trade-finder's `LeagueContextSnapshot`. Sidebar nav already exists as "Coming Soon" placeholder. Pro/Elite gated.
- [ ] **AI analysis of players** — 1–2 paragraph per-player take in PlayerCard modal AND standalone player page. Covers recent form, matchup, role/usage trend, start/sit recommendation. Cache by `(playerId, week, season)`. Reuse prompt/model setup from `server/src/services/draftRankings.ts`. Pro/Elite gated.
- [ ] **AI post-game analysis** — Short AI recap per finalized NFL game focused on fantasy takeaways (exceeded/missed expectations, target share/carry shifts, injury-driven role changes, waiver implications). Surfaced on GameDetailModal and user matchup recap. Cron triggers on `gameStatus === 'final'` transitions. Cache per `(gameId, season, week)`.
- [ ] **AI chat assistant ("Ask AI")** — Persistent chat bubble (bottom-right) answering fantasy questions in user's league context: roster, matchup, waivers, trades, start/sit. Reuses `LeagueContextSnapshot`. Streamed responses, persisted history. Entry points from PlayerCard ("Ask about Josh Allen"), Matchup ("Who should I start?"), Trade Analyzer follow-ups. Slash-style entry from any page. Pro/Elite gated.
- [ ] **ROS (Rest-of-Season) rankings from AI** — New ranking type that projects each player's remaining-season value, factoring in current form, schedule strength ROS, injury risk, and target/usage trajectory. Distinct from draft rankings (snapshot at draft time) and weekly player rankings (week-only). New `ranking_type = 'ros'` rows in `draft_rankings` (or new `ros_rankings` table if schema diverges). Daily regeneration cron during season. AI prompt seeds with: current season stats to date, remaining schedule, recent news, injury status. Surface as a tab on the Player Rankings view + a dedicated `/ros-rankings` page. Pro/Elite gated.
- [ ] **Finish odds movement tracking on Trends** — Third tab on TrendsView: "Odds Movement" — player prop line movement (over/under yardage, anytime TD, receptions). External odds source (DraftKings/FanDuel public or paid like The Odds API). New `player_prop_lines` table keyed on `(playerId, propType, sportsbook, capturedAt)` with daily-or-better cron. Per-player chip: current line, opening line, % change, sparkline. Consolidates with LOW item "Trends based on player prop movements" and MEDIUM "Projection breakdown working."
- [x] **Recent Best Performers tab on Trends** — ✅ Already shipped in PR #230 and verified working on prod (2026-06): the `GET /players/recent-leaders?window=1|3|stf` endpoint (window/position toggles, PPG, delta vs season, position rank, % rostered, trade-target flag) and the `TrendsView` tab both exist. (`season` resolves via `resolveDisplaySeason` to the latest season with data — working as designed.) Backlog entry was stale.

---

## P4 — SEO Follow-Through

Standalone player page route (`/players/:slug-:id`) shipped in commit `21de3f3` (`src/components/PlayerProfileView.tsx`). The "View full profile →" modal link is implied as done — verify and check off. Everything below is the actual indexability work.

- [ ] **Extend `scripts/generate-static-pages.js`** to emit one static HTML per rostered skill player (~300–400) at build time, seeded from `nfl_players` + recent stats/projections. Makes pages instantly indexable on Cloudflare Pages (no JS render wait).
- [ ] **Semantic markup on the player page** — `<h1>{name}</h1>`, `<h2>` section headers (Projections, Matchup, Recent News, Season Stats, Props History), proper `<table>` / `<th scope="col">` for stat rows.
- [ ] **`schema.org` JSON-LD** on each page — `Person` + `Athlete` with `name`, `affiliation` (team), `jobTitle` (position), `memberOf` (NFL league). Enables rich snippets.
- [ ] **Per-page `<title>` and meta description** — Templated `{Name} Fantasy Stats, Projections & News | FilmRoom Fantasy` and 150-char summary with top stat + team + position.
- [ ] **Open Graph + Twitter card tags per player** — Shared links render rich previews (name, headshot, recent stat line).
- [ ] **Canonical URL** — `/players/josh-allen-6802` (slug + sleeper-id) so the same player can't be duplicated under multiple slugs.
- [ ] **Add player URLs to `public/sitemap.xml`** (or generate dynamically) — Google discovers them without crawling the app.
- [ ] **`<link rel="alternate">`** from in-app modal URL state to the player page — preserves SEO intent during in-app navigation.

---

## P5 — Monetization Infrastructure

Hard prereq for any paid feature in P6. Stripe + DB columns + gating must land before any tier-locked feature ships.

- [ ] **Integrate Stripe for payments**
- [ ] **Add `subscription_tier` and `subscription_expires_at` columns** to `users` table
- [ ] **Add feature gating middleware** — check JWT claims for plan tier
- [ ] **Restore Membership section in ProfileView** — entire card + `membershipPlan` state removed from `ProfileView.tsx` for beta. Re-add between password section and logout button, wire Upgrade/Manage plan to Stripe.
- [ ] **Build upgrade / downgrade / cancellation flow**
- [ ] **Add billing webhook handlers** (Stripe events)

---

## P6 — Premium Features (Pro Tier, $4.99/mo)

- [ ] **AI Trade Analyzer** — GPT-powered "Who wins this trade?" with ROS projections. Sidebar nav item removed for beta — re-add `{ icon: ArrowRightLeft, label: 'Trade Analyzer', view: 'TradeAnalyzer' }` to `Sidebar.tsx` menuItems. Route + `ComingSoonView` still exist.
- [ ] **Start/Sit Optimizer** — Matchup-based lineup recommendations (weather, Vegas lines, defensive rankings)
- [ ] **Waiver Wire Rankings** — Priority-ranked targets with FAAB bid suggestions
- [ ] **Advanced Projections** — Multi-source consensus (ESPN, FantasyPros, PFF) with trend graphs
- [ ] **Custom Alerts** — Push/email notifications for injuries, lineup locks, stat milestones
- [ ] **Snap Count Analytics** — Usage trend charts (target share, snap %, red zone opportunities)

## P6 — Premium Features (Elite Tier, $9.99/mo)

- [ ] **Multi-League Dashboard** — Unified view across leagues with player exposure tracking
- [ ] **Playoff Probability Engine** — Monte Carlo of remaining schedule (PlayoffPredictorView already runs Monte Carlo; this would be the multi-league / elite-tier variant)
- [ ] **DFS Lineup Optimizer** — Salary cap optimizer for DraftKings/FanDuel
- [ ] **Live Draft Assistant** — Real-time ADP comparison, positional scarcity, best available
- [ ] **Opponent Scouting Report** — Weekly opponent roster strengths/weaknesses
- [ ] **Dynasty Rankings & Age Curves** — Long-term valuations for keeper/dynasty
- [ ] **Historical Splits Database** — Multi-season splits (home/away, indoor/outdoor, division, primetime)

## P6 — One-Time Purchases

- [ ] **Draft Kit ($14.99)** — Pre-draft tiers, mock draft simulator, printable cheat sheets
- [ ] **Playoff Bundle ($4.99)** — Enhanced bracket predictor, championship-week optimal lineups
- [ ] **Commissioner Toolkit ($7.99)** — League history archive, all-time records, custom trophies/awards

---

## P6 — Future / Optional

- [ ] **Trends based on player prop movements** — Folded into "Finish odds movement tracking on Trends" in P3 above. Drop this duplicate once that ships.
- [ ] **Email collection for newsletter** — Signup form for weekly newsletter (waiver targets, start/sit, injuries).
- [ ] **Ad integration** — Evaluate non-intrusive ad placements (sidebar banners, interstitial between views) for free-tier monetization.

---

## Notes

- This file is a snapshot. Source of truth for new ideas + completed history remains `BACKLOG.md`.
- When something here ships, check it off here AND mirror to `BACKLOG.md` so the historical record stays accurate.
- Several P3 trade-finder hardening items are <1h each and would meaningfully reduce ongoing Anthropic spend — consider knocking out prompt caching, the 8→5 drop, and the rate-limit split as a single "trade-finder cost reduction" PR before anything else in P3.
