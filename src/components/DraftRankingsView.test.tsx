import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
// `../App` only contributes the `Player` type (compiled away), so an empty
// module is enough and avoids pulling the whole app into the test.
// `api` and the league context are mocked so the component renders against
// controlled fixtures with no network or provider.
const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  league: { current: null as any },
}));

vi.mock('../App', () => ({}));
vi.mock('../services/api', () => ({ default: { get: hoisted.mockGet } }));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => ({ league: hoisted.league.current }),
}));

import { DraftRankingsView } from './DraftRankingsView';

// ── Fixtures ─────────────────────────────────────────────────────────

function makeRanking(over: Record<string, any>): any {
  return {
    id: over.id,
    overallRank: over.overallRank,
    positionRank: over.positionRank ?? 1,
    tier: over.tier ?? 1,
    projectedPoints: over.projectedPoints ?? null,
    adp: over.adp ?? null,
    adpDelta: over.adpDelta ?? null,
    rationale: over.rationale ?? 'rationale',
    analysis: over.analysis ?? null,
    generatedAt: '2026-05-31T14:15:47.000Z',
    player: {
      id: over.id,
      name: over.name,
      position: over.position,
      team: over.team,
      age: over.age ?? null,
      yearsExp: over.yearsExp ?? 3,
      status: over.status ?? 'active',
      injuryNote: null,
      headshotUrl: null,
      externalId: null,
    },
  };
}

// A = steal (adpDelta -5), B = reach (adpDelta +6), C = fair (0) + null projection.
const ALLEN = makeRanking({ id: 'a', overallRank: 1, positionRank: 1, tier: 1, position: 'QB', name: 'Josh Allen', team: 'BUF', age: 28, adp: 6, adpDelta: -5, projectedPoints: 380, analysis: 'Allen is the overall QB1.' });
const CMC = makeRanking({ id: 'b', overallRank: 2, positionRank: 1, tier: 1, position: 'RB', name: 'Christian McCaffrey', team: 'SF', age: 27, adp: 1, adpDelta: 6, projectedPoints: 290, analysis: 'McCaffrey is a reach at this cost.' });
const CHASE = makeRanking({ id: 'c', overallRank: 3, positionRank: 1, tier: 2, position: 'WR', name: "Ja'Marr Chase", team: 'CIN', age: 25, adp: 3, adpDelta: 0, projectedPoints: null, analysis: null, rationale: 'Chase is a target hog.' });

const ALL = [ALLEN, CMC, CHASE];

function response(rankings: any[]) {
  return {
    rankings,
    meta: {
      rankingType: 'redraft',
      scoringFormat: 'ppr',
      superflex: false,
      season: 2026,
      count: rankings.length,
      generatedAt: rankings.length ? '2026-05-31T14:15:47.000Z' : null,
    },
  };
}

function renderView() {
  return render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} />);
}

// Player names also appear in the callout cards above the table (Biggest
// Riser, etc.), so row assertions must be scoped to the table container to
// stay unambiguous. The callouts are computed from the unfiltered rankings,
// so filtering tests in particular must look only inside the table.
const table = () => within(screen.getByTestId('rankings-table'));

// The table only renders once loading resolves with data.
async function loaded() {
  return screen.findByTestId('rankings-table');
}

// Clicking the row container (role="button") toggles its expanded panel.
function expandRow(name: string) {
  const row = table().getByText(name).closest('[role="button"]');
  fireEvent.click(row as Element);
}

beforeEach(() => {
  hoisted.mockGet.mockReset();
  hoisted.mockGet.mockResolvedValue(response(ALL));
  hoisted.league.current = null;
});

// ── Tests ────────────────────────────────────────────────────────────

describe('DraftRankingsView — data fetching', () => {
  it('requests the 1-QB redraft variant (superflex hardcoded off)', async () => {
    renderView();
    await loaded();
    const url = hoisted.mockGet.mock.calls[0][0] as string;
    expect(url).toContain('type=redraft');
    expect(url).toContain('superflex=0');
  });

  it('refetches dynasty rookies when the Dynasty pill is clicked', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Dynasty' }));
    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => u.includes('type=dynasty_rookie'))).toBe(true);
    });
  });
});

describe('DraftRankingsView — no fabricated data', () => {
  it('does not render the removed Trend (4wk) column', async () => {
    renderView();
    await loaded();
    expect(screen.queryByText(/4wk/i)).toBeNull();
    expect(screen.queryByText('Trend')).toBeNull();
  });

  it('expanded row shows only Season Projection + AI Take, not the removed panels', async () => {
    renderView();
    await loaded();
    expandRow('Josh Allen');

    expect(screen.getByText('Season Projection')).toBeInTheDocument();
    expect(screen.getByText(/AI Take/)).toBeInTheDocument();

    // Removed fabricated panels / fields must not reappear.
    expect(screen.queryByText('Draft Value')).toBeNull();
    expect(screen.queryByText('Rank Movement')).toBeNull();
    expect(screen.queryByText('ECR')).toBeNull();
    expect(screen.queryByText('Best Ball ADP')).toBeNull();
    expect(screen.queryByText('Ceiling / Floor')).toBeNull();
    expect(screen.queryByText('24h')).toBeNull();
  });
});

