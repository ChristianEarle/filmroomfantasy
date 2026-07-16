import type { PlayerNews } from '../services';

const MAX_LENGTH = 150;

/**
 * Returns a trimmed, validated http(s) URL, or null when the value is
 * missing, uses another protocol (e.g. javascript:), or fails to parse.
 */
export function getSafeNewsUrl(rawUrl: string | null | undefined): string | null {
  const url = rawUrl?.trim();
  if (!url || !(url.startsWith('https://') || url.startsWith('http://'))) return null;
  try {
    new URL(url);
    return url;
  } catch {
    return null;
  }
}

interface NewsSnippetProps {
  item: Pick<PlayerNews, 'content' | 'headline' | 'sourceUrl' | 'aiSummary'>;
  className?: string;
}

export function NewsSnippet({ item, className = '' }: NewsSnippetProps) {
  // Prefer AI summary when available (fantasy-relevant); otherwise content or headline
  const text = item.aiSummary || item.content || item.headline || '';
  const isLong = text.length > MAX_LENGTH;
  const displayText = isLong ? text.slice(0, MAX_LENGTH).trim() + '…' : text;
  const sourceUrl = getSafeNewsUrl(item.sourceUrl);

  if (sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} hover:underline`}
        onClick={(e) => e.stopPropagation()}
      >
        {displayText}
      </a>
    );
  }

  return <span className={className}>{displayText}</span>;
}
