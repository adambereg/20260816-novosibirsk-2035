import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertUniqueSlugs, ContentValidationError, validateArticle } from '../src/content.js';
import { renderMarkdown } from '../src/markdown.js';
import { renderArticle } from '../src/render.js';

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

