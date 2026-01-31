import { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

interface PasswordResetViewProps {
  onBackToLogin: () => void;
  isDarkMode?: boolean;
}

export function PasswordResetView({ onBackToLogin, onGoToSetNewPassword, isDarkMode = true }: PasswordResetViewProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    // Simulate API call; replace with real auth when backend exists
    setTimeout(() => {
      setIsLoading(false);
      setSent(true);
    }, 800);
  };

  const inputWrap = `flex h-12 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
    isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;
  const iconSlot = `flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  if (sent) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
        <div className="w-full max-w-sm">
          <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <CheckCircle className="h-7 w-7 text-green-500" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className={`text-xl font-bold text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Check your email</h1>
            <p className={`mt-2 text-sm text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              If an account exists for <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{email}</span>, we&apos;ve sent a password reset link.
            </p>
            <p className={`mt-3 text-sm text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Didn&apos;t get it? Check spam or try again with a different email.
            </p>
            {onGoToSetNewPassword && (
              <button
                type="button"
                onClick={onGoToSetNewPassword}
                className="mt-4 w-full text-sm text-blue-500 hover:text-blue-400 transition-colors underline"
              >
                Already have a reset link? Set new password
              </button>
            )}
            <button
              type="button"
              onClick={onBackToLogin}
              className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg border font-semibold transition-colors ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <span className="text-xl font-bold text-blue-600">FR</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Reset password</h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Enter your email and we&apos;ll send you a reset link</p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Email address</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Mail className="h-5 w-5" strokeWidth={1.5} /></div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <> Send reset link </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={onBackToLogin}
            className={`mt-6 flex w-full items-center justify-center gap-2 text-sm transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}
