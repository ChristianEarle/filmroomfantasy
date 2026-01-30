import { useEffect, useState } from 'react';
import { X, ArrowLeft, TrendingUp, TrendingDown, Bell, Pin, Users, Share2, Zap, Target, Calendar, Star } from 'lucide-react';
import { Player } from '../App';

interface PlayerCardProps {
  player: Player;
  onClose: () => void;
  isDarkMode: boolean;
}

// Game log data for the History tab (RB)
const gameLogData = [
  { week: 1, opp: 'TEN', isAway: false, fpts: 7.4, snpPct: 29, fin: 'RB30', rushAtt: 6, rushYds: 70, rushYpa: 11.7, rushTd: 0, tgt: 1, rec: 1, recYds: -1, recYpr: -1.0, recTd: 0 },
  { week: 2, opp: 'IND', isAway: true, fpts: 2.9, snpPct: 33, fin: 'RB53', rushAtt: 5, rushYds: 8, rushYpa: 1.6, rushTd: 0, tgt: 2, rec: 1, recYds: 16, recYpr: 16.0, recTd: 0 },
  { week: 3, opp: 'LAC', isAway: true, fpts: 3.1, snpPct: 29, fin: 'RB53', rushAtt: 2, rushYds: 2, rushYpa: 1.0, rushTd: 0, tgt: 3, rec: 3, recYds: 14, recYpr: 4.7, recTd: 0 },
  { week: 4, opp: 'CIN', isAway: false, fpts: 17.8, snpPct: 41, fin: 'RB13', rushAtt: 14, rushYds: 58, rushYpa: 4.1, rushTd: 0, tgt: 3, rec: 4, recYds: 40, recYpr: 10.0, recTd: 1 },
  { week: 5, opp: 'PHI', isAway: true, fpts: 4.5, snpPct: 20, fin: 'RB40', rushAtt: 4, rushYds: 12, rushYpa: 3.0, rushTd: 0, tgt: 3, rec: 3, recYds: 18, recYpr: 6.0, recTd: 0 },
  { week: 6, opp: 'NYJ', isAway: true, fpts: 4.5, snpPct: 28, fin: 'RB39', rushAtt: 2, rushYds: 4, rushYpa: 2.0, rushTd: 0, tgt: 4, rec: 4, recYds: 21, recYpr: 5.3, recTd: 0 },
  { week: 7, opp: 'NYG', isAway: false, fpts: 6.7, snpPct: 25, fin: 'RB27', rushAtt: 4, rushYds: 0, rushYpa: 0.0, rushTd: 0, tgt: 2, rec: 1, recYds: 2, recYpr: 2.0, recTd: 1 },
  { week: 8, opp: 'DAL', isAway: false, fpts: 23.6, snpPct: 27, fin: 'RB6', rushAtt: 7, rushYds: 46, rushYpa: 6.6, rushTd: 2, tgt: 1, rec: 1, recYds: 5, recYpr: 5.0, recTd: 1 },
  { week: 9, opp: 'HOU', isAway: true, fpts: 14.1, snpPct: 32, fin: 'RB9', rushAtt: 2, rushYds: 5, rushYpa: 2.5, rushTd: 0, tgt: 5, rec: 5, recYds: 51, recYpr: 10.2, recTd: 0 },
  { week: 10, opp: 'LV', isAway: true, fpts: 2.8, snpPct: 28, fin: 'RB49', rushAtt: 4, rushYds: 9, rushYpa: 2.3, rushTd: 0, tgt: 2, rec: 2, recYds: 9, recYpr: 4.5, recTd: 0 },
  { week: 11, opp: 'KC', isAway: true, fpts: 6.5, snpPct: 61, fin: 'RB35', rushAtt: 11, rushYds: 30, rushYpa: 2.7, rushTd: 0, tgt: 4, rec: 2, recYds: 20, recYpr: 6.7, recTd: 0 },
  { week: 12, opp: 'BYE', isAway: false, fpts: 0, snpPct: 0, fin: '-', rushAtt: 0, rushYds: 0, rushYpa: 0, rushTd: 0, tgt: 0, rec: 0, recYds: 0, recYpr: 0, recTd: 0 },
  { week: 13, opp: 'WAS', isAway: true, fpts: 19.7, snpPct: 47, fin: 'RB4', rushAtt: 13, rushYds: 35, rushYpa: 2.7, rushTd: 0, tgt: 4, rec: 3, recYds: 27, recYpr: 9.0, recTd: 0 },
  { week: 14, opp: 'LV', isAway: true, fpts: 19.0, snpPct: 68, fin: 'RB5', rushAtt: 17, rushYds: 75, rushYpa: 4.4, rushTd: 0, tgt: 6, rec: 6, recYds: 25, recYpr: 4.2, recTd: 0 },
  { week: 15, opp: 'GB', isAway: false, fpts: 10.5, snpPct: 68, fin: 'RB24', rushAtt: 19, rushYds: 65, rushYpa: 3.4, rushTd: 0, tgt: 1, rec: 0, recYds: 0, recYpr: 0.0, recTd: 0 },
  { week: 16, opp: 'JAC', isAway: false, fpts: 20.1, snpPct: 59, fin: 'RB11', rushAtt: 7, rushYds: 50, rushYpa: 7.1, rushTd: 1, tgt: 5, rec: 4, recYds: 71, recYpr: 17.8, recTd: 0 },
  { week: 17, opp: 'KC', isAway: true, fpts: 16.1, snpPct: 65, fin: 'RB11', rushAtt: 14, rushYds: 43, rushYpa: 3.1, rushTd: 0, tgt: 6, rec: 5, recYds: 33, recYpr: 6.6, recTd: 1 },
  { week: 18, opp: 'LAC', isAway: false, fpts: 3.8, snpPct: 56, fin: 'RB50', rushAtt: 15, rushYds: 28, rushYpa: 1.9, rushTd: 0, tgt: 4, rec: 1, recYds: 5, recYpr: 5.0, recTd: 0 },
];

