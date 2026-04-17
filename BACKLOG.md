# FilmRoom Fantasy Football - Development Backlog

---

## CRITICAL - Must Fix Before Launch

- [x] **Secure OpenAI API key** - Key is in `server/.dev.vars` which is gitignored and not tracked. For production: `wrangler secret put OPENAI_API_KEY --env production`.
- [x] **Add `.dev.vars` to `.gitignore`** - Already in `.gitignore`.
- [x] **Remove hardcoded JWT secret from wrangler.toml** - Moved to `.dev.vars`. Production uses `wrangler secret put`.
- [x] **Fix production API URL fallback** - `src/services/api.ts` now uses `/api` fallback instead of localhost.
- [x] **Add rate limiting** - Added rate limiter middleware. Auth endpoints: 10 req/15min for login/register, 5 req/15min for password reset.
- [x] **Fix 13 TypeScript errors in backend** - Fixed `games.ts` (inArray types), `admin.ts` (explicit cast), `players.ts` (typed conditions array). Backend now passes `tsc --noEmit` clean.

---

## HIGH - Should Fix Before Launch

### Auth & User Management
- [x] **Remove fake password reset** - Deleted `PasswordResetView.tsx` and `SetNewPasswordView.tsx`. Removed backend `/forgot-password` placeholder route. Removed all references from `App.tsx` and `LoginView.tsx`.
- [x] **Implement real password reset** - Full password reset flow implemented: `password_reset_tokens` table, SHA-256 hashed tokens with 1-hour expiry, Resend email API, `ForgotPasswordView`/`ResetPasswordView` components, rate-limited endpoints with email enumeration prevention.
- [x] **Implement real Google OAuth** - Added Google sign-in via `@react-oauth/google` + Google JWKS verification on backend. Supports new user creation, email account linking, and Google-only users. ProfileView adapts for Google-linked accounts.
- [ ] **Finish Google OAuth setup** - Obtain real Google OAuth Client ID from Google Cloud Console, set `GOOGLE_CLIENT_ID` in `server/.dev.vars` and `VITE_GOOGLE_CLIENT_ID` in `.env`, configure authorized origins/redirect URIs, and run `wrangler secret put GOOGLE_CLIENT_ID` for production.
- [x] ~~**Remove fake Google OAuth buttons**~~ - Replaced with real Google OAuth (see above).
- [x] **Wire up profile updates** - ProfileView now reads real user data from AuthContext, password change calls real `/auth/change-password` API with error handling and loading states.
- [x] **Reduce JWT expiration** - Reduced from 7 days to 24 hours.

### Security
- [x] **Add security headers middleware** - Added `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Strict-Transport-Security` (production only).
- [x] **Lock down CORS** - Wildcard subdomain matching now only allowed in development. Production requires explicit origin in `allowedOrigins` array.
- [x] **Add input validation on registration** - Added email regex validation, username length (3-30) and character constraints (alphanumeric, hyphens, underscores).

### Data Pipeline
- [x] **Set up automated data sync** - Added Cloudflare Cron Triggers in `wrangler.toml` (daily players/news/games, every 4h stats/projections, every 6h RSS news). `handleScheduled` in `index.ts` routes cron events to existing admin sync endpoints.
- [x] **Implement projection sync** - Added `POST /api/admin/sync-projections` endpoint. Fetches from Sleeper projections API, imports for all 3 scoring formats (PPR/Half/Standard), pre-fetches players for batch lookup.
- [x] **Fix trending players endpoint** - Now queries real `transactions` table for add/drop counts over the last 14 days. Calculates ownership % from `roster_spots`. Falls back to active players if no transaction data.
- [x] **Implement live scoring** - `matchups.ts` now batch-fetches `player_weekly_stats` for roster players and calculates per-player and team scores based on league scoring format (PPR/Half/Standard). Live endpoint calculates from starters' actual stats.

### UI Bugs
- [x] **Login/Register page crashes without Google Client ID** - `GoogleLogin` component now conditionally renders only when `VITE_GOOGLE_CLIENT_ID` is set. Both LoginView and RegisterView hide Google button + divider when no client ID is configured.
- [x] **Sidebar doesn't collapse on mobile** - Added custom CSS classes (`sidebar-responsive`, `sidebar-open`, `mobile-only`) in `index.css` for responsive sidebar behavior. Sidebar hidden on mobile (<768px) with hamburger menu toggle in Header. Opens as fixed overlay with backdrop dismiss. Closes on nav click or backdrop tap.
- [x] **"Showing top 12 of 0 players" when error** - Footer now conditionally hidden when `error` is set or `totalPlayers` is 0. Also fixed to show `Math.min(12, totalPlayers)` instead of hardcoded 12.
- [x] **Dead ToS/Privacy Policy links** - Removed `href="#"` anchor tags from `RegisterView.tsx`. ToS/Privacy text is now plain text (no clickable links) until real pages are created.
- [x] **404 page uses orange button** - Changed `bg-orange-500` to `bg-blue-600` and `hover:bg-orange-600` to `hover:bg-blue-700` in `App.tsx` 404 view to match the app's blue theme.

### Missing Assets
- [x] **Create favicon.svg** - Created SVG with "FR" branding matching the app's dark theme/blue accent.
- [x] **Create apple-touch-icon.png** - Created 180x180 PNG via sharp from SVG template.
- [x] **Create og-image.png** - Created 1200x630 Open Graph image with FilmRoom branding.

---

## MEDIUM - Fix Soon After Launch

