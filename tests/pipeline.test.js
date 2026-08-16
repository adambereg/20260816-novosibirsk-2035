import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../scripts/build.js';
import { loadArticles } from '../src/content.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = path.join(projectRoot, 'content', 'articles');
const buildPromise = buildSite({ rootDirectory: projectRoot, siteUrl: 'https://example.test' });

test('builder обнаруживает и собирает валидные Markdown articles', async () => {
  const articles = await loadArticles(contentDirectory);
  const result = await buildPromise;

  assert.equal(articles.length, 3);
  assert.equal(result.published.length, 2);
  for (const article of result.published) {
    const page = await readFile(path.join(projectRoot, 'dist', 'articles', article.slug, 'index.html'), 'utf8');
    assert.match(page, /<article class="article-page">/);
    assert.match(page, /<div class="prose"><h2>/);
  }
});

test('builder генерирует /articles/<slug>/ и добавляет URL в публичные индексы', async () => {
  const result = await buildPromise;
  const homepage = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const archive = await readFile(path.join(projectRoot, 'dist', 'articles', 'index.html'), 'utf8');
  const sitemap = await readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');

  for (const article of result.published) {
    const url = `/articles/${article.slug}/`;
    assert.match(homepage, new RegExp(url));
    assert.match(archive, new RegExp(url));
    assert.match(sitemap, new RegExp(url));
  }
});

test('draft: true исключает статью, ссылки и sitemap entry из production build', async () => {
  const result = await buildPromise;
  const homepage = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const archive = await readFile(path.join(projectRoot, 'dist', 'articles', 'index.html'), 'utf8');
  const sitemap = await readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');
  const draft = result.drafts[0];

  assert.equal(result.drafts.length, 1);
  assert.doesNotMatch(homepage, new RegExp(draft.slug));
  assert.doesNotMatch(archive, new RegExp(draft.slug));
  assert.doesNotMatch(sitemap, new RegExp(draft.slug));
  await assert.rejects(
    access(path.join(projectRoot, 'dist', 'articles', draft.slug, 'index.html')),
    { code: 'ENOENT' },
  );
});

test('published articles сортируются по publishedAt DESC', async () => {
  const result = await buildPromise;
  const publishedDates = result.published.map((article) => article.publishedAt);

  assert.deepEqual(publishedDates, ['2026-08-16', '2026-08-10']);
});

