import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { PlayerAvatar } from './PlayerAvatar';

describe('PlayerAvatar', () => {
  it('renders the headshot image when a headshotUrl is given', () => {
    render(<PlayerAvatar name="Josh Allen" headshotUrl="https://example.com/allen.png" />);
    const img = screen.getByAltText('Josh Allen headshot');
    expect(img).toHaveAttribute('src', 'https://example.com/allen.png');
  });

  it('falls back to initials when no url is given', () => {
    render(<PlayerAvatar name="Josh Allen" />);
    expect(screen.getByRole('img', { name: 'Josh Allen avatar' })).toHaveTextContent('JA');
  });

  it('falls back to imageUrl when headshotUrl fails to load', () => {
    render(
      <PlayerAvatar
        name="Josh Allen"
        headshotUrl="https://example.com/broken.png"
        imageUrl="https://example.com/backup.png"
      />,
    );
    const img = screen.getByAltText('Josh Allen headshot');
    expect(img).toHaveAttribute('src', 'https://example.com/broken.png');

    fireEvent.error(img);

    const fallbackImg = screen.getByAltText('Josh Allen headshot');
    expect(fallbackImg).toHaveAttribute('src', 'https://example.com/backup.png');
  });

  it('falls back to initials once both headshotUrl and imageUrl fail', () => {
    render(
      <PlayerAvatar
        name="Josh Allen"
        headshotUrl="https://example.com/broken.png"
        imageUrl="https://example.com/also-broken.png"
      />,
    );
    fireEvent.error(screen.getByAltText('Josh Allen headshot'));
    fireEvent.error(screen.getByAltText('Josh Allen headshot'));

    expect(screen.queryByRole('img', { name: /headshot/i })).toBeNull();
    expect(screen.getByRole('img', { name: 'Josh Allen avatar' })).toHaveTextContent('JA');
  });

  it('falls back to "Unknown Player" initials for an empty name instead of crashing', () => {
    render(<PlayerAvatar name="" />);
    expect(screen.getByRole('img', { name: 'Unknown Player avatar' })).toHaveTextContent('UP');
  });

  it('shows "?" for a whitespace-only name', () => {
    render(<PlayerAvatar name="   " />);
    expect(screen.getByRole('img', { name: /avatar/i })).toHaveTextContent('?');
  });
});
