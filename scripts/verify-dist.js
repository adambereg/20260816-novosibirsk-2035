import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles } from '../src/content.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'dist');

const requiredFiles = [
  'index.html',
  'articles/index.html',
  'about/index.html',
  '404.html',
  'styles.css',
  'sitemap.xml',
  'robots.txt',
];

function targetForUrl(url) {
  const clean = url.split(/[?#]/, 1)[0];
  if (clean === '/') return 'index.html';
  const withoutLeadingSlash = clean.replace(/^\//, '');
  return clean.endsWith('/')
    ? path.join(withoutLeadingSlash, 'index.html')
    : withoutLeadingSlash;
}

for (const file of requiredFiles) {
  await access(path.join(outputDirectory, file));
}

const articles = await loadArticles(path.join(projectRoot, 'content', 'articles'));
for (const article of articles) {
  const articleOutput = path.join(outputDirectory, 'articles', article.slug, 'index.html');
  if (article.draft) {
    try {
      await access(articleOutput);
      throw new Error(`Черновик попал в production output: ${article.slug}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  } else {
    await access(articleOutput);
  }
}

const htmlFiles = [];
async function collectHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectHtml(absolute);
    if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(absolute);
  }
}
await collectHtml(outputDirectory);

const brokenLinks = [];
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const url of urls) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    try {
      await access(path.join(outputDirectory, targetForUrl(url)));
    } catch {
      brokenLinks.push(`${path.relative(outputDirectory, htmlFile)} → ${url}`);
    }
  }
}

if (brokenLinks.length > 0) {
  throw new Error(`Найдены битые внутренние ссылки:\n${brokenLinks.map((link) => `  - ${link}`).join('\n')}`);
}

console.log(`dist verified: ${htmlFiles.length} HTML-страниц, обязательные файлы и внутренние ссылки в порядке.`);

