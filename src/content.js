import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const ALLOWED_FIELDS = new Set([
  'title',
  'slug',
  'description',
  'publishedAt',
  'category',
  'featured',
  'draft',
  'cover',
  'coverAlt',
]);

const FIELD_LIMITS = {
  title: 120,
  description: 240,
  category: 60,
  coverAlt: 240,
};

export class ContentValidationError extends Error {
  constructor(filePath, messages) {
    const details = messages.map((message) => `  - ${message}`).join('\n');
    super(`Некорректный материал ${filePath}:\n${details}`);
    this.name = 'ContentValidationError';
    this.filePath = filePath;
    this.messages = messages;
  }
}

function validateString(data, field, errors) {
  const value = data[field];
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`поле "${field}" должно быть непустой строкой`);
    return;
  }

  if (value.length > FIELD_LIMITS[field]) {
    errors.push(`поле "${field}" длиннее ${FIELD_LIMITS[field]} символов`);
  }
}

function isRealIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function isArticleImagePath(value, slug) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }

  try {
    const url = new URL(value, 'https://content.invalid');
    const directory = `/images/articles/${slug}/`;
    return url.origin === 'https://content.invalid'
      && url.search === ''
      && url.hash === ''
      && url.pathname.startsWith(directory)
      && url.pathname.length > directory.length;
  } catch {
    return false;
  }
}

export function validateArticle({ data, body, filenameSlug, filePath }) {
  const errors = [];

  if (typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    errors.push('поле "slug" должно содержать только a-z, 0-9 и одиночные дефисы');
  }

  if (data.slug !== filenameSlug) {
    errors.push(`имя файла "${filenameSlug}" должно совпадать с front matter slug "${data.slug}"`);
  }

  for (const field of Object.keys(data)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`неизвестное front matter поле "${field}"`);
    }
  }

  for (const field of ['title', 'description', 'category']) {
    validateString(data, field, errors);
  }

  if (!isRealIsoDate(data.publishedAt)) {
    errors.push('поле "publishedAt" должно быть реальной датой-строкой в формате YYYY-MM-DD');
  }

  for (const field of ['featured', 'draft']) {
    if (typeof data[field] !== 'boolean') {
      errors.push(`поле "${field}" должно быть boolean: true или false`);
    }
  }

  if (data.cover !== undefined) {
    if (!isArticleImagePath(data.cover, data.slug)) {
      errors.push(`поле "cover" должно указывать на файл внутри /images/articles/${data.slug}/`);
    }

    validateString(data, 'coverAlt', errors);
  } else if (data.coverAlt !== undefined) {
    validateString(data, 'coverAlt', errors);
  }

  if (typeof body !== 'string' || body.trim() === '') {
    errors.push('Markdown body не должен быть пустым');
  }

  if (errors.length > 0) {
    throw new ContentValidationError(filePath, errors);
  }

  return {
    slug: data.slug,
    title: data.title.trim(),
    description: data.description.trim(),
    publishedAt: data.publishedAt,
    category: data.category.trim(),
    featured: data.featured,
    draft: data.draft,
    cover: data.cover?.trim(),
    coverAlt: data.coverAlt?.trim(),
    body: body.trim(),
    sourcePath: filePath,
  };
}

export async function validateArticleAssets(articles, publicDirectory) {
  const errors = [];

  for (const article of articles) {
    if (!article.cover) continue;

    const target = path.join(publicDirectory, ...article.cover.split('/').filter(Boolean));
    try {
      const file = await stat(target);
      if (!file.isFile()) throw new Error('not a file');
    } catch {
      errors.push(new ContentValidationError(article.sourcePath, [
        `cover файл не найден в public/: ${article.cover}`,
      ]));
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `Проверка файлов изображений завершилась с ошибками: ${errors.length}`);
  }
}

export function assertUniqueSlugs(articles) {
  const sourceBySlug = new Map();

  for (const article of articles) {
    const previousSource = sourceBySlug.get(article.slug);
    if (previousSource) {
      throw new ContentValidationError(article.sourcePath, [
        `duplicate slug "${article.slug}"; уже используется в ${previousSource}`,
      ]);
    }
    sourceBySlug.set(article.slug, article.sourcePath);
  }
}

export async function loadArticles(contentDirectory) {
  const entries = await readdir(contentDirectory, { withFileTypes: true });
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const articles = [];
  const errors = [];

  for (const filename of markdownFiles) {
    const filePath = path.join(contentDirectory, filename);
    try {
      const source = await readFile(filePath, 'utf8');
      const parsed = matter(source);
      articles.push(validateArticle({
        data: parsed.data,
        body: parsed.content,
        filenameSlug: path.basename(filename, '.md'),
        filePath,
      }));
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `Content validation завершилась с ошибками: ${errors.length}`);
  }

  assertUniqueSlugs(articles);
  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug, 'en'));
}
