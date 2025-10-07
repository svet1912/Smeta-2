-- Migration: Advanced Authentication Security
-- Version: 20251007122000_auth_security_enhancement
-- Description: Implement enhanced authentication with refresh tokens and security features
-- Created: 2025-10-07T12:20:00.000Z

-- ============================
-- FORWARD MIGRATION (UP)
-- ============================

-- Create refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  device_info JSONB DEFAULT '{}',
  ip_address INET,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(100)
);

-- Create user sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  device_fingerprint VARCHAR(255),
  is_active BOOLEAN DEFAULT true
);

-- Create login attempts table for rate limiting
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255),
  ip_address INET NOT NULL,
  attempted_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT false,
  failure_reason VARCHAR(100),
  user_agent TEXT
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP,
  ip_address INET
);

-- Enhance auth_users table with security fields
DO $$
BEGIN
  -- Add password_changed_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'password_changed_at') THEN
    ALTER TABLE auth_users ADD COLUMN password_changed_at TIMESTAMP DEFAULT NOW();
  END IF;

  -- Add failed_login_attempts if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'failed_login_attempts') THEN
    ALTER TABLE auth_users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
  END IF;

  -- Add locked_until if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'locked_until') THEN
    ALTER TABLE auth_users ADD COLUMN locked_until TIMESTAMP;
  END IF;

  -- Add last_login_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'last_login_at') THEN
    ALTER TABLE auth_users ADD COLUMN last_login_at TIMESTAMP;
  END IF;

  -- Add email_verified_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'email_verified_at') THEN
    ALTER TABLE auth_users ADD COLUMN email_verified_at TIMESTAMP;
  END IF;

  -- Add two_factor_enabled if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'two_factor_enabled') THEN
    ALTER TABLE auth_users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT false;
  END IF;

  -- Add two_factor_secret if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'two_factor_secret') THEN
    ALTER TABLE auth_users ADD COLUMN two_factor_secret VARCHAR(255);
  END IF;

  -- Add security_preferences if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'auth_users' AND column_name = 'security_preferences') THEN
    ALTER TABLE auth_users ADD COLUMN security_preferences JSONB DEFAULT '{}';
  END IF;
END
$$;

-- Update existing users with initial security data
UPDATE auth_users 
SET 
  password_changed_at = COALESCE(password_changed_at, created_at),
  email_verified_at = COALESCE(email_verified_at, created_at)
