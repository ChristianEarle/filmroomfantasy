# FilmRoom — UI Design Standard

> **Source of truth: the landing page** (`src/components/LandingPage.tsx`). Its
> self-contained `.lp`-scoped stylesheet (`LANDING_CSS`) defines FilmRoom's
> visual identity. Every other view should read as the same product. This file
> codifies that standard and maps it to the app's Tailwind system so the rest of
> the app can align without rewriting the landing page.

## TL;DR — the look

Flat, **neutral near-black**, **electric-blue accent**, **border-defined surfaces
(no shadows)**, **Inter** with tight heading tracking, generous section rhythm,
fast (~120ms) transitions. Think "clean dark analytics dashboard," not "glassy"
or "material."

## ⚠️ The headline cohesion gap

- **Landing** uses **neutral** grays — backgrounds `#0a0a0a / #111 / #1a1a1a`,
  borders `#222`. These are `neutral-*` / `zinc-*` hues (no blue tint).
- **The app** uses Tailwind **`slate-*`** — `slate-900 (#0f172a)`, `slate-800`,
  `slate-700` — which carry a visible **blue-gray tint**, plus dark/light mode.

Side by side, app surfaces look cooler/bluer and slightly lighter than the
landing. **Primary alignment lever:** move the app's dark-surface ramp from
`slate-*` toward the neutral ramp below (or define shared CSS-var tokens both
consume). Until then, audit findings flag `slate-*` surfaces as the main drift.

---

## Color tokens

Landing CSS var → meaning → closest Tailwind:

| Token | Hex | Role | Tailwind ~equiv |
|---|---|---|---|
| `--bg` | `#0a0a0a` | App/base background | `neutral-950`(#0a0a0a) |
| `--bg2` | `#111111` | Raised bg / sub-bars | `neutral-900`-ish |
| `--card` | `#1a1a1a` | Card / panel surface | `neutral-900`(#171717)→`#1a1a1a` |
| `--card2` | `#222222` | Nested surface / track | `neutral-800`-ish |
| `--border` | `#222222` | Default border | `neutral-800` |
| `--border2` | `#2a2a2a` | Hover/elevated border | `neutral-700`-ish |
| `--text` | `#e5e5e5` | Body text | `neutral-200` |
| `--text-bright` | `#ffffff` | Headings / emphasis | `white` |
| `--muted` | `#737373` | Muted/labels | `neutral-500` |
| `--muted2` | `#a3a3a3` | Secondary text | `neutral-400` |

**Accent — blue (the one brand color):**

| Token | Hex | Tailwind |
|---|---|---|
| `--blue` | `#3b82f6` | `blue-500` |
| `--blue-hover` | `#2563eb` | `blue-600` |
| `--blue-glow` | `rgba(59,130,246,.12)` | `blue-500/10` |
| `--blue-border` | `rgba(59,130,246,.35)` | `blue-500/35` |

**Semantic:** green `#22c55e` (`green-500`), gold `#eab308` (`yellow-500`),
red `#ef4444` (`red-500`), orange `#f97316` (`orange-500`). Each used with a
`/12` (~10–15%) alpha background for chips/tags.

**Position colors** (badge text on a `/15` alpha bg of the same hue):
QB → red `#f87171`, RB → green `#4ade80`, WR → blue `#60a5fa`, TE → amber `#fbbf24`.

---

## Typography

- **Family:** `'Inter', ui-sans-serif, system-ui, …` — single family, antialiased.
- **Headings carry negative tracking; labels carry positive tracking.**

| Element | Size | Weight | Tracking | Color |
|---|---|---|---|---|
| Hero `h1` | 44px (30px ≤860) | 800 | `-0.03em` | bright/white |
| Section `h2` | 30px | 800 | `-0.02em` | bright/white |
| Card `h3` | 15–20px | 700 | — | bright/white |
| Step/price `h4` | 15–16px | 700 | — | bright/white |
| Body | 13–16px | 400–500 | — | `--text`/`--muted2` |
| **Micro-label** | 10px | 600–700 | `+0.06–0.07em`, UPPERCASE | `--muted` |
| Stat number | inherit | 700–800 | — | bright |

Accent emphasis in headings: `h1 em` → not italic, colored `--blue`.

---

## Radius scale

`pos badge` 3px · `pill / tab-pill` 6px · `chip / search` 7px · `btn / price-btn`
8px · `team-box / verdict / mini-card` 10px · `feat / price-card` 12px ·
`card / widget` 14px · `bottom-cta` 16px · `pill tags / step-number / bars` 999px.

→ App equivalent: lean on `rounded-md` (6–8px) for controls, `rounded-xl`
(12px) for cards, `rounded-2xl` (16px) for hero panels, `rounded-full` for
pills/badges. **Avoid** ad-hoc one-off radii.

## Elevation

**No drop shadows.** Depth is conveyed entirely by **1px borders** and subtle
background steps (`bg` → `card` → `card2`). Audit flags `shadow-*` / `shadow-xl`
as off-standard (the one acceptable exception: a modal overlay scrim
`bg-black/60`).

## Spacing & layout

- Section vertical rhythm: **72px** (`py-[72px]` ≈ `py-16/18`).
- Container: `max-width:1140px`, `padding:0 24px` (`max-w-[1140px] px-6`).
- Card padding: 18–24px. Control gaps: 3–6px (tight pill rows), 14–24px (groups).

## Motion

- Default transition: **`all .12s`** (snappy). Tailwind: `transition-* duration-100/150`.
- Progress/bar fills: `.35s`. No bouncy/elastic easing; linear/ease.

## Component patterns (the vocabulary to reuse)

- **Button (primary):** filled `--blue`, white text, radius 8px, 600 weight,
  9–11px × 18–22px padding, hover → `blue-600`. **Secondary/outline:**
  transparent bg, 1px `--border`, hover border → `--muted`.
- **Pill / tab-pill:** small 6px-radius toggle; inactive = muted text on
  bg/transparent, active = filled blue + white. Used for scoring/position/format
  filters everywhere.
- **Card / panel:** `--card` bg + 1px `--border` + 12–14px radius, optional
  `bg2` header bar with bottom border. Hover (interactive) → border brightens to
  `--border2` (never a shadow).
- **Micro-label:** 10px uppercase tracked muted label above values (stat blocks,
  control groups, verdict labels).
- **Badge / tag:** tiny 4px-radius pill, semantic `/12` alpha bg + matching text
  (BETA, position, buy/sell, Most Popular, Coming Soon in gold).
- **Stat row:** label (muted) left, value (bright, 700) right, 12–13px.
- **Empty/hint text:** centered 11px muted.

---

## Quick conformance checklist (use during the audit / per PR)

1. Surfaces use the **neutral** ramp (or shared tokens), not raw `slate-*`.
2. The only accent is **blue-500/600**; semantics only for status (green/red/gold).
3. **No `shadow-*`** on cards/panels — borders only.
4. Headings use Inter + **negative tracking**; micro-labels uppercase + positive tracking.
5. Radii snap to the scale (md / xl / 2xl / full) — no ad-hoc px.
6. Filter toggles use the **pill** pattern (inactive muted → active filled blue).
7. Transitions ~**120ms**, no bounce.
8. Position colors match QB-red / RB-green / WR-blue / TE-amber.
