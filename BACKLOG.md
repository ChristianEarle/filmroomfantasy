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
