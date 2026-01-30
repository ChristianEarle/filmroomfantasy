# Fantasy Football App - UI/UX Guidelines

This document serves as the source of truth for design patterns, component behaviors, and stylistic rules for the Fantasy Football application. Future updates must adhere to these guidelines to maintain consistency.

## 1. Core Aesthetic & Theme

### Color Palette
- **Theme Mode:** Dark Mode only.
- **Backgrounds:**
  - App Background: `slate-950` (Main canvas)
  - Components/Cards: `slate-900` (Panels, tables, sidebars)
  - Modals/Overlays: `slate-900` with shadow-2xl
- **Borders:** `slate-800` or `slate-700` for higher contrast dividers.
- **Accents:**
  - Primary Action/Highlight: `blue-600` (Buttons, active states, winning teams)
  - Secondary Text: `blue-400` or `emerald-400` for positive trends.
  - Text: `slate-50` (Primary), `slate-400` (Secondary/Metadata).

### Typography
- **Player Names:** Must **ALWAYS** be bold (`font-bold`) to ensure visual hierarchy and readability.
- **Headings:** Clean sans-serif, generally white or light slate.
- **Data/Numbers:** Monospace or tabular nums where alignment matters (e.g., projection tables).

## 2. Layout Architecture

### Navigation
- **Structure:** Permanent Sidebar navigation (Left aligned).
- **Views:**
  - **Home:** Dashboard with news, matchup preview.
  - **Board:** Main player data table.
  - **Team:** Roster management (Starters/Bench).
  - **Matchup:** Head-to-head comparison.
  - **Waivers:** Available players.
  - **Trends:** Line movement/market data.
  - **GameSlate:** NFL games & betting lines.
  - **Playoff Predictor:** Simulation & prediction tools.

## 3. Component Standards

### Data Tables
- **Styling:** Clean rows, hover effects (`hover:bg-slate-800`).
- **Functionality:**
  - Must include filtering for Scoring (PPR/Half/Std), Positions, and Weeks.
- **Interaction:** Clicking a player row/name triggers the Player Card Modal.

### Player Card Modal
- **Trigger:** Click on player name/row.
- **Content Requirements:**
  - Detailed Stats.
  - Market Signals (Buy/Sell indicators).
  - Matchup Grades.
  - Vegas Prop Lines.
  - Projection Breakdowns.

### Playoff Predictor
- **Structure:** Dropdown tab system toggling between two modes:
  1.  **Predictions:** Monte Carlo simulations with probabilities.
  2.  **Simulator:** Interactive manual game picking.
- **Simulator Logic (Integral Rule):**
  - **"Include Points Scored" Toggle:** When enabled, reveals input fields for team scores.
  - **Auto-Winner Selection:** As scores are typed, the system *must* automatically select the winner (higher score).
  - **Visual Feedback:** Winning team button turns Blue (`bg-blue-600`) with a checkmark icon.
  - **Real-time:** Standings table must update immediately upon selection changes.

## 4. Interaction Patterns

- **Feedback:** Interactive elements (buttons, rows) must have hover states.
- **Selection:** Selected items (tabs, filters, teams) use the Primary Blue accent.
- **Input handling:** Numeric inputs (scores) should trigger immediate state recalculations (no "Save" button required for simulation updates).
