-- Migration: Performance Optimization Indexes
-- Version: 20251007120000_performance_indexes
-- Description: Add critical indexes for SMETA360-2 performance optimization
-- Created: 2025-10-07T12:00:00.000Z

-- ============================
-- FORWARD MIGRATION (UP)
-- ============================

-- Index for materials search functionality
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_search 
ON materials USING gin(to_tsvector('russian', name || ' ' || COALESCE(description, '')))
WHERE deleted_at IS NULL;

-- Index for auth users email lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email 
ON auth_users (email) 
WHERE is_active = true;

-- Composite index for materials updated/created timestamps
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_materials_timestamps 
ON materials (updated_at DESC, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for projects tenant isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_tenant_id 
ON projects (tenant_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for works reference optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_works_category_type 
ON works (category, type, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for user-tenant relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_tenants_user_id 
ON user_tenants (user_id, tenant_id, is_active);

-- Index for estimate items performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimate_items_estimate_id 
ON estimate_items (estimate_id, item_order, created_at);

-- Index for statistics queries with date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_statistics_created_type 
ON statistics (created_at DESC, type) 
WHERE created_at > NOW() - INTERVAL '1 year';

-- Index for session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_token 
ON user_sessions (session_token, expires_at) 
WHERE is_active = true;

-- Partial index for active tenants
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_active 
ON tenants (created_at DESC) 
WHERE is_active = true;

-- Update statistics for all affected tables
ANALYZE materials;
ANALYZE auth_users;
ANALYZE projects;
ANALYZE works;
ANALYZE user_tenants;
ANALYZE estimate_items;
ANALYZE statistics;
ANALYZE user_sessions;
ANALYZE tenants;

-- ============================
-- ROLLBACK MIGRATION (DOWN)
-- ============================
-- ROLLBACK_START
DROP INDEX IF EXISTS idx_materials_search;
DROP INDEX IF EXISTS idx_auth_users_email;
DROP INDEX IF EXISTS idx_materials_timestamps;
DROP INDEX IF EXISTS idx_projects_tenant_id;
DROP INDEX IF EXISTS idx_works_category_type;
DROP INDEX IF EXISTS idx_user_tenants_user_id;
DROP INDEX IF EXISTS idx_estimate_items_estimate_id;
DROP INDEX IF EXISTS idx_statistics_created_type;
DROP INDEX IF EXISTS idx_user_sessions_token;
DROP INDEX IF EXISTS idx_tenants_active;
-- ROLLBACK_END

-- ============================
-- POST MIGRATION VALIDATION
-- ============================
-- VALIDATION_START
-- Verify indexes were created successfully
SELECT schemaname, indexname, tablename 
FROM pg_indexes 
WHERE indexname IN (
  'idx_materials_search',
  'idx_auth_users_email', 
  'idx_materials_timestamps',
  'idx_projects_tenant_id',
  'idx_works_category_type',
  'idx_user_tenants_user_id',
  'idx_estimate_items_estimate_id',
  'idx_statistics_created_type',
  'idx_user_sessions_token',
  'idx_tenants_active'
);

-- Verify table statistics are updated
SELECT 
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as total_operations,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename IN ('materials', 'auth_users', 'projects', 'works', 'user_tenants', 'estimate_items', 'statistics', 'user_sessions', 'tenants');
-- VALIDATION_END