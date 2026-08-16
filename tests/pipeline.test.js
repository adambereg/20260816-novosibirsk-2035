import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
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
  const markdownFiles = (await readdir(contentDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
  const expectedPublishedSlugs = articles
    .filter((article) => !article.draft)
    .map((article) => article.slug)
    .sort();
  const expectedDraftSlugs = articles
    .filter((article) => article.draft)
    .map((article) => article.slug)
    .sort();

  assert.equal(articles.length, markdownFiles.length);
  assert.deepEqual(result.published.map((article) => article.slug).sort(), expectedPublishedSlugs);
  assert.deepEqual(result.drafts.map((article) => article.slug).sort(), expectedDraftSlugs);
  for (const article of result.published) {
    const page = await readFile(path.join(projectRoot, 'dist', 'articles', article.slug, 'index.html'), 'utf8');
    assert.match(page, /<article class="article-page">/);
    assert.match(page, /<div class="prose">[\s\S]+<\/div>\s*<\/article>/);
  }
});

test('builder генерирует /articles/<slug>/ и добавляет URL в публичные индексы', async () => {
  const result = await buildPromise;
  const homepage = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const archive = await readFile(path.join(projectRoot, 'dist', 'articles', 'index.html'), 'utf8');
  const sitemap = await readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');
  const homepageSlugs = new Set(result.published.slice(0, 6).map((article) => article.slug));
  const lead = result.published.find((article) => article.featured) || result.published[0];
  if (lead) homepageSlugs.add(lead.slug);

  for (const article of result.published) {
    const url = `/articles/${article.slug}/`;
    if (homepageSlugs.has(article.slug)) {
      assert.match(homepage, new RegExp(url));
    } else {
      assert.doesNotMatch(homepage, new RegExp(url));
    }
    assert.match(archive, new RegExp(url));
    assert.match(sitemap, new RegExp(url));
  }
});

test('draft: true исключает статью, ссылки и sitemap entry из production build', async () => {
  const result = await buildPromise;
  const homepage = await readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8');
  const archive = await readFile(path.join(projectRoot, 'dist', 'articles', 'index.html'), 'utf8');
  const sitemap = await readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');

  assert.ok(result.drafts.length > 0, 'Нужен хотя бы один draft fixture для проверки исключения');
  for (const draft of result.drafts) {
    assert.doesNotMatch(homepage, new RegExp(draft.slug));
    assert.doesNotMatch(archive, new RegExp(draft.slug));
    assert.doesNotMatch(sitemap, new RegExp(draft.slug));
    await assert.rejects(
      access(path.join(projectRoot, 'dist', 'articles', draft.slug, 'index.html')),
      { code: 'ENOENT' },
    );
  }
});

test('published articles сортируются по publishedAt DESC', async () => {
  const articles = await loadArticles(contentDirectory);
  const result = await buildPromise;
  const expectedSlugs = articles
    .filter((article) => !article.draft)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug, 'en'))
    .map((article) => article.slug);
  const actualSlugs = result.published.map((article) => article.slug);

  assert.deepEqual(actualSlugs, expectedSlugs);
});
