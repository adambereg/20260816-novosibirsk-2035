import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles } from '../src/content.js';
import { renderMarkdown } from '../src/markdown.js';
import { render404, renderAbout, renderArticle, renderArticlesIndex, renderHome } from '../src/render.js';
import { resolveSiteUrl } from '../src/site.js';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, '..');

function assertSafeOutput(rootDirectory, outputDirectory) {
  const root = path.resolve(rootDirectory);
  const output = path.resolve(outputDirectory);
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
    throw new Error(`Отказ от очистки неожиданного output directory: ${output}`);
  }
}

async function writePage(outputDirectory, route, html) {
  const target = route === '/'
    ? path.join(outputDirectory, 'index.html')
    : path.join(outputDirectory, route.replace(/^\//, ''), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function createSitemap(articles, siteUrl) {
  const pages = [
    { pathname: '/', changefreq: 'weekly', priority: '1.0' },
    { pathname: '/articles/', changefreq: 'weekly', priority: '0.9' },
    { pathname: '/about/', changefreq: 'monthly', priority: '0.5' },
    ...articles.map((article) => ({
      pathname: `/articles/${article.slug}/`,
      lastmod: article.publishedAt,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];

  const urls = pages.map((page) => `  <url>
    <loc>${escapeXml(`${siteUrl}${page.pathname}`)}</loc>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>\n    ` : ''}<changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export async function buildSite({ rootDirectory = projectRoot, siteUrl = resolveSiteUrl() } = {}) {
  const root = path.resolve(rootDirectory);
  const outputDirectory = path.join(root, 'dist');
  const contentDirectory = path.join(root, 'content', 'articles');
  const publicDirectory = path.join(root, 'public');

  assertSafeOutput(root, outputDirectory);
  const allArticles = await loadArticles(contentDirectory);
  for (const article of allArticles) {
    renderMarkdown(article);
  }
  const published = allArticles.filter((article) => !article.draft);
  const drafts = allArticles.filter((article) => article.draft);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(publicDirectory, outputDirectory, { recursive: true });

  await writePage(outputDirectory, '/', renderHome(published, siteUrl));
  await writePage(outputDirectory, '/articles/', renderArticlesIndex(published, siteUrl));
  await writePage(outputDirectory, '/about/', renderAbout(siteUrl));
  await writeFile(path.join(outputDirectory, '404.html'), render404(siteUrl), 'utf8');

  for (const article of published) {
    const related = published
      .filter((candidate) => candidate.slug !== article.slug)
      .sort((a, b) => {
        const categoryScore = Number(b.category === article.category) - Number(a.category === article.category);
        return categoryScore || b.publishedAt.localeCompare(a.publishedAt);
      })
      .slice(0, 2);
    await writePage(outputDirectory, `/articles/${article.slug}/`, renderArticle(article, related, siteUrl));
  }

  await writeFile(path.join(outputDirectory, 'sitemap.xml'), createSitemap(published, siteUrl), 'utf8');
  await writeFile(
    path.join(outputDirectory, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
    'utf8',
  );

  return {
    outputDirectory,
    published,
    drafts,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite();
    console.log(`Production build готов: ${result.published.length} опубликовано, ${result.drafts.length} черновик(ов).`);
    console.log(`Output: ${result.outputDirectory}`);
  } catch (error) {
    if (error instanceof AggregateError) {
      for (const nestedError of error.errors) {
        console.error(nestedError.message);
      }
    } else {
      console.error(error.stack || error.message);
    }
    process.exitCode = 1;
  }
}
