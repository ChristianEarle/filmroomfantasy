# FilmRoom Fantasy — Backlog Completion Plan

Date: 2026-07-15. Supersedes the stale portions of `TODO.md` (snapshot 2026-05-20).
Verified against the actual codebase by a 3-way scout pass (frontend, backend, infra/audit history).

## Ground truth: already DONE (stale in TODO.md)

- **Monetization (P5)**: Stripe checkout/portal/cancel/status/webhook (`server/src/routes/billing.ts`), subscription columns on `users`, ProfileView subscription management UI. Only gap: tier gating is inline per-route, no shared middleware.
- **SEO on player profile**: `PlayerProfileView` has `<SEO>`, JSON-LD Person + BreadcrumbList, canonical, OG/Twitter tags, semantic h1/h2/tables.
- **Player Rankings (Board)**: YOUR TEAM badge + row highlight, week prev/next arrows, Export CSV, header subtitle w/ player count, `RosterBoardPanel` sidebar.
- **Draft Rankings**: Watch/watchlist, Ask AI (`POST /api/draft-rankings/ask`, tier-gated), Compare basket, Export, Trade value seed.
- **Trends**: Roster Trends + Projection Movers + Recent Best Performers tabs, all live.
- **PlayerCard**: FilmRoom Insights (real matchup-grade data), matchup grade badge, View full profile link.
- **Backend**: `/players/recent-leaders`, `/players/:id/matchup-grade`, projections with per-stat categories, odds/props data layer, 5 cron jobs, D1 rate limiting, sessions.
- **UI cohesion step 1**: app-wide neutral palette swap (`globals.css`), design docs at `docs/design-standard.md` + `docs/ui-cohesion-audit.md`.

## Blocked on the owner (not code)

- **Google OAuth client ID** (P0) — create in Google Cloud Console, set `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID`, `wrangler secret put GOOGLE_CLIENT_ID`.
- **ECR (FantasyPros API key)**, **paid odds API** for prop-line movement history, **live Pro/Elite verification** of draft Ask AI.
- Remote D1 migration applies + worker deploy for anything below that adds tables.

## Deferred (needs external data sources / platform sync that doesn't exist yet)

- Odds Movement tab on Trends (needs prop-line *history* source), full-season projections (weekly-props-derived only today), ESPN/Yahoo league sync + their draft picks (Phases 2/3), FantasyPros ECR / Underdog ADP, AI post-game recaps (follow-up), push notifications (in-app lands now; push is follow-up).

---

## Execution: three waves of parallel agents

Each stream has exclusive file ownership within its wave; shared files (`schema.ts`,
`server/src/index.ts`, migrations, `App.tsx`, `Header.tsx`) have exactly one owner per wave.
Integration, route registration for new route files, CI, and docs refresh are done centrally
between waves. Verify gates between waves: `npm run typecheck`, `npm run typecheck:server`,
`npm test`, `npm run build`.

### Wave A — features + functional audits (8 parallel streams)

| # | Stream | Owns | Delivers |
|---|--------|------|----------|
| A1 | Draft Rankings data infra | `server/src/services/draftRankings.ts`, `server/src/routes/draftRankings.ts`, `server/src/db/schema.ts`, migrations `0037`/`0038`, `server/src/index.ts`, `src/components/DraftRankingsView.tsx` (+test) | `rank_history` table + daily snapshot cron + `recentRanks`/rank-movement deltas in API; ceiling/floor from the AI generator; superflex variants generated + toggle restored; trend sparkline + Rank Movement panel + ceiling/floor in the view |
| A2 | Player Rankings board | `server/src/routes/players.ts`, `src/components/PlayerTable.tsx`, `src/services/players.ts`, new `src/components/shared/Breadcrumb.tsx` | Real `recentWeeklyScores` in the list API; replace the fake seeded sparkline with real data; Full Season toggle; breadcrumb. (Ask AI wiring deferred to B4 which owns the endpoint.) |
| A3 | Matchup Edge Analysis | `src/components/MatchupView.tsx`, `server/src/routes/matchups.ts`, `src/services/matchups.ts` | Deterministic FilmRoom Edge Analysis section: position advantages, start/sit deltas vs projections, injury flags — computed from existing matchup + projection data, no AI call |
| A4 | PlayerCard features | `src/components/PlayerCard.tsx` | Projected stat-category breakdown (from existing `/players/:id/projections`); quick actions: Watch (reuse `useWatchlist`), Share (profile URL via clipboard/`navigator.share`) |
| A5 | SEO static pages | `scripts/generate-static-pages.js`, `scripts/prerender.js`, `public/sitemap.xml` handling, `src/components/SEO.tsx` | Per-player static HTML at build time (top rostered skill players, seeded from live API), player URLs in sitemap (generated), JSON-LD upgraded to Person+Athlete |
| A6 | Audit: TeamView, WaiversView, AllPlayersView | those three files | Bug/a11y/type/perf fixes per the audit charter |
| A7 | Audit: GameSlateView, GameDetailModal, TrendsView | those three files | Same charter |
| A8 | Audit: ProfileView, Login/Register/ForgotPassword, ErrorBoundary, PlayerAvatar, NewsPanel/NewsSnippet/BiggestMovers, LeagueManager | those files | Same charter |

### Between waves (central): schema scaffolding for Wave B

