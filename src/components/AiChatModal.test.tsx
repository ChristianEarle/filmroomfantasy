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
});