// Game log data for QB
const qbGameLogData = [
  { week: 1, opp: 'NYJ', isAway: false, fpts: 24.8, fin: 'QB5', cmp: 28, att: 42, passYds: 312, passTd: 2, int: 1, rushYds: 28, rushTd: 0 },
  { week: 2, opp: 'MIA', isAway: true, fpts: 31.2, fin: 'QB2', cmp: 32, att: 44, passYds: 356, passTd: 3, int: 0, rushYds: 42, rushTd: 1 },
  { week: 3, opp: 'JAC', isAway: false, fpts: 18.4, fin: 'QB12', cmp: 22, att: 35, passYds: 245, passTd: 2, int: 2, rushYds: 12, rushTd: 0 },
  { week: 4, opp: 'BAL', isAway: true, fpts: 26.8, fin: 'QB4', cmp: 29, att: 41, passYds: 298, passTd: 3, int: 1, rushYds: 35, rushTd: 0 },
  { week: 5, opp: 'HOU', isAway: false, fpts: 22.1, fin: 'QB8', cmp: 25, att: 38, passYds: 268, passTd: 2, int: 0, rushYds: 18, rushTd: 0 },
  { week: 6, opp: 'TEN', isAway: true, fpts: 28.4, fin: 'QB3', cmp: 30, att: 40, passYds: 324, passTd: 2, int: 0, rushYds: 52, rushTd: 1 },
  { week: 7, opp: 'NE', isAway: false, fpts: 19.6, fin: 'QB11', cmp: 24, att: 36, passYds: 256, passTd: 1, int: 1, rushYds: 22, rushTd: 0 },
  { week: 8, opp: 'BYE', isAway: false, fpts: 0, fin: '-', cmp: 0, att: 0, passYds: 0, passTd: 0, int: 0, rushYds: 0, rushTd: 0 },
  { week: 9, opp: 'CIN', isAway: true, fpts: 33.6, fin: 'QB1', cmp: 34, att: 48, passYds: 385, passTd: 4, int: 1, rushYds: 28, rushTd: 0 },
  { week: 10, opp: 'DEN', isAway: false, fpts: 21.2, fin: 'QB9', cmp: 26, att: 39, passYds: 272, passTd: 2, int: 1, rushYds: 15, rushTd: 0 },
];

