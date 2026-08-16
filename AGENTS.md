# AGENTS.md

## Source of Truth

Перед любыми изменениями прочитайте `docs/MVP_SPEC.md` полностью. Формат контента определён в `docs/CONTENT_CONTRACT.md`. Если эти документы конфликтуют с обычными инженерными предпочтениями, следуйте документам.

## Architecture guardrails

- Сохраняйте pipeline `Markdown → custom Node.js builder → static HTML/CSS → dist/ → Netlify`.
- Не добавляйте static-site framework, UI framework, CMS, database или backend.
- Не реализуйте Telegram Bot / Mini App без отдельного запроса.
- Не редактируйте `dist/` вручную: это генерируемый и игнорируемый каталог.
- Не добавляйте зависимость, если небольшая явная функция решает задачу понятно и надёжно.

## Content workflow

- Статьи находятся только в `content/articles/<slug>.md`.
- Не добавляйте статьи в JavaScript-конфигурацию или шаблоны.
- Сохраняйте front matter совместимым с `docs/CONTENT_CONTRACT.md`.
- `draft: true` всегда должен исключать материал из production output.

## Required verification

После изменений выполните:

```bash
npm run check
npm run build
```

Не завершайте работу с ошибками validation, тестов, build или проверки `dist/`.

