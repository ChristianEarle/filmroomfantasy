import type { PlayerNews } from '../services';

const MAX_LENGTH = 150;

interface NewsSnippetProps {
  item: Pick<PlayerNews, 'content' | 'headline' | 'sourceUrl' | 'aiSummary'>;
  className?: string;
}

export function NewsSnippet({ item, className = '' }: NewsSnippetProps) {
  // Prefer AI summary when available (fantasy-relevant); otherwise content or headline
  const text = item.aiSummary || item.content || item.headline || '';
  const isLong = text.length > MAX_LENGTH;
  const displayText = isLong ? text.slice(0, MAX_LENGTH).trim() + '…' : text;
  const sourceUrl = item.sourceUrl?.trim();
  // Validate URL: must start with http(s):// and parse as a valid URL
  let hasLink = false;
  if (sourceUrl && (sourceUrl.startsWith('https://') || sourceUrl.startsWith('http://'))) {
    try {
      new URL(sourceUrl);
      hasLink = true;
    } catch {
      hasLink = false;
    }
  }

  if (hasLink) {
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
