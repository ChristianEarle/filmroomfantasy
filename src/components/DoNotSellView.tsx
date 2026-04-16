import { useState } from 'react';
import { openCookiePreferences } from './CookieConsentBanner';
import { rejectAll, getConsent } from '../services/consent';

interface DoNotSellViewProps {
  isDarkMode: boolean;
}

export function DoNotSellView({ isDarkMode }: DoNotSellViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200';

  const current = getConsent();
  const [optedOut, setOptedOut] = useState(
    current !== null && current.advertising === false && current.analytics === false
  );

  const handleOptOut = () => {
    rejectAll();
    setOptedOut(true);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Do Not Sell or Share My Personal Information</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Your California privacy rights</h2>
          <p>
            Under the California Consumer Privacy Act (CCPA) as amended by the CPRA,
            California residents have the right to opt out of the "sale" or "sharing"
            of their personal information. Under these laws, the use of third-party
            advertising cookies (including Google AdSense) to show you personalized
            ads can qualify as "sharing" even when no money changes hands.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>What we do</h2>
          <p className="mb-3">
            We do not sell personal information in the traditional sense. However, we
            may share limited data (such as cookie identifiers and IP address) with
            Google AdSense and other advertising partners so they can serve relevant
            ads, which may be considered "sharing" under California law.
          </p>
          <p>
            We also honor the Global Privacy Control (GPC) browser signal as a valid
            opt-out request when transmitted by your browser.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Opt out now</h2>
          <div className={`rounded-xl border p-6 ${cardBg}`}>
            {optedOut ? (
              <div>
                <p className={`mb-2 font-semibold ${h}`}>You're opted out.</p>
                <p className="text-sm">
                  Personalized advertising and analytics cookies are disabled for this
                  browser. You can fine-tune your preferences at any time using the
                  button below.
                </p>
              </div>
            ) : (
              <div>
                <p className={`mb-4 ${p}`}>
                  Clicking the button below will disable analytics and advertising
                  cookies for this browser. You will still see ads, but they will not
                  be personalized.
                </p>
                <button
                  type="button"
                  onClick={handleOptOut}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                  Opt out of sale / sharing
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={openCookiePreferences}
              className={`mt-4 text-sm underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
              Open cookie preferences
            </button>
          </div>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Other rights you have</h2>
          <p className="mb-3">California residents also have the right to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Know what personal information we collect, use, and disclose about you.</li>
            <li>Request a copy of your personal information.</li>
            <li>Request deletion of your personal information, subject to certain exceptions.</li>
            <li>Correct inaccurate personal information.</li>
            <li>Limit the use and disclosure of sensitive personal information.</li>
            <li>Not be discriminated against for exercising any of these rights.</li>
          </ul>
          <p className="mt-3">
            To exercise these rights, email{' '}
            <span className="font-medium">privacy@filmroomfantasy.com</span> from the
            email address associated with your account. We may need to verify your
            identity before fulfilling the request.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Authorized agents</h2>
          <p>
            You may designate an authorized agent to submit a request on your behalf.
            We will require written proof of the agent's authority and may contact you
            directly to verify the request.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>For residents of other states</h2>
          <p>
            Similar rights may be available to residents of Colorado, Connecticut,
            Virginia, Utah, and other U.S. states with comprehensive privacy laws. We
            honor opt-out requests from residents of any U.S. state.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            Privacy requests:{' '}
            <span className="font-medium">privacy@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
