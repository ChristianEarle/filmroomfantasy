import { useState } from 'react';
import { X, Check, Zap } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onUpgradeClick: (priceId: string) => Promise<void>;
}

export function UpgradeModal({
  isOpen,
  onClose,
  isDarkMode,
  onUpgradeClick,
}: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  if (!isOpen) return null;

  const handleUpgrade = async (priceId: string) => {
    setIsLoading(true);
    try {
      await onUpgradeClick(priceId);
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    'Connect unlimited leagues',
    'Trending players & add/drop data',
    '5 trade analyses per day',
    '3-day free trial — cancel anytime',
  ];

  const monthlyPriceId = 'pro_monthly';
  const yearlyPriceId = 'pro_yearly';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 ${
        isOpen ? 'bg-black/50 backdrop-blur-sm' : 'pointer-events-none'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md rounded-xl border ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 shadow-xl'
            : 'bg-white border-slate-200 shadow-2xl'
        } p-6`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-lg transition-colors ${
            isDarkMode
              ? 'hover:bg-slate-800 text-slate-400'
              : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <h2
              className={`text-2xl font-bold ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Upgrade to Pro
            </h2>
          </div>
          <p
            className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
          >
            Unlock unlimited leagues and premium features
          </p>
        </div>

        {/* Benefits list */}
        <div className="mb-6 space-y-3">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <Check className="w-4 h-4 text-green-500 shrink-0" />
              <span
                className={`text-sm ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Billing period toggle */}
        <div
          className={`mb-6 p-1 rounded-lg flex gap-1 ${
            isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
          }`}
        >
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? isDarkMode
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-900'
                : isDarkMode
                ? 'text-slate-400'
                : 'text-slate-600'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors relative ${
              billingPeriod === 'yearly'
                ? isDarkMode
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-slate-900'
                : isDarkMode
                ? 'text-slate-400'
                : 'text-slate-600'
            }`}
          >
            Yearly
            <span className="absolute -top-2 right-1 text-xs font-bold text-blue-500 bg-blue-500/20 px-1.5 rounded">
              Save 17%
            </span>
          </button>
        </div>

        {/* Pricing and CTA */}
        {billingPeriod === 'monthly' ? (
          <div className="mb-6">
            <div className="flex items-baseline gap-1 mb-4">
              <span
                className={`text-4xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                $4.99
              </span>
              <span
                className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
              >
                /month
              </span>
            </div>
            <button
              onClick={() => handleUpgrade(monthlyPriceId)}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-semibold transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                'Upgrade Now'
              )}
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-baseline gap-1 mb-4">
              <span
                className={`text-4xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                $49.99
              </span>
              <span
                className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
              >
                /year
              </span>
            </div>
            <p
              className={`text-xs mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
            >
              Just $2.50/month when billed annually
            </p>
            <button
              onClick={() => handleUpgrade(yearlyPriceId)}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-semibold transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : (
                'Upgrade Now'
              )}
            </button>
          </div>
        )}

        {/* Footer note */}
        <p
          className={`text-xs text-center ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Secure payment powered by Stripe. No hidden fees.
        </p>
      </div>
    </div>
  );
}