// Game log data for WR/TE
const wrTeGameLogData = [
  { week: 1, opp: 'CLE', isAway: false, fpts: 18.4, snpPct: 92, fin: 'WR8', tgt: 10, rec: 7, recYds: 94, recTd: 1, rushAtt: 1, rushYds: 12, rushTd: 0 },
  { week: 2, opp: 'NYG', isAway: true, fpts: 22.6, snpPct: 95, fin: 'WR4', tgt: 12, rec: 9, recYds: 126, recTd: 1, rushAtt: 0, rushYds: 0, rushTd: 0 },
  { week: 3, opp: 'ARI', isAway: false, fpts: 12.8, snpPct: 88, fin: 'WR18', tgt: 8, rec: 5, recYds: 78, recTd: 0, rushAtt: 2, rushYds: 18, rushTd: 0 },
  { week: 4, opp: 'SF', isAway: true, fpts: 8.2, snpPct: 91, fin: 'WR32', tgt: 6, rec: 4, recYds: 42, recTd: 0, rushAtt: 0, rushYds: 0, rushTd: 0 },
  { week: 5, opp: 'SEA', isAway: false, fpts: 26.4, snpPct: 94, fin: 'WR2', tgt: 14, rec: 10, recYds: 134, recTd: 1, rushAtt: 1, rushYds: 8, rushTd: 0 },
  { week: 6, opp: 'DET', isAway: true, fpts: 15.2, snpPct: 89, fin: 'WR12', tgt: 9, rec: 6, recYds: 92, recTd: 0, rushAtt: 0, rushYds: 0, rushTd: 0 },
  { week: 7, opp: 'BYE', isAway: false, fpts: 0, snpPct: 0, fin: '-', tgt: 0, rec: 0, recYds: 0, recTd: 0, rushAtt: 0, rushYds: 0, rushTd: 0 },
  { week: 8, opp: 'CHI', isAway: false, fpts: 31.8, snpPct: 96, fin: 'WR1', tgt: 15, rec: 11, recYds: 158, recTd: 2, rushAtt: 2, rushYds: 24, rushTd: 0 },
  { week: 9, opp: 'ATL', isAway: true, fpts: 19.6, snpPct: 93, fin: 'WR7', tgt: 11, rec: 8, recYds: 106, recTd: 1, rushAtt: 1, rushYds: -2, rushTd: 0 },
  { week: 10, opp: 'PHI', isAway: false, fpts: 11.4, snpPct: 90, fin: 'WR22', tgt: 7, rec: 5, recYds: 64, recTd: 0, rushAtt: 0, rushYds: 0, rushTd: 0 },
];

// Game log data for K
const kGameLogData = [
  { week: 1, opp: 'CIN', isAway: false, fpts: 11, fin: 'K4', fgm: 2, fga: 2, lng: 48, xpm: 3, xpa: 3 },
  { week: 2, opp: 'KC', isAway: true, fpts: 8, fin: 'K8', fgm: 2, fga: 3, lng: 52, xpm: 2, xpa: 2 },
  { week: 3, opp: 'DAL', isAway: false, fpts: 13, fin: 'K2', fgm: 3, fga: 3, lng: 46, xpm: 4, xpa: 4 },
  { week: 4, opp: 'BUF', isAway: true, fpts: 6, fin: 'K15', fgm: 1, fga: 2, lng: 38, xpm: 2, xpa: 2 },
  { week: 5, opp: 'TEN', isAway: false, fpts: 10, fin: 'K6', fgm: 2, fga: 2, lng: 51, xpm: 3, xpa: 4 },
  { week: 6, opp: 'BYE', isAway: false, fpts: 0, fin: '-', fgm: 0, fga: 0, lng: 0, xpm: 0, xpa: 0 },
  { week: 7, opp: 'NYJ', isAway: true, fpts: 7, fin: 'K11', fgm: 1, fga: 1, lng: 44, xpm: 3, xpa: 3 },
  { week: 8, opp: 'CLE', isAway: false, fpts: 14, fin: 'K1', fgm: 3, fga: 3, lng: 57, xpm: 5, xpa: 5 },
  { week: 9, opp: 'MIA', isAway: true, fpts: 5, fin: 'K18', fgm: 1, fga: 2, lng: 42, xpm: 1, xpa: 1 },
  { week: 10, opp: 'LV', isAway: false, fpts: 9, fin: 'K7', fgm: 2, fga: 2, lng: 45, xpm: 2, xpa: 3 },
];

