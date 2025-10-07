-- migration_003_refresh_tokens.sql
-- Enhanced Authentication: добавляем поддержку refresh tokens

-- 1. Создаем таблицу для refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE, -- SHA-256 hash refresh token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  use_count INTEGER DEFAULT 1,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP,
  
  -- Device/Session information
  user_agent TEXT,
  ip_address INET,
  device_id VARCHAR(255), -- Unique device identifier
  
  -- Security metadata
  security_flags JSONB DEFAULT '{}', -- Additional security metadata
  
  CONSTRAINT refresh_tokens_expires_at_check CHECK (expires_at > created_at)
);

-- 2. Создаем индексы для производительности
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, is_revoked, expires_at);

-- 3. Создаем составной индекс для быстрого поиска активных токенов
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_lookup ON refresh_tokens(token_hash, expires_at, is_revoked);

-- 4. Обновляем таблицу user_sessions для совместимости
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'jwt';
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 5. Создаем функцию для автоматической очистки истекших токенов
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM refresh_tokens 
  WHERE expires_at < NOW() - INTERVAL '7 days' -- Храним истекшие токены 7 дней для аудита
     OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Логируем операцию очистки
  INSERT INTO audit_log (
    action, 
    table_name, 
    details, 
    created_at
  ) VALUES (
    'cleanup_expired_tokens', 
    'refresh_tokens', 
    jsonb_build_object('deleted_count', deleted_count),
    NOW()
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Создаем функцию для получения статистики по токенам
CREATE OR REPLACE FUNCTION get_refresh_token_stats() RETURNS TABLE (
  total_tokens BIGINT,
  active_tokens BIGINT,
  expired_tokens BIGINT,
  revoked_tokens BIGINT,
  unique_users BIGINT,
  avg_token_lifetime INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_tokens,
    COUNT(*) FILTER (WHERE expires_at > NOW() AND is_revoked = false) as active_tokens,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_tokens,
    COUNT(*) FILTER (WHERE is_revoked = true) as revoked_tokens,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(COALESCE(revoked_at, expires_at) - created_at) as avg_token_lifetime
  FROM refresh_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Добавляем RLS политику для refresh_tokens
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_refresh_tokens_policy ON refresh_tokens
  FOR ALL
  USING (
    user_id = COALESCE(
      current_setting('app.current_user_id', true)::INTEGER,
      (current_setting('jwt.claims.userId', true))::INTEGER
    )
  );

-- 8. Создаем триггер для обновления last_used_at при использовании токена
CREATE OR REPLACE FUNCTION update_refresh_token_last_used() 
RETURNS TRIGGER AS $$
BEGIN
  -- Обновляем last_used_at только если токен используется для аутентификации
  IF TG_OP = 'UPDATE' AND OLD.use_count < NEW.use_count THEN
    NEW.last_used_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_token_usage_trigger
  BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_refresh_token_last_used();

-- 9. Добавляем комментарии к таблице и столбцам
COMMENT ON TABLE refresh_tokens IS 'Enhanced authentication: refresh tokens для долгосрочной аутентификации';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 хеш refresh token для безопасности';
COMMENT ON COLUMN refresh_tokens.device_id IS 'Уникальный идентификатор устройства для multi-device support';
COMMENT ON COLUMN refresh_tokens.security_flags IS 'Дополнительные флаги безопасности в JSON формате';
COMMENT ON COLUMN refresh_tokens.use_count IS 'Количество использований токена для мониторинга';

-- 10. Создаем view для мониторинга активных сессий
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
  rt.id,
  rt.user_id,
  au.email,
  au.firstname,
  au.lastname,
  rt.created_at,
  rt.last_used_at,
  rt.expires_at,
  rt.user_agent,
  rt.ip_address,
  rt.device_id,
  rt.use_count,
  EXTRACT(EPOCH FROM (rt.expires_at - NOW())) / 3600 as hours_until_expiry
FROM refresh_tokens rt
JOIN auth_users au ON rt.user_id = au.id
WHERE rt.is_revoked = false 
  AND rt.expires_at > NOW()
ORDER BY rt.last_used_at DESC;

COMMENT ON VIEW active_user_sessions IS 'Активные пользовательские сессии с refresh tokens';

-- 11. Создаем индекс для быстрого поиска по device_id
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(device_id) 
WHERE device_id IS NOT NULL;

-- Миграция завершена
SELECT 'migration_003_refresh_tokens.sql applied successfully' as result;