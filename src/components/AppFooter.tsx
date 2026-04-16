import { openCookiePreferences } from './CookieConsentBanner';

interface AppFooterProps {
  isDarkMode: boolean;
  onNavigate: (view: string) => void;
}

interface FooterLink {
  label: string;
  view: string;
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

/**
 * Global footer for authenticated/in-app views. Surfaces required compliance
 * links on every page (Privacy, Terms, Cookie Policy, DMCA, CCPA opt-out, etc.)
 * plus a button to reopen the cookie preferences center.
 */
export function AppFooter({ isDarkMode, onNavigate }: AppFooterProps) {
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const linkClass = isDarkMode
    ? 'text-slate-400 hover:text-slate-200'
    : 'text-slate-600 hover:text-slate-900';
  const bg = isDarkMode ? 'bg-slate-950' : 'bg-white';

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

  return (
    <footer className={`${bg} border-t ${border} mt-8`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"
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
            className={`${linkClass} transition-colors`}
          >
            Cookie preferences
          </button>
        </nav>
        <p className={`text-center text-xs mt-4 ${textMuted}`}>
          © {new Date().getFullYear()} FilmRoom Fantasy. Fantasy football analysis &amp; management.
          Not affiliated with the NFL or any fantasy platform.
        </p>
      </div>
    </footer>
  );
}
