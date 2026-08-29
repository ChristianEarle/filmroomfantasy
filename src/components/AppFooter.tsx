import { useState } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { openCookiePreferences } from './CookieConsentBanner';
import api from '../services/api';

interface AppFooterProps {
  isDarkMode: boolean;
  onNavigate: (view: string) => void;
}

interface FooterLink {
  label: string;
  view: string;
}

interface SocialLink {
  label: string;
  href: string;
}

const LEGAL_LINKS: FooterLink[] = [
  { label: 'Privacy Policy', view: 'Privacy' },
  { label: 'Terms of Service', view: 'Terms' },
  { label: 'Cookie Policy', view: 'CookiePolicy' },
  { label: 'Acceptable Use', view: 'AcceptableUse' },
  { label: 'Disclaimer', view: 'Disclaimer' },
  { label: 'Refunds', view: 'Refunds' },
  { label: 'DMCA', view: 'DMCA' },
  { label: 'Accessibility', view: 'Accessibility' },
  { label: 'Do Not Sell / Share', view: 'DoNotSell' },
];

// Fill href values to enable. Empty entries are skipped.
const SOCIAL_LINKS: SocialLink[] = [
  { label: 'X', href: '' },
  { label: 'Discord', href: '' },
  { label: 'Instagram', href: '' },
  { label: 'TikTok', href: '' },
];

const SUPPORT_EMAIL = 'support@filmroomfantasy.com';

export function AppFooter({ isDarkMode, onNavigate }: AppFooterProps) {
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const linkClass = isDarkMode
    ? 'text-slate-400 hover:text-slate-200'
    : 'text-slate-600 hover:text-slate-900';
  const bg = isDarkMode ? 'bg-slate-950' : 'bg-white';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    setError(null);
    try {
      await api.post('/newsletter/subscribe', { email: email.trim(), source: 'footer' });
      setStatus('success');
      setEmail('');
    } catch (err: unknown) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    }
  };

  const handleNav = (view: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(view);
  };

  const viewToPath: Record<string, string> = {
    Privacy: '/privacy',
    Terms: '/terms',
    CookiePolicy: '/cookies',
    AcceptableUse: '/acceptable-use',
    Disclaimer: '/disclaimer',
    Refunds: '/refunds',
    DMCA: '/dmca',
    Accessibility: '/accessibility',
    DoNotSell: '/do-not-sell',
  };

  const activeSocials = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <footer className={`${bg} border-t ${border} mt-8`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className={`max-w-md mx-auto text-center mb-8 pb-8 border-b ${border}`}>
          <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Weekly newsletter
          </h3>
          <p className={`text-xs mb-3 ${textMuted}`}>
            Waiver targets, start/sit calls, and injury updates — straight to your inbox.
          </p>
          {status === 'success' ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-500">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              You're subscribed!
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex items-center justify-center gap-2">
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {status === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                Subscribe
              </button>
            </form>
          )}
          {status === 'error' && error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs mb-6">
          {activeSocials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkClass} transition-colors`}
            >
              {s.label}
            </a>
          ))}
          <a href={`mailto:${SUPPORT_EMAIL}`} className={`${linkClass} transition-colors`}>
            Contact
          </a>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs"
        >
          {LEGAL_LINKS.map((link) => (
            <a
              key={link.view}
              href={viewToPath[link.view] || '#'}
              onClick={handleNav(link.view)}
              className={`${linkClass} transition-colors`}
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={openCookiePreferences}
            className={`${linkClass} text-xs font-normal transition-colors`}
          >
            Cookie preferences
          </button>
        </nav>
        <p className={`text-center text-xs mt-8 ${textMuted}`}>
          © {new Date().getFullYear()} FilmRoom Fantasy. Fantasy football analysis &amp; management.
          Not affiliated with the NFL or any fantasy platform.
        </p>
        <p className={`text-center text-xs mt-2 ${textMuted}`}>
          For entertainment purposes only. Users must be 18+ where applicable.
        </p>
      </div>
    </footer>
  );
}
