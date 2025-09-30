TERMINALS/RUN RULES

1) Любые long-running процессы (dev/start/watch/serve) запускай ТОЛЬКО через VS Code Tasks из .vscode/tasks.json:
   - "dev:client (vite)"
   - "dev:server (node index.js)"
   - "dev:all (separate terminals)"

2) НИКОГДА не выполняй команды в терминале, где крутится сервер.

3) Все API-запросы и проверки эндпоинтов (curl, httpie, newman, k6, wrk, autocannon и т.п.)
   — выполняй ТОЛЬКО в отдельном терминале:
   - либо создавай новый терминал (Terminal → New Terminal),
   - либо запускай VS Code task: "http:terminal (pwsh)" или "http:terminal (bash)".
   Каждый такой запуск должен открываться в НОВОМ терминале (panel=new).

4) Для одноразовых утилит (миграции/линтеры/скрипты) — новый терминал или отдельный task.
