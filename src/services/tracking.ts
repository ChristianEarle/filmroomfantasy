/**
 * Ad-platform tracking pixel manager.
 *
 * Loads GA4, Meta Pixel, Google Ads, and TikTok Pixel scripts conditionally
 * based on cookie consent. Pixels stay dormant until the user grants consent,
 * and unload (or stop firing) when consent is revoked.
 *
 * Configuration is read from Vite env vars at build time:
 *   - VITE_GA4_ID                              — e.g. "G-XXXXXXXXXX"  (analytics consent)
 *   - VITE_META_PIXEL_ID                       — e.g. "1234567890"    (advertising consent)
 *   - VITE_GOOGLE_ADS_ID                       — e.g. "AW-1234567890" (advertising consent)
 *   - VITE_GOOGLE_ADS_SIGNUP_LABEL             — conversion label for sign-up event
 *   - VITE_GOOGLE_ADS_PURCHASE_LABEL           — conversion label for purchase event
 *   - VITE_TIKTOK_PIXEL_ID                     — e.g. "C12345..."     (advertising consent)
 *
 * Any unset ID simply skips that platform — safe to ship without configuration.
 */

import { isAllowed, onConsentChange } from './consent';

const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim();
const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim();
const GOOGLE_ADS_ID = (import.meta.env.VITE_GOOGLE_ADS_ID as string | undefined)?.trim();
const GOOGLE_ADS_SIGNUP_LABEL = (import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL as string | undefined)?.trim();
const GOOGLE_ADS_PURCHASE_LABEL = (import.meta.env.VITE_GOOGLE_ADS_PURCHASE_LABEL as string | undefined)?.trim();
const TIKTOK_PIXEL_ID = (import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined)?.trim();
const REDDIT_PIXEL_ID = (import.meta.env.VITE_REDDIT_PIXEL_ID as string | undefined)?.trim();

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
    ttq?: { load: (id: string) => void; page: () => void; track: (event: string, params?: Record<string, unknown>) => void; instance?: unknown; methods?: string[] } & Record<string, unknown>;
    rdt?: ((...args: unknown[]) => void) & { sendEvent?: unknown; callQueue?: unknown[] };
  }
}

let gaLoaded = false;
let metaLoaded = false;
let googleAdsLoaded = false;
let tiktokLoaded = false;
let redditLoaded = false;

function injectScript(src: string, id: string, async = true): void {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.src = src;
  s.async = async;
  s.id = id;
  document.head.appendChild(s);
}

function ensureGtag(): void {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  // gtag uses arguments object; the standard snippet pushes the raw args to dataLayer
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments);
  };
  window.gtag('js', new Date());
}

function loadGA4(): void {
  if (gaLoaded || !GA4_ID) return;
  gaLoaded = true;
  ensureGtag();
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`, 'ga4-script');
  // anonymize_ip for extra privacy posture; send_page_view false because we fire it manually on SPA nav
  window.gtag!('config', GA4_ID, { anonymize_ip: true, send_page_view: false });
}

function loadGoogleAds(): void {
  if (googleAdsLoaded || !GOOGLE_ADS_ID) return;
  googleAdsLoaded = true;
  ensureGtag();
  // Reuse the gtag.js loader if GA4 isn't loading it
  if (!gaLoaded) {
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`, 'gads-script');
  }
  window.gtag!('config', GOOGLE_ADS_ID);
}

function loadMetaPixel(): void {
  if (metaLoaded || !META_PIXEL_ID) return;
  metaLoaded = true;
  // Standard Meta Pixel bootstrap — adapted from facebook.com docs
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    t.id = 'meta-pixel-script';
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq!('init', META_PIXEL_ID);
  window.fbq!('track', 'PageView');
}