### Frontend
- [x] **Add 404 page** - Unknown routes now show "Page Not Found" with a Go Home button.
- [x] **Replace mock notifications** - Removed hardcoded `mockNotifications` array. Bell dropdown now shows empty state with helpful message. "Mark all as read" only shows when there are unread items. Removed non-functional "View all notifications" link.
- [x] ~~**Implement "Mark all as read"**~~ - Resolved as part of mock notifications cleanup. Button only renders when unread notifications exist.
- [x] ~~**Implement "View all notifications"**~~ - Removed non-functional link as part of notifications cleanup.
- [x] ~~**Remove Yahoo integration stub**~~ - Re-added with real Yahoo Fantasy OAuth integration. Full backend OAuth flow (`server/src/routes/yahoo.ts`), Yahoo sync in leagues.ts, frontend OAuth popup flow in SettingsView.
- [x] **Fix silent disconnect failure** - `SettingsView.tsx` now shows error message via `setSyncingError()` when league disconnect fails.
- [x] **Remove unused SearchBar component** - Deleted `src/components/SearchBar.tsx`.

### Backend
- [x] **Add database indexes on foreign keys** - Migration `0012_add_foreign_key_indexes.sql` adds 21 indexes on all foreign key columns across all tables.
- [x] **Fix N+1 query in league sync** - Pre-fetches all players by external ID in one batched query (chunked by 500) before the roster loop. Reduces ~192 queries down to 1-2.
- [x] **Reduce pagination max limit** - Reduced from 2000 to 200 in `players.ts`.
- [x] **Preserve news history** - Fixed RSS news sync to check for existing entries by `sourceUrl` before inserting, instead of deleting all non-Sleeper entries on each sync.
- [x] **Add Sleeper API rate limit handling** - Added `throttledFetchAll()` utility with concurrency limit (5 concurrent, 200ms batch delay) for matchup fetches. Added 150ms delay between sequential stats fetches in both league sync and admin sync.
- [x] **Validate Sleeper API response format** - Added `isValidSleeperRoster`, `isValidSleeperUser`, `isValidSleeperMatchup` type guards and `validateSleeperArray()` helper. All Sleeper responses now validated at runtime with invalid entries logged and skipped.
- [x] **Add request ID logging** - Added middleware that generates `crypto.randomUUID()` per request, sets `X-Request-Id` header, logs it, and stores on context for route handlers.

### Config & Build
- [x] **Update Wrangler** - Updated from v3.114.17 to v4.70.0. Also updated `@cloudflare/workers-types` to latest.
- [x] **Pin wildcard dependency versions** - Pinned `clsx` to `^2.1.1` and `tailwind-merge` to `^3.4.0`.
- [x] **Add frontend type-check script** - Added `tsconfig.json` for frontend, `typecheck` and `typecheck:server` scripts in `package.json`. Installed `@types/react` and `@types/react-dom`.
- [x] **Add lint script** - Added `lint` script to `package.json`.
- [x] **Add preview script** - Added `preview` script (`vite preview`) to test production builds locally on port 4173.
- [x] **Set up production secrets** - Added complete `wrangler secret put` instructions in `wrangler.toml` comments for all 6 secrets (JWT_SECRET, SYNC_SECRET, OPENAI_API_KEY, GOOGLE_CLIENT_ID, YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET). Local dev uses `.dev.vars`.

### Security Hardening (Audit Fixes)
- [x] **Fix Yahoo OAuth postMessage origin** - Backend callback page now uses `window.location.origin` instead of `'*'`. Frontend `SettingsView.tsx` validates `event.origin` before processing OAuth messages.
- [x] **Fix admin endpoint protection** - Shared `use('*')` middleware always requires `SYNC_SECRET` header. Removed 7 inline auth checks with dev bypass. Returns 500 if secret not configured, 401 if key doesn't match.
- [x] **Fix account enumeration** - Login returns generic `Invalid email or password` for all failures (including Google-only users). Registration returns generic `Email or username already taken` for conflicts.
- [x] **Add route param validation** - `games.ts` and `matchups.ts` now validate `parseInt` results with NaN checks and range bounds (week 1-22, season 2000-2100).
- [x] **Add admin sync input validation** - `sync-games` validates `seasonYear` (2000-2100), `weeks` array (max 22 items, each 1-22). `sync-stats` validates `seasonYear` and `maxWeeks` (1-22).
- [x] **Add news URL protocol validation** - `NewsSnippet.tsx` only renders links for URLs starting with `https://` or `http://`, preventing `javascript:` protocol injection.
- [x] **Add Content Security Policy header** - Added CSP middleware to `server/src/index.ts` with directives for `default-src`, `script-src`, `style-src` (unsafe-inline for Tailwind), `img-src` (Sleeper/ESPN/Google CDNs), `connect-src`, `frame-src`, `object-src`, `base-uri`, `form-action`, `frame-ancestors`.
- [x] **Add distributed rate limiting** - Replaced per-isolate in-memory rate limiter with D1-backed distributed rate limiting. Uses atomic `INSERT OR REPLACE` with `ON CONFLICT` for cross-isolate consistency. Falls back to in-memory if D1 fails. Added `rate_limits` table migration (`0014`). Cron cleanup of expired entries and sessions.
- [x] **Add token revocation/logout endpoint** - Built `POST /auth/logout` that deletes the session from D1. Login, register, and Google OAuth now create sessions. Auth middleware validates session exists and isn't expired before allowing requests. Frontend `authService.logout()` calls server endpoint before clearing local token.
- [x] **Add frontend auth form rate limiting** - Added progressive client-side cooldown to LoginView and RegisterView. After 3 failed attempts: 2s cooldown, after 5: 5s, after 8+: 15s. Submit button shows countdown timer during cooldown. Resets on successful auth.

