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
  // Try headshotUrl first, then imageUrl — a caller can pass both as
  // independent sources, and a broken first source shouldn't skip straight
  // to initials while a second candidate is still available.
  const candidates = [headshotUrl, imageUrl].filter((u): u is string => !!u);
  // Track WHICH urls failed rather than a boolean: a new url (e.g. a
  // different player, or a corrected headshot) is retried automatically
  // without needing an effect-based reset that briefly renders the wrong
  // state.
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set());

  const url = candidates.find((u) => !failedUrls.has(u));

  if (url) {
    return (
      <img
        key={url}
        src={url}
        alt={`${safeName} headshot`}
        className={className}
        loading="lazy"
        onError={() => setFailedUrls((prev) => new Set(prev).add(url))}
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