describe('DraftRankingsView — real fields render', () => {
  it('shows accurate steal and reach counts in the header', async () => {
    renderView();
    await loaded();
    expect(screen.getByText('1 steal')).toBeInTheDocument();
    expect(screen.getByText('1 reach')).toBeInTheDocument();
    expect(screen.queryByText(/moved today/)).toBeNull();
  });

  it('renders STEAL / REACH / FAIR value badges from adpDelta', async () => {
    renderView();
    await loaded();
    expect(table().getByText('+5 STEAL')).toBeInTheDocument();
    expect(table().getByText('-6 REACH')).toBeInTheDocument();
    expect(table().getByText('FAIR')).toBeInTheDocument();
  });

  it('shows real projected points and PPG in the expanded panel', async () => {
    renderView();
    await loaded();
    expandRow('Josh Allen');
    // Scope to the Season Projection panel — the row's Proj column also shows
    // 380.0, so an unscoped query would be ambiguous.
    const panel = within(table().getByText('Season Projection').closest('div') as HTMLElement);
    expect(panel.getByText('Total Points')).toBeInTheDocument();
    expect(panel.getByText('380.0')).toBeInTheDocument();
    // 380 / 17 = 22.4
    expect(panel.getByText('22.4')).toBeInTheDocument();
  });

  it('shows an honest empty state when projectedPoints is null', async () => {
    renderView();
    await loaded();
    expandRow("Ja'Marr Chase");
    expect(table().getByText(/No season projection available/i)).toBeInTheDocument();
    expect(table().queryByText('PPG')).toBeNull();
  });

  it('falls back to rationale when analysis is null in AI Take', async () => {
    renderView();
    await loaded();
    expandRow("Ja'Marr Chase");
    expect(table().getByText('Chase is a target hog.')).toBeInTheDocument();
  });
});

describe('DraftRankingsView — filtering', () => {
  it('filters rows by position', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'QB' }));
    expect(table().getByText('Josh Allen')).toBeInTheDocument();
    expect(table().queryByText('Christian McCaffrey')).toBeNull();
    expect(table().queryByText("Ja'Marr Chase")).toBeNull();
  });

  it('filters rows by search query', async () => {
    renderView();
    await loaded();
    fireEvent.change(screen.getByPlaceholderText('Search player...'), {
      target: { value: 'McCaffrey' },
    });
    expect(table().getByText('Christian McCaffrey')).toBeInTheDocument();
    expect(table().queryByText('Josh Allen')).toBeNull();
  });
});

describe('DraftRankingsView — compare basket', () => {
  it('adds players to the basket and opens the comparison modal', async () => {
    renderView();
    await loaded();
    expect(screen.getByRole('button', { name: 'Compare players' })).toBeDisabled();

    expandRow('Josh Allen');
    fireEvent.click(table().getByRole('button', { name: /add to compare/i }));
    expect(screen.getByText('Compare (1)')).toBeInTheDocument();
    // One player is not enough to compare.
    expect(screen.getByRole('button', { name: 'Compare players' })).toBeDisabled();

    expandRow('Christian McCaffrey');
    fireEvent.click(table().getByRole('button', { name: /add to compare/i }));
    expect(screen.getByText('Compare (2)')).toBeInTheDocument();

    const compareBtn = screen.getByRole('button', { name: 'Compare players' });
    expect(compareBtn).toBeEnabled();
    fireEvent.click(compareBtn);

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Josh Allen')).toBeInTheDocument();
    expect(dialog.getByText('Christian McCaffrey')).toBeInTheDocument();
  });

  it('toggles a player back out of the basket', async () => {
    renderView();
    await loaded();
    expandRow('Josh Allen');
    fireEvent.click(table().getByRole('button', { name: /add to compare/i }));
    expect(screen.getByText('Compare (1)')).toBeInTheDocument();
    // The button now reads "Added"; clicking again removes the player.
    fireEvent.click(table().getByRole('button', { name: /added/i }));
    expect(screen.getByText('Compare (0)')).toBeInTheDocument();
  });
});

describe('DraftRankingsView — empty state', () => {
  it('renders the empty state when no rankings exist', async () => {
    hoisted.mockGet.mockResolvedValue(response([]));
    renderView();
    expect(await screen.findByText(/No Redraft Rankings Yet/i)).toBeInTheDocument();
  });
});
