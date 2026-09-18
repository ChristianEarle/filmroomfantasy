import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────
// `../App` only contributes the `Player` type (compiled away), so an empty
// module is enough and avoids pulling the whole app into the test.
// `api` and the league context are mocked so the component renders against
// controlled fixtures with no network or provider.
const hoisted = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  league: { current: null as any },
  watchlist: { current: null as any },
  auth: { current: { user: null as any, isAuthenticated: false } },
}));

vi.mock('../App', () => ({}));
vi.mock('../services/api', () => ({
  default: { get: hoisted.mockGet, post: hoisted.mockPost },
  api: { get: hoisted.mockGet, post: hoisted.mockPost },
}));
vi.mock('../context/LeagueContext', () => ({
  useLeagueContext: () => ({ league: hoisted.league.current }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => hoisted.auth.current,
}));
// Mock the watchlist hook so the component test doesn't need AuthProvider/network.
vi.mock('../hooks/useWatchlist', () => ({
  useWatchlist: () => hoisted.watchlist.current,
}));

import { DraftRankingsView } from './DraftRankingsView';
import { consumeTradeSeed } from '../utils/tradeSeed';

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
    marketRank: over.marketRank ?? null,
    rationale: over.rationale ?? 'rationale',
    analysis: over.analysis ?? null,
    ceilingRank: over.ceilingRank ?? null,
    floorRank: over.floorRank ?? null,
    recentRanks: over.recentRanks ?? [],
    movement: over.movement ?? { d1: null, d7: null, d30: null },
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

// ── Market ranking fixtures ─────────────────────────────────────────

function makeMarketRanking(over: Record<string, any>): any {
  return {
    playerId: over.playerId,
    player: {
      id: over.playerId,
      name: over.name,
      team: over.team,
      position: over.position,
      status: over.status ?? 'active',
      injuryNote: null,
      headshotUrl: null,
    },
    marketRank: over.marketRank,
    positionRank: over.positionRank ?? 1,
    tier: over.tier ?? 1,
    vorp: over.vorp ?? 50,
    seasonPoints: over.seasonPoints ?? null,
    rosPoints: over.rosPoints ?? null,
    perGameRate: over.perGameRate ?? null,
    remainingGames: over.remainingGames ?? null,
    confidence: over.confidence ?? 'season_props',
  };
}

function marketResponse(rankings: any[], asOfWeek: number | null = 3) {
  return {
    rankings,
    pagination: { limit: 300, offset: 0, total: rankings.length },
    meta: { scoringFormat: 'ppr', season: 2026, asOfWeek, count: rankings.length },
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
  hoisted.watchlist.current = {
    watchedIds: new Set<string>(),
    isWatched: () => false,
    toggle: vi.fn(),
    loading: false,
    isAuthenticated: false,
    refresh: vi.fn(),
  };
  hoisted.auth.current = { user: null, isAuthenticated: false };
  hoisted.mockPost.mockReset();
  localStorage.clear();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('DraftRankingsView — data fetching', () => {
  it('requests the 1-QB redraft variant by default (superflex=0)', async () => {
    renderView();
    await loaded();
    const url = hoisted.mockGet.mock.calls[0][0] as string;
    expect(url).toContain('type=redraft');
    expect(url).toContain('superflex=0');
  });

  it('refetches true dynasty (veteran) rankings when the Dynasty pill is clicked', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Dynasty' }));
    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => u.includes('type=dynasty') && !u.includes('type=dynasty_rookie'))).toBe(true);
    });
  });

  it('refetches dynasty rookies when the Rookie pill is clicked', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Rookie' }));
    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => u.includes('type=dynasty_rookie'))).toBe(true);
    });
  });

  it('refetches with superflex=1 when the Superflex toggle is switched on', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Superflex' }));
    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => u.includes('superflex=1'))).toBe(true);
    });
  });

  it('shows a Monday-generation empty state when the superflex variant has no rows', async () => {
    renderView();
    await loaded();
    hoisted.mockGet.mockResolvedValue(response([]));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Superflex' }));
    expect(await screen.findByText(/No Superflex Redraft Rankings Yet/i)).toBeInTheDocument();
    expect(screen.getByText(/weekly Monday ranking run/i)).toBeInTheDocument();
  });
});

