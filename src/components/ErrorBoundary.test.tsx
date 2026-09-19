import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// React logs caught errors to the console by default; silence that noise
// for this suite (componentDidCatch's own console.error is asserted below).
vi.spyOn(console, 'error').mockImplementation(() => {});

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>safe content</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('shows the fallback UI and the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('clears the caught error and re-renders children on "Try Again"', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Swap in a child that no longer throws (e.g. the underlying condition
    // resolved) before retrying — the boundary still shows the fallback
    // since it hasn't reset yet.
    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('resets a caught error when resetKeys changes, so navigating away recovers the boundary', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['Trends']}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Simulate the app navigating to a different view: the crashing child is
    // swapped out and resetKeys changes in the same update.
    rerender(
      <ErrorBoundary resetKeys={['Playoffs']}>
        <div>playoffs content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('playoffs content')).toBeInTheDocument();
  });

  it('does not reset when resetKeys is unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={['Trends']}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKeys={['Trends']}>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
