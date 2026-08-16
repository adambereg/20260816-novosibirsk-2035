import { estimateReadingMinutes, renderMarkdown } from './markdown.js';
import { site } from './site.js';

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(date) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}

function navLink(href, label, current) {
  const active = current === href ? ' aria-current="page"' : '';
  return `<a href="${href}"${active}>${label}</a>`;
}

function absoluteUrl(siteUrl, pathname) {
  return `${siteUrl}${pathname}`;
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function layout({ title, description, pathname, current, content, siteUrl, type = 'website', publishedTime, structuredData, noindex = false }) {
  const fullTitle = title === site.name ? title : `${title} — ${site.name}`;
  const canonical = absoluteUrl(siteUrl, pathname);
  const articleMeta = publishedTime
    ? `<meta property="article:published_time" content="${escapeHtml(publishedTime)}">`
    : '';
  const robotsMeta = noindex ? '<meta name="robots" content="noindex, follow">' : '';
  const jsonLd = structuredData
    ? `<script type="application/ld+json">${safeJson(structuredData)}</script>`
    : '';

  return `<!doctype html>
<html lang="${site.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${robotsMeta}
  <link rel="canonical" href="${canonical}">
  <meta property="og:locale" content="${site.locale}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${site.name}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  ${articleMeta}
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#f1efe7">
  <link rel="stylesheet" href="/styles.css">
  ${jsonLd}
</head>
<body>
  <a class="skip-link" href="#content">К содержанию</a>
  <header class="site-header">
    <a class="wordmark" href="/" aria-label="Новосибирск-2035, главная">
      <span>НСК</span><b>2035</b>
    </a>
    <nav class="site-nav" aria-label="Основная навигация">
      ${navLink('/articles/', 'Материалы', current)}
      ${navLink('/about/', 'О проекте', current)}
    </nav>
  </header>
  <main id="content">${content}</main>
  <footer class="site-footer">
    <p class="footer-mark">НСК—2035</p>
    <p>Независимый разговор о городе,<br>в котором нам предстоит жить.</p>
    <p class="footer-meta">Новосибирск · 2026</p>
  </footer>
</body>
</html>`;
}

function articleCard(article, className = '') {
  return `<article class="article-card ${className}">
    <p class="card-meta"><span>${escapeHtml(article.category)}</span><time datetime="${article.publishedAt}">${formatDate(article.publishedAt)}</time></p>
    <h3><a href="/articles/${article.slug}/">${escapeHtml(article.title)}</a></h3>
    <p>${escapeHtml(article.description)}</p>
    <a class="text-link" href="/articles/${article.slug}/" aria-label="Читать: ${escapeHtml(article.title)}">Читать материал <span aria-hidden="true">↗</span></a>
  </article>`;
}

export function renderHome(articles, siteUrl) {
  const latest = articles.slice(0, 6);
  const lead = articles.find((article) => article.featured) || articles[0];
  const rest = latest.filter((article) => article.slug !== lead?.slug);

  const leadBlock = lead
    ? `<article class="lead-story">
        <div class="lead-number" aria-hidden="true">01</div>
        <div class="lead-copy">
          <p class="section-label">В фокусе · ${escapeHtml(lead.category)}</p>
          <h2><a href="/articles/${lead.slug}/">${escapeHtml(lead.title)}</a></h2>
          <p>${escapeHtml(lead.description)}</p>
          <a class="button-link" href="/articles/${lead.slug}/">Открыть материал <span aria-hidden="true">→</span></a>
        </div>
      </article>`
    : '<p class="empty-state">Первый материал готовится к публикации.</p>';

  const content = `
    <section class="hero">
      <div class="hero-kicker">Независимый редакционный проект <span>Выпуск 00</span></div>
      <h1><span>Новосибирск</span><strong>2035</strong></h1>
      <div class="hero-bottom">
        <p>Как может измениться город — и какие решения нужно обсуждать уже сегодня.</p>
        <p class="coordinates">55.0084° N<br>82.9357° E</p>
      </div>
    </section>
    <section class="focus-section" aria-labelledby="focus-title">
      <div class="section-heading">
        <p id="focus-title">Главная тема</p>
        <span>${String(articles.length).padStart(2, '0')} опубликовано</span>
      </div>
      ${leadBlock}
    </section>
    <section class="latest-section" aria-labelledby="latest-title">
      <div class="section-heading">
        <h2 id="latest-title">Последние материалы</h2>
        <a href="/articles/">Все материалы →</a>
      </div>
      <div class="article-grid">
        ${rest.map((article) => articleCard(article)).join('\n') || '<p class="empty-state">Другие материалы скоро появятся.</p>'}
      </div>
    </section>
    <section class="manifesto">
      <p class="section-label">Зачем этот проект</p>
      <blockquote>Будущее города — не картинка из презентации. Это последовательность решений, которые можно увидеть, обсудить и изменить.</blockquote>
      <a class="text-link light" href="/about/">О редакционном подходе <span aria-hidden="true">↗</span></a>
    </section>`;

  return layout({
    title: site.name,
    description: site.description,
    pathname: '/',
    current: '/',
    content,
    siteUrl,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.name,
      url: `${siteUrl}/`,
      description: site.description,
      inLanguage: site.language,
    },
  });
}

