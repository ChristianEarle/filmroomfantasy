import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlayerComparisonDrawer } from './PlayerComparisonDrawer';
import type { Player } from '../App';

function make(over: Partial<Player> & { id: string; name: string }): Player {
  return {
    rank: over.rank ?? 1,
    team: over.team ?? 'BUF',
    position: over.position ?? 'QB',
    keyLine: over.keyLine ?? '',
    projectedPoints: over.projectedPoints ?? 300,
    weekChange: over.weekChange ?? 0,
    ...over,
  };
}

describe('PlayerComparisonDrawer', () => {
  it('renders one card per player with their stats', () => {
    const players = [
      make({ id: '1', name: 'Josh Allen', team: 'BUF', position: 'QB', projectedPoints: 380.4, weekChange: 2.1 }),
      make({ id: '2', name: 'Lamar Jackson', team: 'BAL', position: 'QB', projectedPoints: 350.1, weekChange: -1.4 }),
    ];
    render(<PlayerComparisonDrawer players={players} isDarkMode={false} onClose={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('Compare players (2)')).toBeInTheDocument();
    expect(screen.getByText('Josh Allen')).toBeInTheDocument();
    expect(screen.getByText('Lamar Jackson')).toBeInTheDocument();
    expect(screen.getByText('380.4')).toBeInTheDocument();
    expect(screen.getByText('+2.1')).toBeInTheDocument();
    expect(screen.getByText('-1.4')).toBeInTheDocument();
  });

  it('calls onRemove with the right player when its remove button is clicked', () => {
    const onRemove = vi.fn();
    const players = [make({ id: '1', name: 'Josh Allen' }), make({ id: '2', name: 'Lamar Jackson' })];
    render(<PlayerComparisonDrawer players={players} isDarkMode={false} onClose={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText('Remove Josh Allen from comparison'));
    expect(onRemove).toHaveBeenCalledWith(players[0]);
  });

  it('calls onClose when the backdrop or close button is clicked', () => {
    const onClose = vi.fn();
    render(<PlayerComparisonDrawer players={[make({ id: '1', name: 'Josh Allen' })]} isDarkMode={false} onClose={onClose} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Close comparison'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<PlayerComparisonDrawer players={[make({ id: '1', name: 'Josh Allen' })]} isDarkMode={false} onClose={onClose} onRemove={vi.fn()} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