Migrations + `schema.ts` entries added centrally so Wave B streams never touch shared files:
`0039_drop_team_scouting_reports.sql` (orphaned table), `0040_add_notifications.sql`,
`0041_add_team_draft_picks.sql`, `0042_add_player_ai_analyses.sql`. Plus shared
`requireTier` middleware (`server/src/middleware/tier.ts`) consolidating the four inline gates.

### Wave B — new surfaces (4 parallel streams)

| # | Stream | Owns | Delivers |
|---|--------|------|----------|
| B1 | Notifications MVP | new `server/src/routes/notifications.ts`, `src/components/Header.tsx`, new `src/hooks/useNotifications.ts` | In-app notifications: list/mark-read/mark-all endpoints; generation on news sync for rostered/watchlisted players' injury-tagged news; bell dropdown with unread count replacing the "coming soon" tooltip |
| B2 | League Analyzer | new `server/src/routes/leagueAnalyzer.ts`, new `src/components/LeagueAnalyzerView.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx` | Real page replacing ComingSoon: team strength grades, positional surplus/deficit, ROS schedule difficulty, playoff odds (reuse Monte Carlo approach from PlayoffPredictor), optional AI narrative behind tier gate |
| B3 | Sleeper draft-pick inventory | `server/src/services/sleeper.ts`, `server/src/routes/leagues.ts`, `server/src/routes/rosters.ts`, `src/components/TradeAnalyzerView.tsx` | `syncDraftPicks` (native seed + `/traded_picks` overlay) into `team_draft_picks`; picks in `buildTeamRoster`; click-to-add pick chips (`2027 1st (via Team Y)`) in the trade builder |
| B4 | AI platform | `server/src/routes/players.ts`, `server/src/routes/trades.ts`, `server/src/services/tradeAnalyzer.ts`, `server/src/routes/draftRankings.ts` (cache_control only), `server/src/utils/prompt.ts`, `src/components/PlayerCard.tsx`, `src/components/PlayerProfileView.tsx`, `src/components/PlayerTable.tsx` | Anthropic prompt caching on all static system prompts; `POST /players/ask` (board-scoped Ask AI) + wire the stub button via `AiChatModal`; `GET /players/:id/analysis` per-player AI take cached in `player_ai_analyses` by (player, week, season), surfaced on PlayerCard + profile page; adopt `requireTier` middleware everywhere |

### Wave C — sequential polish

1. **UI cohesion steps 2–4** (one agent): de-shadow sweep (~12 files listed in `docs/ui-cohesion-audit.md`), PlayerList purple→amber TE fix, gradient nits.
2. **Mobile pass** (one agent, after C1): bottom nav on mobile, touch targets, modal sizing, table scroll audit across views.
3. **Stretch — global Ask AI assistant**: floating entry reusing `AiChatModal` against a league-context endpoint; only if A+B land green.

### Central wrap-up

- Register new route files in `server/src/index.ts`; wire new cron steps.
- CI: add `npm test` + frontend `tsc --noEmit` to PR checks in `.github/workflows/ci.yml`.
- Refresh `TODO.md`/`BACKLOG.md` to ground truth (check off everything verified done).
- Full verify (typecheck ×2, tests, build), commit per wave, push `claude/backlog-review-3om79s`, draft PR.

## Data feeds roadmap (AI decision inputs)

Already ingested: multi-source news (RSS/ESPN/Rotowire/Twitter + Haiku relevance), Vegas
lines + movement snapshots, player props (market projections), Sleeper trending/transactions,
FantasyCalc dynasty values, ESPN live scores, own matchup-grade engine, projection-accuracy history.

To add, in value order (all feed `LeagueContextSnapshot`/prompt context via the existing
cron → D1 table pattern):

1. **Practice reports / injury designations** (DNP/Limited/Full progression) — nflverse
   injuries dataset or ESPN injuries API (free). Highest-signal weekly feed for start/sit
   and trade analysis; Sleeper only gives coarse status.
2. **Usage/opportunity**: snap %, target share, route participation, red-zone touches,
   carry share — nflverse weekly (free). Prerequisite for real "role change" AI takes.
3. **Implied team totals** — derived from game odds already stored; compute and inject into
   matchup/trade/rankings prompts (no new ingestion; folded into Wave B AI-platform stream).
4. **Depth charts** — Sleeper already carries depth_chart fields on players we sync; store
   and expose for handcuff/injury-fallout reasoning.
5. **Weather** — Open-Meteo/NWS (free) keyed by stadium + kickoff for outdoor games.
6. **Redraft ADP** (Sleeper/Underdog) — sharpens draft-rankings value deltas alongside
   the existing dynasty values.
7. **Pace/environment** (neutral pass rate, plays/game) — derivable from nflverse pbp; later.
8. Also: feed the existing projection-accuracy history back into AI prompts ("props have
   overshot this player 4 straight weeks") — differentiated, zero new ingestion.

## Agent charter (applies to every stream)

- Touch only the files your stream owns; if you need a change in a shared file, return it as a note instead of editing.
- Follow `docs/design-standard.md` (neutral palette, no shadows, existing radius/motion tokens); respect `isDarkMode` prop patterns.
- No new npm dependencies. No git commands. Vitest tests where the logic is testable (utils/hooks).
- Migrations: exact numbers as assigned above; SQLite/D1 syntax mirroring existing migrations.
- Tier gating: `subscriptionTier`-based, 403 `{ code: 'TIER_REQUIRED' }` convention.
- Self-verify with `npx tsc --noEmit` (scoped) where possible; final gates run centrally.
