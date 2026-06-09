# FilmRoom — UI Cohesion Audit

> Audit of every major view against [`design-standard.md`](./design-standard.md)
> (the landing page's design DNA). Goal: a cohesive feel across the app. Done as
> a read-only pass — no code changed. Findings grouped by the standard's 8-point
> conformance checklist.

## Verdict

The app is **structurally on-standard** — pill-pattern filter toggles, ~120ms
transitions, tight heading tracking, the radius scale, and position colors are
**already followed almost everywhere**. The cohesion gap is **almost entirely
one issue**, plus two smaller ones.

## The three things that break cohesion

### 1. `slate-*` instead of the neutral ramp — **the headline gap (every view)**
Checklist rule #1. The whole app paints dark surfaces with Tailwind `slate-900 /
800 / 700` (a blue-gray) and text with `slate-200/300/400/500`. The landing
standard is **neutral** (`#0a0a0a / #111 / #1a1a1a / #222`). Side by side, app
surfaces read cooler, bluer, and a touch lighter than the landing. This single
hue choice is responsible for ~80% of the "different product" feeling.

Found in: HomeView, PlayerTable, AllPlayersView, RosterBoardPanel, NewsPanel,
BiggestMovers, TeamView, MatchupView, GameSlateView, GameDetailModal,
PlayoffPredictorView, TradeAnalyzerView/Shell, TradeHistoryView, TrendsView,
WaiversView, DraftRankingsView, Sidebar, Header, LeagueManager, SettingsView,
ProfileView, PlayerCard — **i.e., all of them.**

**→ Recommended fix (highest leverage, lowest churn): re-point the `slate`
theme variables to the landing's neutral hexes.** This is **Tailwind v4** — the
`slate` scale is defined as `--color-slate-50 … --color-slate-950` theme vars
(`src/index.css:95-104`), and every `slate-*` utility references
`var(--color-slate-NNN)`. Overriding those ~11 variable definitions to neutral
values (`900 ≈ #1a1a1a`, `800 ≈ #222`, `700 ≈ #2a2a2a`, lighter steps to
`#fafafa`) recolors the **entire app from one place** with zero component churn
and instantly matches the landing. (Do it via a `@theme` override in the CSS
source rather than hand-editing compiled output, so a rebuild can't clobber it.)
Caveat: verify the light-mode steps (`slate-50/100/200` used as light surfaces)
still read correctly after the swap. A per-component `slate-→neutral-` sweep is
the fallback.

### 2. `shadow-*` on cards / dropdowns / modals — **~12 files**
Checklist rule #3 (depth = borders only; the only allowed shadow is a modal
scrim `bg-black/60`). Concrete hits:

| File:line | Offending | Fix |
|---|---|---|
| AllPlayersView.tsx:378 | `shadow-xl` (week dropdown) | drop shadow, keep border |
| TeamView.tsx:161,220 | `shadow-xl` (dropdowns) | drop |
| GameSlateView.tsx:247 | `hover:shadow-lg` (game card) | drop |
| GameDetailModal.tsx:112 | `shadow-2xl` (modal box) | drop |
| GameDetailModal.tsx:186,207,250,275 | `shadow-sm` / `hover:shadow-lg` | drop |
| Header.tsx:117,189 | `shadow-xl` (league + search dropdowns) | drop |
| LeagueManager.tsx:97 | `shadow-lg` (portal dropdown) | drop |
| Sidebar.tsx:115 | `shadow-sm` (active nav item) | drop |
| SettingsView.tsx:745 | `shadow-2xl` (modal) | drop |
| Profile/PlayerCard | `shadow-2xl` (PlayerCard.tsx:367), card shadows | drop |
| TradeAnalyzerView.tsx:312,944 | `shadow-lg` / `shadow-black/40` | drop |
| TradeAnalyzerShell.tsx:42 | `shadow-sm` (active tab) | drop |
| DraftRankingsView.tsx:870 | `shadow-xl` (compare modal) | drop |
| PlayerTable.tsx:73 | inline `boxShadow` inset on owned row | keep border accent, drop shadow |

### 3. `PlayerList.tsx` — off-brand **purple** theme (single worst offender)
Rules #1, #2, #8. Uses `bg-black/40 backdrop-blur` surfaces, `purple-500/40`
selected state, `border-purple-400`, `text-purple-300`, and **TE = purple**
(should be amber). This file diverges hardest from the whole design language.
**→ Fix:** neutral surfaces + blue-500/600 selection + TE→amber.

## Smaller nits (low severity)
- Avatar circles use `bg-slate-800` widely (resolves with the palette swap).
- `GameDetailModal.tsx:114` and `PlayerCard.tsx:369` use `from-slate-800
  to-slate-900` header gradients — flatten to a single neutral surface.
- `HomeView.tsx:367` hero gradient hardcodes `rgb(15,23,42)` (= slate-900) —
  swap to neutral.
- `PlayerList.tsx:33` `bg-gray-500` fallback — use neutral.

## Per-file severity (HIGH = whole-surface palette / structural drift)

| File | HIGH | MED | LOW | Notes |
|---|---|---|---|---|
| Sidebar.tsx | 3 | 1 | – | frame-critical (every page) |
| Header.tsx | 3 | 2 | – | frame-critical |
| HomeView.tsx | 3 | 3 | 1 | slate hero gradient |
| MatchupView.tsx | ~6 | – | – | pervasive slate |
| GameDetailModal.tsx | 3 | 3 | – | shadows + slate gradient |
| GameSlateView.tsx | 4 | 2 | – | hover shadow |
| PlayoffPredictorView.tsx | ~11 | – | – | pervasive slate (clean otherwise) |
| TradeAnalyzerView.tsx | many | 2 | 1 | slate + dropdown shadows |
| TradeHistoryView.tsx | many | – | – | pervasive slate |
| TrendsView.tsx | many | 1 | – | pervasive slate |
| WaiversView.tsx | many | 2 | – | pervasive slate |
| SettingsView.tsx | 3 | 1 | 1 | modal shadow |
| ProfileView.tsx | 1 | 2 | – | slate inputs/cards |
| PlayerCard.tsx | 1 | 3 | – | shadow-2xl + slate gradient |
| PlayerTable.tsx | 2 | 5 | 1 | inline inset shadow |
| AllPlayersView.tsx | 2 | 3 | – | shadow-xl dropdown |
| **PlayerList.tsx** | 1 | 3 | 2 | **purple theme — refactor** |
| RosterBoardPanel/NewsPanel/BiggestMovers | 1 each | 2 | – | light; just slate surfaces |
| **DraftRankingsView.tsx** | 0 | 2 | 2 | **closest to standard — use as template** |

## Recommended fix order

1. **Palette override (1 PR, near-zero churn, ~80% of the win):** re-point the
   `slate` scale in the Tailwind config to the landing's neutral hexes. Verify a
   handful of screens in the preview (light + dark).
2. **De-shadow sweep (1 PR):** remove the `shadow-*` from the ~12 files above
   (keep modal scrims). Mechanical.
3. **PlayerList.tsx (1 PR):** purple → neutral + blue, TE → amber.
4. **Polish nits:** flatten slate header gradients, fix the hardcoded
   `rgb(15,23,42)` hero gradient.

Steps 1–2 alone should make the app read as one product with the landing page.
`DraftRankingsView` is the reference for "what conformant looks like."
