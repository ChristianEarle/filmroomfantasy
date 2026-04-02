import { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
  onForgotPassword?: () => void;
  isDarkMode?: boolean;
  error?: string | null;
}

export function LoginView({ onLogin, onSwitchToRegister, onForgotPassword, isDarkMode = true, error: externalError }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const failCount = useRef(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const displayError = externalError || error;

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setError('');
    setIsLoading(true);

    try {
      await onLogin(email, password);
      failCount.current = 0; // Reset on success
    } catch (err) {
      failCount.current++;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
      // Progressive cooldown: 2s after 3 fails, 5s after 5, 15s after 8+
      if (failCount.current >= 8) {
        startCooldown(15);
      } else if (failCount.current >= 5) {
        startCooldown(5);
      } else if (failCount.current >= 3) {
        startCooldown(2);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputWrap = `flex h-12 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
  }`;
  const iconSlot = `flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const inputClass = `min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="FilmRoom logo" className="h-12 w-auto" />
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Welcome back</h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sign in to your FilmRoom account</p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {displayError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{displayError}</div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Email address</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Mail className="h-5 w-5" strokeWidth={1.5} /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
                {onForgotPassword && (
                  <button type="button" onClick={onForgotPassword} className="text-xs text-blue-500 hover:text-blue-400 transition-colors">Forgot password?</button>
                )}
              </div>
              <div className={inputWrap}>
                <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-2`}
                  placeholder="Enter your password"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading || cooldown > 0} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group">
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : cooldown > 0 ? (
                <span>Try again in {cooldown}s</span>
              ) : (
                <> <span>Sign in</span> <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" /> </>
              )}
            </button>
          </form>

        </div>

        <p className={`text-center mt-6 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Don&apos;t have an account?{' '}
          <button onClick={onSwitchToRegister} className="text-blue-500 hover:text-blue-400 font-medium transition-colors">Sign up for free</button>
        </p>
      </div>
    </div>
  );
}
