-- migration_002_minimal_tenancy.sql
-- Минимальная мультитенантность без предположений о структуре

-- 1. Удаляем старые функции, если они есть
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
DROP FUNCTION IF EXISTS get_user_tenant_id(UUID);

-- Создаем функцию для получения tenant_id пользователя
CREATE OR REPLACE FUNCTION get_user_tenant_id(user_uuid UUID) RETURNS UUID AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  -- Ищем в user_tenants
  SELECT tenant_id INTO tenant_uuid
  FROM user_tenants 
  WHERE user_id = user_uuid 
  LIMIT 1;
  
  RETURN tenant_uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Создаем функцию для установки контекста tenant
CREATE OR REPLACE FUNCTION set_tenant_context(user_uuid UUID) RETURNS VOID AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  tenant_uuid := get_user_tenant_id(user_uuid);
  
  IF tenant_uuid IS NOT NULL THEN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
    PERFORM set_config('app.current_user_id', user_uuid::text, false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Создаем простую функцию current_tenant_id для RLS
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Включаем RLS только для одной таблицы как тест
ALTER TABLE construction_projects ENABLE ROW LEVEL SECURITY;

-- 5. Создаем очень мягкую политику с приведением типов
DROP POLICY IF EXISTS basic_tenant_policy ON construction_projects;
CREATE POLICY basic_tenant_policy ON construction_projects
  FOR ALL
  USING (
    -- Разрешаем всё, если tenant_id не установлен в контексте
    current_tenant_id() IS NULL OR
    -- Или если tenant_id записи совпадает с контекстом (с приведением типов)
    tenant_id::text = current_tenant_id()::text OR
    -- Или если у записи нет tenant_id (общие данные)
    tenant_id IS NULL
  );

-- 6. Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_construction_projects_tenant_basic ON construction_projects (tenant_id);

-- Комментарии
COMMENT ON FUNCTION get_user_tenant_id(UUID) IS 'Получение tenant_id для пользователя';
COMMENT ON FUNCTION set_tenant_context(UUID) IS 'Установка tenant контекста для сессии';
COMMENT ON FUNCTION current_tenant_id() IS 'Получение текущего tenant_id из контекста';
COMMENT ON POLICY basic_tenant_policy ON construction_projects IS 'Базовая tenant политика с мягкой изоляцией';