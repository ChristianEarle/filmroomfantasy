import { api } from './api';
import { trackPageView as trackPixelPageView } from './tracking';

function getDevice(): string {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Other';
}

let lastTrackedPath = '';

export function trackPageView(path: string): void {
  // First-party page views are recorded server-side from anonymous request
  // metadata (path, referrer, IP-derived daily hash). No client-side identifier
  // is set, so this is cookieless and runs regardless of cookie-consent state.
  // Third-party ad pixels below remain gated on consent inside trackPixelPageView.

  // Deduplicate rapid-fire calls for the same path
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  try {
    const payload = {
      path,
      referrer: document.referrer || '',
      device: getDevice(),
      browser: getBrowser(),
    };

    // Fire-and-forget — never block rendering
    api.post('/analytics/pageview', payload).catch(() => {
      // Silently ignore analytics failures
    });
  } catch {
    // Never break the app over analytics
  }

  // Mirror the pageview to GA4/Meta/TikTok (no-ops if those pixels aren't configured/loaded).
  try {
    trackPixelPageView(path);
  } catch {
    // ignore
  }
}