---

## LOW - Polish Before or After Launch

- [x] Add `robots.txt` to `public/`
- [x] Add `sitemap.xml`
- [x] Add LICENSE file (MIT)
- [x] Add API documentation (OpenAPI/Swagger spec) - Created `server/openapi.yaml` with full OpenAPI 3.1 spec covering all 50+ endpoints, auth schemes, request/response schemas, and rate limiting docs.
- [x] Add deployment guide (README or separate doc) - Created `DEPLOY.md` with local dev setup, production deployment steps, secret management, CI/CD setup, environment variable reference, and production data seeding instructions.
- [x] Add CHANGELOG - Created `CHANGELOG.md` documenting all features, security, data pipeline, frontend, and infrastructure work for v1.0.0.
- [x] Set up CI/CD pipeline (GitHub Actions) - Created `.github/workflows/ci.yml` with frontend build, backend type-check on PRs, and auto-deploy to Cloudflare Workers on push to main (requires `CLOUDFLARE_API_TOKEN` secret).
- [x] Add PWA support (service worker, web manifest) - Created `public/manifest.json` and `public/sw.js`. Updated `index.html` with manifest link, apple-mobile-web-app-capable meta, and SW registration script. Cache-first for static assets, network-only for API.
- [x] Add image 404 fallback for headshot CDN URLs - `PlayerAvatar` component already handles `onError` with initials fallback; all headshot rendering uses this component.
- [x] Fix season/week detection heuristic in `espn.ts` - Replaced fragile month-only logic with date-aware detection: Jan-Feb 15 = postseason, Feb 16-Jul = offseason, Aug-Sep 4 = preseason, Sep 5+ = regular.
- [x] Remove deprecated `server/scripts/import-players.ts` - Deleted along with `import-players.sql`. Use `/api/admin/sync-players` instead.
- [x] Replace seed.sql test data with live Sleeper sync for production - Documented in `DEPLOY.md` under "Seed production data" section. Production uses admin sync endpoints (`/api/admin/sync-players`, `sync-games`, `sync-stats`, `sync-projections`, `sync-news`) instead of seed.sql. Cron triggers handle ongoing sync.
- [x] Add database check constraints (positive values for weeks, budget, wins/losses) - Migration `0015_add_check_constraints.sql` adds SQLite triggers for: week range (1-22) on matchups/stats/games, season year (2000-2100), non-negative wins/losses/ties, non-negative FAAB and waiver budgets, team count (2-32).
- [x] Add ESPN live score fetching (currently only static schedule) - `GET /api/games/live/scores` now fetches real-time from ESPN scoreboard API, parses game status/quarter/clock, persists scores to DB, and falls back to DB-only if ESPN is unavailable. Returns `source: 'espn' | 'db'`.
- [x] Improve error specificity in Sleeper sync (include HTTP status in error messages)

---

## HIGH - Bugs & Core Fixes

- [x] **Show correct week on PlayerCard** - PlayerCard now accepts a `currentWeek` prop from App.tsx and displays the dynamic NFL week instead of hardcoded "Week 5".
- [x] **Fix clicking current league (banner jumps off screen)** - LeagueManager dropdown now measures available space and opens up or down accordingly. Re-selecting the same league is prevented.
- [x] **Fix playoff predictor saying "you" on everyone** - Fixed root cause in LeagueContext.tsx: `isUserTeam` now compares team IDs instead of owner IDs (which matched all Sleeper-synced teams). PlayoffPredictorView updated to use `team.isUserTeam` instead of `team.owner === 'You'`.
- [x] **Fix key insights on playoff predictor** - Fixed `userTeamData` lookup and all conditional styling/rank/record calculations to use `isUserTeam` flag.
- [x] **Fix `injured_reserve` display in search bar** - Header search now maps all statuses including `injured_reserve → "IR"` with distinct colors for each status level.
- [x] **Password reset email functionality** - Full flow: `password_reset_tokens` table with SHA-256 hashed tokens, 1-hour expiry. Backend `POST /forgot-password` (rate-limited, no email enumeration) and `POST /reset-password` (token verification, session revocation). Resend email API integration with console fallback. Frontend `ForgotPasswordView` and `ResetPasswordView` components. "Forgot password?" link on LoginView. URL parameter detection for reset tokens in App.tsx.
- [x] **Correct playoff percentage** - Replaced fake rank+winRate formula with real Monte Carlo engine (10,000 simulations). Uses PPG-based win probabilities (clamped 15%-85%) for every remaining matchup, tallies playoff appearances across all sims. Projected wins now averaged from simulations. All hardcoded `6` playoff spots replaced with `league.playoffTeams`.
- [x] **Limit to one league connection for free users** - Backend already enforces 1-league limit for free users (402 response). Frontend now proactively blocks the Connect League button with a clear upgrade message when free users already have 1 league.
- [x] **Working Trends page** - Rewrote TrendsView with two tabs: "Roster Trends" (most added/dropped from `/players/trending`) and "Projection Movers" (from `/players/projection-movements`). Real data, two-column layout, ownership %, trend indicators.
- [x] **Configure Resend for password reset emails** - Resend API key set in `.dev.vars`, domain `filmroomfantasy.com` verified. Sends from `noreply@filmroomfantasy.com`. Feedback notifications go to `support@filmroomfantasy.com`. For production: `wrangler secret put RESEND_API_KEY` and `wrangler secret put FEEDBACK_EMAIL`.

---

## MEDIUM - Feature Completion