export function renderArticlesIndex(articles, siteUrl) {
  const cards = articles.map((article, index) => `
    <div class="archive-row">
      <span class="archive-number">${String(index + 1).padStart(2, '0')}</span>
      ${articleCard(article, 'archive-card')}
    </div>`).join('\n');

  const content = `
    <header class="page-intro">
      <p class="eyebrow">Архив наблюдений</p>
      <h1>Материалы</h1>
      <p>Городская среда, мобильность, климат и экономика — без обещаний из будущего, но с вниманием к решениям настоящего.</p>
    </header>
    <section class="archive" aria-label="Все материалы">
      ${cards || '<p class="empty-state">Пока нет опубликованных материалов.</p>'}
    </section>`;

  return layout({
    title: 'Материалы',
    description: 'Все материалы проекта «Новосибирск-2035» о возможных сценариях развития города.',
    pathname: '/articles/',
    current: '/articles/',
    content,
    siteUrl,
  });
}

export function renderArticle(article, related, siteUrl) {
  const body = renderMarkdown(article);
  const readingMinutes = estimateReadingMinutes(article.body);
  const relatedBlock = related.length > 0
    ? `<aside class="related" aria-labelledby="related-title">
        <div class="section-heading"><h2 id="related-title">Читайте также</h2></div>
        <div class="article-grid">${related.map((item) => articleCard(item)).join('\n')}</div>
      </aside>`
    : '';

  const content = `
    <article class="article-page">
      <header class="article-header">
        <a class="back-link" href="/articles/">← Все материалы</a>
        <p class="eyebrow">${escapeHtml(article.category)}</p>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="article-deck">${escapeHtml(article.description)}</p>
        <div class="article-byline">
          <time datetime="${article.publishedAt}">${formatDate(article.publishedAt)}</time>
          <span>${readingMinutes} мин чтения</span>
        </div>
      </header>
      <div class="article-rule" aria-hidden="true"><span>${article.publishedAt.slice(0, 4)}</span></div>
      <div class="prose">${body}</div>
    </article>
    ${relatedBlock}`;

  return layout({
    title: article.title,
    description: article.description,
    pathname: `/articles/${article.slug}/`,
    current: '/articles/',
    content,
    siteUrl,
    type: 'article',
    publishedTime: article.publishedAt,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      mainEntityOfPage: `${siteUrl}/articles/${article.slug}/`,
      publisher: {
        '@type': 'Organization',
        name: site.name,
      },
      inLanguage: site.language,
    },
  });
}

export function renderAbout(siteUrl) {
  const content = `
    <header class="page-intro about-intro">
      <p class="eyebrow">О проекте</p>
      <h1>Город будущего начинается с точного разговора о настоящем.</h1>
    </header>
    <section class="about-grid">
      <div class="about-index">00<br>→<br>35</div>
      <div class="prose about-copy">
        <p class="lead-paragraph">«Новосибирск-2035» — независимый редакционный проект о том, каким может стать большой сибирский город в ближайшее десятилетие.</p>
        <h2>Что мы рассматриваем</h2>
        <p>Транспорт и районы, климат и общественные пространства, локальную экономику и повседневные городские привычки. Нас интересуют не абстрактные прогнозы, а решения, следы которых уже видны.</p>
        <h2>Как устроена публикация</h2>
        <p>Каждый материал хранится в открытом текстовом формате Markdown. Статический сайт собирается автоматически: без CMS, базы данных и скрытого редакционного слоя.</p>
        <h2>Статус</h2>
        <p>Версия 0.1 — технический и редакционный прототип. Представленные тексты проверяют формат и не являются исчерпывающей городской программой.</p>
      </div>
    </section>`;

  return layout({
    title: 'О проекте',
    description: 'Зачем существует «Новосибирск-2035» и как устроен независимый редакционный проект.',
    pathname: '/about/',
    current: '/about/',
    content,
    siteUrl,
  });
}

export function render404(siteUrl) {
  const content = `
    <section class="not-found">
      <p class="error-code">404</p>
      <div>
        <p class="eyebrow">Маршрут не найден</p>
        <h1>Эта улица пока не построена.</h1>
        <p>Вернитесь на главную или откройте архив опубликованных материалов.</p>
        <div class="error-links">
          <a class="button-link" href="/">На главную →</a>
          <a class="text-link" href="/articles/">Все материалы ↗</a>
        </div>
      </div>
    </section>`;

  return layout({
    title: 'Страница не найдена',
    description: 'Запрошенная страница не найдена.',
    pathname: '/404.html',
    current: '',
    content,
    siteUrl,
    noindex: true,
  });
}
