import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// ── Controllable auth: a page refresh starts "loading", then restores the session ──
const authState = { user: null as null | { id: string }, isAuthenticated: false, isLoading: true };
vi.mock('./AuthContext', () => ({
  useAuth: () => authState,
}));

const getLeagues = vi.fn();
vi.mock('../services', () => ({
  leagueService: { getLeagues: () => getLeagues() },
}));

// League detail / roster / matchup fetches aren't under test: never resolve.
vi.mock('../services/api', () => ({
  default: { get: vi.fn(() => new Promise(() => {})), post: vi.fn(() => new Promise(() => {})) },
  ApiError: class ApiError extends Error {},
}));
vi.mock('../services/leagueConnect', () => ({
  leagueConnectService: { syncLeagueIfStale: vi.fn(() => new Promise(() => {})) },
}));

import api from '../services/api';
import { leagueConnectService } from '../services/leagueConnect';
import { LeaguesProvider } from './LeaguesContext';
import { LeagueProvider, useLeagueContext } from './LeagueContext';

function Probe() {
  const { selectedLeagueId } = useLeagueContext();
  return <div data-testid="selected">{selectedLeagueId ?? 'none'}</div>;
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <LeaguesProvider>
      <LeagueProvider>{children}</LeagueProvider>
    </LeaguesProvider>
  );
}

const LEAGUES = [
  { id: 'league-a', name: 'A' },
  { id: 'league-b', name: 'B' },
];

describe('selected league survives a page refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    getLeagues.mockReset();
    vi.mocked(api.get).mockClear();
    vi.mocked(leagueConnectService.syncLeagueIfStale).mockClear();
    authState.user = null;
    authState.isAuthenticated = false;
    authState.isLoading = true;
  });

  it('keeps the saved league while the session is restored, instead of switching to the first league', async () => {
    localStorage.setItem('selectedLeagueId', 'league-b');
    getLeagues.mockResolvedValue({ leagues: LEAGUES });

    const { rerender } = render(<Providers><Probe /></Providers>);
    // Session still restoring: nothing may be cleared.
    expect(localStorage.getItem('selectedLeagueId')).toBe('league-b');

    // Session restored.
    await act(async () => {
      authState.user = { id: 'u1' };
      authState.isAuthenticated = true;
      authState.isLoading = false;
      rerender(<Providers><Probe /></Providers>);
    });

    await waitFor(() => expect(getLeagues).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('league-b'));
    expect(localStorage.getItem('selectedLeagueId')).toBe('league-b');
  });

  it('does not forget the saved league when the leagues fetch fails', async () => {
    localStorage.setItem('selectedLeagueId', 'league-b');
    getLeagues.mockRejectedValue(new Error('network'));
    authState.user = { id: 'u1' };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(getLeagues).toHaveBeenCalled());
    await act(async () => {});
    expect(localStorage.getItem('selectedLeagueId')).toBe('league-b');
  });

  it('never requests a previous user’s saved league after a different user logs in', async () => {
    // Signed out, with the last user's league still saved.
    localStorage.setItem('selectedLeagueId', 'someone-elses-league');
    authState.isLoading = false;
    getLeagues.mockResolvedValue({ leagues: LEAGUES });

    const { rerender } = render(<Providers><Probe /></Providers>);
    await act(async () => {});

    // A different user logs in.
    await act(async () => {
      authState.user = { id: 'u2' };
      authState.isAuthenticated = true;
      rerender(<Providers><Probe /></Providers>);
    });

    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('league-a'));
    const urls = vi.mocked(api.get).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('someone-elses-league'))).toBe(false);
    expect(vi.mocked(leagueConnectService.syncLeagueIfStale)).not.toHaveBeenCalledWith('someone-elses-league');
    expect(urls.some((u) => u.includes('/leagues/league-a'))).toBe(true);
  });

  it('keeps the saved league when the same user logs back in', async () => {
    localStorage.setItem('selectedLeagueId', 'league-b');
    authState.isLoading = false;
    getLeagues.mockResolvedValue({ leagues: LEAGUES });

    const { rerender } = render(<Providers><Probe /></Providers>);
    await act(async () => {});
    await act(async () => {
      authState.user = { id: 'u1' };
      authState.isAuthenticated = true;
      rerender(<Providers><Probe /></Providers>);
    });

    await waitFor(() => expect(getLeagues).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('league-b'));
    expect(localStorage.getItem('selectedLeagueId')).toBe('league-b');
  });

  it('still falls back to the first league when the saved one is gone', async () => {
    localStorage.setItem('selectedLeagueId', 'deleted-league');
    getLeagues.mockResolvedValue({ leagues: LEAGUES });
    authState.user = { id: 'u1' };
    authState.isAuthenticated = true;
    authState.isLoading = false;

    render(<Providers><Probe /></Providers>);
    await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('league-a'));
    expect(localStorage.getItem('selectedLeagueId')).toBe('league-a');
  });
});
