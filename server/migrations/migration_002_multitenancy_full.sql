-- migration_002_multitenancy_full.sql
-- Полноценная мультитенантность с Row Level Security для SMETA360-2

-- 1. Создаем таблицу tenants (если не существует)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Обеспечиваем, что все пользователи привязаны к тенантам
-- Создаем default tenant, если его нет
INSERT INTO tenants (id, name, subdomain, is_active)
SELECT 
  'default-tenant-uuid'::UUID,
  'Default Organization',
  'default',
  true
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE subdomain = 'default');

-- 3. Убеждаемся, что user_tenants существует и имеет правильную структуру
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
    END IF;
END $$;

-- 4. Привязываем всех пользователей без тенанта к default tenant
INSERT INTO user_tenants (user_id, tenant_id, role, is_current)
SELECT 
  au.id,
  t.id,
  'admin',
  true
FROM auth_users au
CROSS JOIN tenants t
WHERE t.subdomain = 'default'
AND NOT EXISTS (
  SELECT 1 FROM user_tenants ut 
  WHERE ut.user_id = au.id
)
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- 5. Создаем функцию для получения текущего tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_tenant_id', true)::UUID,
    (SELECT tenant_id FROM user_tenants WHERE user_id = current_setting('app.current_user_id', true)::UUID AND is_current = true LIMIT 1)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Включаем RLS для критических таблиц
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE works_ref ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_estimates ENABLE ROW LEVEL SECURITY;

-- 7. Создаем RLS политики для materials
DROP POLICY IF EXISTS tenant_isolation_materials ON materials;
CREATE POLICY tenant_isolation_materials ON materials
  FOR ALL
  USING (
    tenant_id IS NULL OR 
    tenant_id = current_tenant_id() OR
    current_tenant_id() IS NULL
  );

-- 8. Создаем RLS политики для works_ref
DROP POLICY IF EXISTS tenant_isolation_works ON works_ref;
CREATE POLICY tenant_isolation_works ON works_ref
  FOR ALL
  USING (
    tenant_id IS NULL OR 
    tenant_id = current_tenant_id() OR
    current_tenant_id() IS NULL
  );

-- 9. Создаем RLS политики для construction_projects
DROP POLICY IF EXISTS tenant_isolation_projects ON construction_projects;
CREATE POLICY tenant_isolation_projects ON construction_projects
  FOR ALL
  USING (
    tenant_id = current_tenant_id() OR
    current_tenant_id() IS NULL
  );

-- 10. Создаем RLS политики для customer_estimates
DROP POLICY IF EXISTS tenant_isolation_estimates ON customer_estimates;
CREATE POLICY tenant_isolation_estimates ON customer_estimates
  FOR ALL
  USING (
    tenant_id = current_tenant_id() OR
    current_tenant_id() IS NULL
  );

-- 11. Создаем индексы для производительности RLS
CREATE INDEX IF NOT EXISTS idx_materials_tenant_rls ON materials (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_works_ref_tenant_rls ON works_ref (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_construction_projects_tenant_rls ON construction_projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimates_tenant_rls ON customer_estimates (tenant_id);

-- 12. Обновляем существующие записи с default tenant (если tenant_id NULL)
UPDATE materials SET tenant_id = (SELECT id FROM tenants WHERE subdomain = 'default' LIMIT 1) 
WHERE tenant_id IS NULL;

UPDATE works_ref SET tenant_id = (SELECT id FROM tenants WHERE subdomain = 'default' LIMIT 1) 
WHERE tenant_id IS NULL;

-- Комментарии для документации
COMMENT ON TABLE tenants IS 'Мультитенантность - организации в системе';
COMMENT ON FUNCTION current_tenant_id() IS 'Получение текущего tenant_id для RLS политик';
COMMENT ON POLICY tenant_isolation_materials ON materials IS 'RLS изоляция материалов по тенантам';
COMMENT ON POLICY tenant_isolation_works ON works_ref IS 'RLS изоляция работ по тенантам';
COMMENT ON POLICY tenant_isolation_projects ON construction_projects IS 'RLS изоляция проектов по тенантам';
COMMENT ON POLICY tenant_isolation_estimates ON customer_estimates IS 'RLS изоляция смет по тенантам';