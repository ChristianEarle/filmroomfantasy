import { openCookiePreferences } from './CookieConsentBanner';

interface CookiePolicyViewProps {
  isDarkMode: boolean;
}

export function CookiePolicyView({ isDarkMode }: CookiePolicyViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const tableBorder = isDarkMode ? 'border-slate-700' : 'border-slate-300';
  const tableHeadBg = isDarkMode ? 'bg-slate-800' : 'bg-slate-100';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Cookie Policy</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. What are cookies?</h2>
          <p>
            Cookies are small text files placed on your device when you visit a website.
            They allow the site to remember your actions and preferences (such as sign-in
            state and dark mode) over time. This Cookie Policy explains which cookies
            FilmRoom Fantasy uses, why we use them, and how you can control them.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Categories of cookies we use</h2>

          <h3 className={`text-lg font-medium mb-2 mt-4 ${h}`}>Essential (always on)</h3>
          <p className="mb-3">
            Required for the site to function. These include session cookies that keep
            you signed in, CSRF tokens that protect form submissions, and preferences
            that persist your dark mode selection. You cannot disable these because the
            site will not work without them.
          </p>

          <h3 className={`text-lg font-medium mb-2 mt-4 ${h}`}>Analytics</h3>
          <p className="mb-3">
            First-party, anonymous page-view tracking that helps us understand which
            features are used and where users encounter problems. No personal profiles
            are built; we do not use these cookies for advertising.
          </p>

          <h3 className={`text-lg font-medium mb-2 mt-4 ${h}`}>Advertising</h3>
          <p className="mb-3">
            Third-party cookies set by Google AdSense and its partners. These may be
            used to measure ad performance and, if you consent, to show you personalized
            ads based on your browsing activity. If you decline advertising cookies, we
            will ask Google to serve non-personalized ads instead.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Cookies we set</h2>
          <div className="overflow-x-auto">
            <table className={`w-full text-sm border ${tableBorder} border-collapse`}>
              <thead className={tableHeadBg}>
                <tr>
                  <th className={`text-left px-3 py-2 border ${tableBorder} ${h}`}>Name</th>
                  <th className={`text-left px-3 py-2 border ${tableBorder} ${h}`}>Category</th>
                  <th className={`text-left px-3 py-2 border ${tableBorder} ${h}`}>Purpose</th>
                  <th className={`text-left px-3 py-2 border ${tableBorder} ${h}`}>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`px-3 py-2 border ${tableBorder}`}>session</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Essential</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Keeps you signed in (HttpOnly).</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Session / 30 days</td>
                </tr>
                <tr>
                  <td className={`px-3 py-2 border ${tableBorder}`}>fr_cookie_consent</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Essential</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Stores your cookie consent choices.</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Persistent (localStorage)</td>
                </tr>
                <tr>
                  <td className={`px-3 py-2 border ${tableBorder}`}>darkMode</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Essential</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Remembers your light/dark theme preference.</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Persistent (localStorage)</td>
                </tr>
                <tr>
                  <td className={`px-3 py-2 border ${tableBorder}`}>__gads, __gpi, IDE</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Advertising</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Set by Google AdSense to measure ad performance and, with consent, to personalize ads.</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Up to 13 months</td>
                </tr>
                <tr>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Stripe (e.g. __stripe_mid)</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Essential</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>Set only on payment pages to prevent fraud during checkout.</td>
                  <td className={`px-3 py-2 border ${tableBorder}`}>1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Third-party cookies</h2>
          <p className="mb-3">
            The following third parties may set cookies on our site. Each is governed by
            its own privacy policy:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Google AdSense</strong> — ad serving and measurement.{' '}
              <a
                href="https://policies.google.com/technologies/ads"
                target="_blank"
                rel="noopener noreferrer"
                className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Google privacy &amp; ads policy
              </a>
            </li>
            <li>
              <strong>Stripe</strong> — fraud prevention on payment pages.{' '}
              <a
                href="https://stripe.com/cookies-policy/legal"
                target="_blank"
                rel="noopener noreferrer"
                className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Stripe cookie policy
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. How to control cookies</h2>
          <p className="mb-3">
            You can change your choices at any time:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Use our preference center:{' '}
              <button
                type="button"
                onClick={openCookiePreferences}
                className={`underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
              >
                Open cookie preferences
              </button>
            </li>
            <li>Adjust your browser settings to block or delete cookies. Note that
              blocking essential cookies will prevent sign-in from working.</li>
            <li>
              Opt out of personalized advertising across the web at{' '}
              <a
                href="https://adssettings.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                adssettings.google.com
              </a>
              {' '}and{' '}
              <a
                href="https://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
                className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
              >
                aboutads.info/choices
              </a>
              .
            </li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Do Not Track</h2>
          <p>
            Some browsers send a "Do Not Track" (DNT) signal. There is no industry
            consensus on how to interpret DNT, so we do not respond to DNT signals.
            You can instead use the cookie preferences above, which achieve the same
            result.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>7. Changes to this policy</h2>
          <p>
            We may update this Cookie Policy when our practices change. We will post
            the updated policy here with a revised "Last updated" date.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact Us</h2>
          <p>
            Questions about this Cookie Policy? Email{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
