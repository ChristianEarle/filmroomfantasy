import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, Shield, Loader2, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../services/api';

interface AdminViewProps {
  isDarkMode: boolean;
}

interface AdminStats {
  totalUsers: number;
  todaySignups: number;
  signupsByDay: { date: string; count: number }[];
  authBreakdown: { email: number; google: number; yahoo: number };
  tiers: { subscription_tier: string; count: number }[];
  totalLeagues: number;
  recentUsers: {
    id: string;
    username: string;
    subscription_tier: string;
    created_at: number;
    hasGoogle: number;
    hasYahoo: number;
    leagueCount: number;
  }[];
}

export function AdminView({ isDarkMode }: AdminViewProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upgrade state
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradeTier, setUpgradeTier] = useState<'free' | 'pro' | 'elite'>('pro');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk upgrade state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AdminStats>('/admin/stats');
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleUpgrade = async () => {
    if (!upgradeEmail.trim()) return;
    setUpgradeLoading(true);
    setUpgradeResult(null);
    try {
      await api.post<{ message: string }>('/admin/set-tier', {
        email: upgradeEmail.trim(),
        tier: upgradeTier,
      });
      setUpgradeResult({ type: 'success', message: `Set ${upgradeEmail} to ${upgradeTier}` });
      setUpgradeEmail('');
      // Refresh stats to reflect change
      fetchStats();
    } catch (err) {
      setUpgradeResult({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update tier' });
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleBulkUpgrade = async (tier: 'free' | 'pro' | 'elite') => {
    if (!confirm(`Set ALL users to ${tier}? This cannot be undone.`)) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const data = await api.post<{ usersUpdated: number }>('/admin/bulk-set-tier', { tier });
      setBulkResult({ type: 'success', message: `${data.usersUpdated} users set to ${tier}` });
      fetchStats();
    } catch (err) {
      setBulkResult({ type: 'error', message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setBulkLoading(false);
    }
  };

  const cardClass = `rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`;
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className={`text-lg ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
        <button onClick={fetchStats} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const tierCounts: Record<string, number> = {};
  stats?.tiers.forEach(t => { tierCounts[t.subscription_tier] = t.count; });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-7 h-7 text-blue-500" />
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Admin Dashboard</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Total Users</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{stats?.totalUsers ?? 0}</div>
        </div>
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Today's Signups</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{stats?.todaySignups ?? 0}</div>
        </div>
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Total Leagues</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{stats?.totalLeagues ?? 0}</div>
        </div>
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Pro Users</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{(tierCounts['pro'] ?? 0) + (tierCounts['elite'] ?? 0)}</div>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Breakdown */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Auth Methods</h2>
          <div className="space-y-3">
            {[
              { label: 'Email/Password', value: stats?.authBreakdown.email ?? 0 },
              { label: 'Google', value: stats?.authBreakdown.google ?? 0 },
              { label: 'Yahoo', value: stats?.authBreakdown.yahoo ?? 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className={textSecondary}>{item.label}</span>
                <span className={`font-semibold ${textPrimary}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tier Breakdown */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Subscription Tiers</h2>
          <div className="space-y-3">
            {['free', 'pro', 'elite'].map(tier => (
              <div key={tier} className="flex items-center justify-between">
                <span className={textSecondary}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                <span className={`font-semibold ${textPrimary}`}>{tierCounts[tier] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signups Chart (simple bar) */}
      {stats?.signupsByDay && stats.signupsByDay.length > 0 && (
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Signups (Last 14 Days)
          </h2>
          <div className="flex items-end gap-1 h-32">
            {stats.signupsByDay.map((day) => {
              const max = Math.max(...stats.signupsByDay.map(d => d.count), 1);
              const height = Math.max((day.count / max) * 100, 4);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-xs ${textSecondary}`}>{day.count}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.count} signups`}
                  />
                  <span className={`text-[10px] ${textSecondary} truncate w-full text-center`}>
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade User */}
      <div className={cardClass}>
        <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
          <Users className="w-5 h-5 inline mr-2" />
          Manage User Tier
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textSecondary}`} />
            <input
              type="email"
              placeholder="User email address"
              value={upgradeEmail}
              onChange={(e) => setUpgradeEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpgrade()}
              className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
          <select
            value={upgradeTier}
            onChange={(e) => setUpgradeTier(e.target.value as 'free' | 'pro' | 'elite')}
            className={`px-3 py-2.5 rounded-lg border text-sm font-medium ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
          <button
            onClick={handleUpgrade}
            disabled={upgradeLoading || !upgradeEmail.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {upgradeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4" />}
            Set Tier
          </button>
        </div>
        {upgradeResult && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
            upgradeResult.type === 'success'
              ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
              : isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
          }`}>
            {upgradeResult.message}
          </div>
        )}
      </div>

      {/* Bulk Tier Actions */}
      <div className={cardClass}>
        <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
          <Shield className="w-5 h-5 inline mr-2" />
          Bulk Tier Actions
        </h2>
        <p className={`text-sm mb-4 ${textSecondary}`}>
          Set all users to a tier at once. New signups through April 1, 2026 automatically receive Elite.
        </p>
        <div className="flex flex-wrap gap-3">
          {(['elite', 'pro', 'free'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => handleBulkUpgrade(tier)}
              disabled={bulkLoading}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                tier === 'elite'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : tier === 'pro'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : isDarkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
              Set All to {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </button>
          ))}
        </div>
        {bulkResult && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
            bulkResult.type === 'success'
              ? isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'
              : isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
          }`}>
            {bulkResult.message}
          </div>
        )}
      </div>

      {/* Recent Users */}
      {stats?.recentUsers && stats.recentUsers.length > 0 && (
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Recent Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Username</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Tier</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Auth</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Leagues</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map((u) => (
                  <tr key={u.id} className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <td className={`py-2.5 ${textPrimary}`}>{u.username}</td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        u.subscription_tier === 'pro'
                          ? 'bg-blue-500/20 text-blue-400'
                          : u.subscription_tier === 'elite'
                            ? 'bg-purple-500/20 text-purple-400'
                            : isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {u.subscription_tier}
                      </span>
                    </td>
                    <td className={`py-2.5 ${textSecondary}`}>
                      {u.hasGoogle ? 'Google' : u.hasYahoo ? 'Yahoo' : 'Email'}
                    </td>
                    <td className={`py-2.5 ${textSecondary}`}>{u.leagueCount}</td>
                    <td className={`py-2.5 ${textSecondary}`}>
                      {new Date(u.created_at * 1000).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
