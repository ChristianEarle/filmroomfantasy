import { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Check } from 'lucide-react';

interface RegisterViewProps {
  onRegister: (email: string, password: string, username: string) => Promise<void>;
  onSwitchToLogin: () => void;
  isDarkMode?: boolean;
  error?: string | null;
}

export function RegisterView({ onRegister, onSwitchToLogin, isDarkMode = true, error: externalError }: RegisterViewProps) {
  const [username, setUsername] = useState('');
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
      await onRegister(email, password, username);
      failCount.current = 0;
    } catch (err) {
      failCount.current++;
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Registration failed. Please try again.');
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

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

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
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <span className="text-xl font-bold text-blue-600">FR</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Create your account</h1>
          <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Get started with FilmRoom Fantasy</p>
        </div>

        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {displayError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{displayError}</div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Username</label>
              <div className={inputWrap}>
                <div className={iconSlot}><User className="h-5 w-5" strokeWidth={1.5} /></div>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="johndoe" required />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Email address</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Mail className="h-5 w-5" strokeWidth={1.5} /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Password</label>
              <div className={inputWrap}>
                <div className={iconSlot}><Lock className="h-5 w-5" strokeWidth={1.5} /></div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-2`}
                  placeholder="Create a password"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className={`mt-4 rounded-lg border p-4 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-medium mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Password must include:</p>
                <div className="space-y-3">
                  <PasswordRequirement met={hasMinLength} text="At least 8 characters" isDarkMode={isDarkMode} />
                  <PasswordRequirement met={hasUppercase} text="One uppercase letter" isDarkMode={isDarkMode} />
                  <PasswordRequirement met={hasNumber} text="One number" isDarkMode={isDarkMode} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading || cooldown > 0 || !hasMinLength || !hasUppercase || !hasNumber} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group">
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : cooldown > 0 ? (
                <span>Try again in {cooldown}s</span>
              ) : (
                <> <span>Create account</span> <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" /> </>
              )}
            </button>
          </form>

          <p className={`text-xs text-center mt-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <p className={`text-center mt-6 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-blue-500 hover:text-blue-400 font-medium transition-colors">Sign in</button>
        </p>
      </div>
    </div>
  );
}

function PasswordRequirement({ met, text, isDarkMode }: { met: boolean; text: string; isDarkMode: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-sm ${met ? 'text-green-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${met ? 'bg-green-500/20 border border-green-500/30' : isDarkMode ? 'border border-slate-700 bg-slate-800' : 'border border-slate-200 bg-slate-100'}`}>
        {met && <Check className="h-3 w-3" strokeWidth={2.5} />}
      </div>
      <span>{text}</span>
    </div>
  );
}
