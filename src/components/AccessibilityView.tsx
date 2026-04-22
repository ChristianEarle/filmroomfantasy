interface AccessibilityViewProps {
  isDarkMode: boolean;
}

export function AccessibilityView({ isDarkMode }: AccessibilityViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Accessibility Statement</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Our commitment</h2>
          <p>
            FilmRoom Fantasy is committed to making our website accessible to the
            widest possible audience, regardless of ability or technology. We aim to
            meet the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA where
            reasonably achievable, and we continue to improve as part of ongoing
            development.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. What we've done</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Semantic HTML structure with proper heading hierarchy and landmark regions.</li>
            <li>Keyboard navigation for all interactive elements.</li>
            <li>Focus indicators on buttons, links, and form controls.</li>
            <li>Alt text for meaningful images and ARIA labels for icon-only buttons.</li>
            <li>Color-contrast testing against WCAG AA thresholds, with light and dark themes.</li>
            <li>Support for the <code>prefers-reduced-motion</code> media query to disable non-essential animations.</li>
            <li>Responsive layouts that work on mobile, tablet, and desktop.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Known limitations</h2>
          <p className="mb-3">
            We're aware that some parts of the site may not yet meet our accessibility
            goals, including:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Complex data tables (rankings, matchups) may be challenging with some screen readers on narrow viewports.</li>
            <li>Some third-party embedded content (ads, charts) may not fully conform to WCAG AA.</li>
            <li>Older content in articles may lack descriptive alt text.</li>
          </ul>
          <p className="mt-3">We're actively working on these and welcome your feedback.</p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Assistive technologies</h2>
          <p>
            FilmRoom is designed to work with recent versions of major screen readers
            (VoiceOver, NVDA, JAWS, TalkBack) and browsers (Chrome, Safari, Firefox,
            Edge). If you encounter an issue with a specific assistive technology,
            please let us know so we can investigate.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Feedback &amp; requests</h2>
          <p>
            If you experience any difficulty accessing content on our site, or if you
            have suggestions for improving accessibility, please contact us at{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
            We aim to respond within 5 business days. When possible, please include:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li>The URL of the page where you encountered the issue.</li>
            <li>A description of the problem.</li>
            <li>The assistive technology and browser you're using.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Ongoing improvement</h2>
          <p>
            Accessibility is not a one-time project. We train our team, audit new
            features before release, and revisit existing pages to raise the bar over
            time. This statement is reviewed and updated as our site evolves.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            Accessibility contact:{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
