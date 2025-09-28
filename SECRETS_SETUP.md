# Настройка Secrets для подключения к базе данных

## GitHub Codespaces

Для работы с реальной базой данных в GitHub Codespaces:

1. Перейдите в **настройки репозитория** на GitHub
2. Откройте **Settings** → **Secrets and variables** → **Codespaces**
3. Нажмите **New repository secret**
4. Добавьте secret с именем `DB_URL` и строкой подключения к PostgreSQL

Пример строки подключения:
```
postgres://username:password@host:port/database?sslmode=require
```

Для Aiven Cloud:
```
postgres://username:password@hostname:port/database?sslmode=require
```

5. После добавления secret перезапустите Codespace или выполните команду:
```bash
bash .devcontainer/.devcontainer/bootstrap_env.sh
```

## Локальная разработка

Для локальной разработки просто отредактируйте файл `server/.env`:

```env
NODE_ENV=development
PORT=3002
DATABASE_URL=postgres://username:password@localhost:5432/database
PGSSLMODE=require
```

## Проверка подключения

После настройки secret запустите проект:
```bash
npm run dev
```

Если подключение к базе данных успешно, вы увидите сообщение:
```
✅ Подключение к PostgreSQL установлено
```

Если база данных недоступна, сервер будет работать в режиме статических данных.