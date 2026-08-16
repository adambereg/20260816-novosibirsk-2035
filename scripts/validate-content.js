import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles, validateArticleAssets } from '../src/content.js';
import { renderMarkdown } from '../src/markdown.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const articles = await loadArticles(path.join(projectRoot, 'content', 'articles'));
  for (const article of articles) {
    renderMarkdown(article);
  }
  await validateArticleAssets(articles, path.join(projectRoot, 'public'));
  const published = articles.filter((article) => !article.draft).length;
  const drafts = articles.length - published;
  console.log(`Content valid: ${articles.length} материал(а), ${published} опубликовано, ${drafts} черновик(ов).`);
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
