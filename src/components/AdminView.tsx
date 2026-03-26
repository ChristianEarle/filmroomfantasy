import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, Shield, Loader2, Search, ChevronUp, ChevronDown, BarChart3, Globe, Monitor, Smartphone, Tablet, Eye, MousePointer, FileText } from 'lucide-react';
import { api } from '../services/api';
import { ArticleEditor } from './ArticleEditor';

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

interface AnalyticsData {
  summary: {
    today: { views: number; visitors: number };
    sevenDay: { views: number; visitors: number };
    thirtyDay: { views: number; visitors: number };
  };
  viewsByDay: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  topReferrers: { referrer: string; views: number; visitors: number }[];
  deviceBreakdown: { device: string; count: number }[];
  browserBreakdown: { browser: string; count: number }[];
  countryBreakdown: { country: string; count: number }[];
  recentPageViews: { path: string; referrer: string | null; device: string | null; browser: string | null; country: string | null; created_at: number; username: string | null }[];
  hourlyToday: { hour: number; views: number }[];
}

type AdminTab = 'overview' | 'analytics' | 'articles';

export function AdminView({ isDarkMode }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

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

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const data = await api.get<AnalyticsData>('/analytics/admin/overview');
      setAnalytics(data);
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch analytics when tab is switched to analytics
  useEffect(() => {
    if (activeTab === 'analytics' && !analytics && !analyticsLoading) {
      fetchAnalytics();
    }
  }, [activeTab, analytics, analyticsLoading, fetchAnalytics]);

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

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Shield className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'articles', label: 'Articles', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-7 h-7 text-blue-500" />
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : isDarkMode
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          tierCounts={tierCounts}
          isDarkMode={isDarkMode}
          cardClass={cardClass}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          upgradeEmail={upgradeEmail}
          setUpgradeEmail={setUpgradeEmail}
          upgradeTier={upgradeTier}
          setUpgradeTier={setUpgradeTier}
          upgradeLoading={upgradeLoading}
          upgradeResult={upgradeResult}
          handleUpgrade={handleUpgrade}
          bulkLoading={bulkLoading}
          bulkResult={bulkResult}
          handleBulkUpgrade={handleBulkUpgrade}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          analytics={analytics}
          loading={analyticsLoading}
          error={analyticsError}
          onRetry={fetchAnalytics}
          isDarkMode={isDarkMode}
          cardClass={cardClass}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      )}

      {activeTab === 'articles' && (
        <ArticleEditor isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

// ─── Overview Tab (existing content) ──────────────────────────────────────────
function OverviewTab({
  stats, tierCounts, isDarkMode, cardClass, textPrimary, textSecondary,
  upgradeEmail, setUpgradeEmail, upgradeTier, setUpgradeTier, upgradeLoading, upgradeResult, handleUpgrade,
  bulkLoading, bulkResult, handleBulkUpgrade,
}: {
  stats: AdminStats | null;
  tierCounts: Record<string, number>;
  isDarkMode: boolean;
  cardClass: string;
  textPrimary: string;
  textSecondary: string;
  upgradeEmail: string;
  setUpgradeEmail: (v: string) => void;
  upgradeTier: 'free' | 'pro' | 'elite';
  setUpgradeTier: (v: 'free' | 'pro' | 'elite') => void;
  upgradeLoading: boolean;
  upgradeResult: { type: 'success' | 'error'; message: string } | null;
  handleUpgrade: () => void;
  bulkLoading: boolean;
  bulkResult: { type: 'success' | 'error'; message: string } | null;
  handleBulkUpgrade: (tier: 'free' | 'pro' | 'elite') => void;
}) {
  return (
    <div className="space-y-6">
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

      {/* Signups Chart */}
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

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({
  analytics, loading, error, onRetry, isDarkMode, cardClass, textPrimary, textSecondary,
}: {
  analytics: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isDarkMode: boolean;
  cardClass: string;
  textPrimary: string;
  textSecondary: string;
}) {
  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className={`text-lg ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
        <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const s = analytics?.summary;

  const DeviceIcon = ({ device }: { device: string }) => {
    if (device === 'mobile') return <Smartphone className="w-4 h-4" />;
    if (device === 'tablet') return <Tablet className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Today</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{s?.today.views ?? 0}</div>
          <div className={`text-xs mt-1 ${textSecondary}`}>
            <Eye className="w-3 h-3 inline mr-1" />
            {s?.today.visitors ?? 0} unique visitors
          </div>
        </div>
        <div className={cardClass}>
          <div className={`text-sm font-medium ${textSecondary}`}>Last 7 Days</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{s?.sevenDay.views ?? 0}</div>
          <div className={`text-xs mt-1 ${textSecondary}`}>
            <Eye className="w-3 h-3 inline mr-1" />
            {s?.sevenDay.visitors ?? 0} unique visitors
          </div>
        </div>
        <div className={`${cardClass} col-span-2 md:col-span-1`}>
          <div className={`text-sm font-medium ${textSecondary}`}>Last 30 Days</div>
          <div className={`text-3xl font-bold mt-1 ${textPrimary}`}>{s?.thirtyDay.views ?? 0}</div>
          <div className={`text-xs mt-1 ${textSecondary}`}>
            <Eye className="w-3 h-3 inline mr-1" />
            {s?.thirtyDay.visitors ?? 0} unique visitors
          </div>
        </div>
      </div>

      {/* Traffic Chart (last 30 days) */}
      {analytics?.viewsByDay && analytics.viewsByDay.length > 0 && (
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Traffic (Last 30 Days)
          </h2>
          <div className="flex items-end gap-[2px] h-36">
            {analytics.viewsByDay.map((day) => {
              const maxViews = Math.max(...analytics.viewsByDay.map(d => d.views), 1);
              const height = Math.max((day.views / maxViews) * 100, 3);
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full bg-blue-500 rounded-t hover:bg-blue-400 transition-colors cursor-default"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.views} views, ${day.visitors} visitors`}
                  />
                  {/* Show date label for every 5th day */}
                  {analytics.viewsByDay.indexOf(day) % 5 === 0 && (
                    <span className={`text-[9px] ${textSecondary} truncate w-full text-center`}>
                      {day.date.slice(5)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className={`flex justify-between mt-2 text-xs ${textSecondary}`}>
            <span>Views</span>
            <span>30 days</span>
          </div>
        </div>
      )}

      {/* Hourly traffic today */}
      {analytics?.hourlyToday && analytics.hourlyToday.length > 0 && (
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
            <BarChart3 className="w-5 h-5 inline mr-2" />
            Today's Traffic by Hour (CT)
          </h2>
          <div className="flex items-end gap-[2px] h-24">
            {Array.from({ length: 24 }, (_, hour) => {
              const data = analytics.hourlyToday.find(h => h.hour === hour);
              const views = data?.views ?? 0;
              const maxViews = Math.max(...analytics.hourlyToday.map(h => h.views), 1);
              const height = views > 0 ? Math.max((views / maxViews) * 100, 5) : 2;
              const ampm = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`;
              return (
                <div key={hour} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t ${views > 0 ? 'bg-emerald-500' : isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
                    style={{ height: `${height}%` }}
                    title={`${ampm} - ${views} views`}
                  />
                  {hour % 4 === 0 && (
                    <span className={`text-[9px] mt-1 ${textSecondary}`}>{ampm}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two column: Top Pages + Top Referrers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
            <MousePointer className="w-5 h-5 inline mr-2" />
            Top Pages
          </h2>
          {analytics?.topPages && analytics.topPages.length > 0 ? (
            <div className="space-y-2">
              {analytics.topPages.map((page, i) => {
                const maxViews = analytics.topPages[0].views || 1;
                const pct = (page.views / maxViews) * 100;
                return (
                  <div key={page.path} className="relative">
                    <div
                      className={`absolute inset-0 rounded ${isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-1.5">
                      <span className={`text-sm truncate ${textPrimary}`}>{page.path}</span>
                      <span className={`text-sm font-medium ml-2 flex-shrink-0 ${textSecondary}`}>
                        {page.views} <span className="text-xs">({page.visitors})</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className={`text-xs pt-2 ${textSecondary}`}>Views (unique visitors)</div>
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>No page view data yet</p>
          )}
        </div>

        {/* Top Referrers */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
            <Globe className="w-5 h-5 inline mr-2" />
            Top Referrers
          </h2>
          {analytics?.topReferrers && analytics.topReferrers.length > 0 ? (
            <div className="space-y-2">
              {analytics.topReferrers.map((ref) => {
                const maxViews = analytics.topReferrers[0].views || 1;
                const pct = (ref.views / maxViews) * 100;
                // Show hostname only
                let displayRef = ref.referrer;
                try {
                  displayRef = new URL(ref.referrer).hostname;
                } catch { /* use raw */ }
                return (
                  <div key={ref.referrer} className="relative">
                    <div
                      className={`absolute inset-0 rounded ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-1.5">
                      <span className={`text-sm truncate ${textPrimary}`}>{displayRef}</span>
                      <span className={`text-sm font-medium ml-2 flex-shrink-0 ${textSecondary}`}>
                        {ref.views}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>No referrer data yet</p>
          )}
        </div>
      </div>

      {/* Three column: Devices, Browsers, Countries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Devices */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Devices</h2>
          <div className="space-y-3">
            {analytics?.deviceBreakdown && analytics.deviceBreakdown.length > 0 ? (
              analytics.deviceBreakdown.map(d => {
                const total = analytics.deviceBreakdown.reduce((sum, x) => sum + x.count, 0) || 1;
                const pct = Math.round((d.count / total) * 100);
                return (
                  <div key={d.device} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DeviceIcon device={d.device} />
                      <span className={`text-sm capitalize ${textPrimary}`}>{d.device}</span>
                    </div>
                    <span className={`text-sm font-medium ${textSecondary}`}>
                      {d.count} <span className="text-xs">({pct}%)</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className={`text-sm ${textSecondary}`}>No data</p>
            )}
          </div>
        </div>

        {/* Browsers */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Browsers</h2>
          <div className="space-y-3">
            {analytics?.browserBreakdown && analytics.browserBreakdown.length > 0 ? (
              analytics.browserBreakdown.map(b => {
                const total = analytics.browserBreakdown.reduce((sum, x) => sum + x.count, 0) || 1;
                const pct = Math.round((b.count / total) * 100);
                return (
                  <div key={b.browser} className="flex items-center justify-between">
                    <span className={`text-sm ${textPrimary}`}>{b.browser}</span>
                    <span className={`text-sm font-medium ${textSecondary}`}>
                      {b.count} <span className="text-xs">({pct}%)</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className={`text-sm ${textSecondary}`}>No data</p>
            )}
          </div>
        </div>

        {/* Countries */}
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Countries</h2>
          <div className="space-y-3">
            {analytics?.countryBreakdown && analytics.countryBreakdown.length > 0 ? (
              analytics.countryBreakdown.map(co => {
                const total = analytics.countryBreakdown.reduce((sum, x) => sum + x.count, 0) || 1;
                const pct = Math.round((co.count / total) * 100);
                return (
                  <div key={co.country} className="flex items-center justify-between">
                    <span className={`text-sm ${textPrimary}`}>{co.country}</span>
                    <span className={`text-sm font-medium ${textSecondary}`}>
                      {co.count} <span className="text-xs">({pct}%)</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className={`text-sm ${textSecondary}`}>No data</p>
            )}
          </div>
        </div>
      </div>

      {/* Live Feed */}
      {analytics?.recentPageViews && analytics.recentPageViews.length > 0 && (
        <div className={cardClass}>
          <h2 className={`text-lg font-semibold mb-4 ${textPrimary}`}>Recent Page Views</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Page</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>User</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary} hidden sm:table-cell`}>Device</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary} hidden md:table-cell`}>Country</th>
                  <th className={`text-left pb-3 font-medium ${textSecondary}`}>Time</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentPageViews.map((pv, i) => (
                  <tr key={i} className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <td className={`py-2 ${textPrimary} max-w-[200px] truncate`}>{pv.path}</td>
                    <td className={`py-2 ${textSecondary}`}>{pv.username || 'Anonymous'}</td>
                    <td className={`py-2 ${textSecondary} hidden sm:table-cell capitalize`}>{pv.device || '-'}</td>
                    <td className={`py-2 ${textSecondary} hidden md:table-cell`}>{pv.country || '-'}</td>
                    <td className={`py-2 ${textSecondary} whitespace-nowrap`}>
                      {new Date(pv.created_at * 1000).toLocaleTimeString()}
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
