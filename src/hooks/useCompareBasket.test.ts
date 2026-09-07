import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCompareBasket, MAX_COMPARE } from './useCompareBasket';

const player = (id: string) => ({ id, name: `Player ${id}`, position: 'RB', team: 'BUF' });

beforeEach(() => {
  localStorage.clear();
});

describe('useCompareBasket', () => {
  it('starts empty when localStorage has nothing', () => {
    const { result } = renderHook(() => useCompareBasket());
    expect(result.current.basket).toEqual([]);
  });

  it('adds and removes a player via toggle', () => {
    const { result } = renderHook(() => useCompareBasket());
    act(() => result.current.toggle(player('a')));
    expect(result.current.isInBasket('a')).toBe(true);
    expect(result.current.basket).toHaveLength(1);

    act(() => result.current.toggle(player('a')));
    expect(result.current.isInBasket('a')).toBe(false);
    expect(result.current.basket).toHaveLength(0);
  });

  it('caps the basket at MAX_COMPARE', () => {
    const { result } = renderHook(() => useCompareBasket());
    act(() => {
      for (let i = 0; i < MAX_COMPARE + 2; i++) {
        result.current.toggle(player(`p${i}`));
      }
    });
    expect(result.current.basket).toHaveLength(MAX_COMPARE);
    // The (MAX_COMPARE)th and (MAX_COMPARE+1)th players were dropped, not added.
    expect(result.current.isInBasket(`p${MAX_COMPARE}`)).toBe(false);
  });

  it('remove() drops a single player regardless of basket size', () => {
    const { result } = renderHook(() => useCompareBasket());
    act(() => {
      result.current.toggle(player('a'));
      result.current.toggle(player('b'));
    });
    act(() => result.current.remove('a'));
    expect(result.current.isInBasket('a')).toBe(false);
    expect(result.current.isInBasket('b')).toBe(true);
  });

  it('clear() empties the basket', () => {
    const { result } = renderHook(() => useCompareBasket());
    act(() => {
      result.current.toggle(player('a'));
      result.current.toggle(player('b'));
    });
    act(() => result.current.clear());
    expect(result.current.basket).toEqual([]);
  });

  it('persists across separate hook instances via localStorage', () => {
    const first = renderHook(() => useCompareBasket());
    act(() => first.result.current.toggle(player('a')));

    const second = renderHook(() => useCompareBasket());
    expect(second.result.current.isInBasket('a')).toBe(true);
  });
});
