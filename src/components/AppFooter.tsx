import { openCookiePreferences } from './CookieConsentBanner';

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
            className={`${linkClass} transition-colors`}
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
