import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const get = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (url: string) => get(url) },
  ApiError: class ApiError extends Error {},
}));

import { LeagueTrends } from './LeagueTrends';

beforeAll(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const teams = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }];
const week = (w: number, oddsA: number, oddsB: number) => ({
  week: w,
  teams: [
    { teamId: 'a', wins: w, losses: 0, ties: 0, pointsFor: 120 * w, standingsRank: 1, scoringRank: 1, playoffOdds: oddsA },
    { teamId: 'b', wins: 0, losses: w, ties: 0, pointsFor: 100 * w, standingsRank: 2, scoringRank: 2, playoffOdds: oddsB },
  ],
});

describe('LeagueTrends', () => {
  it('shows week-by-week playoff odds in the table view and hides AI power rank for non-Pro', async () => {
    get.mockResolvedValue({ seasonYear: 2026, playoffTeams: 1, teams, weeks: [week(1, 70, 30), week(2, 85, 15)], aiPowerRankings: null });
    render(<LeagueTrends leagueId="L1" isDarkMode={false} defaultTeamId="b" />);

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Playoff odds' })).toBeInTheDocument());
    expect(get).toHaveBeenCalledWith('/league-analyzer/L1/history');
    expect(screen.queryByRole('tab', { name: 'AI power rank' })).toBeNull();
    // The viewer's team is highlighted by default.
    expect(screen.getByLabelText('Highlight')).toHaveValue('b');

    fireEvent.click(screen.getByRole('button', { name: /table/i }));
    const table = screen.getByRole('table');
    const bravo = within(table).getByRole('row', { name: /Bravo/ });
    expect(within(bravo).getByText('30%')).toBeInTheDocument();
    expect(within(bravo).getByText('15%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Standings' }));
    expect(within(screen.getByRole('table')).getByRole('row', { name: /Alpha/ })).toHaveTextContent('#1');
  });

  it('offers the AI power rank tab when rankings exist', async () => {
    get.mockResolvedValue({
      seasonYear: 2026, playoffTeams: 1, teams, weeks: [week(1, 70, 30)],
      aiPowerRankings: [{ week: 1, ranking: ['b', 'a'] }],
    });
    render(<LeagueTrends leagueId="L2" isDarkMode={false} defaultTeamId={null} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'AI power rank' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'AI power rank' }));
    fireEvent.click(screen.getByRole('button', { name: /table/i }));
    expect(within(screen.getByRole('table')).getByRole('row', { name: /Bravo/ })).toHaveTextContent('#1');
  });

  it('explains when no week is complete yet', async () => {
    get.mockResolvedValue({ seasonYear: 2026, playoffTeams: 1, teams, weeks: [], aiPowerRankings: null });
    render(<LeagueTrends leagueId="L3" isDarkMode={false} defaultTeamId={null} />);
    await waitFor(() => expect(screen.getByText(/first week of the season is complete/)).toBeInTheDocument());
  });
});
