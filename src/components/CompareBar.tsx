import { useState } from 'react';
import { GitCompare, X } from 'lucide-react';
import { useCompare } from '../hooks/useCompare';
import { PlayerComparisonModal } from './PlayerComparisonModal';

/** Floating "Compare (N)" pill, shown globally whenever the compare basket
 * (populated from PlayerCard's Compare quick action) is non-empty. */
export function CompareBar({ isDarkMode }: { isDarkMode: boolean }) {
  const { compareList, removeFromCompare, clearCompare, maxCompare } = useCompare();
  const [showModal, setShowModal] = useState(false);

  if (compareList.length === 0) return null;

  return (
    <>
      <div className="fixed right-4 z-40 mb-3 mobile-bottom-nav-offset">
        <div className={`flex items-center gap-1.5 rounded-full border shadow-lg pl-1 pr-1.5 py-1 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            disabled={compareList.length < 2}
            title={compareList.length < 2 ? 'Add 1+ more player to compare' : 'Compare selected players'}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              compareList.length < 2
                ? 'opacity-50 cursor-not-allowed text-slate-400'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare ({compareList.length}/{maxCompare})
          </button>
          <button
            type="button"
            onClick={clearCompare}
            aria-label="Clear comparison list"
            title="Clear all"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showModal && (
        <PlayerComparisonModal
          players={compareList}
          isDarkMode={isDarkMode}
          onClose={() => setShowModal(false)}
          onRemove={removeFromCompare}
        />
      )}
    </>
  );
}
