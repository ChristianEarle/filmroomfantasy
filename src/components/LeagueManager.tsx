import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link2, Loader2, ChevronDown, Check } from 'lucide-react';
import { useLeaguesContext } from '../context/LeaguesContext';
import { UpgradeModal } from './UpgradeModal';
// Auth cookie is sent automatically via credentials: 'include'

interface LeagueManagerProps {
  isDarkMode: boolean;
  onLeagueSelect: (leagueId: string) => void;
  selectedLeagueId: string | null;
  isAuthenticated: boolean;
  onConnectLeague: () => void;
  userTier?: 'free' | 'pro';
}

interface DropdownPosition {
  bottom: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function LeagueManager({ isDarkMode, onLeagueSelect, selectedLeagueId, isAuthenticated, onConnectLeague, userTier = 'free' }: LeagueManagerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { leagues, isLoading: leaguesLoading } = useLeaguesContext();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    // Anchor dropdown bottom to top of trigger, grow upward
    const bottomFromViewport = viewportH - rect.top + 4;
    const availableAbove = rect.top - 8;
    const maxH = Math.min(Math.max(availableAbove, 120), 320);
    setPosition({
      bottom: bottomFromViewport,
      left: rect.left,
      width: rect.width,
      maxHeight: maxH,
    });
  }, []);

  // Open/close + position calculation
  useEffect(() => {
    if (dropdownOpen) {
      updatePosition();
      // Update position on scroll/resize
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [dropdownOpen, updatePosition]);

  // Close dropdown on click outside or Escape (Escape returns focus to trigger)
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        // Check if click is inside the portal dropdown
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId);

  if (!isAuthenticated) {
    return (
      <div className={`p-4 border-t flex-shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <button
          onClick={onConnectLeague}
          className={`w-full rounded-lg p-4 text-center transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
        >
          <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Sign in to connect leagues
          </p>
        </button>
      </div>
    );
  }

  const closeDropdownAndRefocus = () => {
    setDropdownOpen(false);
    // Dropdown unmounts on close; move focus back to the trigger so keyboard
    // users aren't dropped at the top of the document.
    triggerRef.current?.focus();
  };

  const dropdownMenu = dropdownOpen && position ? createPortal(
    <div
      ref={dropdownRef}
      id="league-dropdown-portal"
      role="menu"
      aria-label="Select league"
      className={`rounded-lg border shadow-lg overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
      style={{
        position: 'fixed',
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
        zIndex: 9999,
      }}
    >
      {leagues.length > 0 && (
        <div
          className={`overflow-y-auto border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
          style={{ maxHeight: position.maxHeight - 52 }}
        >
          {leagues.map((league) => (
            <button
              key={league.id}
              type="button"
              role="menuitem"
              aria-current={league.id === selectedLeagueId ? 'true' : undefined}
              onClick={() => {
                if (league.id !== selectedLeagueId) {
                  onLeagueSelect(league.id);
                }
                closeDropdownAndRefocus();
              }}
              className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between ${
                league.id === selectedLeagueId
                  ? isDarkMode ? 'bg-blue-600/20' : 'bg-blue-50'
                  : isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
              }`}
            >
              <div>
                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {league.name}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {league.scoringFormat.toUpperCase()} • {league.teamCount} teams
                </div>
              </div>
              {league.id === selectedLeagueId && (
                <Check className="w-4 h-4 text-blue-500" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Connect League Option */}
      <div className="p-2">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            // Check if free user is at limit
            if (userTier === 'free' && leagues.length >= 1) {
              setUpgradeModalOpen(true);
            } else {
              onConnectLeague();
            }
            closeDropdownAndRefocus();
          }}
          className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center gap-2 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
        >
          <Link2 className="w-4 h-4 text-blue-500" />
          <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Connect League</span>
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  const handleUpgradeClick = async (priceId: string) => {
    try {
      // Create checkout session
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${apiBase}/billing/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}?billing=success`,
          cancelUrl: `${window.location.origin}?billing=cancel`,
        }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        alert(error.error || 'Failed to create checkout session');
        return;
      }

      const { url } = await response.json() as { url: string };
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Failed to start checkout');
    }
  };

  return (
    <div className={`p-4 border-t flex-shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
      {/* League Selector */}
      <div className="mb-3">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          aria-expanded={dropdownOpen}
          aria-haspopup="menu"
          aria-controls={dropdownOpen ? 'league-dropdown-portal' : undefined}
          className={`w-full rounded-lg p-3 text-left transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'}`}
        >
          <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Current League
          </div>
          <div className="flex items-center justify-between">
            <div className={`font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {leaguesLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : selectedLeague ? (
                selectedLeague.name
              ) : leagues.length > 0 ? (
                'Select a league'
              ) : (
                'No leagues connected'
              )}
            </div>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''} ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </div>
          {selectedLeague && (
            <div className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {selectedLeague.scoringFormat.toUpperCase()} • {selectedLeague.teamCount} teams
            </div>
          )}
        </button>
      </div>

      {/* Dropdown rendered via portal */}
      {dropdownMenu}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        isDarkMode={isDarkMode}
        onUpgradeClick={handleUpgradeClick}
      />
    </div>
  );
}
