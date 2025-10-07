-- migration_002_multitenancy_simple.sql
-- Упрощенная мультитенантность для существующей структуры

-- 1. Добавляем недостающие поля в tenants (если их нет)
DO $$ 
BEGIN
    -- Добавляем subdomain, если его нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'subdomain') THEN
        ALTER TABLE tenants ADD COLUMN subdomain VARCHAR(100);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
    END IF;
    
    -- Добавляем settings, если его нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'settings') THEN
        ALTER TABLE tenants ADD COLUMN settings JSONB DEFAULT '{}';
    END IF;
END $$;

-- 2. Создаем default tenant, если его нет
INSERT INTO tenants (name, subdomain, settings, is_active)
SELECT 
  'Default Organization',
  'default',
  '{"type": "default"}',
  true
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE name = 'Default Organization');

-- 3. Убеждаемся, что user_tenants существует
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tenants') THEN
        CREATE TABLE user_tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            role VARCHAR(50) DEFAULT 'member',
            is_current BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(user_id, tenant_id)
        );
        
        CREATE INDEX idx_user_tenants_user_current ON user_tenants(user_id, is_current);
        CREATE INDEX idx_user_tenants_tenant ON user_tenants(tenant_id);
    END IF;
END $$;

-- 4. Привязываем пользователей к default tenant
WITH default_tenant AS (
  SELECT id FROM tenants WHERE name = 'Default Organization' LIMIT 1
)
INSERT INTO user_tenants (user_id, tenant_id, role, is_current)
SELECT 
  au.id,
  dt.id,
  'admin',
  true
FROM auth_users au
CROSS JOIN default_tenant dt
WHERE NOT EXISTS (
  SELECT 1 FROM user_tenants ut 
  WHERE ut.user_id = au.id
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 5. Создаем функцию для получения текущего tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  -- Пытаемся получить из настроек сессии
  BEGIN
    tenant_uuid := current_setting('app.current_tenant_id')::UUID;
    IF tenant_uuid IS NOT NULL THEN
      RETURN tenant_uuid;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
  
  -- Если не найден, получаем из user_tenants
  BEGIN
    SELECT tenant_id INTO tenant_uuid
    FROM user_tenants 
    WHERE user_id = current_setting('app.current_user_id')::UUID 
    AND is_current = true 
    LIMIT 1;
    
    RETURN tenant_uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Базовые RLS политики (без строгой изоляции для начала)
-- Включаем RLS только для основных таблиц
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_projects ENABLE ROW LEVEL SECURITY;

-- Создаем мягкие политики, которые не блокируют доступ
DROP POLICY IF EXISTS tenant_policy_materials ON materials;
CREATE POLICY tenant_policy_materials ON materials
  FOR ALL
  USING (true); -- Пока разрешаем всё

DROP POLICY IF EXISTS tenant_policy_projects ON construction_projects;
CREATE POLICY tenant_policy_projects ON construction_projects
  FOR ALL
  USING (
    tenant_id IS NULL OR 
    tenant_id = current_tenant_id() OR
    current_tenant_id() IS NULL
  );

-- 7. Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_materials_tenant_policy ON materials (tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_policy ON construction_projects (tenant_id);

-- Комментарии
COMMENT ON FUNCTION current_tenant_id() IS 'Получение текущего tenant_id с fallback логикой';
COMMENT ON POLICY tenant_policy_materials ON materials IS 'Мягкая политика доступа к материалам';
COMMENT ON POLICY tenant_policy_projects ON construction_projects IS 'Tenant изоляция для проектов';