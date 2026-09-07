import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../services/api', () => ({ api: { post: h.post } }));

import { AiChatModal } from './AiChatModal';

beforeEach(() => {
  h.post.mockReset();
});

describe('AiChatModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AiChatModal isOpen={false} onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('sends a question with context and renders the answer', async () => {
    h.post.mockResolvedValue({ answer: 'Draft Gibbs at 1.01.' });
    render(
      <AiChatModal
        isOpen
        onClose={vi.fn()}
        isDarkMode={false}
        title="Ask AI about the draft"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'redraft', scoring: 'ppr' }}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Who at 1.01?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Draft Gibbs at 1.01.')).toBeInTheDocument());
    expect(h.post).toHaveBeenCalledWith(
      '/draft-rankings/ask',
      expect.objectContaining({ question: 'Who at 1.01?', type: 'redraft', scoring: 'ppr', conversationHistory: [] }),
    );
  });

  it('surfaces the error message when the request fails', async () => {
    h.post.mockRejectedValue(new Error('Ask AI limit of 20 per day reached.'));
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Ask AI limit of 20 per day reached.')).toBeInTheDocument());
  });

  it('renders markdown-lite bold text as a <strong> element, not literal asterisks', async () => {
    h.post.mockResolvedValue({ answer: 'Start **Puka Nacua** this week.' });
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Who do I start?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Puka Nacua', { selector: 'strong' })).toBeInTheDocument());
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it('renders markdown-lite bullet lists as real <li> items', async () => {
    h.post.mockResolvedValue({ answer: 'Top waiver targets:\n- Player A\n- Player B\n- Player C' });
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Waiver targets?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Player A').closest('li')).not.toBeNull());
    expect(screen.getByText('Player B').closest('li')).not.toBeNull();
    expect(screen.getByText('Player C').closest('li')).not.toBeNull();
    expect(screen.getByText('Player A').closest('ul')).not.toBeNull();
  });

  it('renders numbered lists as <ol> items', async () => {
    h.post.mockResolvedValue({ answer: '1. Draft a QB\n2. Grab a WR\n3. Take best available' });
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'What should I do?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('Draft a QB').closest('li')).not.toBeNull());
    expect(screen.getByText('Draft a QB').closest('ol')).not.toBeNull();
  });

  it('shows a "Looked up:" line naming the player when a lookup_player tool call was made', async () => {
    h.post.mockResolvedValue({
      answer: "Chase has the better matchup this week.",
      toolCalls: [{ name: 'lookup_player', input: { name: "Ja'Marr Chase" } }],
    });
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/players/ask" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'How is Chase looking?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText(/Looked up:/)).toBeInTheDocument());
    expect(screen.getByText(/Looked up:.*Ja'Marr Chase/)).toBeInTheDocument();
  });

  it('does not show a "Looked up:" line when there were no tool calls', async () => {
    h.post.mockResolvedValue({ answer: 'General advice with no lookups.', toolCalls: [] });
    render(<AiChatModal isOpen onClose={vi.fn()} isDarkMode={false} title="Ask" endpoint="/x" />);
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Any general tips?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(screen.getByText('General advice with no lookups.')).toBeInTheDocument());
    expect(screen.queryByText(/Looked up:/)).not.toBeInTheDocument();
  });
});

describe('AiChatModal — context changes reset conversation state', () => {
  it('clears prior turns and sends empty history when contextParams changes (e.g. Redraft -> Dynasty)', async () => {
    h.post.mockResolvedValue({ answer: 'Answer for redraft.' });
    const { rerender } = render(
      <AiChatModal
        isOpen
        onClose={vi.fn()}
        isDarkMode={false}
        title="Ask"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'redraft', scoring: 'ppr' }}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Who at 1.01?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Answer for redraft.')).toBeInTheDocument());

    // Same mounted instance, but the caller's contextParams changed underneath it.
    rerender(
      <AiChatModal
        isOpen
        onClose={vi.fn()}
        isDarkMode={false}
        title="Ask"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'dynasty', scoring: 'ppr' }}
      />,
    );

    expect(screen.queryByText('Answer for redraft.')).not.toBeInTheDocument();
    expect(screen.queryByText('Who at 1.01?')).not.toBeInTheDocument();

    h.post.mockResolvedValue({ answer: 'Answer for dynasty.' });
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Who at 1.01 in dynasty?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Answer for dynasty.')).toBeInTheDocument());

    const lastCall = h.post.mock.calls[h.post.mock.calls.length - 1];
    expect(lastCall[1]).toEqual(expect.objectContaining({ conversationHistory: [], type: 'dynasty' }));
  });

  it('preserves turns when closed and reopened with the identical contextParams', async () => {
    h.post.mockResolvedValue({ answer: 'Same context answer.' });
    const onClose = vi.fn();
    const { rerender } = render(
      <AiChatModal
        isOpen
        onClose={onClose}
        isDarkMode={false}
        title="Ask"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'redraft', scoring: 'ppr' }}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: 'Question one?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByText('Same context answer.')).toBeInTheDocument());

    // Close the modal (isOpen=false), then reopen with a fresh but value-equal contextParams object.
    rerender(
      <AiChatModal
        isOpen={false}
        onClose={onClose}
        isDarkMode={false}
        title="Ask"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'redraft', scoring: 'ppr' }}
      />,
    );
    rerender(
      <AiChatModal
        isOpen
        onClose={onClose}
        isDarkMode={false}
        title="Ask"
        endpoint="/draft-rankings/ask"
        contextParams={{ type: 'redraft', scoring: 'ppr' }}
      />,
    );

    expect(screen.getByText('Question one?')).toBeInTheDocument();
    expect(screen.getByText('Same context answer.')).toBeInTheDocument();
  });
});
