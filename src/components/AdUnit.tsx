import { useEffect, useRef } from 'react';

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6355054767351119';

let scriptLoaded = false;

function loadAdSenseScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) {
    scriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
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

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
  isDarkMode?: boolean;
}

export function AdUnit({ slot, format = 'auto', className = '', isDarkMode }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAdSenseScript().then(() => {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch {}
    });
  }, []);

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