### Player Card
- [ ] **Bring back quick actions on player cards** - Re-add the Quick Action buttons (Alert, Pin, Compare, Share) with real functionality. Previously removed because they were non-functional stubs.
- [ ] **FilmRoom Insights working** - Wire up the FilmRoom Insights section on player cards to display real analysis data.
- [x] **Matchup grade working** - Real matchup grade based on opponent defense's last 5 games performance against the player's position. Compares fantasy points allowed to league average, grades A+ through D-. Backend endpoint `GET /players/:id/matchup-grade` with per-game breakdown. PlayerCard shows grade badge, detailed insights with per-week breakdown chips, and league-average comparison.
- [ ] **Projection breakdown working** - Show a real breakdown of projected points by stat category (pass yards, rush yards, receptions, TDs, etc.).
- [ ] **Matchup page insights working** - Re-add the FilmRoom Edge Analysis section on the Matchup page with real, data-driven insights (e.g. position advantages, start/sit suggestions, injury alerts). Previously removed because it was hardcoded fake content.

### Notifications
- [ ] **Working notifications** - Implement real push/in-app notifications for injuries, lineup locks, trade offers, and waiver results.
- [x] **Restore notification bell in header** - Re-added `<Bell>` icon from lucide-react to Header. Shows for authenticated users with "coming soon" tooltip. Ready to wire to notification API when backend is built.

### Waivers
- [x] **Add player search on waivers tab** - Added search bar with clear button to WaiversView. Passes `search` param to API for server-side filtering.

### Feedback
- [x] **Improve feedback UI** - Rewrote embedded mode to show form inline (no button click needed), added orange character count warning near limit, compact layout with inline email field.
- [x] **Have feedback go somewhere manageable** - Feedback submissions now send an email notification via Resend to `FEEDBACK_EMAIL` with type, sender, page, and full message. Non-blocking — request succeeds even if email fails. Still saved to DB.

### Data & Rankings
- [ ] **Top waiver pickups from multiple platforms** - Source trending waiver pickups from multiple league platforms (Sleeper, ESPN, Yahoo) for better consensus recommendations.
- [ ] **Draft rankings** - Pre-draft player rankings with tiers, positional scarcity analysis, and ADP comparison. Sidebar nav item removed for beta — re-add `{ icon: Medal, label: 'Draft Rankings', view: 'DraftRankings' }` to `Sidebar.tsx` menuItems. Route and `ComingSoonView` still exist in `App.tsx`.
- [ ] **Season projections** - Full-season projected stats and fantasy point totals for all players, updated weekly.

### Trade Finder — API Cost & Rate-Limit Hardening
> Reduce Anthropic API pressure on `/trade-finder/recommendations` (currently 6-10 parallel Claude calls per cold request). Ordered by impact-vs-effort.

- [ ] **Enable Anthropic prompt caching on static system prompts** (~1h) - Add `cache_control: { type: 'ephemeral' }` to the system-prompt blocks in `tradeConstructor.ts` (`constructTrades`), `tradeAnalyzer.ts` (`analyzeTrade`), and `tradeFinder.ts` (`buildTeamNeeds`). The constructor and analyzer system prompts are ~2-3K tokens each and identical across every call — Anthropic caches them for 5 min at ~10% of normal token cost. Biggest win: ~50-60% reduction in input token spend per recommendations run, zero UX change. Requires converting the `system:` string to an array of content blocks with `type: 'text' + cache_control`.
- [ ] **Persist verification results in a `trade_verifications` DB table** (~2h) - Key by `(sortedSendIds + sortedReceiveIds + picksHash + leagueType + seasonYear + currentWeek)`. Before calling `analyzeTrade`, look up the hash — reuse if found. Kills redundant grading when the same trade surfaces across different searches or repeated runs. Complements the existing recommendations cache (which keys by filter, not trade shape).
- [ ] **Drop `maxRecommendations` from 8 to 5** (~5min) - `routes/tradeFinder.ts:354`. Cuts verification calls by 37% with minimal UX loss (users rarely scroll past the top 5 trades anyway). Revisit if user feedback wants more variety.
- [ ] **Split rate limits per trade-finder endpoint** (~10min) - Currently `rateLimit(20, 60 * 1000)` applies to all `/trade-finder/*`. Needs is cheap (cached), recommendations is heavy. Split: `/needs` keeps 20/min, `/recommendations` drops to 5/min per user. Prevents worst-case slam without affecting normal usage.
- [ ] **Share the `LeagueContextSnapshot` across users in the same league** (~half day) - Every league member currently rebuilds the full snapshot from scratch on every finder request. Cache it in D1 or Workers KV keyed by `(leagueId, latestSyncTimestamp)` so it's computed once per league per sync. Saves ~50-100ms of D1 queries per request and reduces cold-start load under multi-user pressure.
- [ ] **Lazy verification** (~half day) - Instead of verifying all candidates eagerly, verify the top 3 by deterministic `valueImbalancePct` score first and stream them back to the UI. Lazy-verify the next 5 only when the user clicks "show more." Cuts verification calls by ~60% for users who don't scroll past the top trades.
- [ ] **Move constructor to Haiku** (~30min + regression testing) - Constructor reasoning is simpler than verification. Haiku 4.5 could plausibly handle it at ~25% of Sonnet's cost. Keep Sonnet for the trusted analyzer. Requires testing that Haiku follows the ID-echo and packaging rules reliably.
- [ ] **Cloudflare Queues for verification fan-out** (~1 day) - Move verification calls behind a Cloudflare Queue with a producer rate cap. `/recommendations` returns immediately with "analyzing in progress"; client polls for verified results. Guarantees we never exceed Anthropic rate limits under load. Only needed at real scale — skip until traffic actually warrants it.

