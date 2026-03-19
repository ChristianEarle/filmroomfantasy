# FilmRoom Fantasy Football - Release Audit

**Date:** March 4, 2026
**Status:** NOT READY FOR RELEASE - Critical issues must be resolved

---

## CRITICAL ISSUES (Must Fix Before Launch)

### 1. EXPOSED API KEY IN VERSION CONTROL
- **File:** `server/.dev.vars` - Contains your OpenAI API key in plaintext
- **File is NOT in `.gitignore`** - it's tracked by git
- **Action:** Revoke the key immediately in your OpenAI dashboard, add `.dev.vars` to `.gitignore`

### 2. HARDCODED JWT SECRET
- **File:** `server/wrangler.toml` line 23
- `JWT_SECRET = "dev-secret-key-change-in-production-filmroom-fantasy-2024"` is in version control
- **Action:** Remove from wrangler.toml, set via `wrangler secret put JWT_SECRET --env production`

### 3. HARDCODED LOCALHOST FALLBACK IN PRODUCTION CODE
- **File:** `src/services/api.ts` line 1
- Falls back to `http://127.0.0.1:8787/api` when `VITE_API_URL` is not set
- **Action:** Remove localhost fallback; require `VITE_API_URL` for production builds

### 4. NO RATE LIMITING
- No rate limiting on any endpoint, including auth (login/register)
- Vulnerable to brute force attacks and abuse
- **Action:** Add rate limiting middleware, especially on `/api/auth/*`

### 5. 13 TYPESCRIPT ERRORS IN BACKEND
- `games.ts`: `inArray()` const array type errors (lines 338, 345, 510, 517)
- `admin.ts`: Implicit `any` type (line 609)
- `players.ts`: Implicit `any[]` type (lines 151, 223)
- **Action:** Fix all TS errors; add `tsc --noEmit` to build pipeline

---

## HIGH PRIORITY (Should Fix Before Launch)

### 6. PASSWORD RESET IS FAKE
- **Frontend:** `PasswordResetView.tsx` lines 19-23 uses `setTimeout()` mock
- **Frontend:** `SetNewPasswordView.tsx` lines 40-44 uses `setTimeout()` mock
- **Backend:** `auth.ts` lines 273-291 returns success but sends no email
- **Action:** Implement real email delivery (SendGrid/SES) or remove the feature entirely

### 7. PROFILE UPDATE IS FAKE
- **File:** `ProfileView.tsx` lines 10, 20-33
- Email hardcoded to `'user@example.com'`
- Password/email save shows success toast but does nothing
- **Action:** Wire up to real API endpoints

### 8. GOOGLE OAUTH BUTTONS DO NOTHING
- **Files:** `LoginView.tsx` lines 110-115, `RegisterView.tsx` lines 126-132
- "Continue with Google" buttons have no onClick handler
- **Action:** Implement OAuth or remove the buttons

### 9. NO AUTOMATED DATA SYNC (CRON)
- All data syncs (players, stats, games, news) are manual-only
- Production users will see stale data immediately
- **Action:** Set up Cloudflare Cron Triggers or external scheduler

### 10. PROJECTIONS TABLE NEVER SYNCED
- `playerProjections` table exists in schema but no sync endpoint exists
- UI projection features will show null/empty data
- **Action:** Define projection data source and implement sync

### 11. LIVE SCORING IS A STUB
- **File:** `matchups.ts` lines 130-162 returns static data
- Individual player points hardcoded to `0` (line 94)
- **Action:** Implement real scoring calculation from weekly stats

### 12. TRENDING PLAYERS RETURNS RANDOM DATA
- **File:** `players.ts` lines 624-648
- Uses `Math.random()` for trend values and ownership percentages
- **Action:** Calculate from real add/drop transaction data