describe('DraftRankingsView — trend and movement use real data only', () => {
  it('renders a Trend column but no sparkline when recentRanks is empty', async () => {
    renderView();
    await loaded();
    expect(screen.getByText('Trend')).toBeInTheDocument();
    expect(screen.queryByText(/4wk/i)).toBeNull();
    // Fixtures have no rank history, so no sparkline is fabricated.
    expect(screen.queryByTestId('trend-sparkline')).toBeNull();
  });

  it('renders a sparkline from recentRanks when history exists', async () => {
    const withHistory = makeRanking({
      id: 'a', overallRank: 1, position: 'QB', name: 'Josh Allen', team: 'BUF',
      recentRanks: [4, 3, 2, 1],
    });
    hoisted.mockGet.mockResolvedValue(response([withHistory]));
    renderView();
    await loaded();
    expect(screen.getByTestId('trend-sparkline')).toBeInTheDocument();
  });

  it('expanded row shows Season Projection, Rank Movement, and AI Take — removed fabricated fields stay gone', async () => {
    renderView();
    await loaded();
    expandRow('Josh Allen');

    expect(screen.getByText('Season Projection')).toBeInTheDocument();
    expect(screen.getByText('Rank Movement')).toBeInTheDocument();
    expect(screen.getByText(/AI Take/)).toBeInTheDocument();

    // No movement history in the fixture → honest empty text, no fake deltas.
    expect(screen.getByText(/No rank history yet/i)).toBeInTheDocument();
    expect(screen.queryByText('1d')).toBeNull();
    expect(screen.queryByText('7d')).toBeNull();
    expect(screen.queryByText('30d')).toBeNull();

    // Removed fabricated panels / fields must not reappear.
    expect(screen.queryByText('Draft Value')).toBeNull();
    expect(screen.queryByText('ECR')).toBeNull();
    expect(screen.queryByText('Best Ball ADP')).toBeNull();
    expect(screen.queryByText('24h')).toBeNull();
    expect(screen.queryByText('Preseason Open')).toBeNull();
  });

  it('shows 1d/7d/30d deltas only where snapshots exist, with direction styling', async () => {
    const withMovement = makeRanking({
      id: 'a', overallRank: 5, position: 'QB', name: 'Josh Allen', team: 'BUF',
      movement: { d1: 3, d7: -2, d30: null },
    });
    hoisted.mockGet.mockResolvedValue(response([withMovement]));
    renderView();
    await loaded();
    expandRow('Josh Allen');

    // +3 = moved up the board (green), -2 = fell (red), 30d hidden (no snapshot).
    expect(table().getByText('1d')).toBeInTheDocument();
    expect(table().getByText('▲ 3')).toBeInTheDocument();
    expect(table().getByText('7d')).toBeInTheDocument();
    expect(table().getByText('▼ 2')).toBeInTheDocument();
    expect(table().queryByText('30d')).toBeNull();
    expect(table().queryByText(/No rank history yet/i)).toBeNull();
  });

  it('shows real ceiling/floor ranks when present', async () => {
    const withRange = makeRanking({
      id: 'a', overallRank: 3, position: 'QB', name: 'Josh Allen', team: 'BUF',
      ceilingRank: 1, floorRank: 9,
    });
    hoisted.mockGet.mockResolvedValue(response([withRange]));
    renderView();
    await loaded();
    expandRow('Josh Allen');
    expect(table().getByText('Ceiling / Floor')).toBeInTheDocument();
    expect(table().getByText('#1 / #9')).toBeInTheDocument();
  });

  it('falls back to the positionRank ± 3 estimate when ceiling/floor are null', async () => {
    renderView();
    await loaded();
    expandRow("Ja'Marr Chase");
    // positionRank 1 → max(1, 1-3)=WR1 ceiling, 1+3=WR4 floor, labelled est.
    expect(table().getByText('WR1 / WR4 (est.)')).toBeInTheDocument();
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

describe('DraftRankingsView — trade value', () => {
  it('seeds the player and navigates to the Trade Analyzer', async () => {
    const onNavigate = vi.fn();
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={onNavigate} />);
    await loaded();
    expandRow('Josh Allen');
    fireEvent.click(table().getByRole('button', { name: /trade value/i }));
    expect(onNavigate).toHaveBeenCalledWith('TradeAnalyzer');
    expect(consumeTradeSeed()).toMatchObject({ id: 'a', type: 'player', name: 'Josh Allen', position: 'QB' });
  });
});

describe('DraftRankingsView — watchlist', () => {
  it('routes logged-out users to login when clicking Watch', async () => {
    const onNavigate = vi.fn();
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={onNavigate} />);
    await loaded();
    // The "Watching" filter pill is hidden when logged out.
    expect(screen.queryByRole('button', { name: 'Watching' })).toBeNull();
    expandRow('Josh Allen');
    fireEvent.click(table().getByRole('button', { name: /^watch$/i }));
    expect(onNavigate).toHaveBeenCalledWith('Login');
    expect(hoisted.watchlist.current.toggle).not.toHaveBeenCalled();
  });

  it('toggles the watchlist and shows the filter when authenticated', async () => {
    const toggle = vi.fn();
    hoisted.watchlist.current = {
      watchedIds: new Set<string>(),
      isWatched: () => false,
      toggle,
      loading: false,
      isAuthenticated: true,
      refresh: vi.fn(),
    };
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={vi.fn()} />);
    await loaded();
    expect(screen.getByRole('button', { name: 'Watching' })).toBeInTheDocument();
    expandRow('Josh Allen');
    fireEvent.click(table().getByRole('button', { name: /^watch$/i }));
    expect(toggle).toHaveBeenCalledWith('a');
  });
});

describe('DraftRankingsView — Ask AI gating', () => {
  it('routes logged-out users to login', async () => {
    const onNavigate = vi.fn();
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={onNavigate} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /ask ai/i }));
    expect(onNavigate).toHaveBeenCalledWith('Login');
    expect(screen.queryByRole('dialog', { name: /ask ai about the draft/i })).toBeNull();
  });

  it('routes free-tier users to pricing', async () => {
    const onNavigate = vi.fn();
    hoisted.auth.current = { user: { subscriptionTier: 'free' }, isAuthenticated: true };
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={onNavigate} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /ask ai/i }));
    expect(onNavigate).toHaveBeenCalledWith('Pricing');
  });

  it('opens the chat modal for Pro users', async () => {
    hoisted.auth.current = { user: { subscriptionTier: 'pro' }, isAuthenticated: true };
    render(<DraftRankingsView onPlayerClick={vi.fn()} isDarkMode={false} onNavigate={vi.fn()} />);
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /ask ai/i }));
    expect(screen.getByRole('dialog', { name: /ask ai about the draft/i })).toBeInTheDocument();
  });
});

