import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useIsMobile } from './ui/use-mobile';

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

// NOTE on styling: src/index.css is a precompiled Tailwind build, so utilities not
// already in it (px-5, h-11, inline-block, whitespace-pre-wrap, max-w-[85%],
// max-h-[85vh], every sm:* variant used here, …) silently do nothing. All layout
// that must be reliable is therefore expressed as inline styles below; Tailwind
// classes are only used for colors/typography that are known to exist.

/**
 * Lightweight conversational modal backed by an AI endpoint. Keeps a local
 * turn history and posts each question with the prior turns + context params.
 *
 * On phones it renders as a full-width bottom sheet; on larger screens as a
 * centered dialog with a stable height so the empty state isn't a tiny card.
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
  const isMobile = useIsMobile();

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

  const overlayStyle: CSSProperties = isMobile
    ? { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };

  const panelStyle: CSSProperties = isMobile
    ? {
        width: '100%',
        maxWidth: '100%',
        height: '88dvh',
        maxHeight: '88dvh',
        borderRadius: '16px 16px 0 0',
        borderBottomWidth: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }
    : {
        width: '100%',
        maxWidth: 520,
        height: 'min(640px, 85vh)',
        maxHeight: '85vh',
        borderRadius: 16,
      };

  const sectionPad: CSSProperties = { paddingLeft: 20, paddingRight: 20 };
  const btnSize = isMobile ? 44 : 36;

  return (
    <div
      className="fixed inset-0 z-50"
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative flex flex-col border ${panel}`}
        style={{ ...panelStyle, overflow: 'hidden', minHeight: 0 }}
      >
        <div
          className={`flex items-center justify-between border-b ${border}`}
          style={{ ...sectionPad, paddingTop: 12, paddingBottom: 12, flexShrink: 0 }}
        >
          <h3 className={`text-sm font-bold flex items-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`} style={{ gap: 8, minWidth: 0 }}>
            <MessageSquare className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`inline-flex items-center justify-center rounded-lg border ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            style={{ width: btnSize, height: btnSize, flexShrink: 0, marginLeft: 12 }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          style={{ ...sectionPad, paddingTop: 16, paddingBottom: 16, flex: '1 1 0%', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {turns.length === 0 && (
            <div>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Ask anything about the current rankings — picks, comparisons, or value at a draft slot.
              </p>
              {quickActions && quickActions.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                  {quickActions.map((qa) => (
                    <button
                      key={qa}
                      type="button"
                      onClick={() => send(qa)}
                      disabled={sending}
                      className={`text-xs font-medium rounded-full border disabled:opacity-50 ${isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      style={{ padding: '6px 12px', minHeight: isMobile ? 36 : undefined }}
                    >
                      {qa}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                className={`text-sm ${
                  t.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
                }`}
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 16,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  textAlign: 'left',
                  lineHeight: 1.5,
                }}
              >
                {t.content}
              </div>
            </div>
          ))}

          {sending && (
            <div>
              <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
          )}
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <div
          className={`flex border-t ${border}`}
          style={{ ...sectionPad, paddingTop: 12, paddingBottom: 12, gap: 8, alignItems: 'center', flexShrink: 0 }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(input); } }}
            placeholder={placeholder || 'Ask a question…'}
            disabled={sending}
            className={`text-sm rounded-lg border outline-none ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400 focus:border-blue-500'
            }`}
            style={{ flex: '1 1 0%', minWidth: 0, height: btnSize, padding: '0 12px', fontSize: isMobile ? 16 : undefined }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            style={{ width: btnSize, height: btnSize, flexShrink: 0 }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
