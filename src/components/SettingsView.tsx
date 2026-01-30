import { Plus, Check, Globe, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ConnectedLeague {
  id: string;
  platform: 'Sleeper' | 'ESPN' | 'Yahoo' | 'NFL';
  name: string;
  year: number;
  teams: number;
  status: 'connected' | 'syncing' | 'error';
}

interface SettingsViewProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export function SettingsView({ isDarkMode = true, onToggleDarkMode }: SettingsViewProps) {
  const [connectedLeagues, setConnectedLeagues] = useState<ConnectedLeague[]>([
    {
      id: '1',
      platform: 'Sleeper',
      name: 'Sunday Funday League',
      year: 2025,
      teams: 12,
      status: 'connected'
    }
  ]);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const platforms = [
    { name: 'Sleeper', icon: Globe, color: 'bg-blue-500' },
    { name: 'ESPN', icon: Globe, color: 'bg-red-600' },
    { name: 'Yahoo', icon: Globe, color: 'bg-purple-600' },
    { name: 'NFL', icon: Globe, color: 'bg-blue-800' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Settings</h1>
        <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Manage your connected leagues and application preferences</p>
      </div>

      {/* Connected Leagues */}
      <div className={`border rounded-xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div>
            <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Connected Leagues</h2>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage your fantasy league connections</p>
          </div>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Connect League
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {connectedLeagues.map((league) => (
              <div key={league.id} className={`rounded-lg p-4 border flex items-center justify-between ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    league.platform === 'Sleeper' ? 'bg-blue-500/20 text-blue-500' :
                    league.platform === 'ESPN' ? 'bg-red-500/20 text-red-500' :
                    league.platform === 'Yahoo' ? 'bg-purple-500/20 text-purple-500' :
                    isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{league.name}</div>
                    <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{league.platform} • {league.year} • {league.teams} Teams</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded-full border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                  <button className={`text-sm px-3 py-1.5 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}>
                    Sync Now
                  </button>
                  <button className="text-sm text-red-500 hover:text-red-400 px-3 py-1.5 hover:bg-red-500/10 rounded transition-colors">
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className={`border rounded-xl overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Application Preferences</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customize your FilmRoom experience</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Default Scoring Format</div>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Set your preferred scoring for projections</div>
            </div>
            <select className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
              <option>PPR (Point Per Reception)</option>
              <option>Half PPR</option>
              <option>Standard</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notifications</div>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receive alerts for injuries and lineup changes</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className={`w-11 h-6 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`font-medium mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark Mode</div>
              <div className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Toggle dark mode appearance</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isDarkMode}
                onChange={onToggleDarkMode}
              />
              <div className={`w-11 h-6 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
            </label>
          </div>
        </div>
      </div>

      {/* Connect League Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Connect New League</h3>
              <p className="text-slate-400 text-sm mt-1">Select your fantasy platform to import your league</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {platforms.map((platform) => (
                  <button 
                    key={platform.name}
                    className="flex flex-col items-center justify-center p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-750 hover:border-blue-500 transition-all group"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
                      platform.name === 'Sleeper' ? 'bg-blue-500/20 text-blue-400' :
                      platform.name === 'ESPN' ? 'bg-red-500/20 text-red-400' :
                      platform.name === 'Yahoo' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-800/20 text-blue-300'
                    }`}>
                      <platform.icon className="w-6 h-6" />
                    </div>
                    <span className="font-semibold text-white">{platform.name}</span>
                  </button>
                ))}
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-500/20 rounded-full p-1.5 flex-shrink-0">
                    <LinkIcon className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">Import via League ID</h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Enter your league ID directly if you know it.
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter League ID" 
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                      />
                      <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                        Import
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-200/80">
                  By connecting your league, you allow FilmRoom to access your roster, matchups, and league settings to provide personalized insights.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-700 flex justify-end gap-3">
              <button 
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}