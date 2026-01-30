import { Search } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function SearchBar({ searchQuery, onSearchChange }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" />
      <input
        type="text"
        placeholder="Search players by name or team..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full pl-12 pr-4 py-3 bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
      />
    </div>
  );
}
