import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface PlayerPropLine {
  line: number | null;
  overPrice: number | null;
  underPrice: number | null;
}

export interface PlayerPropsData {
  playerName: string;
  externalId: string | null;
  team: string;
  position: string;
  props: Record<string, PlayerPropLine>;
}

/** Market key → human-readable label */
const MARKET_LABELS: Record<string, string> = {
  passyds: 'pass yds',
  passtds: 'pass TDs',
  rushyds: 'rush yds',
  recyds: 'rec yds',
  receptions: 'receptions',
  rushtds: 'rush TDs',
  rectds: 'rec TDs',
  passcompletions: 'completions',
  passattempts: 'pass att',
  passinterceptions: 'INT',
};

/** Pick the most relevant prop market for a position */
function getPrimaryMarket(position: string): string {
  switch (position) {
    case 'QB': return 'passyds';
    case 'RB': return 'rushyds';
    case 'WR':
    case 'TE': return 'recyds';
    default: return 'passyds';
  }
}

/**
 * Format a primary prop line for display, e.g. "O/U 217.5 pass yds"
 */
export function formatPropLine(props: Record<string, PlayerPropLine>, position: string): string | null {
  const primary = getPrimaryMarket(position);
  const prop = props[primary];
  if (!prop || prop.line == null) return null;
  const label = MARKET_LABELS[primary] || primary;
  return `O/U ${prop.line} ${label}`;
}

export function usePlayerProps(week: number, season: number) {
  const [propsMap, setPropsMap] = useState<Map<string, PlayerPropsData>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchProps = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ players?: PlayerPropsData[] }>(
        `/players/props?week=${week}&season=${season}`
      );
      const players = Array.isArray(response?.players) ? response.players : [];
      const map = new Map<string, PlayerPropsData>();
      for (const p of players) {
        map.set(p.playerName, p);
      }
      setPropsMap(map);
    } catch {
      setPropsMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [week, season]);

  useEffect(() => {
    fetchProps();
  }, [fetchProps]);

  const getPropsForPlayer = (playerName: string): PlayerPropsData | null => {
    return propsMap.get(playerName) || null;
  };

  return { propsMap, loading, getPropsForPlayer };
}
