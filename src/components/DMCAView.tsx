interface DMCAViewProps {
  isDarkMode: boolean;
}

export function DMCAView({ isDarkMode }: DMCAViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const codeBg = isDarkMode ? 'bg-slate-800' : 'bg-slate-100';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>DMCA &amp; Copyright Policy</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Our commitment</h2>
          <p>
            FilmRoom Fantasy respects the intellectual property rights of others and
            expects our users to do the same. In accordance with the Digital Millennium
            Copyright Act of 1998 ("DMCA"), we will respond expeditiously to valid
            claims of copyright infringement regarding material hosted on
            filmroomfantasy.com.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Reporting copyright infringement</h2>
          <p className="mb-3">
            If you believe that material on FilmRoom infringes your copyright, please
            send a written notice to our Designated Agent that includes the following:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>A physical or electronic signature of the copyright owner or a person authorized to act on their behalf.</li>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Identification of the material that is claimed to be infringing, with a URL or sufficient detail to permit us to locate it.</li>
            <li>Your contact information (address, telephone number, and email address).</li>
            <li>A statement that you have a good faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law.</li>
            <li>A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on the owner's behalf.</li>
          </ul>
          <p className="mt-3">
            Incomplete notices may not be actionable. Misrepresentations in a DMCA
            notice may subject you to liability for damages, including costs and
            attorney's fees (17 U.S.C. § 512(f)).
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Designated agent</h2>
          <div className={`${codeBg} rounded-lg p-4 text-sm ${p}`}>
            <div><strong>FilmRoom Fantasy — DMCA Agent</strong></div>
            <div>Email: <span className="font-medium">support@filmroomfantasy.com</span></div>
            <div>Subject line: "DMCA Takedown Notice"</div>
          </div>
          <p className="mt-3">
            Please use email for the fastest response. Postal mail may also be used but
            will be considerably slower; contact us at the email above to request a
            mailing address.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Counter-notification</h2>
          <p className="mb-3">
            If you believe your content was removed by mistake or misidentification, you
            may submit a counter-notification containing:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Your physical or electronic signature.</li>
            <li>Identification of the material that was removed and the location where it appeared before removal.</li>
            <li>A statement, under penalty of perjury, that you have a good faith belief the material was removed as a result of mistake or misidentification.</li>
            <li>Your name, address, telephone number, and a statement that you consent to the jurisdiction of the federal district court for the judicial district in which you reside (or any judicial district in which FilmRoom may be found if you reside outside the United States), and that you will accept service of process from the person who filed the original DMCA notice.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Repeat infringer policy</h2>
          <p>
            It is our policy, in appropriate circumstances and at our discretion, to
            suspend or terminate accounts of users who are deemed to be repeat
            infringers.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Trademarks and other rights</h2>
          <p>
            For trademark, right-of-publicity, or other non-copyright claims, please
            email <span className="font-medium">support@filmroomfantasy.com</span> with
            a detailed description of the issue and the specific URL(s) involved.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            General copyright questions:{' '}
            <span className="font-medium">support@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