### Trade Finder — Discovery Enhancements
> Feature ideas discussed during the trade finder rework session that were deferred. Most require the existing mega-call path to be stable first.

- [ ] **"Target a specific player" UI entry point** (~half day) - Add a collapsible panel to `TradeFinderView.tsx` with a searchable combobox of every non-user player in the league (source: existing `GET /rosters/:leagueId/all`). When selected, the finder runs a single focused construction call for that exact player instead of scanning the whole league. Extend `RecommendationsBody` with `targetPlayerId`, thread through `findTradeRecommendations`, bump `CACHE_VERSION`. Useful on its own regardless of the underlying discovery mechanism.
- [ ] **Historical league-specific trade anchors** (~1 day) - `tradeIngest.ts` + `tradeOutcomes.ts` already ingest real accepted Sleeper trades into the `trades` table but the finder never reads them. Pull the 3 most recent accepted trades for the user's league and inject them into the constructor prompt as calibration examples ("here's what THIS league considers fair"). Low prompt overhead, potentially high signal for dynasty/weird-scoring leagues where market value differs from standard models. Add a `getRecentAcceptedTradesForLeague(leagueId, limit)` helper in `tradeIngest.ts`.
- [ ] **Per-target parallel fan-out discovery** (~1-2 days) - Scrapped in this session (commits c638590/cfbe354, reverted in ef13304) because the prompt was too aggressive about returning null. Conceptually still sound — 20-30 focused calls with their own attention budgets can explore more creative packages than one mega-call. Retry once the current mega-call path is proven stable and once Anthropic prompt caching is enabled (otherwise cost is prohibitive). Key lessons from the failed attempt: (a) the per-target prompt needs encouraging framing, not "null is valid" framing; (b) gate 4 must be relaxed when the fan-out runs with required assets; (c) the same ID-echo bug applies to each focused call and has to be fixed there too.
- [ ] **Expand matcher package shapes beyond 2-for-1** (~half day) - `tradeMatcher.ts` currently only builds 1-for-1, 2-for-1, and 1-for-2 trades. Real trades often need 2-for-2, 3-for-1, or 3-for-2 shapes (especially in deeper rosters or when one side has multiple matching needs). Extend `tryBuildPair()` to generate larger package combinations with a size cap (~5 per side), scored with the existing mutual-benefit + imbalance heuristic. Deterministic backup that doesn't hit the AI at all.
- [ ] **Follow-up conversation refinement for finder results** (~1 day) - `server/src/routes/trades.ts` already has a `/follow-up` endpoint for iterative refinement on the manual analyzer. Reuse it from `TradeFinderView` so users can say "show me cheaper options", "don't touch my RB1", or "what if I swap Tank Dell for Player X" after seeing initial results, without re-running the full finder pipeline.
- [ ] **Empty-state diagnostic surface** (~2h) - When the finder returns zero trades, surface WHY in the UI instead of just "no trades found." Expose stage counts from the existing logs (raw constructor output, validation drops with reasons, gate 4 drops with reasons) in the response body as a `diagnostics` field. Display a collapsible "Why no trades?" section in the empty-state card. Builds user trust and makes debugging trivial — today we have to tail server logs to answer "why didn't it find anything?"
- [ ] **Manual refresh button for scouting report** (~30min) - Scouting reports now persist per `(season, week, rosterFingerprint)` so they only regenerate on real changes. Add a small "refresh" icon next to the "Your Team Needs" heading in `TradeFinderView.tsx` that clears the saved row for the user's team and triggers a fresh scout. Escape hatch for when the AI's initial assessment was wrong or after a major injury report that doesn't show as a roster change.

### Trade Analyzer — Draft Pick Inventory
> Surface each team's real draft pick ownership in the builder so users can click-to-add the picks they actually own (with original-owner info) instead of entering generic "2026 1st Round Pick" via the year/round modal. Discussed during the Trade Analyzer redesign session — deferred because it requires new backend data. Sleeper path only for MVP; MFL/ESPN/Yahoo deferred further.

