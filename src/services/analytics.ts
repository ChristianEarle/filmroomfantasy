import { api } from './api';

// Generate or retrieve a persistent anonymous session ID
function getSessionId(): string {
  const key = 'fr_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

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
  // Deduplicate rapid-fire calls for the same path
  if (path === lastTrackedPath) return;
  lastTrackedPath = path;

  try {
    const payload = {
      path,
      referrer: document.referrer || '',
      sessionId: getSessionId(),
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
}
