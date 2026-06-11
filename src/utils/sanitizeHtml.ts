import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML before injecting it via dangerouslySetInnerHTML.
 *
 * Article content is authored as raw HTML and stored server-side without
 * sanitization, so it must be cleaned on render to prevent stored XSS (e.g.
 * `<img onerror=...>` or `javascript:` URLs stealing the auth token). We keep a
 * conservative allowlist that covers normal article formatting and strip all
 * event handlers / scriptable attributes.
 */
export function sanitizeArticleHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'hr', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height', 'class', 'colspan', 'rowspan'],
    // Block javascript:/data: URLs etc.; allow only safe schemes for links/images.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
  });
}
