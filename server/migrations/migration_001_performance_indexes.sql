-- migration_001_performance_indexes.sql
-- Оптимизация производительности SQL запросов для SMETA360-2

-- 1. Базовый индекс для материалов
CREATE INDEX IF NOT EXISTS idx_materials_updated_at_opt 
ON materials (updated_at DESC);

-- 2. Оптимизация аутентификации пользователей
-- Решает проблему: SELECT id, email, password_hash... WHERE email = $1 AND is_active = true (1206ms)
CREATE INDEX IF NOT EXISTS idx_auth_users_login_opt 
ON auth_users (email, is_active);

-- 3. Индекс для works_ref
CREATE INDEX IF NOT EXISTS idx_works_ref_updated_opt 
ON works_ref (updated_at DESC);

-- 4. Оптимизация для статистики  
-- Решает проблему: SELECT * FROM statistics ORDER BY id (1198ms)
CREATE INDEX IF NOT EXISTS idx_statistics_perf_opt 
ON statistics (id DESC);