// Game log data for DEF
const defGameLogData = [
  { week: 1, opp: 'ARI', isAway: false, fpts: 14, fin: 'DEF3', sack: 4, int: 2, fr: 1, td: 1, pa: 14 },
  { week: 2, opp: 'LAR', isAway: true, fpts: 8, fin: 'DEF9', sack: 3, int: 1, fr: 0, td: 0, pa: 21 },
  { week: 3, opp: 'NYG', isAway: false, fpts: 12, fin: 'DEF5', sack: 5, int: 1, fr: 1, td: 0, pa: 17 },
  { week: 4, opp: 'CLE', isAway: true, fpts: 6, fin: 'DEF14', sack: 2, int: 0, fr: 1, td: 0, pa: 24 },
  { week: 5, opp: 'CAR', isAway: false, fpts: 16, fin: 'DEF1', sack: 6, int: 2, fr: 0, td: 1, pa: 10 },
  { week: 6, opp: 'BYE', isAway: false, fpts: 0, fin: '-', sack: 0, int: 0, fr: 0, td: 0, pa: 0 },
  { week: 7, opp: 'KC', isAway: true, fpts: 4, fin: 'DEF18', sack: 1, int: 0, fr: 0, td: 0, pa: 31 },
  { week: 8, opp: 'ATL', isAway: false, fpts: 10, fin: 'DEF7', sack: 3, int: 1, fr: 1, td: 0, pa: 20 },
  { week: 9, opp: 'NO', isAway: true, fpts: 11, fin: 'DEF6', sack: 4, int: 2, fr: 0, td: 0, pa: 18 },
  { week: 10, opp: 'SEA', isAway: false, fpts: 7, fin: 'DEF12', sack: 2, int: 1, fr: 0, td: 0, pa: 23 },
];

// Helper function for stat cell coloring (green for good, red for bad, neutral otherwise)
const getStatColor = (value: number, goodThreshold: number, badThreshold: number): string => {
  if (value >= goodThreshold) return 'bg-green-500/30 text-green-400';
  if (value <= badThreshold) return 'bg-red-500/30 text-red-400';
  return 'text-slate-300';
};