function loadTikTokPixel(): void {
  if (tiktokLoaded || !TIKTOK_PIXEL_ID) return;
  tiktokLoaded = true;
  // Standard TikTok bootstrap
  (function (w: any, d: Document, t: string) {
    w.TiktokAnalyticsObject = t;
    const ttq: any = (w[t] = w[t] || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (target: any, method: string) {
      target[method] = function () {
        target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.instance = function (id: string) {
      const e = ttq._i[id] || [];
      for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
      return e;
    };
    ttq.load = function (e: string) {
      const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = {};
      const o = d.createElement('script');
      o.type = 'text/javascript';
      o.async = true;
      o.src = i + '?sdkid=' + e + '&lib=' + t;
      o.id = 'tiktok-pixel-script';
      const a = d.getElementsByTagName('script')[0];
      a.parentNode?.insertBefore(o, a);
    };
    ttq.load(TIKTOK_PIXEL_ID);
    ttq.page();
  })(window, document, 'ttq');
}

function loadRedditPixel(): void {
  if (redditLoaded || !REDDIT_PIXEL_ID) return;
  redditLoaded = true;
  (function (w: any, d: Document) {
    if (!w.rdt) {
      const p: any = (w.rdt = function () {
        // eslint-disable-next-line prefer-rest-params
        p.sendEvent ? p.sendEvent.apply(p, arguments) : p.callQueue.push(arguments);
      });
      p.callQueue = [];
      const t = d.createElement('script');
      t.src = 'https://www.redditstatic.com/ads/pixel.js';
      t.async = true;
      t.id = 'reddit-pixel-script';
      const s = d.getElementsByTagName('script')[0];
      s.parentNode?.insertBefore(t, s);
    }
  })(window, document);
  window.rdt!('init', REDDIT_PIXEL_ID);
  window.rdt!('track', 'PageVisit');
}

/** Initialize all pixels the user has consented to. Safe to call multiple times. */
function syncPixelsToConsent(): void {
  if (isAllowed('analytics')) loadGA4();
  if (isAllowed('advertising')) {
    loadGoogleAds();
    loadMetaPixel();
    loadTikTokPixel();
    loadRedditPixel();
  }
}

/**
 * Boot tracking. Call once at app startup. Subscribes to consent changes so
 * pixels can load the moment the user grants consent (without a refresh).
 */
export function initTracking(): void {
  // First sync covers the case where consent was granted on a previous visit.
  syncPixelsToConsent();
  onConsentChange(() => syncPixelsToConsent());
}

/** Track an SPA page view. Safe to call before consent — no-ops if pixels not loaded. */
export function trackPageView(path: string): void {
  if (gaLoaded && window.gtag && GA4_ID) {
    window.gtag('event', 'page_view', { page_path: path });
  }
  if (metaLoaded && window.fbq) {
    window.fbq('track', 'PageView');
  }
  if (tiktokLoaded && window.ttq) {
    window.ttq.page();
  }
  if (redditLoaded && window.rdt) {
    window.rdt('track', 'PageVisit');
  }
}

/** User completed sign-up (free account creation). */
export function trackSignUp(method: 'email' | 'google' = 'email'): void {
  if (gaLoaded && window.gtag) {
    window.gtag('event', 'sign_up', { method });
  }
  if (googleAdsLoaded && window.gtag && GOOGLE_ADS_ID && GOOGLE_ADS_SIGNUP_LABEL) {
    window.gtag('event', 'conversion', { send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_SIGNUP_LABEL}` });
  }
  if (metaLoaded && window.fbq) {
    window.fbq('track', 'CompleteRegistration', { method });
  }
  if (tiktokLoaded && window.ttq) {
    window.ttq.track('CompleteRegistration');
  }
  if (redditLoaded && window.rdt) {
    window.rdt('track', 'SignUp');
  }
}

/** User clicked Subscribe / Upgrade and is being redirected to Stripe checkout. */
export function trackBeginCheckout(tier: 'pro' | 'elite', interval: 'month' | 'year', value: number): void {
  if (gaLoaded && window.gtag) {
    window.gtag('event', 'begin_checkout', {
      currency: 'USD',
      value,
      items: [{ item_id: `${tier}_${interval}`, item_name: `${tier} (${interval}ly)` }],
    });
  }
  if (metaLoaded && window.fbq) {
    window.fbq('track', 'InitiateCheckout', { currency: 'USD', value, content_ids: [`${tier}_${interval}`] });
  }
  if (tiktokLoaded && window.ttq) {
    window.ttq.track('InitiateCheckout', { currency: 'USD', value, content_id: `${tier}_${interval}` });
  }
  if (redditLoaded && window.rdt) {
    window.rdt('track', 'AddToCart', { currency: 'USD', value, itemCount: 1 });
  }
}

/**
 * User completed purchase. Fired on the success URL after Stripe redirects back.
 * Note: this is a client-side fallback. For accuracy, also verify via the Stripe
 * webhook server-side (server-to-server conversion APIs).
 */
export function trackPurchase(tier: 'pro' | 'elite', interval: 'month' | 'year', value: number): void {
  const txnId = crypto.randomUUID(); // dedupe on the ad platform side
  if (gaLoaded && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: txnId,
      currency: 'USD',
      value,
      items: [{ item_id: `${tier}_${interval}`, item_name: `${tier} (${interval}ly)`, price: value, quantity: 1 }],
    });
  }
  if (googleAdsLoaded && window.gtag && GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL) {
    window.gtag('event', 'conversion', {
      send_to: `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`,
      value,
      currency: 'USD',
      transaction_id: txnId,
    });
  }
  if (metaLoaded && window.fbq) {
    window.fbq('track', 'Purchase', { currency: 'USD', value, content_ids: [`${tier}_${interval}`] });
  }
  if (tiktokLoaded && window.ttq) {
    window.ttq.track('CompletePayment', { currency: 'USD', value, content_id: `${tier}_${interval}` });
  }
  if (redditLoaded && window.rdt) {
    window.rdt('track', 'Purchase', { currency: 'USD', value, transactionId: txnId });
  }
}
