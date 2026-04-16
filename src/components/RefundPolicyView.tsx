interface RefundPolicyViewProps {
  isDarkMode: boolean;
}

export function RefundPolicyView({ isDarkMode }: RefundPolicyViewProps) {
  const h = isDarkMode ? 'text-white' : 'text-slate-900';
  const p = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const s = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className={`text-3xl font-bold mb-2 ${h}`}>Refund &amp; Cancellation Policy</h1>
      <p className={`text-sm mb-8 ${s}`}>Last updated: April 16, 2026</p>

      <div className={`space-y-8 ${p}`}>
        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>1. Subscription plans</h2>
          <p>
            FilmRoom Fantasy offers a free plan and two paid subscription tiers (Pro
            and Elite) billed monthly through Stripe. This policy explains how billing,
            cancellations, and refunds work.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>2. Free trials</h2>
          <p>
            If you start a free trial of a paid plan, we will not charge your payment
            method until the trial period ends. You may cancel at any time during the
            trial to avoid being charged.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>3. Recurring billing</h2>
          <p>
            Paid subscriptions renew automatically each month at the then-current price
            until cancelled. We send a receipt to your email address after each
            successful charge.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>4. Cancellation</h2>
          <p className="mb-3">
            You can cancel your subscription at any time from{' '}
            <strong>Settings → Subscription</strong>. When you cancel:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Your paid features remain active through the end of the current billing period.</li>
            <li>You will not be billed again.</li>
            <li>Your account automatically returns to the Free plan at the end of the period.</li>
          </ul>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>5. Refunds</h2>
          <p className="mb-3">
            Because subscriptions can be cancelled at any time and service continues
            through the billing period you already paid for, monthly subscriptions are
            generally non-refundable.
          </p>
          <p className="mb-3">
            We may issue a full or partial refund at our discretion in the following
            situations:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Duplicate or accidental charges.</li>
            <li>A billing error or technical issue attributable to FilmRoom that prevented you from using the service.</li>
            <li>You were charged for a renewal immediately after cancelling (notify us within 7 days).</li>
            <li>Where required by applicable consumer protection law.</li>
          </ul>
          <p className="mt-3">
            To request a refund, email{' '}
            <span className="font-medium">billing@filmroomfantasy.com</span> from the
            email address on your account and include the date and amount of the charge.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>6. Chargebacks</h2>
          <p>
            If you believe a charge is incorrect, please contact us first — most issues
            can be resolved quickly. Initiating a chargeback without contacting us may
            result in suspension of your account while the dispute is investigated.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>7. Price changes</h2>
          <p>
            We may change subscription prices from time to time. Any price change will
            be communicated at least 14 days in advance and will take effect on your
            next billing cycle. If you do not agree with the new price, you can cancel
            before it takes effect.
          </p>
        </section>

        <section>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>8. EU / UK consumer rights</h2>
          <p>
            If you are a consumer in the EU or UK, you have a 14-day right of
            withdrawal from the date of your initial paid subscription, provided you
            have not substantially used the service. You expressly request that service
            begins immediately upon subscribing, which may affect the withdrawal right
            for services already provided. Contact us to exercise this right.
          </p>
        </section>

        <section className={`border-t pt-6 ${border}`}>
          <h2 className={`text-xl font-semibold mb-3 ${h}`}>Contact</h2>
          <p>
            Billing questions:{' '}
            <span className="font-medium">billing@filmroomfantasy.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
