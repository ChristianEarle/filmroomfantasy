import { Search, User, Loader2, Menu, Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Player } from '../App';
import { usePlayerSearch } from '../hooks';

interface HeaderProps {
  onPlayerClick: (player: Player) => void;
  isDarkMode: boolean;
  isAuthenticated?: boolean;
  onProfileClick?: () => void;
  onMenuToggle?: () => void;
}

export function Header({ onPlayerClick, isDarkMode, isAuthenticated = false, onProfileClick, onMenuToggle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Use the API search hook
  const { results: searchResults, isSearching, search, clearResults } = usePlayerSearch();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        search(searchQuery);
      } else {
        clearResults();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, search, clearResults]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setSearchQuery('');
        clearResults();
      }
    }

    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchOpen, clearResults]);

  // Convert search result to app Player format (PlayerCard fetches its own detailed stats)
  const convertToPlayer = (apiPlayer: { id: string; name: string; team: string; position: string; headshotUrl?: string }): Player => ({
    id: apiPlayer.id,
    name: apiPlayer.name,
    team: apiPlayer.team,
    position: apiPlayer.position as Player['position'],
    keyLine: '',
    projectedPoints: 0,
    weekChange: 0,
    rank: 0,
    headshotUrl: apiPlayer.headshotUrl ?? null,
  });

  return (
    <header className={`h-14 sm:h-16 border-b flex items-center justify-between px-3 sm:px-6 relative ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
      <div className="flex items-center gap-2">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors mobile-only focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Menu aria-hidden="true" className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        )}
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
            aria-label="Search players"
            aria-expanded={searchOpen}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            <Search className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>

          {searchOpen && (
            <div role="combobox" aria-label="Player search results" className={`absolute top-12 right-0 w-[calc(100vw-2rem)] sm:w-96 rounded-lg border shadow-xl z-50 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="p-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search players by name or team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500 ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                  )}
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className={`max-h-96 overflow-y-auto border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  {searchResults.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        onPlayerClick(convertToPlayer(player));
                        setSearchOpen(false);
                        setSearchQuery('');
                        clearResults();
                      }}
                      className={`w-full px-4 py-3 transition-colors text-left border-b last:border-b-0 ${isDarkMode ? 'hover:bg-slate-800 border-slate-700' : 'hover:bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team} • {player.position}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            player.status === 'active'
                              ? 'bg-green-500/20 text-green-500'
                              : player.status === 'questionable'
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : player.status === 'doubtful'
                              ? 'bg-orange-500/20 text-orange-500'
                              : 'bg-red-500/20 text-red-500'
                          }`}>
                            {player.status === 'active' ? 'Active'
                              : player.status === 'questionable' ? 'Q'
                              : player.status === 'doubtful' ? 'D'
                              : player.status === 'out' ? 'O'
                              : player.status === 'injured_reserve' ? 'IR'
                              : player.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                <div className={`p-4 text-center text-sm border-t ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>
                  No players found
                </div>
              )}

              {searchQuery.length > 0 && searchQuery.length < 2 && (
                <div className={`p-4 text-center text-sm border-t ${isDarkMode ? 'text-slate-400 border-slate-700' : 'text-slate-500 border-slate-200'}`}>
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="relative">
            <button
              aria-label="Notifications"
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              title="Notifications coming soon"
            >
              <Bell className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          </div>
        )}

        <button
          onClick={onProfileClick}
          aria-label={isAuthenticated ? 'View profile' : 'Sign in'}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${isDarkMode ? 'bg-slate-800 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200'} ${onProfileClick ? 'cursor-pointer' : ''}`}
          title={isAuthenticated ? 'Profile' : 'Sign in'}
        >
          <User aria-hidden="true" className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
      </div>
    </header>
  );
}
