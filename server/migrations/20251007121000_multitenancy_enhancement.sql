-- Migration: Enhanced Multitenancy Support
-- Version: 20251007121000_multitenancy_enhancement
-- Description: Implement comprehensive multi-tenant architecture with RLS
-- Created: 2025-10-07T12:10:00.000Z

-- ============================
-- FORWARD MIGRATION (UP)
-- ============================

-- Create tenants table if not exists
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE,
  settings JSONB DEFAULT '{}',
  subscription_plan VARCHAR(50) DEFAULT 'basic',
  max_users INTEGER DEFAULT 10,
  max_projects INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add tenant_id to tables that don't have it
DO $$
BEGIN
  -- Add tenant_id to materials if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'tenant_id') THEN
    ALTER TABLE materials ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;

  -- Add tenant_id to projects if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'tenant_id') THEN
    ALTER TABLE projects ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;

  -- Add tenant_id to works if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'works' AND column_name = 'tenant_id') THEN
    ALTER TABLE works ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;

  -- Add tenant_id to estimates if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimates' AND column_name = 'tenant_id') THEN
    ALTER TABLE estimates ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;

  -- Add tenant_id to estimate_items if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'estimate_items' AND column_name = 'tenant_id') THEN
    ALTER TABLE estimate_items ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END
$$;

-- Update user_tenants table structure
DO $$
BEGIN
  -- Add role column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tenants' AND column_name = 'role') THEN
    ALTER TABLE user_tenants ADD COLUMN role VARCHAR(50) DEFAULT 'member';
  END IF;

  -- Add permissions column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tenants' AND column_name = 'permissions') THEN
    ALTER TABLE user_tenants ADD COLUMN permissions JSONB DEFAULT '{}';
  END IF;

  -- Add joined_at column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_tenants' AND column_name = 'joined_at') THEN
    ALTER TABLE user_tenants ADD COLUMN joined_at TIMESTAMP DEFAULT NOW();
  END IF;
END
$$;

-- Create default tenant if no tenants exist
INSERT INTO tenants (id, name, subdomain, is_active) 
SELECT 
  gen_random_uuid(),
  'Default Organization',
  'default',
  true
WHERE NOT EXISTS (SELECT 1 FROM tenants);

-- Get the default tenant ID for data migration
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE subdomain = 'default' LIMIT 1;
  
  -- Update existing records to use default tenant
  UPDATE materials SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE projects SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE works SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE estimates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE estimate_items SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  
  -- Associate all existing users with default tenant
  INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at)
  SELECT 
    au.id, 
    default_tenant_id, 
    CASE WHEN au.role = 'admin' THEN 'owner' ELSE 'member' END,
    true,
    NOW()
  FROM auth_users au
  WHERE NOT EXISTS (
    SELECT 1 FROM user_tenants ut 
    WHERE ut.user_id = au.id AND ut.tenant_id = default_tenant_id
  );
END
$$;

-- Make tenant_id NOT NULL after data migration
ALTER TABLE materials ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE works ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE estimates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE estimate_items ALTER COLUMN tenant_id SET NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE works ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_materials ON materials
  USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE POLICY tenant_isolation_projects ON projects
  USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE POLICY tenant_isolation_works ON works
  USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE POLICY tenant_isolation_estimates ON estimates
  USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE POLICY tenant_isolation_estimate_items ON estimate_items
  USING (tenant_id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

-- Tenant admin can see their own tenant
CREATE POLICY tenant_admin_access ON tenants
  USING (id = COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID));

-- Create function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_tenant_id', true)::UUID, '00000000-0000-0000-0000-000000000000'::UUID);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_materials_tenant_id ON materials (tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_works_tenant_id ON works (tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant_id ON estimates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_tenant_id ON estimate_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_composite ON user_tenants (user_id, tenant_id, is_active);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to tenants table
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update table statistics
ANALYZE tenants;
ANALYZE user_tenants;
ANALYZE materials;
ANALYZE projects;
ANALYZE works;
ANALYZE estimates;
ANALYZE estimate_items;

-- ============================
-- ROLLBACK MIGRATION (DOWN)
-- ============================
-- ROLLBACK_START
-- Disable RLS policies
DROP POLICY IF EXISTS tenant_isolation_materials ON materials;
DROP POLICY IF EXISTS tenant_isolation_projects ON projects;
DROP POLICY IF EXISTS tenant_isolation_works ON works;
DROP POLICY IF EXISTS tenant_isolation_estimates ON estimates;
DROP POLICY IF EXISTS tenant_isolation_estimate_items ON estimate_items;
DROP POLICY IF EXISTS tenant_admin_access ON tenants;

-- Disable RLS
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE works DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Drop functions
DROP FUNCTION IF EXISTS set_tenant_context(UUID);
DROP FUNCTION IF EXISTS get_current_tenant_id();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_materials_tenant_id;
DROP INDEX IF EXISTS idx_projects_tenant_id;
DROP INDEX IF EXISTS idx_works_tenant_id;
DROP INDEX IF EXISTS idx_estimates_tenant_id;
DROP INDEX IF EXISTS idx_estimate_items_tenant_id;
DROP INDEX IF EXISTS idx_user_tenants_composite;

-- Remove tenant_id columns (careful - this will lose data)
ALTER TABLE materials DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE projects DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE works DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE estimates DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE estimate_items DROP COLUMN IF EXISTS tenant_id;

-- Remove additional columns from user_tenants
ALTER TABLE user_tenants DROP COLUMN IF EXISTS role;
ALTER TABLE user_tenants DROP COLUMN IF EXISTS permissions;
ALTER TABLE user_tenants DROP COLUMN IF EXISTS joined_at;

-- Drop tenants table (careful - this will lose data)
DROP TABLE IF EXISTS tenants CASCADE;
-- ROLLBACK_END

-- ============================
-- POST MIGRATION VALIDATION
-- ============================
-- VALIDATION_START
-- Verify tenants table exists and has data
SELECT COUNT(*) as tenant_count FROM tenants WHERE is_active = true;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('materials', 'projects', 'works', 'estimates', 'estimate_items', 'tenants')
AND rowsecurity = true;

-- Verify all records have tenant_id
SELECT 
  'materials' as table_name,
  COUNT(*) as total_records,
  COUNT(tenant_id) as records_with_tenant_id
FROM materials
UNION ALL
SELECT 
  'projects' as table_name,
  COUNT(*) as total_records,
  COUNT(tenant_id) as records_with_tenant_id
FROM projects
UNION ALL
SELECT 
  'works' as table_name,
  COUNT(*) as total_records,
  COUNT(tenant_id) as records_with_tenant_id
FROM works;

-- Verify user-tenant associations exist
SELECT COUNT(*) as user_tenant_associations FROM user_tenants WHERE is_active = true;

-- Test tenant context functions
SELECT set_tenant_context((SELECT id FROM tenants LIMIT 1));
SELECT get_current_tenant_id();
-- VALIDATION_END