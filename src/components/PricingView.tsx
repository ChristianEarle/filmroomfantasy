import { useState, useCallback } from 'react';
import { CreditCard, Check, AlertCircle } from 'lucide-react';

interface PricingViewProps {
  isDarkMode: boolean;
  userTier?: 'free' | 'pro' | 'elite';
  isAuthenticated?: boolean;
}

export function PricingView({ isDarkMode, userTier = 'free', isAuthenticated = false }: PricingViewProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [loading, setLoading] = useState<'pro' | 'elite' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = useCallback(async (tier: 'pro' | 'elite') => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    setLoading(tier);
    setError(null);

    try {
      const interval = isAnnual ? 'year' : 'month';
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiBase}/billing/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('filmroom_token') ? { Authorization: `Bearer ${localStorage.getItem('filmroom_token')}` } : {}),
        },
        body: JSON.stringify({
          priceId: tier === 'elite' ? (interval === 'year' ? 'elite_yearly' : 'elite_monthly') : (interval === 'year' ? 'pro_yearly' : 'pro_monthly'),
          successUrl: `${window.location.origin}/pricing?billing=success`,
          cancelUrl: `${window.location.origin}/pricing?billing=cancel`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      } else {
        setError('Could not redirect to payment. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setLoading(null);
    }
  }, [isAuthenticated, isAnnual]);

  const savings = {
    pro: '50%',
    elite: '50%',
  };

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'Forever',
      monthlyPrice: null,
      yearlyPrice: null,
      description: 'Free to start. Upgrade when you want more.',
      features: [
        { text: 'Player rankings — all positions, all scoring formats', highlight: true },
        { text: 'NFL Game Slate with live scores', highlight: true },
        { text: 'News & injury updates', highlight: true },
        { text: '1 league sync', highlight: false },
        { text: 'Current week projections', highlight: false },
      ],
      cta: userTier === 'free' ? 'Current Plan' : 'Downgrade',
      featured: false,
      badge: null,
    },
    {
      name: 'Pro',
      monthlyPrice: 4.99,
      yearlyPrice: 29.99,
      description: 'Everything you need to dominate your league.',
      features: [
        { text: 'Everything in Free', highlight: true },
        { text: 'Unlimited league syncs', highlight: true },
        { text: 'Trending players & add/drop data', highlight: true },
        { text: 'Deeper player research — stats, Vegas props, game logs, matchup grades', highlight: true },
      ],
      cta: userTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      featured: true,
      badge: 'Most Popular',
    },
    {
      name: 'Elite',
      monthlyPrice: 9.99,
      yearlyPrice: 59.99,
      description: 'Advanced tools for serious competitors.',
      features: [
        { text: 'Everything in Pro', highlight: true },
        { text: 'Trade analyzer', highlight: true, comingSoon: true },
        { text: 'Lineup optimizer', highlight: true, comingSoon: true },
        { text: 'Custom scoring models', highlight: false, comingSoon: true },
        { text: 'Season-long projections', highlight: false, comingSoon: true },
        { text: 'Priority support', highlight: false, comingSoon: true },
        { text: 'Early access to new features', highlight: false, comingSoon: true },
      ],
      cta: userTier === 'elite' ? 'Current Plan' : 'Upgrade to Elite',
      featured: false,
      badge: null,
    },
  ];

  return (
    <div className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl sm:text-5xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Simple, transparent pricing
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Free to start. Upgrade when you need more.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center items-center gap-4 mb-12">
          <button
            onClick={() => setIsAnnual(false)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              !isAnnual
                ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              isAnnual
                ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual
          </button>
          {isAnnual && (
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
              Save {savings.pro}
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className={`mb-8 p-4 rounded-lg flex items-center gap-3 ${isDarkMode ? 'bg-red-900/20 border border-red-700/50 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-16`}>
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border transition-all relative ${
                tier.featured
                  ? isDarkMode
                    ? 'bg-slate-900 border-slate-700 ring-2 ring-blue-600 ring-opacity-50'
                    : 'bg-slate-50 border-slate-200 ring-2 ring-blue-600 ring-opacity-50'
                  : isDarkMode
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
              }`}
            >
              {tier.badge && (
                <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {tier.badge}
                </div>
              )}

              <div className="p-8 flex flex-col h-full">
                {/* Tier Name */}
                <h3 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {tier.name}
                </h3>

                {/* Price */}
                {tier.monthlyPrice !== null && tier.yearlyPrice !== null ? (
                  <div className="mb-1">
                    <div className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      ${isAnnual ? tier.yearlyPrice.toFixed(2) : tier.monthlyPrice.toFixed(2)}
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      per {isAnnual ? 'year' : 'month'}
                    </div>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {tier.price}
                    </div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {tier.period}
                    </div>
                  </div>
                )}

                {/* Savings Note */}
                {tier.monthlyPrice !== null && isAnnual && (
                  <div className={`text-xs font-semibold mb-6 ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                    Save {savings[tier.name as 'pro' | 'elite']} vs monthly
                  </div>
                )}

                <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {tier.description}
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${feature.highlight ? 'text-blue-600' : isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                      <span className={`text-sm ${feature.highlight ? (isDarkMode ? 'text-white font-semibold' : 'text-slate-900 font-semibold') : isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {feature.text}
                        {'comingSoon' in feature && feature.comingSoon && (
                          <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${isDarkMode ? 'bg-amber-900/30 text-amber-400 border border-amber-800/50' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                            Coming Soon
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => {
                    if (tier.name === 'Free') {
                      window.location.href = '/login';
                    } else if (tier.name !== 'Free') {
                      handleUpgrade(tier.name.toLowerCase() as 'pro' | 'elite');
                    }
                  }}
                  disabled={loading === (tier.name.toLowerCase() as 'pro' | 'elite') || tier.name === userTier}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    tier.name === userTier
                      ? isDarkMode
                        ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : tier.featured
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isDarkMode
                          ? 'border border-slate-700 text-white hover:bg-slate-800'
                          : 'border border-slate-200 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {loading === (tier.name.toLowerCase() as 'pro' | 'elite') ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    tier.cta
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className={`text-3xl font-bold mb-8 text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'Can I change my plan anytime?',
                a: 'Yes, upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle.',
              },
              {
                q: 'Is there a free trial for Pro and Elite?',
                a: 'Yes, both Pro and Elite include a 7-day free trial. No credit card required to start.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, debit cards, and Apple Pay through Stripe.',
              },
              {
                q: 'Can I sync multiple leagues on Free?',
                a: 'Free tier allows 1 league sync. Pro and Elite support unlimited league syncs across Sleeper, Yahoo, and ESPN.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'Annual subscriptions come with a 14-day money-back guarantee. Monthly subscriptions can be cancelled anytime.',
              },
              {
                q: 'What happens if I cancel?',
                a: 'Your access ends at the end of your billing period. You can reactivate anytime without losing your data.',
              },
            ].map((item, idx) => (
              <div key={idx} className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {item.q}
                </h3>
                <p className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className={`mt-16 text-center py-12 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Ready to level up your fantasy game?
          </p>
          <button
            onClick={() => {
              if (isAuthenticated) {
                handleUpgrade('pro');
              } else {
                window.location.href = '/login';
              }
            }}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Start with Pro
          </button>
        </div>
      </div>
    </div>
  );
}
