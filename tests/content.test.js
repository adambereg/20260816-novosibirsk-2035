import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  assertUniqueSlugs,
  ContentValidationError,
  validateArticle,
  validateArticleAssets,
} from '../src/content.js';
import { renderMarkdown } from '../src/markdown.js';
import { renderArticle, renderArticlesIndex, renderHome } from '../src/render.js';

const validData = {
  title: 'Тестовый материал',
  slug: 'test-article',
  description: 'Короткое описание тестового материала.',
  publishedAt: '2026-08-16',
  category: 'Тест',
  featured: false,
  draft: false,
};

function createArticle({ data = validData, body = '## Подзаголовок\n\nТекст материала.', filenameSlug = data.slug } = {}) {
  return validateArticle({
    data,
    body,
    filenameSlug,
    filePath: `${filenameSlug}.md`,
  });
}

async function createPublicFixture(t, article, { includeCover = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'novosibirsk-2035-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const publicDirectory = path.join(root, 'public');
  await mkdir(publicDirectory, { recursive: true });

  if (includeCover) {
    const coverFile = path.join(publicDirectory, ...article.cover.split('/').filter(Boolean));
    await mkdir(path.dirname(coverFile), { recursive: true });
    await writeFile(coverFile, 'test image');
  }

  return publicDirectory;
}

test('content contract принимает корректную статью', () => {
  const article = createArticle();

  assert.equal(article.slug, 'test-article');
  assert.equal(article.publishedAt, '2026-08-16');
  assert.equal(article.draft, false);
});

test('content contract отклоняет неверный slug', () => {
  assert.throws(() => createArticle({
    data: { ...validData, slug: 'Bad_Slug' },
    filenameSlug: 'Bad_Slug',
  }), (error) => {
    assert.ok(error instanceof ContentValidationError);
    assert.match(error.message, /поле "slug"/);
    return true;
  });
});

test('content contract отклоняет несовпадение filename и slug', () => {
  assert.throws(() => createArticle({ filenameSlug: 'different-filename' }), (error) => {
    assert.ok(error instanceof ContentValidationError);
    assert.match(error.message, /имя файла "different-filename" должно совпадать/);
    return true;
  });
});

test('content contract отклоняет duplicate slug', () => {
  assert.throws(() => assertUniqueSlugs([
    { slug: 'same-slug', sourcePath: 'first.md' },
    { slug: 'same-slug', sourcePath: 'second.md' },
  ]), (error) => {
    assert.ok(error instanceof ContentValidationError);
    assert.match(error.message, /duplicate slug "same-slug"/);
    return true;
  });
});

test('content contract отклоняет неизвестное front matter поле', () => {
  assert.throws(() => createArticle({
    data: { ...validData, futureField: true },
  }), (error) => {
    assert.ok(error instanceof ContentValidationError);
    assert.match(error.message, /неизвестное front matter поле/);
    return true;
  });
});

test('content contract принимает cover с существующим локальным файлом', async (t) => {
  const article = createArticle({
    data: {
      ...validData,
      cover: '/images/articles/test-article/cover.webp',
      coverAlt: 'Зимняя улица Новосибирска',
    },
  });
  const publicDirectory = await createPublicFixture(t, article);

  await assert.doesNotReject(validateArticleAssets([article], publicDirectory));
});

test('content contract отклоняет cover без coverAlt', () => {
  assert.throws(() => createArticle({
    data: {
      ...validData,
      cover: '/images/articles/test-article/cover.webp',
    },
  }), /поле "coverAlt" должно быть непустой строкой/);
});

test('content contract отклоняет cover вне каталога статьи', () => {
  assert.throws(() => createArticle({
    data: {
      ...validData,
      cover: '/images/articles/another-article/cover.webp',
      coverAlt: 'Изображение',
    },
  }), /поле "cover" должно указывать на файл внутри \/images\/articles\/test-article\//);

  assert.throws(() => createArticle({
    data: {
      ...validData,
      cover: 'https://example.test/cover.webp',
      coverAlt: 'Изображение',
    },
  }), /поле "cover" должно указывать на файл внутри/);
});

test('content contract отклоняет отсутствующий cover файл', async (t) => {
  const article = createArticle({
    data: {
      ...validData,
      cover: '/images/articles/test-article/cover.webp',
      coverAlt: 'Изображение',
    },
  });
  const publicDirectory = await createPublicFixture(t, article, { includeCover: false });

  await assert.rejects(validateArticleAssets([article], publicDirectory), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /cover файл не найден в public/);
    return true;
  });
});

