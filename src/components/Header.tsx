import { Search, Bell, User, Info, AlertTriangle, ArrowRightLeft, Calendar } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Player } from '../App';
import { nflPlayersData } from '../data/nflTeamsData';

interface HeaderProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
  isAuthenticated?: boolean;
  onProfileClick?: () => void;
}

interface Notification {
  id: string;
  type: 'injury' | 'trade' | 'game' | 'waiver';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'injury',
    title: 'Christian McCaffrey Status Update',
    message: 'Ruled OUT for Week 5 vs Cardinals due to hamstring injury.',
    time: '10m ago',
    read: false
  },
  {
    id: '2',
    type: 'trade',
    title: 'Trade Offer Received',
    message: 'Team Smith offers: CeeDee Lamb for your Justin Jefferson.',
    time: '2h ago',
    read: false
  },
  {
    id: '3',
    type: 'waiver',
    title: 'Waiver Claim Successful',
    message: 'You successfully picked up Zay Flowers. Dropped: Skyy Moore.',
    time: '5h ago',
    read: true
  },
  {
    id: '4',
    type: 'game',
    title: 'Matchup Reminder',
    message: 'Your matchup vs Team Johnson starts in 1 hour. Set your lineup!',
    time: '1h ago',
    read: true
  }
];

export function Header({ onPlayerClick, isDarkMode, isAuthenticated = false, onProfileClick }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    if (searchOpen || notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen, notificationsOpen]);

  const filteredPlayers = useMemo(() => {
    if (searchQuery.length === 0) return [];
    
    const query = searchQuery.toLowerCase();
    return nflPlayersData
      .filter(player => 
        player.name.toLowerCase().includes(query) ||
        player.team.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query)
      )
      .sort((a, b) => b.projectedPoints - a.projectedPoints)
      .slice(0, 10); // Limit to top 10 results
  }, [searchQuery]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'injury': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'trade': return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      case 'waiver': return <Info className="w-4 h-4 text-green-500" />;
      case 'game': return <Calendar className="w-4 h-4 text-amber-500" />;
    }
  };

  const unreadCount = mockNotifications.filter(n => !n.read).length;

  return (
    <header className={`h-16 border-b flex items-center justify-between px-6 relative ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2">
        <h1 className={isDarkMode ? 'text-white' : 'text-slate-900'}>FilmRoom</h1>
        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">BETA</span>
      </div>

      <div className="flex items-center gap-3">
        <div 
          ref={searchRef}
          className="relative"
        >
          <button 
            onClick={() => setSearchOpen(!searchOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Search className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
          
          {searchOpen && (
            <div className={`absolute top-12 right-0 w-96 rounded-xl border shadow-xl z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search players by name or team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                  autoFocus
                />
              </div>
              
              {filteredPlayers.length > 0 && (
                <div className={`max-h-96 overflow-y-auto border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  {filteredPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        onPlayerClick(player);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full px-4 py-3 transition-colors text-left border-b last:border-b-0 ${isDarkMode ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team} • {player.position}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints} pts</div>
                          <div className={`text-xs ${player.weekChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {player.weekChange >= 0 ? '+' : ''}{player.weekChange.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {searchQuery.length > 0 && filteredPlayers.length === 0 && (
                <div className={`p-4 text-center text-sm border-t ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>
                  No players found
                </div>
              )}
            </div>
          )}
        </div>
        
        <div 
          ref={notificationRef}
          className="relative"
        >
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-amber-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            {unreadCount > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full"></div>
            )}
          </button>

          {notificationsOpen && (
            <div className={`absolute top-12 right-0 w-80 rounded-xl border shadow-xl z-50 overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className={`p-3 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notifications</h3>
                <span className={`text-xs cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Mark all as read</span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {mockNotifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border-b last:border-b-0 transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'} ${!notification.read ? (isDarkMode ? 'bg-slate-700/30' : 'bg-blue-50') : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === 'injury' ? 'bg-red-500/10' :
                        notification.type === 'trade' ? 'bg-blue-500/10' :
                        notification.type === 'waiver' ? 'bg-green-500/10' :
                        'bg-amber-500/10'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{notification.title}</span>
                          <span className={`text-xs whitespace-nowrap ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{notification.time}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{notification.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`p-2 border-t text-center ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
                <button className="text-xs text-blue-500 hover:text-blue-400 font-medium">View all notifications</button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onProfileClick}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} ${onProfileClick ? 'cursor-pointer' : ''}`}
          title={isAuthenticated ? 'Profile' : 'Sign in'}
        >
          <User className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
      </div>
    </header>
  );
}