export function PlayerCard({ player, onClose, isDarkMode }: PlayerCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'props' | 'breakdown' | 'history'>('props');

  useEffect(() => {
    // Trigger animation on mount
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const getMatchupGrade = () => {
    const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
    return grades[Math.floor(Math.random() * 3)]; // Simulated A-range grade
  };

  const matchupGrade = getMatchupGrade();
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-400 bg-green-500/20 border-green-500/30';
    if (grade.startsWith('B')) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    if (grade.startsWith('C')) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    return 'text-red-400 bg-red-500/20 border-red-500/30';
  };

  return (
    <div
      className={`fixed inset-0 backdrop-blur-sm z-[100] flex items-start justify-center overflow-y-auto p-4 transition-opacity duration-200 ${isDarkMode ? 'bg-slate-950/80' : 'bg-slate-900/50'} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={`w-full max-w-5xl mt-8 mb-8 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleClose}
            className={`flex items-center gap-2 transition-colors group ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back</span>
            <span className={isDarkMode ? 'text-slate-600' : 'text-slate-400'}>/</span>
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Player Card</span>
          </button>
          <button
            onClick={handleClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-white hover:bg-slate-100 border border-slate-200'}`}
          >
            <X className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className={`lg:col-span-2 rounded-xl border overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Player Header */}
            <div className={`p-6 border-b ${isDarkMode ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center border shadow-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.team}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</h1>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${getGradeColor(matchupGrade)}`}>
                        {matchupGrade}
                      </span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{player.team} • {player.position} • Week 5</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Projection (PPR)</div>
                  <div className={`text-4xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.projectedPoints}</div>
                  <div className={`text-sm mt-1 flex items-center gap-1 justify-end ${
                    player.weekChange >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {player.weekChange >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{player.weekChange >= 0 ? '+' : ''}{player.weekChange.toFixed(1)} from last week</span>
                  </div>
                </div>
              </div>
            </div>

            {/* News Section */}
            <div className={`p-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Latest News</span>
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">AS</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Adam Schefter</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>@AdamSchefter</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>• 2h</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span> was a full participant in practice today and is expected to play Sunday with no limitations. #FantasyFootball
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">MH</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Matthew Berry</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>@MatthewBerryTMR</span>
                      <span className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>• 5h</span>
                    </div>
                    <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Love <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{player.name}</span> this week. Great matchup, high target share expected. Start with confidence.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className={`flex border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              {(['props', 'breakdown', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? isDarkMode ? 'text-white' : 'text-slate-900'
                      : isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'props' && 'Vegas Props'}
                  {tab === 'breakdown' && 'Projection'}
                  {tab === 'history' && 'History'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'props' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Vegas Prop Lines</h3>
                    <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Updated 2h ago</span>
                  </div>
                  <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
                          <th className={`text-left text-xs px-4 py-3 font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Prop</th>
                          <th className={`text-left text-xs px-4 py-3 font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Book</th>
                          <th className={`text-right text-xs px-4 py-3 font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Line</th>
                          <th className={`text-right text-xs px-4 py-3 font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Over/Under</th>
                        </tr>
                      </thead>
                      <tbody>
                        {player.position === 'QB' ? (
                          <>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Passing Yards</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>DraftKings</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>285.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Passing TDs</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FanDuel</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-115 / -105</td>
                            </tr>
                            <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rush + Pass Yards</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Caesars</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>318.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                          </>
                        ) : player.position === 'RB' ? (
                          <>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rushing Yards</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>DraftKings</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>78.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rush + Rec Yards</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FanDuel</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>106.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-115 / -105</td>
                            </tr>
                            <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Anytime TD</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Caesars</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>-</td>
                              <td className="px-4 py-3 text-sm text-green-500 text-right">-120</td>
                            </tr>
                          </>
                        ) : player.position === 'K' ? (
                          <>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Total Points</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>DraftKings</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>8.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Field Goals Made</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FanDuel</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>1.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-125 / +105</td>
                            </tr>
                            <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Extra Points Made</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Caesars</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-115 / -105</td>
                            </tr>
                          </>
                        ) : player.position === 'DEF' ? (
                          <>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Total Sacks</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>DraftKings</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Interceptions</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FanDuel</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>1.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>+120 / -140</td>
                            </tr>
                            <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Points Allowed</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Caesars</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>21.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                          </>
                        ) : (
                          <>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Receiving Yards</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>DraftKings</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>96.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-110 / -110</td>
                            </tr>
                            <tr className={`border-b transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Receptions</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>FanDuel</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>7.5</td>
                              <td className={`px-4 py-3 text-sm text-right ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>-115 / -105</td>
                            </tr>
                            <tr className={`transition-colors ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100'}`}>
                              <td className={`px-4 py-3 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Anytime TD</td>
                              <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Caesars</td>
                              <td className={`px-4 py-3 text-sm text-right font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>-</td>
                              <td className="px-4 py-3 text-sm text-green-500 text-right">-135</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'breakdown' && (
                <div className="space-y-4">
                  <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Projection Breakdown</h3>
                  <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="space-y-3">
                      {player.position === 'QB' ? (
                        <>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Passing Yards</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>285.4</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Passing TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.1</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Interceptions</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.8</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rushing Yards</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>32.6</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rushing TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.35</span>
                          </div>
                        </>
                      ) : player.position === 'RB' ? (
                        <>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rushing Yards</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>78.5</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rushing TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.68</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receptions</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>4.2</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receiving Yards</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>28.4</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receiving TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.25</span>
                          </div>
                        </>
                      ) : player.position === 'K' ? (
                        <>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Field Goals (0-39)</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.8</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Field Goals (40-49)</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.6</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Field Goals (50+)</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.3</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Extra Points</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.8</span>
                          </div>
                        </>
                      ) : player.position === 'DEF' ? (
                        <>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sacks</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>2.4</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Interceptions</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>1.2</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Fumble Recoveries</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.5</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Defensive TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.15</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Points Allowed</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>18.5</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receptions</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>7.2</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receiving Yards</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>95.8</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Receiving TDs</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.72</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}">
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Targets</span>
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>9.4</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between py-3 bg-blue-500/10 -mx-4 px-4 rounded-lg mt-2">
                        <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Total PPR Points</span>
                        <span className="font-bold text-blue-400 text-lg">{player.projectedPoints}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-8">
                  {/* Season Stats */}
                  <div>
                    <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Season Stats</h3>
                    <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          {player.position === 'QB' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-3 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Passing</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Rushing</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-3 py-2 text-left text-xs text-amber-500 font-semibold">YR</th>
                                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">TM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">G</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">CMP</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">INT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-700">
                                  <td className="px-3 py-3 text-amber-500 font-semibold">'25</td>
                                  <td className="px-3 py-3 text-slate-300 font-medium">{player.team}</td>
                                  <td className="px-3 py-3 text-center text-white font-semibold">342.8</td>
                                  <td className="px-3 py-3 text-center text-slate-300">17</td>
                                  <td className="px-3 py-3 text-center text-slate-300">412</td>
                                  <td className="px-3 py-3 text-center text-slate-300">628</td>
                                  <td className="px-3 py-3 text-center text-slate-300">4,821</td>
                                  <td className="px-3 py-3 text-center text-slate-300">38</td>
                                  <td className="px-3 py-3 text-center text-slate-300">12</td>
                                  <td className="px-3 py-3 text-center text-slate-300">542</td>
                                  <td className="px-3 py-3 text-center text-slate-300">6</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'K' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-3 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={4}>Field Goals</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Extra Pts</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-3 py-2 text-left text-xs text-amber-500 font-semibold">YR</th>
                                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">TM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">G</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FGM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FGA</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FG%</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">LNG</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">XPM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">XPA</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-700">
                                  <td className="px-3 py-3 text-amber-500 font-semibold">'25</td>
                                  <td className="px-3 py-3 text-slate-300 font-medium">{player.team}</td>
                                  <td className="px-3 py-3 text-center text-white font-semibold">148.0</td>
                                  <td className="px-3 py-3 text-center text-slate-300">17</td>
                                  <td className="px-3 py-3 text-center text-slate-300">32</td>
                                  <td className="px-3 py-3 text-center text-slate-300">36</td>
                                  <td className="px-3 py-3 text-center text-slate-300">88.9%</td>
                                  <td className="px-3 py-3 text-center text-slate-300">57</td>
                                  <td className="px-3 py-3 text-center text-slate-300">42</td>
                                  <td className="px-3 py-3 text-center text-slate-300">44</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'DEF' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-3 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Defense</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-3 py-2 text-left text-xs text-amber-500 font-semibold">YR</th>
                                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">TM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">G</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">SACK</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">INT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FR</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">PA</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-700">
                                  <td className="px-3 py-3 text-amber-500 font-semibold">'25</td>
                                  <td className="px-3 py-3 text-slate-300 font-medium">{player.team}</td>
                                  <td className="px-3 py-3 text-center text-white font-semibold">142.0</td>
                                  <td className="px-3 py-3 text-center text-slate-300">17</td>
                                  <td className="px-3 py-3 text-center text-slate-300">48</td>
                                  <td className="px-3 py-3 text-center text-slate-300">18</td>
                                  <td className="px-3 py-3 text-center text-slate-300">12</td>
                                  <td className="px-3 py-3 text-center text-slate-300">4</td>
                                  <td className="px-3 py-3 text-center text-slate-300">312</td>
                                </tr>
                              </tbody>
                            </>
                          ) : player.position === 'WR' || player.position === 'TE' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-3 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Fantasy</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Receiving</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Rushing</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-3 py-2 text-left text-xs text-amber-500 font-semibold">YR</th>
                                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">TM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">G</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TGT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">REC</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">Y/R</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-700">
                                  <td className="px-3 py-3 text-amber-500 font-semibold">'25</td>
                                  <td className="px-3 py-3 text-slate-300 font-medium">{player.team}</td>
                                  <td className="px-3 py-3 text-center text-white font-semibold">268.4</td>
                                  <td className="px-3 py-3 text-center text-slate-300">17</td>
                                  <td className="px-3 py-3 text-center text-slate-400"># 8</td>
                                  <td className="px-3 py-3 text-center text-slate-300">156</td>
                                  <td className="px-3 py-3 text-center text-slate-300">108</td>
                                  <td className="px-3 py-3 text-center text-slate-300">1,456</td>
                                  <td className="px-3 py-3 text-center text-slate-300">13.5</td>
                                  <td className="px-3 py-3 text-center text-slate-300">12</td>
                                  <td className="px-3 py-3 text-center text-slate-300">18</td>
                                  <td className="px-3 py-3 text-center text-slate-300">124</td>
                                  <td className="px-3 py-3 text-center text-slate-300">1</td>
                                </tr>
                              </tbody>
                            </>
                          ) : (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-3 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Fantasy</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={4}>Rushing</th>
                                  <th className="px-3 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={4}>Receiving</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-3 py-2 text-left text-xs text-amber-500 font-semibold">YR</th>
                                  <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">TM</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">G</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">Y/A</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">REC</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">Y/R</th>
                                  <th className="px-3 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-700">
                                  <td className="px-3 py-3 text-amber-500 font-semibold">'25</td>
                                  <td className="px-3 py-3 text-slate-300 font-medium">{player.team}</td>
                                  <td className="px-3 py-3 text-center text-white font-semibold">248.6</td>
                                  <td className="px-3 py-3 text-center text-slate-300">17</td>
                                  <td className="px-3 py-3 text-center text-slate-400"># 12</td>
                                  <td className="px-3 py-3 text-center text-slate-300">286</td>
                                  <td className="px-3 py-3 text-center text-slate-300">1,245</td>
                                  <td className="px-3 py-3 text-center text-slate-300">4.4</td>
                                  <td className="px-3 py-3 text-center text-slate-300">12</td>
                                  <td className="px-3 py-3 text-center text-slate-300">52</td>
                                  <td className="px-3 py-3 text-center text-slate-300">412</td>
                                  <td className="px-3 py-3 text-center text-slate-300">7.9</td>
                                  <td className="px-3 py-3 text-center text-slate-300">3</td>
                                </tr>
                              </tbody>
                            </>
                          )}
                        </table>
                      </div>
                      {/* Timeline slider */}
                      <div className="px-4 py-3 border-t border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                          <div className="flex-1 h-1 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-full"></div>
                          <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Game Logs */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Game Logs</h3>
                      <select className={`border rounded-lg px-3 py-1.5 text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
                        <option>2025</option>
                        <option>2024</option>
                        <option>2023</option>
                      </select>
                    </div>
                    <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          {player.position === 'QB' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-2 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Passing</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Rushing</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium w-8">WK</th>
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium">OPP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">CMP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">INT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {qbGameLogData.map((game, index) => (
                                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-2 py-2 text-slate-400 font-medium">{game.week}</td>
                                    <td className={`px-2 py-2 font-medium ${game.isAway ? 'text-blue-400' : 'text-slate-300'}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-2 py-2 text-center font-semibold ${getStatColor(game.fpts, 22, 15)}`}>{game.fpts}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fin}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.cmp, 25, 18)}`}>{game.cmp}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.att}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.passYds, 280, 200)}`}>{game.passYds}</td>
                                    <td className={`px-2 py-2 text-center ${game.passTd > 1 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.passTd}</td>
                                    <td className={`px-2 py-2 text-center ${game.int > 0 ? 'bg-red-500/30 text-red-400' : 'text-slate-400'}`}>{game.int}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rushYds, 30, 10)}`}>{game.rushYds}</td>
                                    <td className={`px-2 py-2 text-center ${game.rushTd > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.rushTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'K' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-2 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Field Goals</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Extra Pts</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium w-8">WK</th>
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium">OPP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FGM</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FGA</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">LNG</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">XPM</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">XPA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {kGameLogData.map((game, index) => (
                                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-2 py-2 text-slate-400 font-medium">{game.week}</td>
                                    <td className={`px-2 py-2 font-medium ${game.isAway ? 'text-blue-400' : 'text-slate-300'}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-2 py-2 text-center font-semibold ${getStatColor(game.fpts, 10, 5)}`}>{game.fpts}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fin}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.fgm, 2, 1)}`}>{game.fgm}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fga}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.lng, 50, 30)}`}>{game.lng}</td>
                                    <td className="px-2 py-2 text-center text-slate-300">{game.xpm}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.xpa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'DEF' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-2 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={2}>Fantasy</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Defense</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium w-8">WK</th>
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium">OPP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">SACK</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">INT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FR</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">PA</th>
                                </tr>
                              </thead>
                              <tbody>
                                {defGameLogData.map((game, index) => (
                                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-2 py-2 text-slate-400 font-medium">{game.week}</td>
                                    <td className={`px-2 py-2 font-medium ${game.isAway ? 'text-blue-400' : 'text-slate-300'}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-2 py-2 text-center font-semibold ${getStatColor(game.fpts, 10, 5)}`}>{game.fpts}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fin}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.sack, 3, 1)}`}>{game.sack}</td>
                                    <td className={`px-2 py-2 text-center ${game.int > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.int}</td>
                                    <td className={`px-2 py-2 text-center ${game.fr > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.fr}</td>
                                    <td className={`px-2 py-2 text-center ${game.td > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.td}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(28 - game.pa, 14, 7)}`}>{game.pa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : player.position === 'WR' || player.position === 'TE' ? (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-2 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Fantasy</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={4}>Receiving</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Rushing</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium w-8">WK</th>
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium">OPP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">SNP%</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TGT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">REC</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {wrTeGameLogData.map((game, index) => (
                                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-2 py-2 text-slate-400 font-medium">{game.week}</td>
                                    <td className={`px-2 py-2 font-medium ${game.isAway ? 'text-blue-400' : 'text-slate-300'}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-2 py-2 text-center font-semibold ${getStatColor(game.fpts, 15, 8)}`}>{game.fpts}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.snpPct, 80, 60)}`}>{game.snpPct}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fin}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.tgt, 8, 4)}`}>{game.tgt}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rec, 6, 3)}`}>{game.rec}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.recYds, 80, 40)}`}>{game.recYds}</td>
                                    <td className={`px-2 py-2 text-center ${game.recTd > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.recTd}</td>
                                    <td className={`px-2 py-2 text-center ${game.rushAtt > 0 ? 'text-slate-300' : 'text-slate-500'}`}>{game.rushAtt}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rushYds, 15, 0)}`}>{game.rushYds}</td>
                                    <td className={`px-2 py-2 text-center ${game.rushTd > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.rushTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          ) : (
                            <>
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="px-2 py-3 text-left text-xs text-slate-500 font-medium" colSpan={2}></th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={3}>Fantasy</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={4}>Rushing</th>
                                  <th className="px-2 py-3 text-center text-xs text-slate-400 font-semibold" colSpan={5}>Receiving</th>
                                </tr>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium w-8">WK</th>
                                  <th className="px-2 py-2 text-left text-xs text-slate-400 font-medium">OPP</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FPTS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">SNP%</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">FIN</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">ATT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">Y/A</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TGT</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">REC</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">YDS</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">Y/R</th>
                                  <th className="px-2 py-2 text-center text-xs text-slate-400 font-medium">TD</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gameLogData.map((game, index) => (
                                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                    <td className="px-2 py-2 text-slate-400 font-medium">{game.week}</td>
                                    <td className={`px-2 py-2 font-medium ${game.isAway ? 'text-blue-400' : 'text-slate-300'}`}>
                                      {game.isAway ? '@' : ''}{game.opp}
                                    </td>
                                    <td className={`px-2 py-2 text-center font-semibold ${getStatColor(game.fpts, 15, 10)}`}>{game.fpts}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.snpPct, 50, 30)}`}>{game.snpPct}</td>
                                    <td className="px-2 py-2 text-center text-slate-400">{game.fin}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rushAtt, 12, 6)}`}>{game.rushAtt}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rushYds, 60, 30)}`}>{game.rushYds}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rushYpa, 5, 3)}`}>{game.rushYpa}</td>
                                    <td className={`px-2 py-2 text-center ${game.rushTd > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.rushTd}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.tgt, 5, 3)}`}>{game.tgt}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.rec, 4, 2)}`}>{game.rec}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.recYds, 40, 20)}`}>{game.recYds}</td>
                                    <td className={`px-2 py-2 text-center ${getStatColor(game.recYpr, 10, 5)}`}>{game.recYpr}</td>
                                    <td className={`px-2 py-2 text-center ${game.recTd > 0 ? 'bg-green-500/30 text-green-400' : 'text-slate-400'}`}>{game.recTd}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* FilmRoom Insights */}
            <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-yellow-500" />
                <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>FilmRoom Insights</h3>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Target className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {player.name} has an <strong className="text-green-500">elite matchup</strong> against a bottom-5 defense.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Star className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Vegas lines are <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>trending up</strong> — sharp money on the over.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Weather looks <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>favorable</strong> for passing this week.
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className={`rounded-lg p-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <h4 className={`font-semibold text-sm mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Quick Actions</h4>
                <div className="space-y-2">
                  <button className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded transition-colors group ${isDarkMode ? 'text-white hover:bg-slate-700' : 'text-slate-900 hover:bg-slate-200'}`}>
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold group-hover:text-amber-500 transition-colors">Alert me on line moves</span>
                  </button>
                  <button className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded transition-colors group ${isDarkMode ? 'text-white hover:bg-slate-700' : 'text-slate-900 hover:bg-slate-200'}`}>
                    <Pin className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold group-hover:text-red-500 transition-colors">Pin to dashboard</span>
                  </button>
                  <button className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded transition-colors group ${isDarkMode ? 'text-white hover:bg-slate-700' : 'text-slate-900 hover:bg-slate-200'}`}>
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-semibold group-hover:text-blue-500 transition-colors">Compare to opponent</span>
                  </button>
                  <button className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded transition-colors group ${isDarkMode ? 'text-white hover:bg-slate-700' : 'text-slate-900 hover:bg-slate-200'}`}>
                    <Share2 className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold group-hover:text-purple-500 transition-colors">Share snapshot</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Key Line Spotlight */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 border border-blue-500/30">
              <h4 className="text-white font-bold mb-2">Key Line</h4>
              <p className="text-2xl font-bold text-white mb-1">{player.keyLine}</p>
              <p className="text-blue-200 text-sm">Market consensus across major sportsbooks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
