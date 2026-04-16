interface DisclaimerViewProps {
  isDarkMode: boolean;
}

export function DisclaimerView({ isDarkMode }: DisclaimerViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Disclaimer</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Informational purposes only</h2>
          <p>
            All content on FilmRoom Fantasy — including player rankings, projections,
            trade grades, waiver recommendations, playoff odds, and articles — is
            provided for informational and entertainment purposes only. It is not
            intended as, and should not be construed as, professional advice of any
            kind.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Not gambling or betting advice</h2>
          <p>
            FilmRoom is a fantasy football analysis tool. We do not offer gambling or
            sports-betting advice, do not accept wagers, and do not facilitate payouts
            of any kind. Any decisions you make on third-party platforms (including
            daily fantasy sports, sportsbooks, or prop-betting services) are your own.
            If you or someone you know has a gambling problem, call 1-800-GAMBLER or
            visit{' '}
            <a
              href="https://www.ncpgambling.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
            >
              ncpgambling.org
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. No guarantees of accuracy</h2>
          <p>
            Our projections are generated from Vegas betting lines, publicly available
            NFL statistics, and proprietary models. Fantasy football is inherently
            unpredictable — injuries, weather, coaching decisions, and in-game
            circumstances can change outcomes. We do not guarantee the accuracy,
            completeness, or timeliness of any projection, ranking, or analysis, and
            we make no promises about fantasy football results.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. AI-generated content</h2>
          <p>
            Some features (including the Trade Analyzer and counter-offer suggestions)
            use artificial intelligence and machine-learning models. AI output may
            contain inaccuracies, biases, or errors and should not be relied upon as a
            sole basis for any decision. Always apply your own judgment.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Third-party trademarks</h2>
          <p>
            NFL team names, logos, player names, and related marks are the property of
            their respective owners. References to players, teams, or leagues on
            FilmRoom are for identification and commentary purposes only. FilmRoom is
            not affiliated with, endorsed by, or sponsored by the NFL, any NFL team,
            or any fantasy football platform (Sleeper, ESPN, Yahoo, or otherwise).
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. External links</h2>
          <p>
            Our site may contain links to third-party websites. We do not control and
            are not responsible for the content, accuracy, or privacy practices of any
            linked site. Use of external sites is at your own risk.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>7. No liability</h2>
          <p>
            FilmRoom, its owners, employees, and affiliates accept no liability for
            any loss (including loss of winnings, league fees, or entry fees) arising
            from your use of the site. See our{' '}
            <a href="/terms" className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              Terms of Service
            </a>
            {' '}for the full disclaimer of warranties and limitation of liability.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            Questions? Email{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
