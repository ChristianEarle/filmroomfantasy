import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SlotRankGrid, sortTeamsBySlot } from './SlotRankGrid';

const cell = (position: string, rank: number | null) => ({
  position, rank, rankOf: 3, avgPoints: 10, deltaPct: 0, status: 'balanced' as const, starterCount: rank == null ? 0 : 1,
});

const TEAMS = [
  { id: 'a', name: 'Alpha', isUserTeam: false, positions: [cell('QB', 2), cell('RB', 1), cell('SFLEX', null)] },
  { id: 'b', name: 'Bravo', isUserTeam: true, positions: [cell('QB', 3), cell('RB', 2), cell('SFLEX', 1)] },
  { id: 'c', name: 'Charlie', isUserTeam: false, positions: [cell('QB', 1), cell('RB', 3), cell('SFLEX', 2)] },
];

describe('sortTeamsBySlot', () => {
  it('orders by the slot rank, best or worst first, and keeps the page order with no sort', () => {
    expect(sortTeamsBySlot(TEAMS, { column: 'QB', direction: 'best' }).map((t) => t.id)).toEqual(['c', 'a', 'b']);
    expect(sortTeamsBySlot(TEAMS, { column: 'QB', direction: 'worst' }).map((t) => t.id)).toEqual(['b', 'a', 'c']);
    expect(sortTeamsBySlot(TEAMS, null).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('always puts teams with no starter at the slot last', () => {
    expect(sortTeamsBySlot(TEAMS, { column: 'SFLEX', direction: 'best' }).map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(sortTeamsBySlot(TEAMS, { column: 'SFLEX', direction: 'worst' }).map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('SlotRankGrid sorting', () => {
  const rowNames = () => within(screen.getByRole('table')).getAllByRole('rowheader').map((r) => r.textContent);

  it('sorts by a clicked slot, flips on a second click, and resets from the Team header', () => {
    render(<SlotRankGrid teams={TEAMS} columns={['QB', 'RB', 'SFLEX']} isDarkMode={false} cellClasses={() => ''} />);
    expect(rowNames()).toEqual(['Alpha', 'Bravo (you)', 'Charlie']);

    fireEvent.click(screen.getByRole('button', { name: /^QB/ }));
    expect(rowNames()).toEqual(['Charlie', 'Alpha', 'Bravo (you)']);
    expect(screen.getByRole('columnheader', { name: /QB/ })).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(screen.getByRole('button', { name: /^QB/ }));
    expect(rowNames()).toEqual(['Bravo (you)', 'Alpha', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: /QB/ })).toHaveAttribute('aria-sort', 'descending');

    fireEvent.click(screen.getByRole('button', { name: /^RB/ }));
    expect(rowNames()).toEqual(['Alpha', 'Bravo (you)', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: /QB/ })).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(rowNames()).toEqual(['Alpha', 'Bravo (you)', 'Charlie']);
  });
});
