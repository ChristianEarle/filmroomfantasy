interface TermsOfServiceViewProps {
  isDarkMode: boolean;
}

export function TermsOfServiceView({ isDarkMode }: TermsOfServiceViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Terms of Service</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 2, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Acceptance of Terms</h2>
          <p>
            By accessing or using FilmRoom Fantasy ("FilmRoom," "we," "us," or "our") at
            filmroomfantasy.com and related services, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, do not use our services. We may update these terms
            from time to time, and your continued use of FilmRoom constitutes acceptance of any changes.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Description of Service</h2>
          <p>
            FilmRoom is a fantasy football analysis platform that provides player rankings, projections,
            trade analysis, waiver wire recommendations, and league management tools. Our projections
            are powered by Vegas betting lines, statistical models, and publicly available NFL data.
            FilmRoom is intended for entertainment and informational purposes related to fantasy
            football leagues.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Account Registration</h2>
          <p className="mb-3">
            To access certain features, you must create an account. When registering, you agree to:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your password and account</li>
            <li>Accept responsibility for all activity under your account</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
          </ul>
          <p className="mt-3">
            You must be at least 13 years old to create an account. By registering, you represent
            that you meet this age requirement.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Subscription Plans and Payments</h2>
          <p className="mb-3">
            FilmRoom offers free and paid subscription tiers. By subscribing to a paid plan, you agree
            to the following:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Subscriptions are billed on a recurring monthly basis through Stripe</li>
            <li>You authorize us to charge your payment method for the subscription fee</li>
            <li>Prices are subject to change with reasonable notice</li>
            <li>You may cancel your subscription at any time through your account settings; cancellation takes effect at the end of the current billing period</li>
            <li>Refunds are provided at our discretion and are not guaranteed</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. League Data and Third-Party Platforms</h2>
          <p>
            When you connect a fantasy football league from Sleeper, ESPN, or Yahoo, you authorize
            FilmRoom to access your publicly available league data (rosters, matchups, standings, and
            related information). We access this data solely to provide our analysis services. You
            represent that you have the right to authorize this access and that doing so does not
            violate any agreements you have with these platforms.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Acceptable Use</h2>
          <p className="mb-3">
            Your use of FilmRoom is governed by our{' '}
            <a
              href="/acceptable-use"
              className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
            >
              Acceptable Use Policy
            </a>
            , which is incorporated into these Terms. In summary, you agree not to:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Use FilmRoom for any unlawful purpose or in violation of any applicable laws</li>
            <li>Attempt to gain unauthorized access to our systems, other accounts, or data</li>
            <li>Scrape, crawl, or use automated tools to extract data from FilmRoom without permission</li>
            <li>Interfere with or disrupt the integrity or performance of our services</li>
            <li>Resell, redistribute, or commercially exploit our content, projections, or analysis without written consent</li>
            <li>Upload malicious code, viruses, or any harmful content</li>
          </ul>
          <p className="mt-3">
            See the full <a href="/acceptable-use" className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>Acceptable Use Policy</a> for the complete list of prohibited activities and enforcement details.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>7. Intellectual Property</h2>
          <p>
            All content on FilmRoom — including but not limited to player rankings, projections,
            analysis, articles, graphics, and software — is the property of FilmRoom or its licensors
            and is protected by copyright and intellectual property laws. You may not reproduce,
            distribute, or create derivative works from our content without prior written permission.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>8. Disclaimer of Warranties</h2>
          <p>
            FilmRoom is provided "as is" and "as available" without warranties of any kind, express
            or implied. We do not guarantee the accuracy, completeness, or reliability of our
            projections, rankings, or analysis. Fantasy football involves inherent unpredictability,
            and our tools are intended to assist — not replace — your own judgment. We are not
            responsible for any fantasy football outcomes, financial losses, or decisions made based
            on our analysis.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, FilmRoom and its officers, directors, employees,
            and agents shall not be liable for any indirect, incidental, special, consequential, or
            punitive damages, including but not limited to loss of profits, data, or goodwill, arising
            from your use of or inability to use our services, even if we have been advised of the
            possibility of such damages. Our total liability shall not exceed the amount you paid to
            FilmRoom in the twelve months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at any time for violation of
            these terms or for any other reason at our discretion. Upon termination, your right to
            use FilmRoom ceases immediately. Provisions that by their nature should survive termination
            (including intellectual property, disclaimers, and limitations of liability) shall continue
            in effect.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>11. Governing Law</h2>
          <p>
            These Terms of Service are governed by and construed in accordance with the laws of the
            United States. Any disputes arising from these terms or your use of FilmRoom shall be
            resolved in the courts of competent jurisdiction.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact Us</h2>
          <p>
            If you have questions about these Terms of Service, please contact us
            at <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
