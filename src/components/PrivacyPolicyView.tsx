interface PrivacyPolicyViewProps {
  isDarkMode: boolean;
}

export function PrivacyPolicyView({ isDarkMode }: PrivacyPolicyViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Privacy Policy</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 2, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Introduction</h2>
          <p>
            FilmRoom Fantasy ("FilmRoom," "we," "us," or "our") operates the website filmroomfantasy.com
            and related services. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you visit our website or use our services. By using FilmRoom,
            you consent to the practices described in this policy.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Information We Collect</h2>
          <h3 className={`text-lg font-medium mb-2 ${h}`}>Account Information</h3>
          <p className="mb-3">
            When you create an account, we collect your email address, username, and password (stored
            securely using industry-standard hashing). If you connect a fantasy football league, we
            collect your platform username or league identifier to sync your league data.
          </p>
          <h3 className={`text-lg font-medium mb-2 ${h}`}>League Data</h3>
          <p className="mb-3">
            When you sync a league from Sleeper, ESPN, or Yahoo, we access publicly available league
            information including rosters, matchups, standings, and player data. We do not access
            private messages or personal information from these platforms beyond what is needed to
            provide our services.
          </p>
          <h3 className={`text-lg font-medium mb-2 ${h}`}>Usage Data</h3>
          <p className="mb-3">
            We automatically collect certain information when you visit our site, including your IP
            address, browser type, operating system, referring URLs, pages viewed, and the dates and
            times of your visits. This data helps us improve our services and understand how users
            interact with FilmRoom.
          </p>
          <h3 className={`text-lg font-medium mb-2 ${h}`}>Cookies and Tracking Technologies</h3>
          <p>
            We use cookies and similar technologies to maintain your session, remember your preferences
            (such as dark mode), and serve relevant advertisements through Google AdSense. Third-party
            advertising partners may also use cookies to serve personalized ads based on your browsing
            activity. You can manage cookie preferences through your browser settings.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Provide, operate, and maintain our fantasy football analysis services</li>
            <li>Sync and display your league data, rosters, and matchup information</li>
            <li>Generate personalized player rankings, projections, and trade analysis</li>
            <li>Process subscription payments and manage your account</li>
            <li>Send transactional emails (e.g., password resets, account confirmations)</li>
            <li>Analyze usage patterns to improve our features and user experience</li>
            <li>Display relevant advertisements through Google AdSense</li>
            <li>Detect, prevent, and address technical issues or abuse</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Third-Party Services</h2>
          <p className="mb-3">We integrate with or use the following third-party services:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Google AdSense</strong> — serves advertisements on our site. Google may use cookies to serve ads based on your prior visits. You can opt out of personalized advertising at <span className="underline">adssettings.google.com</span>.</li>
            <li><strong>Sleeper, ESPN, Yahoo</strong> — fantasy football league platforms from which we import league data at your request.</li>
            <li><strong>Stripe</strong> — processes subscription payments. We do not store credit card numbers; payment data is handled directly by Stripe in accordance with PCI-DSS standards.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Data Sharing and Disclosure</h2>
          <p className="mb-3">
            We do not sell your personal information. We may share information in the following
            circumstances:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Service providers:</strong> Third-party vendors who assist with hosting, analytics, payment processing, and ad serving, subject to confidentiality obligations.</li>
            <li><strong>Legal requirements:</strong> When required by law, subpoena, or government request, or to protect our rights, safety, or property.</li>
            <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred to the successor entity.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, we will remove your personal information within 30 days, except where we are
            required to retain it for legal or regulatory purposes. Aggregated, anonymized data may
            be retained indefinitely for analytics.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>7. Data Security</h2>
          <p>
            We implement industry-standard security measures including HTTPS encryption, secure
            password hashing, and access controls to protect your data. However, no method of
            transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>8. Your Rights</h2>
          <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Access, correct, or delete your personal information</li>
            <li>Object to or restrict certain processing of your data</li>
            <li>Request a portable copy of your data</li>
            <li>Withdraw consent for data processing where consent is the legal basis</li>
            <li>Opt out of personalized advertising</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, contact us at the email address below.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>9. Children's Privacy</h2>
          <p>
            FilmRoom is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children under 13. If you believe we have collected information
            from a child under 13, please contact us and we will promptly delete it.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of material
            changes by posting the updated policy on this page with a revised "Last updated" date.
            Your continued use of FilmRoom after any changes constitutes acceptance of the updated
            policy.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, please contact us
            at <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
