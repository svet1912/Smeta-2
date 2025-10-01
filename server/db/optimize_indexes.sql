-- 🚀 Оптимизация индексов для Smeta360
-- Выполняется автоматически при запуске сервера

-- Включаем расширение для полнотекстового поиска
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Материалы: быстрый поиск по названию (триграммы для ILIKE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_name_trgm
  ON materials USING gin (name gin_trgm_ops);

-- 2. Работы: быстрый поиск по названию (триграммы для ILIKE)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_works_ref_name_trgm
  ON works_ref USING gin (name gin_trgm_ops);

-- 3. Сметы: выборка по пользователю (частый запрос)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_estimates_user_id
  ON customer_estimates(user_id);

-- 4. Элементы смет: выборка по смете (самый частый JOIN)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_estimate_items_estimate_id
  ON customer_estimate_items(estimate_id);

-- 5. Дополнительные индексы для auth системы
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_fast
  ON auth_users(email) WHERE email IS NOT NULL;

-- 6. Индексы для проектов
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_construction_projects_user_id  
  ON construction_projects(user_id);

-- 7. Составной индекс для поиска материалов по категории и названию
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_category_name
  ON materials(category, name) WHERE category IS NOT NULL;

-- 8. Индекс для сортировки смет по дате создания
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_estimates_created_at
  ON customer_estimates(created_at DESC);

-- Статистика создания индексов
SELECT 
  schemaname,
  tablename, 
  indexname,
  indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%_trgm' OR indexname LIKE 'idx_customer_%' OR indexname LIKE 'idx_materials_%'
ORDER BY tablename, indexname;