WHERE password_changed_at IS NULL OR email_verified_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash) WHERE is_revoked = false;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts (ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts (email, attempted_at DESC) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token_hash) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_users_email_active ON auth_users (email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auth_users_locked ON auth_users (locked_until) WHERE locked_until IS NOT NULL;

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  -- Clean up expired refresh tokens
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() - INTERVAL '7 days';
  
  -- Clean up expired sessions
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Clean up old login attempts (keep last 30 days)
  DELETE FROM login_attempts 
  WHERE attempted_at < NOW() - INTERVAL '30 days';
  
  -- Clean up used password reset tokens
  DELETE FROM password_reset_tokens 
  WHERE used_at IS NOT NULL AND used_at < NOW() - INTERVAL '7 days';
  
  -- Clean up expired password reset tokens
  DELETE FROM password_reset_tokens 
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is rate limited
CREATE OR REPLACE FUNCTION is_rate_limited(
  check_email VARCHAR DEFAULT NULL,
  check_ip INET DEFAULT NULL,
  time_window INTERVAL DEFAULT INTERVAL '15 minutes',
  max_attempts INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER := 0;
BEGIN
  -- Count failed attempts in time window
  SELECT COUNT(*) INTO attempt_count
  FROM login_attempts
  WHERE attempted_at > NOW() - time_window
    AND success = false
    AND (
      (check_email IS NOT NULL AND email = check_email) OR
      (check_ip IS NOT NULL AND ip_address = check_ip)
    );
  
  RETURN attempt_count >= max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
  attempt_email VARCHAR DEFAULT NULL,
  attempt_ip INET DEFAULT NULL,
  attempt_success BOOLEAN DEFAULT false,
  attempt_reason VARCHAR DEFAULT NULL,
  attempt_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  attempt_id UUID;
BEGIN
  INSERT INTO login_attempts (
    email,
    ip_address,
    success,
    failure_reason,
    user_agent
  ) VALUES (
    attempt_email,
    attempt_ip,
    attempt_success,
    attempt_reason,
    attempt_user_agent
  ) RETURNING id INTO attempt_id;
  
  RETURN attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update user login stats
CREATE OR REPLACE FUNCTION update_user_login_stats(
  user_uuid UUID,
  login_success BOOLEAN DEFAULT true
)
RETURNS void AS $$
BEGIN
  IF login_success THEN
    UPDATE auth_users 
    SET 
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login_at = NOW()
    WHERE id = user_uuid;
  ELSE
    UPDATE auth_users 
    SET 
      failed_login_attempts = failed_login_attempts + 1,
      locked_until = CASE 
        WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
        ELSE locked_until
      END
    WHERE id = user_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke all user sessions
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  -- Revoke all refresh tokens
  UPDATE refresh_tokens 
  SET 
    is_revoked = true,
    revoked_at = NOW(),
    revoked_reason = 'revoked_all_sessions'
  WHERE user_id = user_uuid AND is_revoked = false;
  
  -- Deactivate all sessions
  UPDATE user_sessions 
  SET is_active = false
  WHERE user_id = user_uuid AND is_active = true;
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically cleanup sessions on token revocation
CREATE OR REPLACE FUNCTION cleanup_sessions_on_token_revocation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_revoked = true AND OLD.is_revoked = false THEN
    UPDATE user_sessions 
    SET is_active = false
    WHERE refresh_token_id = NEW.id AND is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_sessions_on_revocation ON refresh_tokens;
CREATE TRIGGER trigger_cleanup_sessions_on_revocation
  AFTER UPDATE ON refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_sessions_on_token_revocation();

-- Create scheduled job for token cleanup (using pg_cron if available)
-- Note: This requires pg_cron extension
DO $$
BEGIN
  -- Try to create scheduled cleanup job
  BEGIN
    PERFORM cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_tokens();');
  EXCEPTION
    WHEN OTHERS THEN
      -- pg_cron not available, skip scheduling
      NULL;
  END;
END
$$;

-- Update table statistics
ANALYZE refresh_tokens;
ANALYZE user_sessions;
ANALYZE login_attempts;
ANALYZE password_reset_tokens;
ANALYZE auth_users;

-- ============================
-- ROLLBACK MIGRATION (DOWN)
-- ============================
-- ROLLBACK_START
-- Drop scheduled job
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('cleanup-expired-tokens');
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
END
$$;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_cleanup_sessions_on_revocation ON refresh_tokens;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_tokens();
DROP FUNCTION IF EXISTS is_rate_limited(VARCHAR, INET, INTERVAL, INTEGER);
DROP FUNCTION IF EXISTS record_login_attempt(VARCHAR, INET, BOOLEAN, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS update_user_login_stats(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS revoke_all_user_sessions(UUID);
DROP FUNCTION IF EXISTS cleanup_sessions_on_token_revocation();

-- Drop indexes
DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_token;
DROP INDEX IF EXISTS idx_login_attempts_ip_time;
DROP INDEX IF EXISTS idx_login_attempts_email_time;
DROP INDEX IF EXISTS idx_password_reset_tokens_user;
DROP INDEX IF EXISTS idx_password_reset_tokens_token;
DROP INDEX IF EXISTS idx_auth_users_email_active;
DROP INDEX IF EXISTS idx_auth_users_locked;

-- Remove added columns from auth_users
ALTER TABLE auth_users DROP COLUMN IF EXISTS password_changed_at;
ALTER TABLE auth_users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE auth_users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE auth_users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE auth_users DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE auth_users DROP COLUMN IF EXISTS two_factor_enabled;
ALTER TABLE auth_users DROP COLUMN IF EXISTS two_factor_secret;
ALTER TABLE auth_users DROP COLUMN IF EXISTS security_preferences;

-- Drop tables
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
-- ROLLBACK_END

-- ============================
-- POST MIGRATION VALIDATION
-- ============================
-- VALIDATION_START
-- Verify all security tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('refresh_tokens', 'user_sessions', 'login_attempts', 'password_reset_tokens')
  AND table_schema = 'public';

-- Verify auth_users has new security columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'auth_users' 
  AND column_name IN ('password_changed_at', 'failed_login_attempts', 'locked_until', 'last_login_at', 'email_verified_at', 'two_factor_enabled');

-- Verify indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%tokens%' OR indexname LIKE 'idx_%sessions%' OR indexname LIKE 'idx_%attempts%';

-- Verify functions were created
SELECT proname 
FROM pg_proc 
WHERE proname IN ('cleanup_expired_tokens', 'is_rate_limited', 'record_login_attempt', 'update_user_login_stats', 'revoke_all_user_sessions');

-- Test basic functions
SELECT is_rate_limited('test@example.com', '127.0.0.1'::inet);
SELECT record_login_attempt('test@example.com', '127.0.0.1'::inet, true, NULL, 'test-agent');

-- Check that all existing users have security fields populated
SELECT 
  COUNT(*) as total_users,
  COUNT(password_changed_at) as users_with_password_date,
  COUNT(email_verified_at) as users_with_email_verified
FROM auth_users 
WHERE is_active = true;
-- VALIDATION_END