
# 🧑‍💻 SMETA360-2 — Инструкции для AI Coding Agents

## 🏗️ Архитектура и ключевые компоненты
- **Frontend**: React + Vite (`src/`).
   - Компоненты: `src/components/` (Material-UI, Ant Design)
   - Страницы: `src/pages/`, секции: `src/sections/`
   - API-клиенты: `src/api/` (auth, database, проекты)
   - Контексты: `src/contexts/` (тенант, аутентификация)
- **Backend**: Node.js + Express (`server/`).
   - Основной сервер: `server/index.js`
   - Контроллеры: `server/controllers/`
   - Сервисы: `server/services/`
   - Миграции: `server/migrations/`
   - Работа с БД: `server/database.js` (PostgreSQL, Aiven Cloud)
- **Тесты**: `tests/` (Vitest — backend, Playwright — e2e)
- **Документация**: `docs/`, `PROJECT_DOCUMENTATION.md`, `README.md`

## 🚦 Терминалы и запуск
- Все долгоживущие процессы (dev/start/watch/serve) — ТОЛЬКО через VS Code Tasks из `.vscode/tasks.json`:
   - "dev:client (vite)"
   - "dev:server (node index.js)"
   - "dev:all (separate terminals)"
- Не выполняй команды в терминале, где работает сервер.
- API-запросы и тесты — всегда в отдельном терминале или через VS Code task "http:terminal (bash/pwsh)" (panel=new).
- Одноразовые утилиты (миграции, линтеры, скрипты) — отдельный терминал или task.

## 🧩 Конвенции и паттерны
- React-компоненты: PascalCase, хуки — camelCase с префиксом `use`, утилиты — camelCase.
- API-клиенты: camelCase, разделение по сущностям (`authService.js`, `projectsApi.js`).
- Контексты: отдельные провайдеры для аутентификации и тенантов.
- Backend: контроллеры и сервисы разделены, миграции — отдельная папка.
- Все переменные окружения для фронта — через префикс `VITE_` (`src/.env.local`).
- Для backend — `server/.env` (см. шаблон `server/.env.template`).

## 🔗 Интеграции и взаимодействие
- База данных: PostgreSQL (Aiven Cloud), SSL/TLS, RLS включён.
- API: Express, JWT, CORS, тенант-контекст.
- CI/CD: GitHub Actions (`.github/workflows/prod.yml`), auto-deploy на push/merge.
- Docker: поддержка через `Dockerfile` и `docker-compose.yml`.

## 🧪 Тестирование
- Backend: Vitest (`tests/backend/`), запуск через task.
- E2E: Playwright (`tests/e2e/`), запуск через task.
- Контрактные тесты: Zod, тесты кэша — отдельные скрипты.

## 📚 Быстрый старт и примеры
- Для запуска dev-окружения: используйте VS Code Tasks.
- Для анализа маршрутов: `node dev-utils/routes-map.mjs`
- Для деплоя: см. секцию "Деплой" в `README.md` и `PROJECT_DOCUMENTATION.md`.

## 📌 Важные файлы и директории
- `src/`, `server/`, `tests/`, `docs/`, `dev-utils/`, `.github/`, `PROJECT_DOCUMENTATION.md`, `README.md`

---
Если что-то неясно или отсутствует — уточните у пользователя для доработки инструкции.
