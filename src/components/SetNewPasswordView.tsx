import { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowLeft, Check, CheckCircle } from 'lucide-react';

interface SetNewPasswordViewProps {
  onSuccess: () => void;
  /** Optional token from reset link (e.g. from URL query); use when backend exists */
  resetToken?: string | null;
  isDarkMode?: boolean;
}

function PasswordRequirement({ met, text, isDarkMode }: { met: boolean; text: string; isDarkMode: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 text-xs ${met ? 'text-green-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${met ? 'bg-green-500/20 border border-green-500/30' : isDarkMode ? 'border border-slate-700 bg-slate-800' : 'border border-slate-200 bg-slate-100'}`}>
        {met && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </div>
      <span>{text}</span>
    </div>
  );
}

export function SetNewPasswordView({ onSuccess, resetToken, isDarkMode = true }: SetNewPasswordViewProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isValid = hasMinLength && hasUppercase && hasNumber && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValid) return;
    setIsLoading(true);
    // Replace with real API: POST /auth/reset-password with { token: resetToken, newPassword }
    setTimeout(() => {
      setIsLoading(false);
      setSaved(true);
    }, 800);
  };

  const inputWrap = `flex h-12 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
    isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;
  const iconSlot = `flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  if (saved) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
        <div className="w-full max-w-sm">
          <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-center mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <CheckCircle className="h-7 w-7 text-green-500" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className={`text-xl font-bold text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Password updated</h1>
            <p className={`mt-2 text-sm text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You can now sign in with your new password.
            </p>
            <button
              type="button"
              onClick={onSuccess}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-semibold text-white transition-colors hover:bg-blue-700"
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
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Set new password</h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Enter your new password below</p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>New password</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-2`}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className={`mt-4 rounded-lg border p-4 ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-medium mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Password must include:</p>
                <div className="space-y-3">
                  <PasswordRequirement met={hasMinLength} text="At least 8 characters" isDarkMode={isDarkMode} />
                  <PasswordRequirement met={hasUppercase} text="One uppercase letter" isDarkMode={isDarkMode} />
                  <PasswordRequirement met={hasNumber} text="One number" isDarkMode={isDarkMode} />
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Confirm new password</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Confirm new password"
                  required
                />
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isValid}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <> Set new password </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={onSuccess}
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
