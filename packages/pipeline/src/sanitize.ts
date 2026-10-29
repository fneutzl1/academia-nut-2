import sanitizeHtml from 'sanitize-html';

// Same allow-list as the legacy explore-api SanitizeContent
const ALLOWED_TAGS = ['h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li', 'b', 'i',
  'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td',
  'pre', 'iframe'];

export function sanitizeContent(html: unknown): string {
  if (typeof html !== 'string' || html === '') return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    exclusiveFilter: (frame) => frame.tag === 'p' && !frame.text.trim(),
  });
}

/** Lowercase, accent-free, dash-separated slug (matches legacy makeSlug output). */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[·/_,:;]/g, '-')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