describe('DraftRankingsView — empty state', () => {
  it('renders the empty state when no rankings exist', async () => {
    hoisted.mockGet.mockResolvedValue(response([]));
    renderView();
    expect(await screen.findByText(/No Redraft Rankings Yet/i)).toBeInTheDocument();
  });

  it('tells the user dynasty rankings generate on the weekly cron when the Dynasty pill has no rows yet', async () => {
    renderView();
    await loaded();
    hoisted.mockGet.mockResolvedValue(response([]));
    fireEvent.click(screen.getByRole('button', { name: 'Dynasty' }));
    expect(await screen.findByText(/No Dynasty Rankings Yet/i)).toBeInTheDocument();
    expect(screen.getByText(/weekly Monday AI ranking run/i)).toBeInTheDocument();
  });
});

describe('DraftRankingsView — vs Mkt column (AI view)', () => {
  it('shows a green pill with the market rank in its tooltip when AI ranks the player well above market', async () => {
    // Allen: overallRank 1, marketRank 6 → delta = 6 - 1 = 5 → AI is higher on the player → green.
    const withMarket = makeRanking({
      id: 'a', overallRank: 1, position: 'QB', name: 'Josh Allen', team: 'BUF', marketRank: 6,
    });
    hoisted.mockGet.mockResolvedValue(response([withMarket]));
    renderView();
    await loaded();
    const pill = table().getByTitle('Market rank #6');
    expect(pill).toHaveTextContent('+5');
  });

  it('shows a red pill when AI ranks the player well below market', async () => {
    // overallRank 20, marketRank 5 → delta = 5 - 20 = -15 → AI is lower on the player → red.
    const withMarket = makeRanking({
      id: 'a', overallRank: 20, position: 'RB', name: 'Faded Vet', team: 'SF', marketRank: 5,
    });
    hoisted.mockGet.mockResolvedValue(response([withMarket]));
    renderView();
    await loaded();
    const pill = table().getByTitle('Market rank #5');
    expect(pill).toHaveTextContent('-15');
  });

  it('shows a neutral dash for a small gap (|delta| <= 3) even though a market rank exists', async () => {
    const withMarket = makeRanking({
      id: 'a', overallRank: 10, position: 'WR', name: 'Close Call', team: 'KC', marketRank: 12,
    });
    hoisted.mockGet.mockResolvedValue(response([withMarket]));
    renderView();
    await loaded();
    const pill = table().getByTitle('Market rank #12');
    expect(pill).toHaveTextContent('—');
  });

  it('shows a neutral dash with no tooltip when the player has no market rank', async () => {
    renderView();
    await loaded();
    // Fixtures (ALLEN/CMC/CHASE) all have marketRank: null by default.
    expect(table().queryByTitle(/Market rank/)).toBeNull();
  });
});

