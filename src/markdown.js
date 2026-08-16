import { marked } from 'marked';
import { ContentValidationError } from './content.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function isSafeLink(href) {
  const value = String(href || '').trim();
  if (value === '' || value.startsWith('#') || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) {
    return true;
  }

  try {
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isValidArticleImage(href, slug) {
  const value = String(href || '').trim();
  if (!value.startsWith('/')) return false;

  try {
    const url = new URL(value, 'https://content.invalid');
    const directory = `/images/articles/${slug}/`;
    return url.origin === 'https://content.invalid'
      && url.pathname.startsWith(directory)
      && url.pathname.length > directory.length;
  } catch {
    return false;
  }
}

export function renderMarkdown(article) {
  const errors = [];
  const tokens = marked.lexer(article.body, { gfm: true });

  marked.walkTokens(tokens, (token) => {
    if (token.type === 'html') {
      errors.push('сырой HTML в Markdown запрещён');
    }

    if (token.type === 'heading' && token.depth === 1) {
      errors.push('заголовок первого уровня запрещён: H1 создаётся из front matter title');
    }

    if (token.type === 'link' && !isSafeLink(token.href)) {
      errors.push(`небезопасный URL в Markdown: ${token.href}`);
    }

    if (token.type === 'image' && !isValidArticleImage(token.href, article.slug)) {
      errors.push(`изображение должно находиться в /images/articles/${article.slug}/: ${token.href}`);
    }

    if (token.type === 'image' && String(token.text || '').trim() === '') {
      errors.push('изображение должно иметь непустой alt-текст');
    }
  });

  if (errors.length > 0) {
    throw new ContentValidationError(article.sourcePath, [...new Set(errors)]);
  }

  return marked.parser(tokens, { gfm: true });
}

export function estimateReadingMinutes(markdown) {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?(?:\[[^\]]*\])\([^)]*\)/g, ' ')
    .replace(/[#>*_~|-]/g, ' ');
  const words = plainText.match(/[\p{L}\p{N}]+/gu) || [];
  return Math.max(1, Math.ceil(words.length / 180));
}
