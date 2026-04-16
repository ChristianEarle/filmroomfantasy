/**
 * Cookie consent management.
 *
 * Tracks user consent for three categories of cookies/technologies:
 *   - essential: always on (session, auth, CSRF, dark-mode preference)
 *   - analytics: first-party page-view analytics
 *   - advertising: Google AdSense + personalized advertising cookies
 *
 * Consent is stored in localStorage under `fr_cookie_consent`. A CustomEvent
 * named `fr:consent-change` is dispatched on the window whenever consent is
 * updated so subscribers (AdUnit, analytics) can react immediately.
 *
 * We treat "no stored value" as "no decision yet" and keep non-essential
 * cookies disabled until the user makes a choice (GDPR/ePrivacy compliant).
 */

export type ConsentCategory = 'essential' | 'analytics' | 'advertising';

export interface ConsentState {
  essential: true; // always true; included for type completeness
  analytics: boolean;
  advertising: boolean;
  /** ISO timestamp of when the user made this decision. */
  decidedAt: string | null;
  /** Schema version — bump if we materially change the categories. */
  version: number;
}

const STORAGE_KEY = 'fr_cookie_consent';
const EVENT_NAME = 'fr:consent-change';
const CURRENT_VERSION = 1;

const DEFAULT_PENDING: ConsentState = {
  essential: true,
  analytics: false,
  advertising: false,
  decidedAt: null,
  version: CURRENT_VERSION,
};

function readStorage(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CURRENT_VERSION) return null;
    return {
      essential: true,
      analytics: !!parsed.analytics,
      advertising: !!parsed.advertising,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : null,
      version: CURRENT_VERSION,
    };
  } catch {
    return null;
  }
}

function writeStorage(state: ConsentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — in-memory only (banner will reappear next visit)
  }
}

/** Get the current consent state. If no decision has been made, returns null. */
export function getConsent(): ConsentState | null {
  return readStorage();
}

/** Whether the user has made an explicit consent decision yet. */
export function hasDecided(): boolean {
  const state = readStorage();
  return state !== null && state.decidedAt !== null;
}

/** Whether a specific category is allowed. Essential is always true. */
export function isAllowed(category: ConsentCategory): boolean {
  if (category === 'essential') return true;
  const state = readStorage();
  if (!state) return false;
  return state[category] === true;
}

/** Set consent for all categories at once and notify subscribers. */
export function setConsent(next: { analytics: boolean; advertising: boolean }): void {
  const state: ConsentState = {
    essential: true,
    analytics: !!next.analytics,
    advertising: !!next.advertising,
    decidedAt: new Date().toISOString(),
    version: CURRENT_VERSION,
  };
  writeStorage(state);
  try {
    window.dispatchEvent(new CustomEvent<ConsentState>(EVENT_NAME, { detail: state }));
  } catch {
    // CustomEvent unavailable (old browser) — subscribers will pick up on next read
  }
}

/** Accept everything. */
export function acceptAll(): void {
  setConsent({ analytics: true, advertising: true });
}

/** Reject everything non-essential. */
export function rejectAll(): void {
  setConsent({ analytics: false, advertising: false });
}

/** Clear the stored decision (used by "Manage preferences" to reopen the banner). */
export function resetConsent(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent<ConsentState>(EVENT_NAME, { detail: DEFAULT_PENDING }));
  } catch {
    // ignore
  }
}

/**
 * Subscribe to consent changes. The callback is invoked immediately with the
 * current state, and again whenever consent is updated. Returns an unsubscribe
 * function.
 */
export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<ConsentState>).detail;
    if (detail) cb(detail);
    else cb(readStorage() ?? DEFAULT_PENDING);
  };
  window.addEventListener(EVENT_NAME, handler);
  // Invoke once with current state so subscribers don't need to read twice
  cb(readStorage() ?? DEFAULT_PENDING);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
