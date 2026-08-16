# Новосибирск-2035

Небольшой независимый editorial project о возможных сценариях развития Новосибирска и экспериментальный Markdown publishing pipeline.

## Архитектура

```text
content/articles/*.md
        ↓
custom Node.js builder
        ↓
static HTML/CSS + sitemap + robots
        ↓
dist/
        ↓
Netlify
```

В проекте нет static-site framework, клиентского UI framework, CMS, базы данных и backend. Архитектурные требования зафиксированы в [docs/MVP_SPEC.md](docs/MVP_SPEC.md), формат статей — в [docs/CONTENT_CONTRACT.md](docs/CONTENT_CONTRACT.md).

## Локальный запуск

Требуется Node.js 22 или новее.

```bash
npm install
npm run check
npm run build
npx serve dist
```

После сборки сайт находится в `dist/`.

## Работа с материалами

Добавьте файл `content/articles/<slug>.md` по примеру из content contract; front matter поле `slug` должно совпадать с именем файла. Builder найдёт его автоматически. Изменение существующего материала требует редактирования только его `.md`.

- `draft: false` — материал публикуется;
- `draft: true` — материал валидируется, но отсутствует в production build;
- `featured: true` — материал может стать главным на главной странице;
- шесть новейших опубликованных материалов автоматически появляются на главной.

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run validate` | Проверяет имена файлов, front matter и Markdown |
| `npm test` | Запускает минимальные тесты контракта и pipeline |
| `npm run build` | Создаёт чистый production output в `dist/` |
| `npm run verify` | Проверяет обязательные файлы и внутренние ссылки в `dist/` |
| `npm run check` | Последовательно запускает validation, тесты, build и verification |

## Netlify

Конфигурация уже находится в `netlify.toml`: build command — `npm run build`, publish directory — `dist`. Netlify передаёт основной URL через переменную `URL`; для локальной сборки абсолютные URL sitemap можно переопределить через `SITE_URL`.