**One caveat to flag in the UI:** Sleeper and MFL don't expose exact pick slots (e.g. "2026 1.07") mid-season — only year + round + original owner. The best we can surface is `2026 1st (originally Team Y's)`, which is industry-standard. Add a small tooltip explaining slot resolves from Team Y's final standings.

- [ ] **Phase 1 — Sleeper MVP** (~400-500 LOC across schema + service + routes + UI):
  - New `team_draft_picks` table keyed on `(leagueId, draftYear, draftRound, originalOwnerId)` with a mutating `ownerId` column so pick chains collapse to current ownership without walking a trade graph. Columns: `id`, `leagueId`, `ownerId`, `originalOwnerId`, `draftYear`, `draftRound`, `acquiredVia` ('native' | 'trade'), timestamps.
  - New `syncDraftPicks(leagueId, externalLeagueId)` in `server/src/services/sleeper.ts`: seed native ownership for current year + 3 future years × rounds 1–N for every team, then overlay `/league/{externalId}/traded_picks` so each traded pick updates `ownerId` / `acquiredVia='trade'`. A comment referencing this endpoint already exists at the top of `sleeper.ts` (lines 1-5) but nothing calls it yet.
  - Wire the sync into the existing league-refresh path in `server/src/routes/leagues.ts` (~line 6-26) alongside rosters/schedule. No new cron needed — picks refresh whenever a user re-syncs their league. Optional admin endpoint `POST /api/admin/sync-draft-picks/:leagueId` for manual retrigger.
  - Extend `buildTeamRoster()` in `server/src/routes/rosters.ts` so `TeamRosterOut` gains a sorted `picks: Array<{ year, round, originalOwnerId, originalOwnerName, isNative }>`. Returns via the same `/api/rosters/:leagueId/all` — no new endpoint, no extra frontend fetch.
  - Frontend: extend `TradeTeamCard` in `src/components/TradeAnalyzerView.tsx` with a "Roster & picks" collapsible section (default expanded on user's card, collapsed on opponents). Two chip rows: **Players** (starters + bench — click to add to sends) and **Picks** (labelled `2026 1st` when native or `2026 1st (via Team Y)` when traded — click to add with the existing pick asset shape). Add an optional `originalOwnerName` to the `TradeAsset` type so the pick chip can show the "via" sub-label.
- [ ] **Phase 2 — MFL parity** (~200 LOC) - MFL has a `?TYPE=futureDraftPicks&JSON=1` endpoint but `server/src/services/mfl.ts` doesn't call it. Mirror the Phase-1 pattern. Response schema needs verification against a real MFL league first — their API is notoriously inconsistent.
- [ ] **Phase 3 — ESPN / Yahoo** (DEFERRED) - Neither platform has any league sync in this repo today (ESPN is NFL game data only, Yahoo is OAuth-only). Building pick sync would first require building full league sync for those platforms. Not worth it until that broader integration lands — at which point pick sync becomes a small additive step.

### Draft Rankings — Enhancements
> Follow-ups deferred from the Draft Rankings redesign. The redesign landed the headline layout (compact setup, 4 computed callouts, table with VALUE badges, 4-column expanded row); these are the items that needed either new data or new features and were backlogged.

- [ ] **4-week trend sparkline** (~half day frontend + 1-day backend) - The mock shows a small sparkline in each row's `TREND (4wk)` column. Needs a `rank_history` table keyed on `(playerId, scoringFormat, superflex, rankingType, snapshotDate)` populated by a daily cron that takes a snapshot of the current `draft_rankings` table. Extend `/draft-rankings` to return `recentRanks: number[]` (last 28 days or nearest 4 snapshots) per player. Frontend: replace the TREND slot with a minimal inline SVG sparkline — recharts is overkill, a 60×20 path element works. Without rank history the first sparkline is flat — acceptable degraded state.
- [ ] **24h / 7d / 30d / Preseason Open rank movement** (~4h frontend if rank_history exists) - Derived from the same `rank_history` table above. Show four deltas in the expanded row's `Rank Movement` panel: current minus 1-day-ago, 7-days-ago, 30-days-ago, and season-opening snapshot. Color green for up, red for down. Adds ~3 numbers to the response per player. Depends on the sparkline task landing first.
- [ ] **Ceiling / Floor** (~half day backend) - Currently approximated on the frontend as `position1 / position+3`. Real ceiling/floor should come from the AI generator that already produces `rationale` and `analysis` — extend the prompt in `server/src/services/draftRankings.ts` to also emit `ceilingRank` and `floorRank`, store them on the `draft_rankings` row, surface in the response. No new cron needed — it piggybacks on the existing ranking regeneration.
- [ ] **Detailed projection breakdown in expanded row** (~1 day) - Mock shows PPG, Rush Yds, Rush TDs, Rec, Rec Yds per player in the `Season Projection` panel. We currently only store `projectedPoints` (the seasonal total) per ranking. Would need to either (a) join against `player_projections` at query time to pull the stat-by-stat breakdown for the target scoring format, or (b) snapshot those stats onto the `draft_rankings` row at generation time. Option (a) is lighter-weight but slower; option (b) costs a few extra columns but keeps the rankings response self-contained.
- [ ] **ECR (Expert Consensus Rank) + Best Ball ADP** (~2 days) - Both require new data sources:
  - ECR: FantasyPros exposes a consensus rankings endpoint but gate-keeps it behind an API key + tier. Cheap for small-volume polling (daily cron). Need a new `player_external_ranks` table and a sync service similar to the Sleeper integration.
  - Best Ball ADP: Underdog and DraftKings both publish best-ball ADP. Underdog's public API is the friendliest; scraping DraftKings is fragile. Same `player_external_ranks` storage.
  - Surface in the expanded row's `Draft Value` panel alongside FilmRoom Rank / Consensus ADP.
- [ ] **Compare (up to N) drawer** (~1 day frontend) - Mock has a `+ Compare (0)` button in the header that opens a side-drawer with 2–4 players side-by-side: projection breakdown, value, AI take, schedule strength. Pure client-side state (no new persistence). Add a `Compare Drawer` component, thread `selectedForCompare: Set<string>` through `PlayerRow`, render a checkbox on hover. Can reuse the same expanded-row panel markup for each column.
- [ ] **Export rankings** (~2h) - Mock has an `Export` button. CSV download of the current filtered rankings with columns matching the table (`#, Player, Position, Team, ProjPts, ADP, ValueDelta, Tier, Analysis`). Pure frontend — generate a `data:text/csv` blob from `filteredRankings` and trigger a download. No backend call needed.
- [ ] **Ask AI about draft** button (~half day) - Mock has a blue "Ask AI about draft" CTA. Quick chat modal where the user can ask questions against the currently loaded ranking set ("who should I draft at pick 5?", "build me a zero-RB plan"). Reuse the existing Trade Analyzer `/trades/follow-up` pattern but with a new `/draft-rankings/ask` endpoint that seeds the rankings + positional tiers as context. Pro/Elite gated.
- [ ] **Redraft / Dynasty / Rookie three-way split** (~3h backend + 1h frontend) - Current backend bundles Dynasty and Rookie into a single `dynasty_rookie` ranking type. The mock shows them as separate pills. Split at the generation level: three ranking types (`redraft`, `dynasty`, `rookie`), each generated independently. Existing `draft_rankings` rows can stay until regenerated — the API just needs to route the new `dynasty`/`rookie` query values correctly.