describe('DraftRankingsView — Market source toggle', () => {
  beforeEach(() => {
    hoisted.mockGet.mockImplementation((url: string) => {
      if (url.includes('/market-rankings')) {
        return Promise.resolve(marketResponse([
          makeMarketRanking({ playerId: 'm1', marketRank: 1, positionRank: 1, tier: 1, position: 'RB', name: 'Market Bell Cow', team: 'DET', seasonPoints: 312.4, rosPoints: 260.1, confidence: 'season_props' }),
          makeMarketRanking({ playerId: 'm2', marketRank: 2, positionRank: 1, tier: 1, position: 'WR', name: 'Market Alpha', team: 'MIA', seasonPoints: 298.7, rosPoints: 240.5, confidence: 'weekly_extrapolation' }),
        ]));
      }
      return Promise.resolve(response(ALL));
    });
  });

  it('defaults to the FilmRoom AI source and requests draft-rankings', async () => {
    renderView();
    await loaded();
    expect(screen.getByRole('button', { name: 'FilmRoom AI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Market' })).toBeInTheDocument();
    const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
    expect(urls.some(u => u.includes('/draft-rankings'))).toBe(true);
    expect(urls.some(u => u.includes('/market-rankings'))).toBe(false);
  });

  it('fetches and renders the Market board when the Market pill is clicked, hiding Redraft/Dynasty/Rookie pills', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));

    await waitFor(() => {
      const urls = hoisted.mockGet.mock.calls.map(c => c[0] as string);
      expect(urls.some(u => u.includes('/market-rankings') && u.includes('scoring=ppr'))).toBe(true);
    });

    expect(await screen.findByText('Market Bell Cow')).toBeInTheDocument();
    expect(table().getByText('Market Alpha')).toBeInTheDocument();

    // AI-only ranking-view pills are gone while Market is selected.
    expect(screen.queryByRole('button', { name: 'Redraft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dynasty' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rookie' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Superflex' })).toBeNull();
  });

  it('renders the Market table shape: rank, player, season proj, ROS, tier, confidence badge', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('Market Bell Cow');

    expect(table().getByText('Season Proj')).toBeInTheDocument();
    expect(table().getByText('ROS')).toBeInTheDocument();
    expect(table().getByText('Tier')).toBeInTheDocument();
    expect(table().getByText('Confidence')).toBeInTheDocument();

    expect(table().getByText('312.4')).toBeInTheDocument(); // season proj
    expect(table().getByText('260.1')).toBeInTheDocument(); // ROS
    expect(table().getByText('HIGH')).toBeInTheDocument(); // season_props confidence
    expect(table().getByText('EST')).toBeInTheDocument(); // weekly_extrapolation confidence
  });

  it('disables rationale expand for Market rows (no chevron, no expand panel on click)', async () => {
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('Market Bell Cow');

    const row = table().getByText('Market Bell Cow').closest('div');
    fireEvent.click(row as Element);
    // No AI-only panels ever appear for Market rows.
    expect(screen.queryByText('FilmRoom AI Take')).toBeNull();
    expect(screen.queryByText('Ceiling / Floor')).toBeNull();
    expect(screen.queryByTestId('trend-sparkline')).toBeNull();
  });

  it('shows the empty state copy once no market sync has run yet', async () => {
    hoisted.mockGet.mockImplementation((url: string) => {
      if (url.includes('/market-rankings')) return Promise.resolve(marketResponse([], null));
      return Promise.resolve(response(ALL));
    });
    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    expect(await screen.findByText(/Market rankings generate after the projections sync\./i)).toBeInTheDocument();
  });

  it('caches the Market board per scoring/season: toggling Market -> AI -> Market issues exactly one market request', async () => {
    renderView();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('Market Bell Cow');

    const marketCallCount = () =>
      hoisted.mockGet.mock.calls.filter(c => (c[0] as string).includes('/market-rankings')).length;
    expect(marketCallCount()).toBe(1);

    // Flip back to FilmRoom AI, then back to Market — nothing about the query
    // (scoring/season) changed, so the cached board should be reused as-is.
    fireEvent.click(screen.getByRole('button', { name: 'FilmRoom AI' }));
    await screen.findByRole('button', { name: 'Redraft' });

    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    expect(await screen.findByText('Market Bell Cow')).toBeInTheDocument();

    expect(marketCallCount()).toBe(1);
  });

  it('the ROS pill re-sorts the Market board by remaining-season points instead of full-season rank', async () => {
    hoisted.mockGet.mockImplementation((url: string) => {
      if (url.includes('/market-rankings')) {
        return Promise.resolve(marketResponse([
          makeMarketRanking({ playerId: 's1', marketRank: 1, position: 'RB', name: 'Season Leader', team: 'DET', seasonPoints: 300, rosPoints: 100 }),
          makeMarketRanking({ playerId: 's2', marketRank: 2, position: 'WR', name: 'ROS Leader', team: 'MIA', seasonPoints: 280, rosPoints: 300 }),
          makeMarketRanking({ playerId: 's3', marketRank: 3, position: 'TE', name: 'Middle Player', team: 'SF', seasonPoints: 260, rosPoints: 200 }),
        ]));
      }
      return Promise.resolve(response(ALL));
    });

    renderView();
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: 'Market' }));
    await screen.findByText('Season Leader');

    // Default (Season) order matches full-season marketRank: 1, 2, 3.
    const seasonOrderText = screen.getByTestId('rankings-table').textContent || '';
    expect(seasonOrderText.indexOf('Season Leader')).toBeLessThan(seasonOrderText.indexOf('ROS Leader'));
    expect(seasonOrderText.indexOf('ROS Leader')).toBeLessThan(seasonOrderText.indexOf('Middle Player'));

    fireEvent.click(screen.getByRole('button', { name: 'ROS' }));

    // ROS order re-sorts by rosPoints descending: ROS Leader (300), Middle Player (200), Season Leader (100).
    await waitFor(() => {
      const rosOrderText = screen.getByTestId('rankings-table').textContent || '';
      expect(rosOrderText.indexOf('ROS Leader')).toBeLessThan(rosOrderText.indexOf('Middle Player'));
      expect(rosOrderText.indexOf('Middle Player')).toBeLessThan(rosOrderText.indexOf('Season Leader'));
    });
  });
});
