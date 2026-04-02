import { useState, useEffect } from 'react';
import { Clock, AlertCircle, FileText } from 'lucide-react';
import { playerService } from '../services';
import type { PlayerNews } from '../services';
import { NewsSnippet } from './NewsSnippet';

interface NewsPanelProps {
  isDarkMode: boolean;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export function NewsPanel({ isDarkMode }: NewsPanelProps) {
  const [news, setNews] = useState<(PlayerNews & { source?: string; isArticle?: boolean; players?: Array<{ id: string; name: string; position: string; team: string }> })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await playerService.getAllNews(3);
        setNews(response.news);
      } catch {
        setError('Failed to load news');
        setNews([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
      <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>News & Notes</h3>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`animate-pulse border-b pb-4 last:border-0 last:pb-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className={`h-3 w-16 rounded mb-2 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className={`h-4 w-full rounded mb-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className={`h-4 w-3/4 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={`flex items-center gap-2 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : news.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No news available</p>
      ) : (
        <div className="space-y-4">
          {news.slice(0, 3).map((item) => (
            <div key={item.id} className={`border-b pb-4 last:border-0 last:pb-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-blue-500">
                  {item.source || 'News'}
                </span>
                <span className={`text-xs flex items-center gap-1 whitespace-nowrap ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {formatTimeAgo(item.publishedAt)}
                </span>
              </div>
              <p className={`text-sm font-bold leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                {item.isArticle && item.sourceUrl ? (
                  <a href={item.sourceUrl} className="hover:underline">
                    {item.headline}
                  </a>
                ) : (
                  <NewsSnippet item={item} />
                )}
              </p>
              {item.isArticle ? (
                <p className={`text-xs mt-1 flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <FileText className="w-3 h-3" aria-hidden="true" />
                  {item.players && item.players.length > 0
                    ? item.players.map(p => p.name).join(', ')
                    : 'Article'}
                </p>
              ) : item.player && (
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {item.player.name} · {item.player.position} · {item.player.team}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
