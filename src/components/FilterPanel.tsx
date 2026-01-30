import { Filter } from 'lucide-react';

interface FilterPanelProps {
  selectedPosition: string;
  onPositionChange: (position: string) => void;
}

const positions = [
  { value: 'ALL', label: 'All Positions', color: 'bg-purple-500' },
  { value: 'QB', label: 'Quarterback', color: 'bg-red-500' },
  { value: 'RB', label: 'Running Back', color: 'bg-green-500' },
  { value: 'WR', label: 'Wide Receiver', color: 'bg-blue-500' },
  { value: 'TE', label: 'Tight End', color: 'bg-yellow-500' },
  { value: 'K', label: 'Kicker', color: 'bg-amber-500' },
  { value: 'DEF', label: 'Defense', color: 'bg-indigo-500' },
];

export function FilterPanel({ selectedPosition, onPositionChange }: FilterPanelProps) {
  return (
    <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg p-6 sticky top-8">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-purple-400" />
        <h2 className="text-white">Filter by Position</h2>
      </div>
      
      <div className="space-y-2">
        {positions.map((position) => (
          <button
            key={position.value}
            onClick={() => onPositionChange(position.value)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
              selectedPosition === position.value
                ? 'bg-purple-500/40 border-2 border-purple-400 text-white'
                : 'bg-white/5 border border-white/10 text-purple-200 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${position.color}`}></div>
              <span>{position.label}</span>
              {position.value !== 'ALL' && (
                <span className="ml-auto text-xs opacity-60">{position.value}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
