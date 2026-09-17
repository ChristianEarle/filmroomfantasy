import { useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useLeagueContext } from '../context/LeagueContext';
import { useNflState } from '../hooks/useNflState';
import { leagueConnectService } from '../services/leagueConnect';

interface ArchivedLeagueBannerProps {
  isDarkMode: boolean;
}

/**
 * Shown on league-scoped pages when the app's league row is parked on a
 * season other than the live NFL season. Everything on those pages (roster,
 * projections, matchups, week picker) reads that stored season, so a league
 * that never rolled over to the new year looks frozen: last year's roster,
 * "Week 1", and zero projections. Rankings read the live season, which is
 * why they look fine while the league pages don't.
 *
 * Sync runs the same full sync as Settings; if the league was renewed on
 * Sleeper it follows the renewal to the new season's league and re-imports.
 */
export function ArchivedLeagueBanner({ isDarkMode }: ArchivedLeagueBannerProps) {
  const { league, refreshAll } = useLeagueContext();
  const { season: nflSeason } = useNflState();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const stale = league?.seasonYear != null && nflSeason != null && league.seasonYear !== nflSeason;
  if (!league || !stale) return null;

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setResult(null);
    try {
      const res = await leagueConnectService.syncLeague(league.id);
      if (res.rolledOver) {
        setResult({ ok: true, message: `Moved this league to the ${res.rolledOver.season} season and re-imported rosters.` });
      } else {
        setResult({
          ok: false,
          message: `Synced, but Sleeper has no ${nflSeason} league renewed from this one. If your league was recreated rather than renewed, connect this year's league in Settings.`,
        });
      }
      await refreshAll();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Sync failed. Try again in a moment.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      role="status"
      className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
        isDarkMode ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDarkMode ? 'text-amber-200' : 'text-amber-900'}`}>
          This league is still on the {league.seasonYear} season.
        </p>
        <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-amber-200/80' : 'text-amber-800'}`}>
          Rosters, projections and matchups here are from {league.seasonYear}. Sync to move it to {nflSeason}.
        </p>
        {result && (
          <p className={`text-xs mt-2 ${result.ok ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-700') : (isDarkMode ? 'text-red-400' : 'text-red-700')}`}>
            {result.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0"
      >
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
        {syncing ? 'Syncing…' : `Sync to ${nflSeason}`}
      </button>
    </div>
  );
}
