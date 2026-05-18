import { Plus, Globe, AlertCircle, Loader2, X, RefreshCw, Trash2, Check } from 'lucide-react';
import { FeedbackWidget } from './FeedbackWidget';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLeaguesContext } from '../context/LeaguesContext';
import { leagueConnectService, sleeperApi, yahooApi, PlatformError, type Platform, type ExternalLeague } from '../services';
import { authService } from '../services';
import { API_ORIGIN } from '../services/api';
import { UpgradeModal } from './UpgradeModal';
import type { ScoringFormat } from '../services/auth';

interface SettingsViewProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLeagueSynced?: () => void;
}

const SCORING_OPTIONS: { value: ScoringFormat; label: string }[] = [
  { value: 'ppr', label: 'PPR (Point Per Reception)' },
  { value: 'half_ppr', label: 'Half PPR' },
  { value: 'standard', label: 'Standard' },
];

type ConnectionStep = 'select-platform' | 'sleeper-username' | 'sleeper-leagues' | 'enter-league-id' | 'confirm' | 'yahoo-connecting' | 'yahoo-leagues';

export function SettingsView({ isDarkMode = true, onToggleDarkMode, onLeagueSynced }: SettingsViewProps) {
  const { user, updateProfile } = useAuth();
  const { leagues, isLoading: leaguesLoading, error: leaguesError, refetch: refetchLeagues } = useLeaguesContext();

  const preferredScoring = user?.preferredScoring ?? 'ppr';
  const notificationsEnabled = user?.notificationsEnabled ?? true;

  // Preference update error state
  const [prefError, setPrefError] = useState<string | null>(null);

  // Refs for Yahoo OAuth cleanup on unmount
  const yahooPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const yahooListenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Clean up Yahoo OAuth resources on unmount
  useEffect(() => {
    return () => {
      if (yahooPollRef.current) clearInterval(yahooPollRef.current);
      if (yahooListenerRef.current) window.removeEventListener('message', yahooListenerRef.current);
    };
  }, []);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectionStep, setConnectionStep] = useState<ConnectionStep>('select-platform');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  // Sleeper connection state
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [sleeperUserId, setSleeperUserId] = useState<string | null>(null);
  const [sleeperLeagues, setSleeperLeagues] = useState<ExternalLeague[]>([]);
  const [loadingSleeperLeagues, setLoadingSleeperLeagues] = useState(false);
  const [sleeperError, setSleeperError] = useState<string | null>(null);

  // Manual league ID state
  const [manualLeagueId, setManualLeagueId] = useState('');
  const [manualSeasonYear, setManualSeasonYear] = useState<number>(new Date().getFullYear());
  const [fetchedLeague, setFetchedLeague] = useState<ExternalLeague | null>(null);
  const [fetchingLeague, setFetchingLeague] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Upgrade modal (shown when free user hits the 1-league limit)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Connection state
  const [connecting, setConnecting] = useState(false);
  const [connectingLeagueId, setConnectingLeagueId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Sync/disconnect state
  const [syncingLeagueId, setSyncingLeagueId] = useState<string | null>(null);
  const [syncingError, setSyncingError] = useState<string | null>(null);
  const [syncSuccessLeagueId, setSyncSuccessLeagueId] = useState<string | null>(null);
  const [disconnectingLeagueId, setDisconnectingLeagueId] = useState<string | null>(null);

  // Background connecting state (shown after modal closes)
  const [backgroundConnecting, setBackgroundConnecting] = useState<{ name: string; platform: Platform } | null>(null);

  // Yahoo connection state
  const [yahooLeagues, setYahooLeagues] = useState<ExternalLeague[]>([]);
  const [loadingYahooLeagues, setLoadingYahooLeagues] = useState(false);
  const [yahooError, setYahooError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordChanging(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPasswordChanging(false);
    }
  };

  // Wrap updateProfile with error handling
  const handleUpdatePreference = useCallback(async (updates: Parameters<typeof updateProfile>[0]) => {
    setPrefError(null);
    try {
      await updateProfile(updates);
    } catch (err) {
      setPrefError(err instanceof Error ? err.message : 'Failed to save preference. Please try again.');
    }
  }, [updateProfile]);

  const platforms = [
    { id: 'sleeper' as Platform, name: 'Sleeper', color: 'bg-blue-500', textColor: 'text-blue-400', description: 'Connect via username' },
    { id: 'espn' as Platform, name: 'ESPN', color: 'bg-red-600', textColor: 'text-red-400', description: 'Public leagues only' },
    { id: 'yahoo' as Platform, name: 'Yahoo', color: 'bg-purple-600', textColor: 'text-purple-400', description: 'Connect via OAuth' },
    { id: 'mfl' as Platform, name: 'MFL', color: 'bg-green-600', textColor: 'text-green-400', description: 'Enter league ID' },
  ];

  // Reset modal state
  const resetModal = () => {
    setConnectionStep('select-platform');
    setSelectedPlatform(null);
    setSleeperUsername('');
    setSleeperUserId(null);
    setSleeperLeagues([]);
    setSleeperError(null);
    setManualLeagueId('');
    setManualSeasonYear(new Date().getFullYear());
    setFetchedLeague(null);
    setFetchError(null);
    setConnectError(null);
    setYahooLeagues([]);
    setYahooError(null);
  };

  // Map a typed PlatformError to a user-readable string. Without this the UI
  // collapses every failure (timeout, 5xx, rate-limit, real 404) into
  // "user not found" — which is the #1 reported false negative.
  const platformErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof PlatformError) {
      switch (err.kind) {
        case 'rate_limited': return err.message;
        case 'unavailable':  return err.message;
        case 'timeout':      return err.message;
        case 'network':      return err.message;
        default:             return fallback;
      }
    }
    return err instanceof Error ? err.message : fallback;
  };

  const handleCloseModal = () => {
    setShowConnectModal(false);
    resetModal();
  };

  // Fetch Sleeper user's leagues
  const handleFetchSleeperLeagues = async () => {
    const trimmed = sleeperUsername.trim();
    if (!trimmed) return;

    // Validate before hitting the network — Sleeper usernames are typically
    // 1-32 chars of letters/numbers/underscore/dot/hyphen. Pre-flighting
    // lets the user fix typos instantly instead of waiting for a 404, but
    // we stay permissive: real Sleeper accounts with hyphens/dots exist.
    if (!/^[a-zA-Z0-9_.-]{1,32}$/.test(trimmed)) {
      setSleeperError('Username must be letters, numbers, underscores, dots, or hyphens. Use your Sleeper username, not your display name.');
      return;
    }

    setLoadingSleeperLeagues(true);
    setSleeperError(null);

    try {
      const sleeperUser = await sleeperApi.getUser(trimmed);
      if (!sleeperUser) {
        setSleeperError('User not found. Please check the username (not display name).');
        setLoadingSleeperLeagues(false);
        return;
      }

      setSleeperUserId(sleeperUser.user_id);
      const fetchedLeagues = await sleeperApi.getUserLeagues(sleeperUser.user_id);
      if (fetchedLeagues.length === 0) {
        setSleeperError('No NFL leagues found for this user.');
      } else {
        setSleeperLeagues(fetchedLeagues);
        setConnectionStep('sleeper-leagues');
      }
    } catch (err) {
      setSleeperError(platformErrorMessage(err, 'Failed to fetch leagues. Please try again.'));
    } finally {
      setLoadingSleeperLeagues(false);
    }
  };

  // Yahoo OAuth connect flow
  const handleYahooConnect = async () => {
    setConnectionStep('yahoo-connecting');
    setYahooError(null);

    // Clean up any previous OAuth resources
    if (yahooPollRef.current) clearInterval(yahooPollRef.current);
    if (yahooListenerRef.current) window.removeEventListener('message', yahooListenerRef.current);

    try {
      const authUrl = await yahooApi.getAuthUrl();

      // Open OAuth popup
      const popup = window.open(authUrl, 'yahoo_oauth', 'width=600,height=700,scrollbars=yes');

      // Listen for the callback message
      const handleMessage = async (event: MessageEvent) => {
        if (event.data?.type !== 'yahoo_oauth') return;
        // Validate origin — the callback popup runs on the API worker origin
        // (cross-origin from the app) so we accept messages from either the
        // app's own origin (dev/proxy mode) or the API origin (prod).
        if (event.origin !== window.location.origin && event.origin !== API_ORIGIN) return;
        window.removeEventListener('message', handleMessage);
        yahooListenerRef.current = null;

        if (event.data.success) {
          // OAuth succeeded — fetch Yahoo leagues
          setLoadingYahooLeagues(true);
          setConnectionStep('yahoo-leagues');
          try {
            const yahooFetchedLeagues = await yahooApi.getLeagues();
            setYahooLeagues(yahooFetchedLeagues);
            if (yahooFetchedLeagues.length === 0) {
              setYahooError('No NFL leagues found on your Yahoo account.');
            }
          } catch {
            setYahooError('Failed to fetch Yahoo leagues. Please try again.');
          } finally {
            setLoadingYahooLeagues(false);
          }
        } else {
          setYahooError(event.data.error || 'Yahoo authorization failed.');
          setConnectionStep('select-platform');
        }
      };

      window.addEventListener('message', handleMessage);
      yahooListenerRef.current = handleMessage;

      // Handle popup being closed manually
      const pollTimer = setInterval(() => {
        if (popup && popup.closed) {
          clearInterval(pollTimer);
          yahooPollRef.current = null;
          // If still on connecting step, the callback never fired
          setConnectionStep((prev) => {
            if (prev === 'yahoo-connecting') {
              setYahooError('Authorization window was closed. Please try again.');
              return 'select-platform';
            }
            return prev;
          });
          window.removeEventListener('message', handleMessage);
          yahooListenerRef.current = null;
        }
      }, 500);
      yahooPollRef.current = pollTimer;
    } catch {
      setYahooError('Failed to start Yahoo authorization. Please try again.');
      setConnectionStep('select-platform');
    }
  };

  // Fetch league by ID
  const handleFetchLeagueById = async () => {
    if (!manualLeagueId.trim() || !selectedPlatform) return;

    setFetchingLeague(true);
    setFetchError(null);
    setFetchedLeague(null);

    try {
      const league = await leagueConnectService.fetchExternalLeague(
        selectedPlatform,
        manualLeagueId.trim(),
        manualSeasonYear,
      );
      if (!league) {
        setFetchError(
          selectedPlatform === 'espn'
            ? 'League not found. ESPN private leagues are not yet supported — make sure your league is set to public.'
            : 'League not found. Please check the ID and the season year.'
        );
      } else {
        setFetchedLeague(league);
        setConnectionStep('confirm');
      }
    } catch (err) {
      setFetchError(platformErrorMessage(err, 'Failed to fetch league. Please try again.'));
    } finally {
      setFetchingLeague(false);
    }
  };

  // Connect a league
  const handleConnectLeague = async (league: ExternalLeague) => {
    // Close modal immediately and show background connecting bar
    const savedSleeperUsername = sleeperUsername;
    const savedSleeperUserId = sleeperUserId;
    handleCloseModal();
    setBackgroundConnecting({ name: league.name, platform: league.platform });
    setConnectError(null);

    try {
      // Pass the sleeper username so the backend knows which team belongs to this user
      const result = await leagueConnectService.connectLeague(
        league.platform,
        league.externalId,
        league,
        league.platform === 'sleeper' ? savedSleeperUsername : undefined,
        league.platform === 'sleeper' ? savedSleeperUserId ?? undefined : undefined
      );

      // Auto-sync the league to import teams and rosters. Use the QUICK sync
      // variant — it imports rosters + current week only and stays well under
      // the Workers wall-time limit so first-time connect almost always
      // succeeds. The user can hit the manual "Sync" button later to pull
      // full schedule + historical stats + projections.
      if (result.league?.id) {
        try {
          const syncResult = await leagueConnectService.syncLeagueQuick(result.league.id);
          // The sync may succeed at the league level but fail to identify
          // which Sleeper roster belongs to this user (e.g. wrong username,
          // or the league was connected by ID without a username). Surface
          // that as a warning so the user knows to fix it in settings.
          if (syncResult?.warning) {
            setConnectError(syncResult.warning);
          }
        } catch (syncError: unknown) {
          const msg = syncError instanceof Error ? syncError.message : 'Sync failed';
          setConnectError(`League connected but sync failed: ${msg}. Open Settings and tap Sync to retry.`);
          refetchLeagues();
          onLeagueSynced?.();
          setBackgroundConnecting(null);
          return;
        }
      }

      refetchLeagues();
      onLeagueSynced?.();
    } catch (error: unknown) {
      setConnectError(error instanceof Error ? error.message : 'Failed to connect league. Please try again.');
    } finally {
      setBackgroundConnecting(null);
    }
  };

  // Sync a league
  const handleSyncLeague = async (leagueId: string) => {
    setSyncingLeagueId(leagueId);
    setSyncingError(null);
    setSyncSuccessLeagueId(null);
    try {
      await leagueConnectService.syncLeague(leagueId);
      refetchLeagues();
      onLeagueSynced?.();
      setSyncSuccessLeagueId(leagueId);
      setTimeout(() => setSyncSuccessLeagueId((prev) => prev === leagueId ? null : prev), 5000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Sync failed. Please try again.';
      setSyncingError(message);
    } finally {
      setSyncingLeagueId(null);
    }
  };

  // Disconnect a league
  const handleDisconnectLeague = async (leagueId: string) => {
    if (!confirm('Are you sure you want to disconnect this league?')) return;

    setDisconnectingLeagueId(leagueId);
    setSyncingError(null);
    try {
      await leagueConnectService.disconnectLeague(leagueId);
      refetchLeagues();
      onLeagueSynced?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect league. Please try again.';
      setSyncingError(message);
    } finally {
      setDisconnectingLeagueId(null);
    }
  };

  const getPlatformColor = (platform?: string) => {
    switch (platform) {
      case 'sleeper': return 'bg-blue-500/20 text-blue-500';
      case 'espn': return 'bg-red-500/20 text-red-500';
      case 'yahoo': return 'bg-purple-500/20 text-purple-500';
      case 'mfl': return 'bg-green-500/20 text-green-500';
      default: return isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Settings</h1>
        <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Manage your connected leagues and application preferences</p>
      </div>

      {/* Connected Leagues */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Connected Leagues</h2>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage your fantasy league connections</p>
          </div>
          <button
            onClick={() => {
              if (user?.subscriptionTier !== 'pro' && user?.subscriptionTier !== 'elite' && leagues.length >= 1) {
                setUpgradeModalOpen(true);
                return;
              }
              setConnectError(null);
              setShowConnectModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Connect League
          </button>
        </div>

        <div className="p-6">
          {leaguesError && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              Failed to load leagues: {leaguesError.message}
            </div>
          )}
          {syncingError && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {syncingError}
            </div>
          )}
          {connectError && !showConnectModal && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {connectError}
            </div>
          )}
          {backgroundConnecting && (
            <div className={`mb-4 rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPlatformColor(backgroundConnecting.platform)}`}>
                  <Globe className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{backgroundConnecting.name}</div>
                  <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {backgroundConnecting.platform === 'mfl' ? 'MFL' : backgroundConnecting.platform === 'espn' ? 'ESPN' : backgroundConnecting.platform.charAt(0).toUpperCase() + backgroundConnecting.platform.slice(1)}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-blue-500">
                  <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <div className="text-right">
                    <div className="text-sm font-medium">Connecting...</div>
                    <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>This will take a moment</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {leaguesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : leagues.length === 0 && !backgroundConnecting ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
              <p className="text-sm">No leagues connected yet.</p>
              <p className="text-xs mt-1">Click "Connect League" to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leagues.map((league) => (
                <div key={league.id} className={`rounded-lg p-4 border flex items-center justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPlatformColor(league.platform)}`}>
                      <Globe className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{league.name}</div>
                      <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {league.platform ? (league.platform === 'mfl' ? 'MFL' : league.platform === 'espn' ? 'ESPN' : league.platform.charAt(0).toUpperCase() + league.platform.slice(1)) : 'FilmRoom'} • {league.seasonYear} • {league.teamCount} Teams • {league.scoringFormat.toUpperCase()}
                      </div>
                      {league.updatedAt && (
                        <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Last synced: {new Date(league.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {new Date(league.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-full border border-green-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Connected
                    </span>
                    <button
                      onClick={() => handleSyncLeague(league.id)}
                      disabled={syncingLeagueId === league.id || disconnectingLeagueId === league.id}
                      aria-label={`Sync ${league.name}`}
                      className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                        syncSuccessLeagueId === league.id
                          ? 'text-green-500 bg-green-500/10'
                          : syncingLeagueId === league.id
                          ? 'text-blue-500 bg-blue-500/10'
                          : isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                      } disabled:cursor-not-allowed`}
                    >
                      {syncingLeagueId === league.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : syncSuccessLeagueId === league.id ? (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {syncingLeagueId === league.id ? 'Syncing...' : syncSuccessLeagueId === league.id ? 'Synced!' : 'Sync'}
                    </button>
                    <button
                      onClick={() => handleDisconnectLeague(league.id)}
                      disabled={disconnectingLeagueId === league.id || syncingLeagueId === league.id}
                      aria-label={`Disconnect ${league.name}`}
                      className={`text-sm px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                        disconnectingLeagueId === league.id
                          ? 'text-red-400 bg-red-500/10'
                          : 'text-red-500 hover:text-red-400 hover:bg-red-500/10'
                      } disabled:cursor-not-allowed`}
                    >
                      {disconnectingLeagueId === league.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {disconnectingLeagueId === league.id ? 'Removing...' : 'Disconnect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Application Preferences */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Application Preferences</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customize your FilmRoom experience</p>
        </div>

        <div className="p-6 space-y-6">
          {prefError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {prefError}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="scoring-format" className={`font-medium mb-1 block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Default Scoring Format</label>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Set your preferred scoring for projections</div>
            </div>
            <select
              id="scoring-format"
              value={preferredScoring}
              onChange={(e) => handleUpdatePreference({ preferredScoring: e.target.value as ScoringFormat })}
              className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            >
              {SCORING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div id="notifications-label" className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notifications</div>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receive alerts for injuries and lineup changes</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={notificationsEnabled}
                onChange={(e) => handleUpdatePreference({ notificationsEnabled: e.target.checked })}
                aria-labelledby="notifications-label"
                role="switch"
                aria-checked={notificationsEnabled}
              />
              <div className={`w-11 h-6 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div id="darkmode-label" className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark Mode</div>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Toggle dark mode appearance</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isDarkMode}
                onChange={onToggleDarkMode}
                aria-labelledby="darkmode-label"
                role="switch"
                aria-checked={isDarkMode}
              />
              <div className={`w-11 h-6 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`}></div>
            </label>
          </div>
        </div>
      </div>

      {/* Account Management */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Account</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Change your password{user?.hasGoogle ? ' or manage your Google-linked account' : ''}</p>
        </div>

        <div className="p-6 space-y-4">
          {passwordError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm">
              <Check className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              Password changed successfully.
            </div>
          )}

          {user?.hasGoogle && !user?.hasPassword && (
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Your account uses Google sign-in. You can set a password below to also enable email/password login.
            </p>
          )}

          {user?.hasPassword && (
            <div>
              <label htmlFor="current-password" className={`block text-sm font-medium mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                placeholder="Enter current password"
              />
            </div>
          )}

          <div>
            <label htmlFor="new-password" className={`block text-sm font-medium mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className={`block text-sm font-medium mb-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
              placeholder="Re-enter new password"
            />
          </div>

          <button
            onClick={handleChangePassword}
            disabled={passwordChanging || !newPassword || !confirmPassword || (!!user?.hasPassword && !currentPassword)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {passwordChanging && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {user?.hasPassword ? 'Change Password' : 'Set Password'}
          </button>
        </div>
      </div>

      {/* Feedback */}
      <FeedbackWidget isDarkMode={!!isDarkMode} currentPage="Settings" embedded />

      {/* Connect League Modal */}
      {showConnectModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') handleCloseModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-league-title"
            className={`rounded-lg max-w-lg w-full overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}
          >
            {/* Modal Header */}
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <h3 id="connect-league-title" className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Connect League</h3>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {connectionStep === 'select-platform' && 'Select your fantasy platform'}
                  {connectionStep === 'sleeper-username' && 'Enter your Sleeper username'}
                  {connectionStep === 'sleeper-leagues' && 'Select a league to connect'}
                  {connectionStep === 'enter-league-id' && `Enter your ${selectedPlatform?.toUpperCase()} league ID`}
                  {connectionStep === 'confirm' && 'Confirm league connection'}
                  {connectionStep === 'yahoo-connecting' && 'Connecting to Yahoo...'}
                  {connectionStep === 'yahoo-leagues' && 'Select a Yahoo league to connect'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                aria-label="Close dialog"
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              >
                <X className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} aria-hidden="true" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Step 1: Select Platform */}
              {connectionStep === 'select-platform' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {platforms.map((platform) => (
                      <button
                        key={platform.id}
                        onClick={() => {
                          setSelectedPlatform(platform.id);
                          if (platform.id === 'sleeper') {
                            setConnectionStep('sleeper-username');
                          } else if (platform.id === 'yahoo') {
                            handleYahooConnect();
                          } else {
                            setConnectionStep('enter-league-id');
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-all group ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 hover:border-blue-500'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-500'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${platform.color}/20 ${platform.textColor}`}>
                          <Globe className="w-6 h-6" />
                        </div>
                        <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{platform.name}</span>
                        <span className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{platform.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sleeper: Enter Username */}
              {connectionStep === 'sleeper-username' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Sleeper Username
                    </label>
                    <input
                      type="text"
                      value={sleeperUsername}
                      onChange={(e) => setSleeperUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchSleeperLeagues()}
                      placeholder="Enter your Sleeper username"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    />
                  </div>

                  {sleeperError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {sleeperError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConnectionStep('select-platform')}
                      className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFetchSleeperLeagues}
                      disabled={!sleeperUsername.trim() || loadingSleeperLeagues}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loadingSleeperLeagues && <Loader2 className="w-4 h-4 animate-spin" />}
                      Find Leagues
                    </button>
                  </div>

                  {/* Manual League ID option */}
                  <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <button
                      onClick={() => setConnectionStep('enter-league-id')}
                      className={`w-full text-sm text-center ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Or enter League ID directly →
                    </button>
                  </div>
                </div>
              )}

              {/* Sleeper: Select League */}
              {connectionStep === 'sleeper-leagues' && (
                <div className="space-y-4">
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {sleeperLeagues.map((league) => {
                      const isThisConnecting = connectingLeagueId === league.externalId;
                      return (
                        <button
                          key={league.externalId}
                          onClick={() => handleConnectLeague(league)}
                          disabled={connecting}
                          className={`w-full p-4 border rounded-lg text-left transition-all relative ${
                            isThisConnecting
                              ? (isDarkMode ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/50' : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500/50')
                              : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-blue-500' : 'bg-slate-50 border-slate-200 hover:border-blue-500')
                          } ${connecting && !isThisConnecting ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{league.name}</div>
                              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {league.seasonYear} • {league.teamCount} Teams • {league.scoringFormat.toUpperCase()}
                              </div>
                            </div>
                            {isThisConnecting && (
                              <div className="flex items-center gap-2 text-blue-500">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm font-medium">Connecting...</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {connectError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {connectError}
                    </div>
                  )}

                  <button
                    onClick={() => setConnectionStep('sleeper-username')}
                    className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                  >
                    Back
                  </button>
                </div>
              )}

              {/* Enter League ID Manually */}
              {connectionStep === 'enter-league-id' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      League ID
                    </label>
                    <input
                      type="text"
                      value={manualLeagueId}
                      onChange={(e) => setManualLeagueId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchLeagueById()}
                      placeholder={`Enter your ${selectedPlatform?.toUpperCase() || ''} league ID`}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    />
                    <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {selectedPlatform === 'sleeper' && 'Find your league ID in the Sleeper app under League Settings'}
                      {selectedPlatform === 'espn' && 'Find your league ID in the URL: fantasy.espn.com/football/league?leagueId=XXXXXX'}
                      {selectedPlatform === 'mfl' && 'Find your league ID in the URL: myfantasyleague.com/YYYY/home/XXXXX (the 5-digit number)'}
                    </p>
                  </div>

                  {/* Season selector — off-season users (Jan–Aug) need to pick last year's league */}
                  {(selectedPlatform === 'espn' || selectedPlatform === 'mfl') && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Season
                      </label>
                      <select
                        value={manualSeasonYear}
                        onChange={(e) => setManualSeasonYear(parseInt(e.target.value, 10))}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      >
                        {(() => {
                          const cy = new Date().getFullYear();
                          return [cy, cy - 1, cy - 2].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}

                  {fetchError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {fetchError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConnectionStep(selectedPlatform === 'sleeper' ? 'sleeper-username' : 'select-platform')}
                      className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFetchLeagueById}
                      disabled={!manualLeagueId.trim() || fetchingLeague}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {fetchingLeague && <Loader2 className="w-4 h-4 animate-spin" />}
                      Find League
                    </button>
                  </div>
                </div>
              )}

              {/* Yahoo: Connecting */}
              {connectionStep === 'yahoo-connecting' && (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                  <p className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                    Waiting for Yahoo authorization...
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Complete the sign-in in the popup window.
                  </p>
                </div>
              )}

              {/* Yahoo: Select League */}
              {connectionStep === 'yahoo-leagues' && (
                <div className="space-y-4">
                  {loadingYahooLeagues ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {yahooLeagues.map((league) => {
                        const isThisConnecting = connectingLeagueId === league.externalId;
                        return (
                          <button
                            key={league.externalId}
                            onClick={() => handleConnectLeague(league)}
                            disabled={connecting}
                            className={`w-full p-4 border rounded-lg text-left transition-all ${
                              isThisConnecting
                                ? (isDarkMode ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500/50' : 'bg-purple-50 border-purple-500 ring-1 ring-purple-500/50')
                                : (isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-purple-500' : 'bg-slate-50 border-slate-200 hover:border-purple-500')
                            } ${connecting && !isThisConnecting ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{league.name}</div>
                                <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {league.seasonYear} • {league.teamCount} Teams • {league.scoringFormat.toUpperCase()}
                                </div>
                              </div>
                              {isThisConnecting && (
                                <div className="flex items-center gap-2 text-purple-500">
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                  <span className="text-sm font-medium">Connecting...</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {yahooError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {yahooError}
                    </div>
                  )}

                  {connectError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {connectError}
                    </div>
                  )}

                  <button
                    onClick={() => setConnectionStep('select-platform')}
                    className={`w-full px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                  >
                    Back
                  </button>
                </div>
              )}

              {/* Confirm Connection */}
              {connectionStep === 'confirm' && fetchedLeague && (
                <div className="space-y-4">
                  <div className={`p-4 border rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {fetchedLeague.name}
                    </div>
                    <div className={`text-sm space-y-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <p>Platform: {fetchedLeague.platform === 'mfl' ? 'MFL' : fetchedLeague.platform === 'espn' ? 'ESPN' : fetchedLeague.platform.charAt(0).toUpperCase() + fetchedLeague.platform.slice(1)}</p>
                      <p>Season: {fetchedLeague.seasonYear}</p>
                      <p>Teams: {fetchedLeague.teamCount}</p>
                      <p>Scoring: {fetchedLeague.scoringFormat.toUpperCase()}</p>
                    </div>
                  </div>

                  {connectError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {connectError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setConnectionStep('enter-league-id')}
                      className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleConnectLeague(fetchedLeague)}
                      disabled={connecting}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {connecting ? 'Connecting & Syncing...' : 'Connect League'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info Banner */}
            {connectionStep === 'select-platform' && (
              <div className={`p-4 border-t ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`} aria-hidden="true" />
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    By connecting your league, FilmRoom will access your roster, matchups, and league settings to provide personalized insights. Your data is never shared.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade modal — shown when a free user hits the 1-league cap.
          Replaces an inline banner that users frequently missed. */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        isDarkMode={isDarkMode}
        onUpgradeClick={async (priceId: string) => {
          try {
            const res = await fetch(
              `${import.meta.env.VITE_API_URL || API_ORIGIN + '/api'}/billing/create-checkout`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  priceId,
                  successUrl: `${window.location.origin}?billing=success`,
                  cancelUrl: `${window.location.origin}?billing=cancel`,
                }),
              }
            );
            if (!res.ok) {
              const error = await res.json() as { error?: string };
              setConnectError(error.error || 'Failed to start checkout. Please try again.');
              setUpgradeModalOpen(false);
              return;
            }
            const { url } = await res.json() as { url: string };
            if (url) window.location.href = url;
          } catch (err) {
            setConnectError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.');
            setUpgradeModalOpen(false);
          }
        }}
      />
    </div>
  );
}
