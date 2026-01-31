import { useState } from 'react';
import { Mail, Lock, CreditCard, LogOut, Eye, EyeOff, Check } from 'lucide-react';

interface ProfileViewProps {
  isDarkMode?: boolean;
  onLogout: () => void;
}

export function ProfileView({ isDarkMode = true, onLogout }: ProfileViewProps) {
  const [email, setEmail] = useState('user@example.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [membershipPlan] = useState<'pro' | 'free'>('pro');

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2000);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Profile</h1>
        <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Manage your account, email, password, and membership</p>
      </div>

      {/* Email */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <Mail className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Email address</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Update your email for login and notifications</p>
            </div>
          </div>
          <form onSubmit={handleSaveEmail} className="flex flex-col sm:flex-row gap-3">
            <div
              className={`flex h-11 min-w-0 flex-1 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
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
                  isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {emailSaved ? <><Check className="h-4 w-4" /> Saved</> : 'Save email'}
            </button>
          </form>
        </div>
      </div>

      {/* Password */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <Lock className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Password</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Change your password</p>
            </div>
          </div>
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div
              className={`flex h-11 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className={`flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Lock className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`min-w-0 flex-1 bg-transparent py-0 pr-2 text-sm focus:outline-none placeholder:text-sm ${
                  isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder="Current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
              >
                {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div
              className={`flex h-11 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className={`flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Lock className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`min-w-0 flex-1 bg-transparent py-0 pr-2 text-sm focus:outline-none placeholder:text-sm ${
                  isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder="New password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className={`flex h-full w-10 shrink-0 items-center justify-center rounded-r-[7px] ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div
              className={`flex h-11 items-center gap-3 rounded-lg border text-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent ${
                isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className={`flex h-full w-11 shrink-0 items-center justify-center rounded-l-[7px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Lock className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`min-w-0 flex-1 bg-transparent py-0 pr-4 text-sm focus:outline-none placeholder:text-sm ${
                  isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder="Confirm new password"
              />
            </div>
            <button
              type="submit"
              disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
            >
              {passwordSaved ? <><Check className="h-4 w-4" /> Saved</> : 'Update password'}
            </button>
          </form>
        </div>
      </div>

      {/* Membership */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <CreditCard className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Membership</h2>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Your current plan and billing</p>
            </div>
          </div>
          <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className={`font-semibold capitalize ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{membershipPlan}</span>
                <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {membershipPlan === 'pro' ? 'Full access to all features' : 'Upgrade for premium features'}
                </p>
              </div>
              {membershipPlan === 'free' ? (
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
                  Upgrade
                </button>
              ) : (
                <button className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  Manage plan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log out */}
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="p-6">
          <button
            onClick={onLogout}
            className="flex h-11 items-center gap-2.5 text-red-500 transition-colors hover:text-red-400 font-medium"
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