### Player Rankings — Enhancements
> Follow-ups deferred from the Player Rankings redesign session. The redesign landed the 3 Boom/Bust/MVP callouts above the table and the OUTCOME pill column (BOOM/BUST/MET) on finalized weeks. These are the larger pieces that needed new data, new surfaces, or changes outside `PlayerTable.tsx`.

- [ ] **4-week trend sparkline in TREND column** (~half day frontend + 1-day backend) - Mock shows a small inline sparkline per row. Needs a per-player weekly score history — we already track `fantasyPointsPPR` per week, just need to return the last 4 weeks alongside the current week's row. Extend the `/players` response with `recentWeeklyScores: number[]` (up to 4, most recent last). Frontend: small SVG path element (~60×20) in the TREND column. Non-breaking — falls back to the existing delta pill when the array is empty.
- [ ] **Expanded player row with stat breakdown + AI take** (~1-2 days) - Mock shows clicking a row expands it in-place with 4 columns: PASSING/RUSHING/RECEIVING stats (QB/RB/WR/TE respectively), SEASON AVG (PPG + position rank + week scope), and FILMROOM AI TAKE (1–2 paragraph analysis + 'Trade value' / 'Full game log' buttons). Right now clicking a row opens a modal; this would be an alternative inline view. Two pieces: (a) expose per-player weekly stats in the `/players` list response (already available in PlayerCard modal), (b) add a weekly-board-scoped AI analysis endpoint similar to the draft-rankings rationale. AI take could be gated to Pro/Elite to control cost.
- [ ] **'Your Roster' right sidebar on the Board view** (~1 day frontend + small LeagueContext plumbing) - Currently the Board view (`activeView === 'Board'` in `App.tsx` ~line 506) renders `PlayerTable` in a 2/3 grid with `NewsPanel` + `BiggestMovers` in the 1/3 right column. Mock replaces that with a 'Your Roster' widget (starters with current-week scores + position rank + 'Full lineup →' link) and an 'Over/Under — Booms/Busts' widget (per-roster boom/bust tally for the current week). Data already exists in `LeagueContext.roster` and the existing actual-points endpoint; need two new compact panel components (`RosterWeekPanel`, `RosterOverUnderPanel`) and to swap them in for the current sidebar components when the user has a league connected. Keep the existing sidebar as a fallback for unauthenticated / un-synced users.
- [ ] **'YOUR TEAM' row highlight + badge** (~2h) - Mock shows a blue-left-border and a 'YOUR TEAM' pill on Lamar Jackson's row to indicate an owned player. Derive from `LeagueContext.roster` (already contains `player.id`s). Add an `ownedPlayerIds: Set<string>` memo in `PlayerTable`, pass an `isOwned` boolean to `PlayerRow`, render the border + pill. Pure frontend, zero new data.
- [ ] **Week prev/next arrows + 'Full Season' toggle** (~3h) - Mock replaces the current week dropdown with inline `< Week N >` arrows (a compact prev/next pattern) plus a 'Full Season' toggle pill. The pill flips the view from weekly points to season totals, which requires the `/players` endpoint already supports season-level aggregates via `seasonStats`. Frontend only: swap the dropdown for two small chevron buttons + a week label, add a 'Full Season' boolean to the query state that routes to the season totals path.
- [ ] **Header action buttons: Export + Ask AI** (~3h total) - Mock has two CTAs in the top-right of the header:
  - **Export** (~1h) — CSV download of the current filtered rankings, same as the Draft Rankings export. Pure frontend blob generation.
  - **Ask AI** (~2h) — Quick chat modal seeded with the current week + scoring format + filtered players as context. Reuse the Trade Analyzer `/trades/follow-up` pattern with a new `/players/ask` endpoint. Pro/Elite gated.
- [ ] **Page breadcrumb: 'Rankings / Player Rankings'** (~1h) - Mock includes a breadcrumb above the header. Not currently rendered anywhere in the app. Would need a small `Breadcrumb` component that maps the `activeView` to its parent section (e.g., Rankings, Tools, League) and renders both. Useful beyond just this view.
- [ ] **Header subtitle with player count + week context** (~1h) - Mock header reads '2025 Season · Week 1 (Final) · Actual points scored · 883 players'. Current header reads '2025 Fantasy Football Player Rankings — Week 1 (Final)'. Pull `totalPlayers` from the existing `/players` response and the season/week from state.

### Settings
- [x] **"Last synced" timestamp on connected leagues** - League cards in Settings now show "Last synced: [date] at [time]" from the league's `updatedAt` field.
- [x] **Account management in settings** - Added Account section to Settings with password change form. Supports both existing-password users (requires current password) and Google-only users (set a new password). Uses existing `/auth/change-password` endpoint.
- [x] **Sync success feedback** - Sync button now shows green "Synced!" with checkmark for 5 seconds after successful sync. Last synced timestamp updates immediately.

### Mobile
- [ ] **Mobile optimization** - Comprehensive mobile pass: fix touch targets, table scrolling, modal sizing, bottom nav, and responsive breakpoints across all views.

---

