import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
// `../App` only contributes the `Player` type (compiled away), so an empty
// module is enough. `api` and the league context are mocked so the
// component renders against controlled fixtures with no network or
// provider — this suite is about the week picker + empty-state/re-sync
// behavior, not the Edge Analysis math (covered elsewhere) or real fetches.
const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  setSelectedMatchupWeek: vi.fn(),
  refreshMatchup: vi.fn(),
  context: {} as any,
}));

vi.mock('../App', () => ({}));
vi.mock('../services/api', () => ({
  default: { get: hoisted.mockGet, post: hoisted.mockPost },
  api: { get: hoisted.mockGet, post: hoisted.mockPost },
}));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => hoisted.context,
}));

import { MatchupView } from './MatchupView';

// A single starter is enough to clear the component's "no roster data at
// all" early return so the header/week-picker/banners under test render.
const ROSTER = [
  {
    id: 'p1',
    name: 'Test Starter',
    team: 'KC',
    position: 'QB',
    slot: 'QB',
    isStarter: true,
    projectedPoints: 20,
  },
];

function baseContext(overrides: Record<string, any> = {}) {
  return {
    league: { currentWeek: 3 },
    userTeam: { id: 'team-1', name: 'My Team' },
    roster: ROSTER,
    matchup: null,
    matchupLoading: false,
    error: null,
    selectedLeagueId: 'league-1',
    selectedMatchupWeek: null,
    setSelectedMatchupWeek: hoisted.setSelectedMatchupWeek,
    matchupCurrentWeek: 3,
    matchupAvailableWeeks: [1, 2, 3],
    refreshMatchup: hoisted.refreshMatchup,
    ...overrides,
  };
}

const noop = () => {};

beforeEach(() => {
  hoisted.mockGet.mockReset();
  hoisted.mockPost.mockReset().mockResolvedValue({ success: true });
  hoisted.setSelectedMatchupWeek.mockReset();
  hoisted.refreshMatchup.mockReset().mockResolvedValue(undefined);
});

describe('MatchupView week picker', () => {
  it('defaults the picker to the league/matchup current week', () => {
    hoisted.context = baseContext();
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    expect(screen.getByLabelText('Viewing week 3')).toBeInTheDocument();
  });

  it('shows the explicitly selected week instead of the current week', () => {
    hoisted.context = baseContext({ selectedMatchupWeek: 2 });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    expect(screen.getByLabelText('Viewing week 2')).toBeInTheDocument();
  });

  it('advances to the next week when the next-week button is clicked', () => {
    hoisted.context = baseContext({ selectedMatchupWeek: 2 });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    fireEvent.click(screen.getByLabelText('Next week'));
    expect(hoisted.setSelectedMatchupWeek).toHaveBeenCalledWith(3);
  });

  it('disables the previous-week button at week 1', () => {
    hoisted.context = baseContext({ selectedMatchupWeek: 1, matchupCurrentWeek: 1 });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    expect(screen.getByLabelText('Previous week')).toBeDisabled();
  });
});

describe('MatchupView empty state for an unsynced week', () => {
  it('shows the "not synced yet" message with a Re-sync button when the week has no matchup row at all', () => {
    hoisted.context = baseContext({
      selectedMatchupWeek: 5,
      matchupAvailableWeeks: [1, 2, 3], // week 5 was never synced
      matchup: null,
    });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    expect(screen.getByText('No matchup synced for Week 5 yet')).toBeInTheDocument();
    expect(screen.getByText(/re-sync automatically every 4 hours/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-sync now/i })).toBeInTheDocument();
    // The generic bye-week banner should not also render for this case.
    expect(screen.queryByText(/no opponent scheduled for week/i)).not.toBeInTheDocument();
  });

  it('shows the generic bye-week message (not the resync prompt) when the week IS synced but has no opponent', () => {
    hoisted.context = baseContext({
      selectedMatchupWeek: 2,
      matchupAvailableWeeks: [1, 2, 3], // week 2 is synced — this is a real bye week
      matchup: null,
    });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);
    expect(screen.getByText(/no opponent scheduled for week 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/no matchup synced/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-sync now/i })).not.toBeInTheDocument();
  });

  it('calls the user sync route and refreshes the matchup when Re-sync now is clicked', async () => {
    hoisted.context = baseContext({
      selectedMatchupWeek: 5,
      matchupAvailableWeeks: [1, 2, 3],
      matchup: null,
    });
    render(<MatchupView onPlayerClick={noop} isDarkMode={false} />);

    fireEvent.click(screen.getByRole('button', { name: /re-sync now/i }));

    await waitFor(() => {
      expect(hoisted.mockPost).toHaveBeenCalledWith('/leagues/league-1/sync');
    });
    expect(hoisted.refreshMatchup).toHaveBeenCalled();
  });
});
