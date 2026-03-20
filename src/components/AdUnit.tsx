import { useEffect, useRef } from 'react';

interface AdUnitProps {
  slot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
  isDarkMode?: boolean;
}

export function AdUnit({ slot, format = 'auto', className = '', isDarkMode }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {}
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