### 13. MISSING SECURITY HEADERS
- No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`
- **Action:** Add security headers middleware

### 14. CORS ALLOWS WILDCARD SUBDOMAINS
- **File:** `index.ts` lines 37-51
- Accepts any `*.pages.dev` and `*.cloudflarepages.com` origin
- **Action:** Whitelist only your specific production domain

### 15. MISSING STATIC ASSETS
- `index.html` references `favicon.svg`, `apple-touch-icon.png`, `og-image.png` - none exist
- **Action:** Create and add these files to `public/`

---

## MEDIUM PRIORITY (Fix Soon After Launch)

### 16. MOCK NOTIFICATIONS
- **File:** `Header.tsx` lines 22-55 - hardcoded `mockNotifications` array
- "Mark all as read" (line 228) and "View all notifications" (line 257) have no handlers
- **Action:** Build real notification system or remove

### 17. NO INPUT VALIDATION ON REGISTRATION
- **File:** `auth.ts` lines 25-36
- No email format validation (regex), no username length/character constraints
- **Action:** Add validation middleware

### 18. MISSING DATABASE INDEXES
- Foreign keys like `leagueMembers.leagueId`, `teams.leagueId`, `rosters.teamId` have no indexes
- Will slow down as data grows
- **Action:** Add indexes on foreign key columns

### 19. N+1 QUERY IN LEAGUE SYNC
- **File:** `leagues.ts` lines 620-696
- One DB query per roster player (60+ queries per roster)
- **Action:** Batch fetch players with IN clause

### 20. JWT EXPIRATION TOO LONG
- Token expires in 7 days with no refresh token mechanism
- **Action:** Reduce to 24h, implement refresh tokens

### 21. YAHOO INTEGRATION INCOMPLETE
- **File:** `leagueConnect.ts` lines 163-172 - stub that returns null
- UI shows "Coming soon" badge
- **Action:** Implement or remove from UI

### 22. TRADE SYSTEM NOT IMPLEMENTED
- Schema tables exist (`trades`, `tradeItems`) but no API routes
- **Action:** Build trade endpoints or remove schema

### 23. NEWS DELETED ON EACH SYNC
- Non-Sleeper news entries wiped on re-sync (no history preserved)
- **Action:** Archive old entries instead of deleting

### 24. ROUTE FALLBACK RENDERS NULL
- **File:** `App.tsx` lines 411-412
- Unknown routes render a blank screen instead of a 404 page
- **Action:** Add a proper 404/not-found component

### 25. WRANGLER IS OUTDATED
- Currently v3.114.17, latest is v4.70.0
- **Action:** Update with `npm update wrangler`

---

## LOW PRIORITY (Polish Items)

| # | Issue | File |
|---|-------|------|
| 26 | No `robots.txt` or `sitemap.xml` | `public/` |
| 27 | No PWA support (no service worker or manifest) | Global |
| 28 | No CI/CD pipeline | Global |
| 29 | No API documentation (OpenAPI/Swagger) | `server/` |
| 30 | No LICENSE file | Root |
| 31 | Wildcard versions for `clsx` and `tailwind-merge` in package.json | `package.json` |
| 32 | No `preview` or `lint` scripts in frontend | `package.json` |
| 33 | Seed data is hardcoded 2024 test data | `server/src/db/seed.sql` |
| 34 | ESPN game sync doesn't fetch live scores | `server/src/services/espn.ts` |
| 35 | Image CDN URLs have no 404 fallback | Player headshots |
| 36 | Season/week detection uses fragile month heuristic | `espn.ts` lines 27-35 |
| 37 | `import-players.ts` is deprecated but still in repo | `server/scripts/` |
| 38 | Pagination max limit of 2000 is too high | `players.ts` line 131 |
| 39 | Silent disconnect failure in Settings | `SettingsView.tsx` line 196 |
| 40 | Unused `SearchBar.tsx` component with mismatched styling | `src/components/` |

---

## PREMIUM FEATURE IDEAS

### Tier 1 - "FilmRoom Pro" ($4.99/mo)

| Feature | Description |
|---------|-------------|
| **AI Trade Analyzer** | GPT-powered trade evaluations - "Who wins this trade?" with ROS projections |
| **Advanced Projections** | Multiple projection sources (ESPN, FantasyPros, PFF) with consensus rankings |
| **Projection Trend Graphs** | Historical projection movement charts (schema already exists: `projectionLineSnapshots`) |
| **Start/Sit Recommendations** | AI-generated weekly lineup advice based on matchups, weather, and Vegas lines |
| **Waiver Wire Rankings** | Priority-ranked waiver targets with FAAB bid suggestions |
| **Custom Scoring Alerts** | Push notifications for player milestones, injury updates, and lineup lock reminders |

### Tier 2 - "FilmRoom Elite" ($9.99/mo)

| Feature | Description |
|---------|-------------|
| **Multi-League Dashboard** | Unified view across all leagues with cross-league player exposure tracking |
| **Dynasty/Keeper Rankings** | Long-term player valuations with age curves and draft capital analysis |
| **DFS Optimizer** | Lineup optimizer for DraftKings/FanDuel with salary cap constraints |
| **Playoff Probability Engine** | Monte Carlo simulation of remaining schedule to predict playoff odds |
| **Live Draft Assistant** | Real-time draft board with ADP comparison, positional scarcity alerts, and best available |
| **Opponent Scouting Report** | Weekly matchup analysis with opponent roster strengths/weaknesses |
| **Historical Performance Database** | Multi-season stat comparison and splits (home/away, indoor/outdoor, vs division) |

### Tier 3 - One-Time Purchases

| Feature | Price | Description |
|---------|-------|-------------|
| **Draft Kit** | $14.99 | Pre-draft rankings, mock draft simulator, cheat sheets |
| **Playoff Bundle** | $4.99 | Enhanced playoff predictor, championship odds, optimal lineups for playoffs |
| **Commissioner Tools** | $7.99 | League history, all-time records, trophy case, custom awards |

### Implementation Notes for Premium
- The "Upgrade" and "Manage plan" buttons already exist in `ProfileView.tsx` (lines 198-205) but have no handlers
- Stripe integration recommended for payments
- Feature gating via JWT claims (add `plan: 'pro' | 'elite' | 'free'` to token payload)
- Database: Add `subscription_tier`, `subscription_expires_at` columns to `users` table

---

## RECOMMENDED LAUNCH CHECKLIST

### Before Public Launch:
- [ ] Revoke and rotate exposed OpenAI API key
- [ ] Remove hardcoded JWT secret from wrangler.toml
- [ ] Add `.dev.vars` to `.gitignore`
- [ ] Fix production API URL fallback
- [ ] Add rate limiting to auth endpoints
- [ ] Fix all 13 TypeScript errors
- [ ] Implement or remove password reset flow
- [ ] Implement or remove Google OAuth buttons
- [ ] Wire up profile update endpoints
- [ ] Add security headers middleware
- [ ] Create favicon, apple-touch-icon, and OG image
- [ ] Lock down CORS to production domain only
- [ ] Set production secrets via `wrangler secret put`
- [ ] Add proper 404 page
- [ ] Set up automated data sync (cron)
- [ ] Test full user flow end-to-end

### Before Premium Launch:
- [ ] Integrate Stripe for payments
- [ ] Add subscription tier to user schema
- [ ] Implement feature gating middleware
- [ ] Build premium feature endpoints
- [ ] Add upgrade/downgrade flow
- [ ] Test billing edge cases (cancellation, expiry, renewal)
