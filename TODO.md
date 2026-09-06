# FilmRoom Fantasy — TODO

What's left to finish, re-verified against the codebase. Completed work and
historical context live in `BACKLOG.md`; the 2026-07 completion sprint is
documented in `docs/COMPLETION_PLAN.md` and PR #243.

Snapshot: 2026-07-16 (post completion sprint).

---

## Shipped by the 2026-07 completion sprint (PR #243)

- Draft Rankings data infra: superflex variants + toggle, `rank_history` +
  daily snapshots, TREND sparklines, 1d/7d/30d movement, AI ceiling/floor
- Player Rankings board: real weekly-score sparklines, Full Season toggle,
  breadcrumb, Ask AI (`POST /players/ask`)
- Matchup page: FilmRoom Edge Analysis rebuilt on real data
- PlayerCard: projected stat breakdown, Watch/Share quick actions,
  FilmRoom AI Take (also on the player profile page)
- League Analyzer: real page (grades, surplus/deficit, ROS schedule,
  Monte Carlo odds, narratives)
- Notifications MVP: injury-news fan-out + real Header bell
- Trade Analyzer: Sleeper draft-pick inventory with click-to-add chips
- AI platform: Anthropic prompt caching, per-player analysis cache,
  shared `requireTier` middleware
- SEO: per-player static pages + generated sitemap
- Audits with fixes on all previously unaudited components (~90 issues),
  `useOdds`/`useGames` bug fixes, 14 baseline type errors cleared
- UI cohesion steps 2–4 (de-shadow, PlayerList palette, gradients)
- Mobile pass: bottom nav, touch targets, modal sizing
- CI now gates PRs on frontend type-check + tests

Deploy notes: migrations `0037`–`0041` auto-apply on merge; superflex +
ceiling/floor data appears after the next Monday ranking batch; rank
history accrues from the first daily cron.

## Shipped since the completion sprint

- Season projections: new `GET /players/:id/season-projection` surfaces
  the AI full-season point total that Draft Rankings' redraft batch
  already generates (`draft_rankings.projectedPoints`) — no new model or
  cron, just exposing existing data outside the Draft Rankings page.
  Shown on PlayerCard's Averages tab alongside the existing week-derived
  projection. Only covers the ~200 players the redraft batch ranks;
  shows a graceful empty state for everyone else.

---

## P0 — Owner action required (not code)

- [ ] **Google OAuth client ID** — create in Google Cloud Console, set
  `GOOGLE_CLIENT_ID` (server `.dev.vars` + `wrangler secret put`) and
  `VITE_GOOGLE_CLIENT_ID` (`.env`), configure authorized origins. Code is
  fully wired; only the credential is missing.
- [ ] **Live Pro/Elite verification** — one authed round-trip each for
  `/draft-rankings/ask`, `/players/ask`, and `/players/:id/analysis` in
  prod (tests mock Anthropic). Still needs a Pro login to exercise the
  gated paths for real.
- [x] **Sign off on dropping `team_scouting_reports`** — dropped in
  migration `0044_drop_team_scouting_reports.sql` (2026-09-06).

## P1 — Remaining feature gaps

- [ ] **Push notifications** — in-app notifications shipped; web push /
  email delivery (and waiver/trade/lineup-lock event types) remain.
- [x] **Season projections** — `GET /players` in season mode now returns
  genuine full-season `seasonProjectedPoints` from `draft_rankings`
  (redraft, matching scoring format), with `seasonActualPoints` as a
  labeled fallback (#301).
- [ ] **PlayerCard Alert/Pin/Compare actions** — deliberately skipped in
  the sprint (Watch/Share shipped). Compare could reuse the Draft
  Rankings compare-basket pattern.
- [x] **Redraft / Dynasty / Rookie three-way split** — true veteran-inclusive
  `dynasty` ranking type added alongside `redraft` and the existing
  rookie-only `dynasty_rookie`; Draft Rankings now has Redraft/Dynasty/
  Rookie pills (#301).
- [x] **Research page decision** — removed from nav for launch; dead
  `ComingSoonView`/`ResearchView` deleted, old `/research` links redirect
  home (#303).

## P2 — Data feeds (see roadmap in docs/COMPLETION_PLAN.md)

- [ ] Practice reports / injury designations (nflverse or ESPN, free)
- [ ] Usage data: snap %, target share, red-zone touches (nflverse, free)
- [ ] Depth charts (Sleeper fields already synced upstream — store/expose)
- [ ] Weather for outdoor games (Open-Meteo/NWS, free)
- [ ] Redraft ADP (Sleeper/Underdog)
- [ ] Feed projection-accuracy history back into AI prompts

## P3 — Blocked on external data sources / platform sync

- [ ] **Odds Movement tab on Trends** — needs prop-line history (paid
  odds API or scraping); `player_prop_lines`-style snapshots + cron.
- [ ] **ECR + Best Ball ADP columns** — FantasyPros API key (paid) /
  Underdog ADP; `player_external_ranks` table.
- [ ] **MFL draft-pick parity** (`?TYPE=futureDraftPicks`) — verify
  against a real MFL league first. ESPN/Yahoo pick sync blocked on those
  platforms having league sync at all.

## P3 — Nice-to-haves / follow-ups

- [ ] **Global AI chat assistant** — persistent bubble reusing
  `AiChatModal` against a league-context endpoint; per-surface Ask AI
  (board, draft rankings) shipped and covers most of the value.
- [ ] **AI post-game recaps** — cron on `gameStatus === 'final'`,
  cache per game; surface on GameDetailModal + matchup recap.
- [ ] **ROS rankings** — new ranking type projecting rest-of-season value.
- [ ] **Expanded player row on the board** (inline stat breakdown) — the
  modal + AI take cover this; inline expand is a UX preference.
- [ ] **De-shadow vendored `src/components/ui/*` primitives** — left
  untouched by the cohesion sweep (unbounded blast radius).
- [x] **Server-side test harness** — Vitest harness added (`unit` +
  `@cloudflare/vitest-pool-workers` projects), 45 tests, wired into CI (#302).
- [ ] **Newsletter email capture**, **ad integration** (monetization
  experiments).

## P6 — Premium roadmap (unchanged)

Stripe/billing/gating infrastructure is DONE. Remaining premium features
as previously scoped: Start/Sit Optimizer, Waiver Wire Rankings, Advanced
Projections, Custom Alerts, Snap Count Analytics (Pro); Multi-League
Dashboard, DFS Optimizer, Live Draft Assistant, Opponent Scouting, Dynasty
Age Curves, Historical Splits (Elite); Draft Kit / Playoff Bundle /
Commissioner Toolkit (one-time).

---

## Notes

- Source of truth for new ideas + completed history remains `BACKLOG.md`.
- When something here ships, check it off here AND mirror to `BACKLOG.md`.
