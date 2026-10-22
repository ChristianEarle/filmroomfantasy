import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Header's dropdowns (search, league switcher) previously had no Escape
// handling or focus restoration, unlike the notifications dropdown right
// next to them and LeagueManager's own league switcher — this suite covers
// that they now behave the same way.
const hoisted = vi.hoisted(() => ({
  search: vi.fn(),
  clearResults: vi.fn(),
  setSelectedLeagueId: vi.fn(),
}));

vi.mock('../App', () => ({}));
vi.mock('../hooks', () => ({
  usePlayerSearch: () => ({ results: [], isSearching: false, search: hoisted.search, clearResults: hoisted.clearResults }),
}));
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => ({ items: [], unreadCount: 0, loading: false, markRead: vi.fn(), markAllRead: vi.fn() }),
  formatRelativeTime: () => '',
}));
vi.mock('../context/LeaguesContext', () => ({
  useLeaguesContext: () => ({
    leagues: [
      { id: 'league-1', name: 'League One', scoringFormat: 'ppr', teamCount: 10 },
      { id: 'league-2', name: 'League Two', scoringFormat: 'half_ppr', teamCount: 12 },
    ],
  }),
}));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => ({ selectedLeagueId: 'league-1', setSelectedLeagueId: hoisted.setSelectedLeagueId }),
}));

import { Header } from './Header';

function renderHeader() {
  return render(<Header onPlayerClick={vi.fn()} isDarkMode={false} isAuthenticated />);
}

describe('Header', () => {
  beforeEach(() => {
    hoisted.search.mockClear();
    hoisted.clearResults.mockClear();
    hoisted.setSelectedLeagueId.mockClear();
  });

  it('closes the league switcher on Escape and returns focus to its trigger', () => {
    renderHeader();
    const trigger = screen.getByText('League One').closest('button')!;
    fireEvent.click(trigger);
    expect(screen.getByText('League Two')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('League Two')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the search box on Escape, clears the query, and returns focus to its toggle button', () => {
    renderHeader();
    const toggle = screen.getByLabelText('Search players');
    fireEvent.click(toggle);

    const input = screen.getByPlaceholderText('Search players...');
    fireEvent.change(input, { target: { value: 'ma' } });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('Search players...')).not.toBeInTheDocument();
    expect(hoisted.clearResults).toHaveBeenCalled();
    // The toggle button unmounts while the search box is open and remounts
    // on close — focus restoration is deferred, so this settles async.
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(screen.getByLabelText('Search players')).toHaveFocus();
        resolve(undefined);
      }, 0);
    });
  });
});
