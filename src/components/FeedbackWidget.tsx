import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Loader2, CheckCircle, Bug, Lightbulb, MessageCircle } from 'lucide-react';
import api from '../services/api';

interface FeedbackWidgetProps {
  isDarkMode: boolean;
  currentPage?: string;
  /** When true, renders inline in Settings instead of as a floating button */
  embedded?: boolean;
}

type FeedbackType = 'bug' | 'feature' | 'general';

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: <Bug className="w-4 h-4" />, description: 'Something not working?' },
  { value: 'feature', label: 'Feature Request', icon: <Lightbulb className="w-4 h-4" />, description: 'Got an idea?' },
  { value: 'general', label: 'General', icon: <MessageCircle className="w-4 h-4" />, description: 'Other feedback' },
];

export function FeedbackWidget({ isDarkMode, currentPage, embedded = false }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.length < 10) {
      setError('Please provide more details (at least 10 characters)');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/feedback', {
        type,
        message: message.trim(),
        email: email.trim() || undefined,
        page: currentPage,
      });

      setIsSuccess(true);
      setMessage('');
      setEmail('');
      setType('general');

      // Auto-close after success (with cleanup)
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        successTimerRef.current = null;
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit feedback';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    setIsSuccess(false);
  };

  const feedbackForm = (
    <>
      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onKeyDown={(e) => { if (e.key === 'Escape') handleClose(); }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal content */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className={`relative w-full max-w-md rounded-lg shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'
            }`}
          >
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div>
                <h3 id="feedback-dialog-title" className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Send Feedback
                </h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Help us improve FilmRoom
                </p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close feedback dialog"
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Success state */}
            {isSuccess ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <h4 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Feedback Submitted!
                </h4>
                <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Thank you — we'll review your feedback shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Feedback type selector */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    What type of feedback?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {feedbackTypes.map((ft) => (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => setType(ft.value)}
                        className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                          type === ft.value
                            ? 'border-blue-500 bg-blue-500/10'
                            : isDarkMode
                              ? 'border-slate-700 hover:border-slate-600'
                              : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className={type === ft.value ? 'text-blue-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                          {ft.icon}
                        </span>
                        <span className={`text-xs mt-1 font-medium ${
                          type === ft.value
                            ? 'text-blue-500'
                            : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {ft.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Your feedback
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={5000}
                    placeholder={
                      type === 'bug'
                        ? 'Please describe what went wrong and how to reproduce it...'
                        : type === 'feature'
                          ? 'Describe the feature you would like to see...'
                          : 'Share your thoughts with us...'
                    }
                    rows={4}
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {message.length}/5000 characters
                  </p>
                </div>

                {/* Email (optional) */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Email <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    We'll only use this to follow up if needed
                  </p>
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || message.length < 10}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className={`border rounded-lg overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Feedback</h2>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Help us improve FilmRoom</p>
        </div>
        <div className="p-6">
          {isSuccess ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
              <h4 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Feedback Submitted!</h4>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Thank you — we'll review your feedback shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Feedback type selector */}
              <div className="grid grid-cols-3 gap-2">
                {feedbackTypes.map((ft) => (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setType(ft.value)}
                    className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
                      type === ft.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDarkMode
                          ? 'border-slate-700 hover:border-slate-600'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={type === ft.value ? 'text-blue-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                      {ft.icon}
                    </span>
                    <span className={`text-xs mt-1 font-medium ${
                      type === ft.value ? 'text-blue-500' : isDarkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      {ft.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Message */}
              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={5000}
                  placeholder={
                    type === 'bug' ? 'Describe what went wrong...'
                    : type === 'feature' ? 'Describe the feature you want...'
                    : 'Share your thoughts...'
                  }
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <p className={`text-xs mt-1 text-right ${message.length > 4500 ? 'text-orange-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {message.length}/5000
                </p>
              </div>

              {/* Email (optional) */}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional — for follow-up)"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDarkMode
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">{error}</div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || message.length < 10}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-lg transition-all hover:scale-105 ${
          isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        aria-label="Send Feedback"
      >
        <MessageSquare className="w-5 h-5" aria-hidden="true" />
      </button>
      {feedbackForm}
    </>
  );
}
