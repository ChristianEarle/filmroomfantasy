import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLogin: () => void;
  onSwitchToRegister: () => void;
  isDarkMode?: boolean;
}

export function LoginView({ onLogin, onSwitchToRegister, isDarkMode = true }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate login - replace with actual auth logic
    setTimeout(() => {
      setIsLoading(false);
      onLogin();
    }, 800);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'} shadow-sm`}>
            <span className="text-xl font-bold text-blue-600">FR</span>
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Welcome back
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Sign in to your FilmRoom account
          </p>
        </div>

        {/* Login Form */}
        <div className={`border rounded-lg p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Email address
              </label>
              <div
                className={`flex h-11 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className={`flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Mail className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
                    isDarkMode
                      ? 'text-white placeholder:text-slate-500'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Password
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-500 hover:text-blue-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div
                className={`flex h-11 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                  isDarkMode
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className={`flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Lock className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`min-w-0 flex-1 bg-transparent py-0 pr-2 text-sm focus:outline-none placeholder:text-sm ${
                    isDarkMode
                      ? 'text-white placeholder:text-slate-500'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className={`absolute inset-0 flex items-center ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className={`w-full border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`} />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className={`px-2 ${isDarkMode ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'}`}>
                or continue with
              </span>
            </div>
          </div>

          {/* Social Login - Google only */}
          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              className={`flex h-11 items-center justify-center gap-2.5 rounded-lg border text-sm font-medium transition-colors ${
                isDarkMode
                  ? 'border-slate-700 bg-slate-800 text-white hover:bg-slate-700 hover:border-slate-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>

        {/* Sign Up Link */}
        <p className={`text-center mt-6 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Don't have an account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
          >
            Sign up for free
          </button>
        </p>
      </div>
    </div>
  );
}
