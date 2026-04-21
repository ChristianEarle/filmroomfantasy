interface AcceptableUseViewProps {
  isDarkMode: boolean;
}

export function AcceptableUseView({ isDarkMode }: AcceptableUseViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Acceptable Use Policy</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Purpose</h2>
          <p>
            This Acceptable Use Policy ("AUP") sets out the rules for using FilmRoom
            Fantasy. It supplements and is incorporated into our{' '}
            <a href="/terms" className={`underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
              Terms of Service
            </a>
            . Violations may result in suspension or termination of your account.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Prohibited activities</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Use FilmRoom in violation of any applicable law or regulation.</li>
            <li>Circumvent or attempt to circumvent access controls, rate limits, or subscription tiers.</li>
            <li>Attempt to gain unauthorized access to any account, server, or network connected to FilmRoom.</li>
            <li>Scrape, spider, crawl, or use any automated tool to extract data from the site without our prior written consent.</li>
            <li>Reverse engineer, decompile, or disassemble any portion of the service except where such restriction is prohibited by applicable law.</li>
            <li>Resell, sublicense, or redistribute FilmRoom content, projections, rankings, or analysis in any form.</li>
            <li>Use FilmRoom data to build or train a competing product, model, or dataset.</li>
            <li>Upload or transmit malware, viruses, ransomware, or any other malicious code.</li>
            <li>Interfere with the operation of the service, degrade performance, or attempt a denial-of-service attack.</li>
            <li>Forge headers, impersonate another person, or misrepresent your affiliation with a person or entity.</li>
            <li>Create multiple accounts to evade bans, rate limits, or free-tier quotas.</li>
            <li>Use the service to harass, threaten, or defame another person.</li>
            <li>Post content that is unlawful, infringing, obscene, hateful, or designed to promote illegal activity.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Content you submit</h2>
          <p>
            If the service allows you to submit content (for example, team names,
            comments, or support messages), you represent that you have the right to
            do so and that the content does not violate this AUP or any third-party
            rights. We may remove content that violates this AUP without notice.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. API and automation</h2>
          <p>
            We do not currently offer a public API. Any automated access is prohibited
            unless specifically authorized in writing. If you need programmatic access
            for a legitimate purpose, contact us.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Reporting abuse</h2>
          <p>
            To report a violation of this AUP, email{' '}
            <span className="font-medium">support@filmroomfantasy.com</span> with as
            much detail as you can provide (URLs, timestamps, screenshots).
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Enforcement</h2>
          <p>
            Depending on the nature and severity of the violation, we may warn the
            user, remove content, suspend the account, terminate the account, or take
            legal action. We may cooperate with law enforcement where required by law.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            Abuse reports:{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
