import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
// `../App` only contributes the `Player` type (compiled away), so an empty
// module is enough. `api` and the league/auth contexts are mocked so the
// component renders against controlled fixtures with no network or
// providers. useOdds/usePlayerProps are mocked to no-ops — this suite is
// about the Full Season projected-vs-actual display, not odds/props.
const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  league: { current: null as any },
  roster: { current: [] as any[] },
  auth: { current: { user: null as any, isAuthenticated: false } },
}));

vi.mock('../App', () => ({}));
vi.mock('../services/api', () => ({
  default: { get: hoisted.mockGet },
  api: { get: hoisted.mockGet },
}));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => ({ league: hoisted.league.current, roster: hoisted.roster.current }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => hoisted.auth.current,
}));
vi.mock('../hooks/useOdds', () => ({
  useOdds: () => ({ odds: [] }),
}));
vi.mock('../hooks/usePlayerProps', () => ({
  usePlayerProps: () => ({ getPropsForPlayer: () => null }),
  formatPropLine: () => null,
}));

import { PlayerTable } from './PlayerTable';

// ── Fixtures ─────────────────────────────────────────────────────────

function makePlayer(over: Record<string, any>) {
  return {
    id: over.id,
    name: over.name,
    team: over.team ?? 'BUF',
    position: over.position ?? 'QB',
    status: over.status ?? 'active',
    byeWeek: null,
    headshotUrl: null,
    avgPointsPPR: over.avgPointsPPR ?? 0,
    projectedPoints: over.projectedPoints ?? 0,
    weeklyProjectedPoints: over.weeklyProjectedPoints,
    isRostered: false,
    seasonProjectedPoints: over.seasonProjectedPoints ?? null,
    seasonActualPoints: over.seasonActualPoints ?? null,
    seasonStats: over.seasonStats,
    recentWeeklyScores: over.recentWeeklyScores ?? [],
  };
}

// A player covered by the redraft projection pool: genuine season projection.
const ALLEN = makePlayer({
  id: 'a', name: 'Josh Allen', team: 'BUF', position: 'QB',
  seasonProjectedPoints: 380.4,
  seasonActualPoints: 120.5,
  seasonStats: { games: 5, gamesPlayed: 5, fantasyPointsPPR: 120.5, fantasyPointsHalf: 118, fantasyPointsStd: 110, passYards: 1500, passTDs: 12, rushYards: 100, rushTDs: 1, receptions: 0, receivingYards: 0, receivingTDs: 0 },
});

// A player outside the ranked pool: no projection, falls back to actual.
const OBSCURE = makePlayer({
  id: 'b', name: 'Obscure Backup', team: 'NYJ', position: 'RB',
  seasonProjectedPoints: null,
  seasonActualPoints: 45.2,
  seasonStats: { games: 5, gamesPlayed: 5, fantasyPointsPPR: 45.2, fantasyPointsHalf: 40, fantasyPointsStd: 35, passYards: 0, passTDs: 0, rushYards: 300, rushTDs: 2, receptions: 5, receivingYards: 30, receivingTDs: 0 },
});

function seasonModeResponse() {
  return {
    players: [ALLEN, OBSCURE],
    pagination: { page: 1, limit: 500, total: 2, totalPages: 1 },
    weekComplete: false,
    pointsType: 'projected',
  };
}

function weekModeResponse() {
  return {
    players: [
      makePlayer({ id: 'a', name: 'Josh Allen', team: 'BUF', position: 'QB', projectedPoints: 24.1, weeklyProjectedPoints: 22.0 }),
    ],
    pagination: { page: 1, limit: 500, total: 1, totalPages: 1 },
    weekComplete: true,
    pointsType: 'actual',
  };
}

function renderTable(currentWeek = 1) {
  return render(
    <PlayerTable
      selectedScoring="PPR"
      onScoringChange={vi.fn()}
      selectedPosition="ALL"
      onPositionChange={vi.fn()}
      currentWeek={currentWeek}
      onWeekChange={vi.fn()}
      onPlayerClick={vi.fn()}
      onViewAll={vi.fn()}
      isDarkMode={false}
    />,
  );
}

beforeEach(() => {
  hoisted.mockGet.mockReset();
  hoisted.mockGet.mockResolvedValue(weekModeResponse());
  hoisted.league.current = null;
  hoisted.roster.current = [];
  hoisted.auth.current = { user: null, isAuthenticated: false };
});

// ── Tests ────────────────────────────────────────────────────────────

describe('PlayerTable — Week mode (unaffected by Full Season changes)', () => {
  it('fetches with a week param and shows the API-reported pointsType', async () => {
    renderTable(3);
    // With pointsType 'actual' the callout cards (BOOM/BUST/WK MVP) also
    // render the player's name, so assertions here are scoped to the table
    // grid to stay unambiguous.
    const grid = await screen.findByRole('grid', { name: 'Player rankings' });
    await within(grid).findByText('Josh Allen');
    const url = hoisted.mockGet.mock.calls[0][0] as string;
    expect(url).toContain('week=3');
    expect(url).not.toContain('sortBy=avgPointsPPR');
    // Week mode never shows the Full Season Proj/Actual badge.
    expect(within(grid).queryByText('Proj')).toBeNull();
    expect(within(grid).queryByText('Actual')).toBeNull();
  });
});

describe('PlayerTable — Full Season projected vs actual', () => {
  it('omits the week param and requests season aggregates', async () => {
    hoisted.mockGet.mockResolvedValue(seasonModeResponse());
    renderTable(3);
    fireEvent.click(screen.getByRole('button', { name: 'Full Season' }));
    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => !u.includes('week='))).toBe(true);
    });
  });

  it('shows the genuine AI season projection with a "Proj" badge when available', async () => {
    hoisted.mockGet.mockResolvedValue(seasonModeResponse());
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Full Season' }));

    await screen.findByText('Josh Allen');
    const row = screen.getByText('Josh Allen').closest('tr') as HTMLElement;
    expect(within(row).getByText('380.4')).toBeInTheDocument();
    expect(within(row).getByText('Proj')).toBeInTheDocument();
  });

  it('falls back to the summed actual points with an "Actual" badge when no projection is covered', async () => {
    hoisted.mockGet.mockResolvedValue(seasonModeResponse());
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Full Season' }));

    await screen.findByText('Obscure Backup');
    const row = screen.getByText('Obscure Backup').closest('tr') as HTMLElement;
    expect(within(row).getByText('45.2')).toBeInTheDocument();
    expect(within(row).getByText('Actual')).toBeInTheDocument();
  });

  it('sorts by the displayed projected/actual value, not raw seasonStats totals', async () => {
    // Obscure's raw season actual (45.2) is lower than Allen's projection
    // (380.4), so sorting desc by the displayed value must keep Allen first.
    hoisted.mockGet.mockResolvedValue(seasonModeResponse());
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Full Season' }));

    const grid = await screen.findByRole('grid', { name: 'Player rankings' });
    await within(grid).findByText('Josh Allen');
    // Each data row is a clickable `role="button"` <tr> (row-expand affordance),
    // which overrides its implicit `role="row"` — so query by that role
    // instead, in DOM order, to read back the rendered sort order.
    const dataRows = within(grid).getAllByRole('button');
    const names = dataRows.map(r => (within(r).queryByText('Josh Allen') ? 'Josh Allen' : 'Obscure Backup'));
    expect(names).toEqual(['Josh Allen', 'Obscure Backup']);
  });
});
