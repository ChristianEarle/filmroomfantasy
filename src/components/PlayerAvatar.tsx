import { useState, memo } from 'react';

function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface PlayerAvatarProps {
  name: string;
  headshotUrl?: string | null;
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  fallbackColorClass?: string; // Override default text color (e.g. "text-purple-300")
  isDarkMode?: boolean;
}

/** Renders player headshot, or initials when image is missing or fails to load. */
export const PlayerAvatar = memo(function PlayerAvatar({
  name,
  headshotUrl,
  imageUrl,
  className = 'w-full h-full object-cover object-top',
  fallbackClassName = 'text-sm font-bold',
  fallbackColorClass,
  isDarkMode = true,
}: PlayerAvatarProps) {
  const safeName = name || 'Unknown Player';
  const url = headshotUrl || imageUrl;
  // Track WHICH url failed rather than a boolean: a new url (e.g. a different
  // player, or a corrected headshot) is retried automatically without needing
  // an effect-based reset that briefly renders the wrong state.
  const [erroredUrl, setErroredUrl] = useState<string | null>(null);

  const showImage = url && erroredUrl !== url;

  if (showImage) {
    return (
      <img
        src={url}
        alt={`${safeName} headshot`}
        className={className}
        loading="lazy"
        onError={() => setErroredUrl(url)}
      />
    );
  }

  const colorClass = fallbackColorClass ?? (isDarkMode ? 'text-slate-400' : 'text-slate-500');
  return (
    <span
      role="img"
      aria-label={`${safeName} avatar`}
      className={`${fallbackClassName} ${colorClass}`}
    >
      {getInitials(safeName)}
    </span>
  );
});
