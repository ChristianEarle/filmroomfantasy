import { Home, LayoutDashboard, TrendingUp, Settings, Swords, Users as UsersIcon, ListPlus, CalendarRange, Trophy } from 'lucide-react';

interface SidebarProps {
  activeView: 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Playoffs' | 'Settings';
  onViewChange: (view: 'Board' | 'Team' | 'Matchup' | 'Waivers' | 'Home' | 'GameSlate' | 'Trends' | 'Playoffs' | 'Settings') => void;
  isDarkMode: boolean;
}

export function Sidebar({ activeView, onViewChange, isDarkMode }: SidebarProps) {
  const menuItems = [
    { icon: Home, label: 'Home', view: 'Home' as const },
    { icon: LayoutDashboard, label: 'Board', view: 'Board' as const },
    { icon: Swords, label: 'Matchup', view: 'Matchup' as const },
    { icon: UsersIcon, label: 'Team', view: 'Team' as const },
    { icon: ListPlus, label: 'Waivers', view: 'Waivers' as const },
    { icon: CalendarRange, label: 'Game Slate', view: 'GameSlate' as const },
    { icon: TrendingUp, label: 'Trends', view: 'Trends' as const },
    { icon: Trophy, label: 'Playoff Predictor', view: 'Playoffs' as const },
    { icon: Settings, label: 'Settings', view: 'Settings' as const },
  ];

  return (
    <aside className={`w-64 border-r flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      {/* Logo */}
      <div className={`h-16 flex items-center px-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {menuItems.map((item, index) => (
            <li key={index}>
              <button
                onClick={() => onViewChange(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  item.view === activeView
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDarkMode 
                      ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className={`text-sm ${item.view === activeView ? 'font-semibold' : ''}`}>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* League Info */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Current League</div>
          <div className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sunday Funday League</div>
          <div className={`text-xs mt-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Record: <span className="font-semibold">3-1</span> (2nd place)</div>
        </div>
      </div>
    </aside>
  );
}