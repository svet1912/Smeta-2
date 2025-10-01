// Общие настройки окружения тестов
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Важно: отключаем кэш/редис в тестах, чтобы тесты были детерминированы
process.env.CACHE_ENABLED = 'false';
process.env.CACHE_MATERIALS = 'false';
process.env.CACHE_WORKS = 'false';

// Ограничим шум логов в тестах (если используешь pino-http)
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

import { expect } from 'vitest';

// Матчеры jest-dom подключим только для frontend тестов с jsdom environment
// Для backend тестов (node environment) они не нужны