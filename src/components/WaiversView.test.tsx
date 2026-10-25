import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mirrors PlayerTable.test.tsx's mocking approach: stub the API, league and
// auth contexts so WaiversView renders against controlled fixtures with no
// network or providers.
const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  auth: { current: { user: null as any, isAuthenticated: false } },
  mockGetPlayerAnalysis: vi.fn(),
}));

vi.mock('../App', () => ({}));
vi.mock('../services/api', () => ({
  default: { get: hoisted.mockGet },
  ApiError: class ApiError extends Error {},
}));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => ({ league: { id: 'league-1', seasonYear: 2026 }, userTeam: null }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => hoisted.auth.current,
}));
vi.mock('../hooks', () => ({
  useNflState: () => ({ week: 4, season: 2026, state: null, isLoading: false, error: null }),
}));

vi.mock('../services', () => ({
  playerService: { getPlayerAnalysis: hoisted.mockGetPlayerAnalysis },
}));

import { WaiversView } from './WaiversView';

function makeAvailablePlayer(over: Record<string, any>) {
  return {
    id: over.id,
    name: over.name,
    team: over.team ?? 'BUF',
    position: over.position ?? 'WR',
    status: 'active',
    byeWeek: null,
    headshotUrl: null,
    avgPointsPPR: over.avgPointsPPR ?? 0,
    projectedPoints: over.projectedPoints ?? 10,
    seasonStats: null,
  };
}

beforeEach(() => {
  hoisted.mockGet.mockReset();
  hoisted.mockGetPlayerAnalysis.mockReset();
  hoisted.auth.current = { user: null, isAuthenticated: false };
  hoisted.mockGet.mockResolvedValue({
    players: [makeAvailablePlayer({ id: 'p1', name: 'Waiver Wire Wonder' })],
    pointsType: 'projected',
  });
});

describe('WaiversView — AI pickup take', () => {
  it('shows a Pro upsell instead of AI take controls for a free/logged-out user', async () => {
    render(<WaiversView onPlayerClick={vi.fn()} onViewAll={vi.fn()} isDarkMode={false} />);
    await waitFor(() => expect(screen.getAllByText('Waiver Wire Wonder').length).toBeGreaterThan(0));
    expect(screen.getByText('AI Take (Pro)')).toBeTruthy();
    expect(hoisted.mockGetPlayerAnalysis).not.toHaveBeenCalled();
  });

  it('lets a Pro user expand and fetch the AI take for a top available player', async () => {
    hoisted.auth.current = { user: { subscriptionTier: 'pro' }, isAuthenticated: true };
    hoisted.mockGetPlayerAnalysis.mockResolvedValue({ analysis: 'Strong pickup — trending usage.', cached: false });

    render(<WaiversView onPlayerClick={vi.fn()} onViewAll={vi.fn()} isDarkMode={false} />);
    await waitFor(() => expect(screen.getAllByText('Waiver Wire Wonder').length).toBeGreaterThan(0));
    expect(screen.queryByText('AI Take (Pro)')).toBeNull();

    const toggle = screen.getByTitle('Show AI pickup take');
    fireEvent.click(toggle);

    await waitFor(() => expect(hoisted.mockGetPlayerAnalysis).toHaveBeenCalledWith('p1', { week: 4, season: 2026 }));
    await waitFor(() => expect(screen.getByText('Strong pickup — trending usage.')).toBeTruthy());
  });
});
