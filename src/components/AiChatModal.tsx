import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  title: string;
  /** API endpoint that accepts { conversationHistory, question, ...contextParams } and returns { answer }. */
  endpoint: string;
  /** Extra fields merged into the POST body (e.g. the ranking variant selectors). */
  contextParams?: Record<string, unknown>;
  placeholder?: string;
  quickActions?: string[];
}

/**
 * Lightweight conversational modal backed by an AI endpoint. Keeps a local
 * turn history and posts each question with the prior turns + context params.
 */
export function AiChatModal({
  isOpen,
  onClose,
  isDarkMode,
  title,
  endpoint,
  contextParams,
  placeholder,
  quickActions,
}: AiChatModalProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    const el = scrollRef.current;
    // scrollTo is unimplemented in jsdom; guard so tests (and odd envs) don't throw.
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [turns, sending]);

  if (!isOpen) return null;

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || sending) return;
    setError(null);
    const history = turns;
    setTurns((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setSending(true);
    try {
      const data = await api.post<{ answer: string }>(endpoint, {
        conversationHistory: history,
        question,
        ...contextParams,
      });
      setTurns((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const panel = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const border = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border shadow-xl ${panel}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${border}`}>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <MessageSquare className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {turns.length === 0 && (
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Ask anything about the current rankings — picks, comparisons, or value at a draft slot.
              </p>
              {quickActions && quickActions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {quickActions.map((qa) => (
                    <button
                      key={qa}
                      type="button"
                      onClick={() => send(qa)}
                      disabled={sending}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full border disabled:opacity-50 ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {qa}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[85%] text-left text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                  t.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="text-left">
              <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <div className={`px-5 py-3 border-t flex gap-2 ${border}`}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(input); } }}
            placeholder={placeholder || 'Ask a question…'}
            disabled={sending}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border outline-none ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-500'
            }`}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
