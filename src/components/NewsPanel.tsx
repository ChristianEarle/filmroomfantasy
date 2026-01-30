import { Clock } from 'lucide-react';

interface NewsItem {
  source: string;
  title: string;
  time: string;
}

interface NewsPanelProps {
  isDarkMode: boolean;
}

const newsItems: NewsItem[] = [
  {
    source: 'JAL @ PHI',
    title: "CeeDee Lamb's receiving prop moved from 79.5 → 82.5 yards.",
    time: '10 min ago',
  },
  {
    source: 'CHI @ BAL',
    title: "Ja'Marr Chase target share projection bumped after Higgins limited in practice.",
    time: '28 min ago',
  },
  {
    source: 'ATL @ NO',
    title: "Bijan rush + rec line ticks up to 96.5 after positive coach comments.",
    time: '1 hr ago',
  },
];

export function NewsPanel({ isDarkMode }: NewsPanelProps) {
  return (
    <div className={`rounded-xl border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>News & Notes</h3>
      
      <div className="space-y-4">
        {newsItems.map((item, index) => (
          <div key={index} className={`border-b pb-4 last:border-0 last:pb-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-xs text-blue-500">{item.source}</span>
              <span className={`text-xs flex items-center gap-1 whitespace-nowrap ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <Clock className="w-3 h-3" />
                {item.time}
              </span>
            </div>
            <p className={`text-sm font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}