import { Check, Zap, Crown } from 'lucide-react';

interface PricingViewProps {
  isDarkMode: boolean;
  onSelectPlan?: (plan: 'free' | 'pro' | 'elite') => void;
  onGoToLogin: () => void;
}

const plans = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: 'Forever',
    description: 'Get started with core rankings',
    icon: null,
    featured: false,
    cta: 'Start free',
    ctaStyle: 'outline' as const,
    features: [
      { text: 'Player rankings — all positions', highlight: true },
      { text: 'NFL Game Slate with live scores', highlight: true },
      { text: 'News & injury updates', highlight: true },
      { text: '1 league sync', highlight: false },
      { text: 'Current week projections', highlight: false },
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    badge: 'Most Popular',
    price: '$5',
    priceSuffix: '/mo',
    period: 'or $30/year (save 50%)',
    description: 'Unlock the full edge',
    icon: Zap,
    featured: true,
    cta: 'Try Pro free for 7 days',
    ctaStyle: 'fill' as const,
    features: [
      { text: 'Everything in Free', highlight: true },
      { text: 'Unlimited league syncs', highlight: true },
      { text: 'All 18 weeks of projections', highlight: true },
      { text: 'Waiver wire recommendations', highlight: true },
      { text: 'Advanced matchup breakdowns', highlight: true },
      { text: 'Trending players & add/drop data', highlight: false },
      { text: 'Playoff predictor simulator', highlight: false },
      { text: 'Player news alerts', highlight: false },
    ],
  },
  {
    id: 'elite' as const,
    name: 'Elite',
    price: '$10',
    priceSuffix: '/mo',
    period: 'or $60/year (save 50%)',
    description: 'For the serious competitor',
    icon: Crown,
    featured: false,
    cta: 'Try Elite free for 7 days',
    ctaStyle: 'outline' as const,
    features: [
      { text: 'Everything in Pro', highlight: true },
      { text: 'Trade analyzer', highlight: true },
      { text: 'Lineup optimizer', highlight: true },
      { text: 'Custom scoring models', highlight: false },
      { text: 'Season-long projections', highlight: false },
      { text: 'Priority support', highlight: false },
      { text: 'Early access to new features', highlight: false },
    ],
  },
];

export function PricingView({ isDarkMode, onGoToLogin }: PricingViewProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Simple pricing
        </h1>
        <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Free to start. Upgrade when you want more.
        </p>
      </div>

      {/* Pricing Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-px rounded-xl overflow-hidden border ${isDarkMode ? 'bg-slate-700 border-slate-700' : 'bg-slate-200 border-slate-200'}`}>
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col p-8 ${
              plan.featured
                ? isDarkMode ? 'bg-slate-900' : 'bg-slate-50'
                : isDarkMode ? 'bg-slate-950' : 'bg-white'
            }`}
          >
            {/* Tier label */}
            <div className="mb-2">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                plan.featured ? 'text-blue-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}>
                {plan.name}
                {plan.badge && <span className="ml-1">— {plan.badge}</span>}
              </span>
            </div>

            {/* Price */}
            <div className="mb-1">
              <span className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {plan.price}
              </span>
              {plan.priceSuffix && (
                <span className={`text-base font-normal ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {plan.priceSuffix}
                </span>
              )}
            </div>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {plan.period}
            </p>

            {/* Features */}
            <ul className="flex-1 space-y-3 mb-8">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className={`w-4 h-4 mt-0.5 shrink-0 ${
                    feature.highlight ? 'text-blue-500' : isDarkMode ? 'text-slate-600' : 'text-slate-300'
                  }`} />
                  <span className={`text-sm ${
                    feature.highlight
                      ? isDarkMode ? 'text-slate-200' : 'text-slate-700'
                      : isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <button
              onClick={onGoToLogin}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
                plan.ctaStyle === 'fill'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : isDarkMode
                    ? 'border border-slate-700 text-white hover:border-slate-500 bg-transparent'
                    : 'border border-slate-300 text-slate-900 hover:border-slate-400 bg-transparent'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <p className={`text-center mt-8 text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        All plans include a 7-day free trial. No credit card required to start.
      </p>
    </div>
  );
}
