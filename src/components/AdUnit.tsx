import { useEffect, useRef, useState } from 'react';
import { isAllowed, onConsentChange } from '../services/consent';

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6355054767351119';

let scriptLoaded = false;

function loadAdSenseScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) {
    scriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    // Signal non-personalized ads to AdSense BEFORE the script loads if the user
    // has not consented to advertising cookies. This is the Google-recommended
    // mechanism for serving non-personalized ads under GDPR/ePrivacy and CCPA.
    // See: https://support.google.com/adsense/answer/9009582
    if (!isAllowed('advertising')) {
      try {
        (window as any).adsbygoogle = (window as any).adsbygoogle || [];
        (window as any).adsbygoogle.requestNonPersonalizedAds = 1;
      } catch {
        // ignore
      }
    }

    const script = document.createElement('script');
    script.src = ADSENSE_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Minimum amount of visible text (in characters) on the page for ads to render.
 * Prevents ads from showing on thin/empty screens (AdSense "low value content" policy).
 */
const MIN_PAGE_TEXT_LENGTH = 500;

function pageHasEnoughContent(): boolean {
  const main = document.querySelector('main');
  const textContent = (main || document.body).innerText || '';
  return textContent.length >= MIN_PAGE_TEXT_LENGTH;
}

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
  isDarkMode?: boolean;
}

export function AdUnit({ slot, format = 'auto', className = '' }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const [hasContent, setHasContent] = useState(false);
  const [consentReady, setConsentReady] = useState(false);
  const [consentVersion, setConsentVersion] = useState(0);

  // Wait for consent state to be available before deciding whether/how to serve ads.
  // - Advertising allowed  -> personalized ads
  // - Advertising rejected -> non-personalized ads (still allowed under AdSense policy)
  // - No decision yet      -> don't load AdSense until the user chooses (EU/UK compliant default)
  useEffect(() => {
    const unsub = onConsentChange(() => {
      setConsentVersion((v) => v + 1);
      setConsentReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!consentReady) return;

    // Defer the content check so the page has time to render
    const timer = setTimeout(() => {
      if (!pageHasEnoughContent()) return;

      // If the user hasn't made a decision yet, wait for one — don't load AdSense
      // preemptively. If they have decided (accept OR reject), we can proceed:
      // reject just means non-personalized ads.
      const hasStoredDecision = (() => {
        try {
          return !!localStorage.getItem('fr_cookie_consent');
        } catch {
          return false;
        }
      })();
      if (!hasStoredDecision) return;

      setHasContent(true);
      loadAdSenseScript().then(() => {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {
          // ignore
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [consentReady, consentVersion]);

  if (!hasContent) return null;

  return (
    <div className={`ad-unit ${className}`} ref={adRef}>
      <ins className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-6355054767351119"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