test('Markdown renderer изолированно отклоняет raw HTML', () => {
  const article = createArticle({
    body: 'Обычный текст.\n\n<img src="x" onerror="alert(1)">',
  });

  assert.throws(() => renderMarkdown(article), (error) => {
    assert.ok(error instanceof ContentValidationError);
    assert.match(error.message, /сырой HTML в Markdown запрещён/);
    return true;
  });
});

test('Markdown renderer отклоняет H1 и небезопасные ссылки', () => {
  const article = createArticle({
    body: '# Лишний H1\n\n[ссылка](javascript:alert(1))',
  });

  assert.throws(() => renderMarkdown(article), ContentValidationError);
});

test('Markdown images соблюдают article image convention', () => {
  const validImage = createArticle({
    body: '![Улица зимой](/images/articles/test-article/winter-street.jpg)',
  });
  assert.match(renderMarkdown(validImage), /src="\/images\/articles\/test-article\/winter-street.jpg"/);

  const externalImage = createArticle({
    body: '![Улица](https://example.test/street.jpg)',
  });
  assert.throws(() => renderMarkdown(externalImage), /изображение должно находиться/);

  const anotherArticleImage = createArticle({
    body: '![Улица](/images/articles/another-article/street.jpg)',
  });
  assert.throws(() => renderMarkdown(anotherArticleImage), /изображение должно находиться/);

  const missingAlt = createArticle({
    body: '![](/images/articles/test-article/street.jpg)',
  });
  assert.throws(() => renderMarkdown(missingAlt), /непустой alt-текст/);
});

test('статья без cover продолжает собираться без placeholder', () => {
  const html = renderArticle(createArticle(), [], 'https://example.test');

  assert.doesNotMatch(html, /class="article-cover"/);
  assert.doesNotMatch(html, /property="og:image"/);
});

test('cover рендерится в статье, карточках и Open Graph metadata', () => {
  const article = createArticle({
    data: {
      ...validData,
      cover: '/images/articles/test-article/cover.webp',
      coverAlt: 'Зимняя улица Новосибирска',
    },
  });
  const articleHtml = renderArticle(article, [], 'https://example.test');
  const homepage = renderHome([article], 'https://example.test');
  const archive = renderArticlesIndex([article], 'https://example.test');

  assert.match(articleHtml, /class="article-cover"[\s\S]*src="\/images\/articles\/test-article\/cover\.webp"/);
  assert.match(articleHtml, /property="og:image" content="https:\/\/example\.test\/images\/articles\/test-article\/cover\.webp"/);
  assert.match(homepage, /class="lead-cover"[\s\S]*src="\/images\/articles\/test-article\/cover\.webp"/);
  assert.match(archive, /class="card-cover"[\s\S]*src="\/images\/articles\/test-article\/cover\.webp"/);
});

test('plain-text front matter metadata экранируется в generated HTML', () => {
  const article = createArticle({
    data: {
      ...validData,
      title: '<img src=x onerror=alert(1)>',
      description: '<script>alert("description")</script>',
      category: '<b>Категория</b>',
    },
  });
  const html = renderArticle(article, [], 'https://example.test');

  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert\("description"\)<\/script>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;b&gt;Категория&lt;\/b&gt;/);
  assert.match(html, /\\u003cscript>alert/);
});
