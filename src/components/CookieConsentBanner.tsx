import { useEffect, useState } from 'react';
import { acceptAll, rejectAll, setConsent, getConsent, hasDecided } from '../services/consent';

interface CookieConsentBannerProps {
  isDarkMode: boolean;
  onNavigate?: (view: string) => void;
  /**
   * When true, offset the banner's left edge by the desktop sidebar width
   * (16rem / w-64) so it doesn't overlap the sidebar on md+ screens.
   */
  offsetForSidebar?: boolean;
}

/**
 * Cookie consent banner shown at the bottom of the screen until the user
 * makes a choice. Required for GDPR/ePrivacy (EU/UK/Swiss visitors) and for
 * compliance with Google AdSense's EU User Consent Policy.
 *
 * Three actions:
 *   - Accept All        — enables analytics + advertising cookies
 *   - Reject All        — only essential cookies
 *   - Manage Preferences — per-category toggles
 *
 * The banner listens for a global `fr:open-cookie-preferences` event so
 * footer links can re-open it after the user has dismissed it.
 */
export function CookieConsentBanner({ isDarkMode, onNavigate, offsetForSidebar = false }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [advertisingOn, setAdvertisingOn] = useState(true);

  useEffect(() => {
    // Show banner on first visit (no stored decision)
    if (!hasDecided()) {
      setVisible(true);
    }

    // Allow footer links / settings page to re-open the banner
    const openHandler = () => {
      const current = getConsent();
      if (current) {
        setAnalyticsOn(current.analytics);
        setAdvertisingOn(current.advertising);
      }
      setShowPreferences(true);
      setVisible(true);
    };
    window.addEventListener('fr:open-cookie-preferences', openHandler);
    return () => window.removeEventListener('fr:open-cookie-preferences', openHandler);
  }, []);

  if (!visible) return null;

  const bg = isDarkMode ? 'bg-slate-900' : 'bg-white';
  const border = isDarkMode ? 'border-slate-700' : 'border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const subBg = isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50';

  const handleAcceptAll = () => {
    acceptAll();
    setVisible(false);
    setShowPreferences(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setVisible(false);
    setShowPreferences(false);
  };

  const handleSavePreferences = () => {
    setConsent({ analytics: analyticsOn, advertising: advertisingOn });
    setVisible(false);
    setShowPreferences(false);
  };

  const handleNavigateToPolicy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate('CookiePolicy');
      setVisible(false);
      setShowPreferences(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
      className={`fixed right-0 bottom-0 left-0 z-[70] ${offsetForSidebar ? 'md:left-64' : ''} ${bg} border-t ${border} shadow-2xl`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        {!showPreferences ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <h2 id="cookie-banner-title" className={`text-base font-semibold mb-1 ${textPrimary}`}>
                We value your privacy
              </h2>
              <p id="cookie-banner-description" className={`text-sm ${textSecondary}`}>
                We use cookies to keep you signed in, understand how the site is used,
                and serve relevant ads through Google AdSense. You can accept all,
                reject non-essential, or choose which categories to allow.{' '}
                <a
                  href="/cookies"
                  onClick={handleNavigateToPolicy}
                  className={`underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Learn more
                </a>
                .
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Manage preferences
              </button>
              <button
                type="button"
                onClick={handleRejectAll}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-4">
              <h2 id="cookie-banner-title" className={`text-base font-semibold ${textPrimary}`}>
                Cookie preferences
              </h2>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className={`text-sm ${textMuted} hover:${textPrimary}`}
                aria-label="Close preferences"
              >
                Back
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className={`flex items-start gap-3 p-3 rounded-lg ${subBg}`}>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${textPrimary}`}>Essential</div>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>
                    Required for sign-in, session security, and core site functionality.
                    These cannot be disabled.
                  </p>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                  Always on
                </div>
              </div>

              <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${subBg}`}>
                <input
                  type="checkbox"
                  checked={analyticsOn}
                  onChange={(e) => setAnalyticsOn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${textPrimary}`}>Analytics</div>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>
                    Anonymous page-view tracking to help us understand how the site is used
                    and improve features. No personal profiles are built.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer ${subBg}`}>
                <input
                  type="checkbox"
                  checked={advertisingOn}
                  onChange={(e) => setAdvertisingOn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${textPrimary}`}>Advertising</div>
                  <p className={`text-xs ${textSecondary} mt-0.5`}>
                    Google AdSense cookies used to serve relevant ads. If disabled, you'll
                    still see ads, but they won't be personalized.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={handleRejectAll}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Reject all
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isDarkMode
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Dispatch an event to re-open the cookie preferences modal from anywhere. */
export function openCookiePreferences(): void {
  try {
    window.dispatchEvent(new Event('fr:open-cookie-preferences'));
  } catch {
    // ignore
  }
}
