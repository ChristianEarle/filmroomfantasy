import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { authService } from '../services/auth';

interface EmailVerificationBannerProps {
  email: string;
  isDarkMode?: boolean;
}

/**
 * Top-of-page banner shown to authenticated users whose email is not yet
 * verified. Lets them resend the verification email and dismiss the banner
 * for the current session (it'll come back next visit until they verify).
 */
export function EmailVerificationBanner({ email, isDarkMode = true }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('fr_verify_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const handleResend = async () => {
    setStatus('sending');
    setError(null);
    try {
      await authService.resendVerification();
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not send email. Try again in a moment.');
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem('fr_verify_banner_dismissed', '1');
    } catch {
      // ignore — banner just won't persist its dismissed state
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className={`flex items-start gap-3 px-4 py-3 border-b ${
        isDarkMode
          ? 'bg-amber-950/40 border-amber-800/40 text-amber-100'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}
    >
      <Mail className={`mt-0.5 h-5 w-5 shrink-0 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
      <div className="flex-1 text-sm leading-snug">
        {status === 'sent' ? (
          <>Verification email sent to <span className="font-semibold">{email}</span>. Check your inbox.</>
        ) : (
          <>
            Verify your email (<span className="font-semibold">{email}</span>) so you can recover your password and receive billing receipts.{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={status === 'sending'}
              className={`underline font-semibold transition-opacity ${status === 'sending' ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-80'}`}
            >
              {status === 'sending' ? 'Sending…' : 'Resend email'}
            </button>
            {status === 'error' && error && (
              <span className={`ml-2 ${isDarkMode ? 'text-red-300' : 'text-red-700'}`}>{error}</span>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className={`shrink-0 rounded p-0.5 transition-colors ${
          isDarkMode ? 'hover:bg-amber-900/40' : 'hover:bg-amber-100'
        }`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
