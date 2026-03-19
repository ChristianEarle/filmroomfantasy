import { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authService } from '../services/auth';

interface ForgotPasswordViewProps {
  onBackToLogin: () => void;
  isDarkMode?: boolean;
}

export function ForgotPasswordView({ onBackToLogin, isDarkMode = true }: ForgotPasswordViewProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputWrap = `flex h-12 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
    isDarkMode ? 'bg-[#1a1a1a]/50 border-[#222]' : 'bg-slate-50 border-slate-200'
  }`;
  const iconSlot = `flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`;
  const inputClass = `min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
    isDarkMode ? 'text-white placeholder:text-[#555]' : 'text-slate-900 placeholder:text-[#737373]'
  }`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-100'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${isDarkMode ? 'bg-[#1a1a1a] border border-[#222]' : 'bg-white border border-slate-200'}`}>
            <span className="text-xl font-bold text-blue-600">FR</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {sent ? 'Check your email' : 'Reset your password'}
          </h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            {sent
              ? 'If an account exists with that email, we sent a reset link.'
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className={`text-sm mb-6 ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-600'}`}>
                Check your inbox for the reset link. It expires in 1 hour.
              </p>
              <button
                onClick={onBackToLogin}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-700'}`}>Email address</label>
                <div className={inputWrap}>
                  <div className={iconSlot}><Mail className="h-5 w-5" strokeWidth={1.5} /></div>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group">
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><span>Send reset link</span><ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </form>
          )}
        </div>

        <button
          onClick={onBackToLogin}
          className={`flex items-center justify-center gap-2 w-full mt-6 text-sm ${isDarkMode ? 'text-[#737373] hover:text-[#a3a3a3]' : 'text-[#555] hover:text-slate-700'} transition-colors`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}

interface ResetPasswordViewProps {
  token: string;
  onSuccess: () => void;
  isDarkMode?: boolean;
}

export function ResetPasswordView({ token, onSuccess, isDarkMode = true }: ResetPasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Password reset failed. The link may have expired.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputWrap = `flex h-12 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
    isDarkMode ? 'bg-[#1a1a1a]/50 border-[#222]' : 'bg-slate-50 border-slate-200'
  }`;
  const iconSlot = `flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-[#555]' : 'text-[#737373]'}`;
  const inputClass = `min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
    isDarkMode ? 'text-white placeholder:text-[#555]' : 'text-slate-900 placeholder:text-[#737373]'
  }`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-100'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${isDarkMode ? 'bg-[#1a1a1a] border border-[#222]' : 'bg-white border border-slate-200'}`}>
            <span className="text-xl font-bold text-blue-600">FR</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {success ? 'Password reset!' : 'Choose a new password'}
          </h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-[#737373]' : 'text-[#555]'}`}>
            {success
              ? 'Your password has been updated successfully.'
              : 'Enter your new password below.'}
          </p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-[#111] border-[#222]' : 'bg-white border-slate-200'}`}>
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <button
                onClick={onSuccess}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Sign in with new password
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
              )}

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-700'}`}>New password</label>
                <div className={inputWrap}>
                  <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-2`}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-[#555] hover:text-[#a3a3a3]' : 'text-[#737373] hover:text-slate-600'} transition-colors`}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-[#a3a3a3]' : 'text-slate-700'}`}>Confirm password</label>
                <div className={inputWrap}>
                  <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-4`}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group">
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><span>Reset password</span><ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