### Code Audits
> Audit each component for: bugs, hardcoded/fake data, unused code, missing error handling, accessibility (aria, keyboard nav), type safety, performance (memoization, key props), and memory leaks.

**Completed:**
- [x] **Audit HomeView** - Fixed 24 issues
- [x] **Audit Board (PlayerTable + FilterPanel)** - Fixed 34 issues
- [x] **Audit MatchupView** - Fixed 22 issues
- [x] **Audit SettingsView + FeedbackWidget** - Fixed 33 issues
- [x] **Audit PlayoffPredictorView** - Fixed 18 issues (ties in records, findIndex guards, dynamic playoff weeks, memoization, tied scores, ARIA tabs, aria-labels, error display, unused vars)
- [x] **Audit TradeHistoryView** - Fixed 11 issues (fetchAll race condition w/ cancellation token, handleIngest/handleGrade stale-league races, double fetch on league change, ingestNotice/error persistence across league switches, defensive seasons sort, dead callerTeamId field, dead aiAnalysis optional fields, label htmlFor, aria-pressed on season tabs, aria-expanded + aria-label on trade row expand button, clearing expanded set on league change)

**Views — Not yet audited:**
- [ ] **Audit TeamView** - Roster display, player cards, team stats
- [ ] **Audit WaiversView** - Waiver claims, player search, bid management
- [ ] **Audit GameSlateView + GameDetailModal** - NFL schedule, live scores, game detail overlay
- [ ] **Audit TrendsView** - Roster trends, projection movers
- [ ] **Audit AllPlayersView** - Full player list with filters, pagination
- [ ] **Audit ProfileView** - User profile, password change, Google link status
- [ ] **Audit LoginView + RegisterView + ForgotPasswordView** - Auth forms, rate limiting, Google OAuth
- [ ] **Audit PlayerCard** - Player detail modal, game log, stats, matchup grade, projections

**Shared Components — Not yet audited:**
- [ ] **Audit Sidebar** - Navigation, responsive collapse, active state
- [ ] **Audit Header + LeagueManager** - Search bar, league switcher dropdown, notifications bell
- [ ] **Audit PlayerAvatar** - Image loading, fallback initials
- [ ] **Audit NewsPanel + NewsSnippet + BiggestMovers** - News feed, player movers widget
- [ ] **Audit ErrorBoundary** - Error catch/display, recovery
- [ ] **Audit App.tsx** - Routing, state management, context wiring, page transitions

---

## LOW - Future Enhancements

- [ ] **Trends based on player prop movements** - Show player trends driven by betting prop line movements (over/under, anytime TD, yardage props) throughout the week.
- [ ] **Email collection for newsletter** - Add an email signup form for a weekly fantasy football newsletter with waiver targets, start/sit advice, and injury updates.
- [ ] **Ad integration** - Evaluate and integrate non-intrusive ad placements (sidebar banners, interstitial between views) for free-tier monetization.

---

## OPTIONAL - Premium Features (Future Revenue)

> These are optional enhancements for monetization. Not required for launch.

### Pro Tier ($4.99/mo)
- [ ] AI Trade Analyzer - GPT-powered "Who wins this trade?" with ROS projections. Sidebar nav item removed for beta — re-add `{ icon: ArrowRightLeft, label: 'Trade Analyzer', view: 'TradeAnalyzer' }` to `Sidebar.tsx` menuItems. Route and `ComingSoonView` still exist in `App.tsx`.
- [ ] Start/Sit Optimizer - Matchup-based lineup recommendations (weather, Vegas lines, defensive rankings)
- [ ] Waiver Wire Rankings - Priority-ranked targets with FAAB bid suggestions
- [ ] Advanced Projections - Multi-source consensus (ESPN, FantasyPros, PFF) with trend graphs
- [ ] Custom Alerts - Push/email notifications for injuries, lineup locks, stat milestones
- [ ] Snap Count Analytics - Usage trend charts (target share, snap %, red zone opportunities)

### Elite Tier ($9.99/mo)
- [ ] Multi-League Dashboard - Unified view across leagues with player exposure tracking
- [ ] Playoff Probability Engine - Monte Carlo simulation of remaining schedule
- [ ] DFS Lineup Optimizer - Salary cap optimizer for DraftKings/FanDuel
- [ ] Live Draft Assistant - Real-time ADP comparison, positional scarcity, best available
- [ ] Opponent Scouting Report - Weekly breakdown of opponent roster strengths/weaknesses
- [ ] Dynasty Rankings & Age Curves - Long-term valuations for keeper/dynasty leagues
- [ ] Historical Splits Database - Multi-season splits (home/away, indoor/outdoor, division, primetime)

### One-Time Purchases
- [ ] Draft Kit ($14.99) - Pre-draft tiers, mock draft simulator, printable cheat sheets
- [ ] Playoff Bundle ($4.99) - Enhanced bracket predictor, championship-week optimal lineups
- [ ] Commissioner Toolkit ($7.99) - League history archive, all-time records, custom trophies/awards

### Premium Infrastructure (needed before any premium feature)
- [ ] Integrate Stripe for payments
- [ ] Add `subscription_tier` and `subscription_expires_at` columns to `users` table
- [ ] Add feature gating middleware (check JWT claims for plan tier)
- [ ] Restore Membership section in ProfileView — removed entire card and `membershipPlan` state from `ProfileView.tsx` for beta. Re-add between password section and logout button with Upgrade/Manage plan buttons wired to Stripe.
- [ ] Build upgrade/downgrade/cancellation flow
- [ ] Add billing webhook handlers (Stripe events)
