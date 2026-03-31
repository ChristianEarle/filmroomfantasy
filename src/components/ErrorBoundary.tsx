import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  isDarkMode?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, retryCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // In production, you could send this to an error tracking service
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  private handleReset = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    const { isDarkMode = true } = this.props;

    if (this.state.hasError) {
      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className={`max-w-md w-full rounded-lg border p-8 text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center" role="alert">
              <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
            </div>

            <h1 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Something went wrong
            </h1>

            <p className={`text-sm mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              We encountered an unexpected error. Please try refreshing the page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className={`mb-6 p-3 rounded-lg text-left text-xs font-mono overflow-auto max-h-32 ${isDarkMode ? 'bg-slate-800 text-red-400' : 'bg-slate-100 text-red-600'}`}>
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3">
              {this.state.retryCount < MAX_RETRIES && (
                <button
                  type="button"
                  onClick={this.handleReset}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
                >
                  Try Again
                </button>
              )}
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
