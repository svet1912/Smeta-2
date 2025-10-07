--
-- PostgreSQL database dump
--

\restrict g0bFGf7gdC0iYtKW0iSlVcPtrrmz4kGRGGuC5D8PahRXvXjYYQUTeW8QeZufNxh

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6 (Debian 17.6-0+deb13u1)

-- Started on 2025-10-07 16:21:38 UTC

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS defaultdb;
--
-- TOC entry 5561 (class 1262 OID 16462)
-- Name: defaultdb; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE defaultdb WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF-8';


\unrestrict g0bFGf7gdC0iYtKW0iSlVcPtrrmz4kGRGGuC5D8PahRXvXjYYQUTeW8QeZufNxh
\connect defaultdb
\restrict g0bFGf7gdC0iYtKW0iSlVcPtrrmz4kGRGGuC5D8PahRXvXjYYQUTeW8QeZufNxh

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 3 (class 3079 OID 17234)
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- TOC entry 5562 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- TOC entry 4 (class 3079 OID 18363)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 5563 (class 0 OID 0)
-- Dependencies: 4
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 2 (class 3079 OID 16857)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5564 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- TOC entry 343 (class 1255 OID 17152)
-- Name: app_create_tenant_with_admin(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_create_tenant_with_admin(p_user_id integer, p_tenant_name text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
      DECLARE
        v_tenant_id uuid;
      BEGIN
        INSERT INTO tenants (name) VALUES (p_tenant_name)
        RETURNING id INTO v_tenant_id;

        INSERT INTO user_tenants (tenant_id, user_id, role)
        VALUES (v_tenant_id, p_user_id, 'admin')
        ON CONFLICT DO NOTHING;

        RETURN v_tenant_id;
      END;
      $$;


--
-- TOC entry 344 (class 1255 OID 17156)
-- Name: app_current_tenant(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_tenant() RETURNS uuid
    LANGUAGE plpgsql
    AS $$
      BEGIN
        BEGIN
          RETURN current_setting('app.tenant_id')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RETURN NULL;
        END;
      END;
      $$;


--
-- TOC entry 345 (class 1255 OID 17157)
-- Name: app_current_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_user() RETURNS integer
    LANGUAGE plpgsql
    AS $$
      BEGIN
        BEGIN
          RETURN current_setting('app.user_id')::integer;
        EXCEPTION WHEN OTHERS THEN
          RETURN NULL;
        END;
      END;
      $$;


--
-- TOC entry 576 (class 1255 OID 18548)
-- Name: check_customer_estimates_tenant_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_customer_estimates_tenant_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    project_tenant_id uuid;
BEGIN
    -- Получаем tenant_id проекта
    SELECT 
        CASE 
            WHEN cp.tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN cp.tenant_id::uuid
            ELSE '5a1f0a53-9f0b-4137-a82a-6302bc993c54'::uuid
        END
    INTO project_tenant_id
    FROM construction_projects cp 
    WHERE cp.id = NEW.project_id;
    
    -- Если проект не найден
    IF project_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Проект с ID % не найден', NEW.project_id;
    END IF;
    
    -- Если tenant_id не совпадает
    IF NEW.tenant_id != project_tenant_id THEN
        RAISE EXCEPTION 'tenant_id сметы (%) не совпадает с tenant_id проекта (%)', 
            NEW.tenant_id, project_tenant_id;
    END IF;
    
    RETURN NEW;
END;
$_$;


--
-- TOC entry 577 (class 1255 OID 18550)
-- Name: check_object_parameters_tenant_consistency(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_object_parameters_tenant_consistency() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    project_tenant_id uuid;
BEGIN
    SELECT 
        CASE 
            WHEN cp.tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            THEN cp.tenant_id::uuid
            ELSE '5a1f0a53-9f0b-4137-a82a-6302bc993c54'::uuid
        END
    INTO project_tenant_id
    FROM construction_projects cp 
    WHERE cp.id = NEW.project_id;
    
    IF project_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Проект с ID % не найден', NEW.project_id;
    END IF;
    
    IF NEW.tenant_id != project_tenant_id THEN
        RAISE EXCEPTION 'tenant_id параметров объекта (%) не совпадает с tenant_id проекта (%)', 
            NEW.tenant_id, project_tenant_id;
    END IF;
    
    RETURN NEW;
END;
$_$;


--
-- TOC entry 582 (class 1255 OID 18676)
-- Name: cleanup_expired_refresh_tokens(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_refresh_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- TOC entry 581 (class 1255 OID 18644)
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;


--
-- TOC entry 5565 (class 0 OID 0)
-- Dependencies: 581
-- Name: FUNCTION current_tenant_id(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.current_tenant_id() IS 'Получение текущего tenant_id из контекста';


--
-- TOC entry 351 (class 1255 OID 17231)
-- Name: effective_material_price(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.effective_material_price(p_material_id text, p_date date DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
        SELECT tmp.price
        FROM tenant_material_prices tmp
        WHERE tmp.tenant_id = app_current_tenant()
          AND tmp.material_id = p_material_id
          AND tmp.valid_from <= p_date
          AND (tmp.valid_to IS NULL OR tmp.valid_to >= p_date)
        ORDER BY tmp.valid_from DESC
        LIMIT 1;
      $$;


--
-- TOC entry 352 (class 1255 OID 17232)
-- Name: effective_work_price(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.effective_work_price(p_work_id text, p_date date DEFAULT CURRENT_DATE) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
        SELECT twp.price
        FROM tenant_work_prices twp
        WHERE twp.tenant_id = app_current_tenant()
          AND twp.work_id = p_work_id
          AND twp.valid_from <= p_date
          AND (twp.valid_to IS NULL OR twp.valid_to >= p_date)
        ORDER BY twp.valid_from DESC
        LIMIT 1;
      $$;


--
-- TOC entry 542 (class 1255 OID 17905)
-- Name: get_connection_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_connection_stats() RETURNS TABLE(state text, count bigint, max_duration interval)
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          COALESCE(state, 'unknown') as state,
          COUNT(*) as count,
          COALESCE(MAX(now() - state_change), '0'::interval) as max_duration
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state
        ORDER BY count DESC;
      END;
      $$;


--
-- TOC entry 353 (class 1255 OID 17233)
-- Name: get_effective_work_materials(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_effective_work_materials(p_work_id text) RETURNS TABLE(material_id text, consumption_per_work_unit numeric, waste_coeff numeric, is_tenant_override boolean)
    LANGUAGE plpgsql STABLE
    AS $$
      BEGIN
        -- Проверяем, есть ли тенантские переопределения для этой работы
        IF EXISTS (
          SELECT 1 FROM work_materials_tenant wmt 
          WHERE wmt.tenant_id = app_current_tenant() 
            AND wmt.work_id = p_work_id
        ) THEN
          -- Возвращаем только тенантские связи
          RETURN QUERY
          SELECT 
            wmt.material_id,
            wmt.consumption_per_work_unit,
            wmt.waste_coeff,
            true as is_tenant_override
          FROM work_materials_tenant wmt
          WHERE wmt.tenant_id = app_current_tenant() 
            AND wmt.work_id = p_work_id;
        ELSE
          -- Возвращаем глобальные связи
          RETURN QUERY
          SELECT 
            wm.material_id,
            wm.consumption_per_work_unit,
            wm.waste_coeff,
            false as is_tenant_override
          FROM work_materials wm
          WHERE wm.work_id = p_work_id;
        END IF;
      END;
      $$;


--
-- TOC entry 583 (class 1255 OID 18677)
-- Name: get_refresh_token_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_refresh_token_stats() RETURNS TABLE(total_tokens bigint, active_tokens bigint, expired_tokens bigint, revoked_tokens bigint, unique_users bigint, avg_token_lifetime interval)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- TOC entry 543 (class 1255 OID 17906)
-- Name: get_slow_queries(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_slow_queries(min_duration_ms integer DEFAULT 1000) RETURNS TABLE(query_start timestamp with time zone, duration interval, state text, query text)
    LANGUAGE plpgsql
    AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          psa.query_start,
          now() - psa.query_start as duration,
          psa.state,
          LEFT(psa.query, 200) as query
        FROM pg_stat_activity psa
        WHERE psa.datname = current_database()
          AND psa.state = 'active'
          AND (now() - psa.query_start) > (min_duration_ms || ' milliseconds')::interval
        ORDER BY (now() - psa.query_start) DESC;
      END;
      $$;


--
-- TOC entry 579 (class 1255 OID 18642)
-- Name: get_user_tenant_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tenant_id(user_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- TOC entry 5566 (class 0 OID 0)
-- Dependencies: 579
-- Name: FUNCTION get_user_tenant_id(user_uuid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_tenant_id(user_uuid uuid) IS 'Получение tenant_id для пользователя';


--
-- TOC entry 349 (class 1255 OID 17178)
-- Name: next_estimate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_estimate_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
      DECLARE
        v_tenant uuid := app_current_tenant();
        v_seq    bigint;
      BEGIN
        INSERT INTO tenant_counters(tenant_id, estimate_seq)
        VALUES (v_tenant, 0)
        ON CONFLICT (tenant_id) DO NOTHING;

        UPDATE tenant_counters
           SET estimate_seq = estimate_seq + 1
         WHERE tenant_id = v_tenant
        RETURNING estimate_seq INTO v_seq;

        RETURN to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0'); -- пример: 2025-00001
      END;
      $$;


--
-- TOC entry 580 (class 1255 OID 18643)
-- Name: set_tenant_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tenant_context(user_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  tenant_uuid UUID;
BEGIN
  tenant_uuid := get_user_tenant_id(user_uuid);
  
  IF tenant_uuid IS NOT NULL THEN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
    PERFORM set_config('app.current_user_id', user_uuid::text, false);
  END IF;
END;
$$;


--
-- TOC entry 5567 (class 0 OID 0)
-- Dependencies: 580
-- Name: FUNCTION set_tenant_context(user_uuid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_tenant_context(user_uuid uuid) IS 'Установка tenant контекста для сессии';


--
-- TOC entry 578 (class 1255 OID 18580)
-- Name: set_tenant_context_string(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tenant_context_string(tenant_string text) RETURNS void
    LANGUAGE plpgsql
    AS $$
        BEGIN
          PERFORM set_config('app.tenant_id', tenant_string, false);
        END;
        $$;


--
-- TOC entry 544 (class 1255 OID 17907)
-- Name: system_health_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_health_check() RETURNS TABLE(category text, metric text, value text, status text)
    LANGUAGE plpgsql
    AS $$
      BEGIN
        -- Соединения
        RETURN QUERY
        SELECT 'Connections'::text, 'Active'::text, 
               COUNT(*)::text, 
               CASE WHEN COUNT(*) < 50 THEN '✅' ELSE '⚠️' END
        FROM pg_stat_activity WHERE state = 'active';
        
        -- RLS
        RETURN QUERY  
        SELECT 'Security'::text, 'RLS Tables'::text,
               COUNT(*)::text,
               CASE WHEN COUNT(*) >= 8 THEN '✅' ELSE '❌' END
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relrowsecurity = true AND n.nspname = 'public';
        
        -- Индексы
        RETURN QUERY
        SELECT 'Performance'::text, 'Indexes'::text,
               COUNT(*)::text, '✅'::text
        FROM pg_indexes WHERE schemaname = 'public';
        
        -- Размер БД
        RETURN QUERY
        SELECT 'Storage'::text, 'Database Size'::text,
               pg_size_pretty(pg_database_size(current_database())),
               '📊'::text;
      END;
      $$;


--
-- TOC entry 348 (class 1255 OID 17163)
-- Name: tg_set_audit_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_audit_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW.created_at IS NULL THEN NEW.created_at := now(); END IF;
          IF NEW.created_by IS NULL AND app_current_user() IS NOT NULL THEN 
            NEW.created_by := app_current_user(); 
          END IF;
        END IF;
        NEW.updated_at := now();
        IF app_current_user() IS NOT NULL THEN
          NEW.updated_by := app_current_user();
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- TOC entry 347 (class 1255 OID 17161)
-- Name: tg_set_child_tenant_from_estimate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_child_tenant_from_estimate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.tenant_id IS NULL THEN
          SELECT e.tenant_id INTO NEW.tenant_id FROM estimates e WHERE e.id = NEW.estimate_id;
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- TOC entry 350 (class 1255 OID 17179)
-- Name: tg_set_estimate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_estimate_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.number IS NULL OR NEW.number = '' THEN
          NEW.number := next_estimate_number();
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- TOC entry 346 (class 1255 OID 17158)
-- Name: tg_set_tenant_from_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_tenant_from_context() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.tenant_id IS NULL AND app_current_tenant() IS NOT NULL THEN
          NEW.tenant_id := app_current_tenant();
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- TOC entry 584 (class 1255 OID 18679)
-- Name: update_refresh_token_last_used(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_refresh_token_last_used() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Обновляем last_used_at только если токен используется для аутентификации
  IF TG_OP = 'UPDATE' AND OLD.use_count < NEW.use_count THEN
    NEW.last_used_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 16467)
-- Name: auth_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    firstname character varying(255) NOT NULL,
    lastname character varying(255) NOT NULL,
    company character varying(255),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(50),
    "position" character varying(255),
    location character varying(255),
    bio text,
    avatar_url character varying(500),
    skills jsonb DEFAULT '[]'::jsonb
);


--
-- TOC entry 294 (class 1259 OID 18648)
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer,
    token_hash character varying(128) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    last_used_at timestamp without time zone DEFAULT now(),
    use_count integer DEFAULT 1,
    is_revoked boolean DEFAULT false,
    revoked_at timestamp without time zone,
    user_agent text,
    ip_address inet,
    device_id character varying(255),
    security_flags jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT refresh_tokens_expires_at_check CHECK ((expires_at > created_at))
);


--
-- TOC entry 5568 (class 0 OID 0)
-- Dependencies: 294
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.refresh_tokens IS 'Enhanced authentication: refresh tokens для долгосрочной аутентификации';


--
-- TOC entry 5569 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN refresh_tokens.token_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'SHA-256 хеш refresh token для безопасности';


--
-- TOC entry 5570 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN refresh_tokens.use_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.use_count IS 'Количество использований токена для мониторинга';


--
-- TOC entry 5571 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN refresh_tokens.device_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.device_id IS 'Уникальный идентификатор устройства для multi-device support';


--
-- TOC entry 5572 (class 0 OID 0)
-- Dependencies: 294
-- Name: COLUMN refresh_tokens.security_flags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.security_flags IS 'Дополнительные флаги безопасности в JSON формате';


--
-- TOC entry 295 (class 1259 OID 18681)
-- Name: active_user_sessions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_user_sessions AS
 SELECT rt.id,
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
    (EXTRACT(epoch FROM ((rt.expires_at)::timestamp with time zone - now())) / (3600)::numeric) AS hours_until_expiry
   FROM (public.refresh_tokens rt
     JOIN public.auth_users au ON ((rt.user_id = au.id)))
  WHERE ((rt.is_revoked = false) AND (rt.expires_at > now()))
  ORDER BY rt.last_used_at DESC;


--
-- TOC entry 5573 (class 0 OID 0)
-- Dependencies: 295
-- Name: VIEW active_user_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.active_user_sessions IS 'Активные пользовательские сессии с refresh tokens';


--
-- TOC entry 275 (class 1259 OID 18191)
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id integer NOT NULL,
    action character varying(20) NOT NULL,
    old_values jsonb,
    new_values jsonb,
    user_id integer,
    tenant_id uuid,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 274 (class 1259 OID 18190)
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5574 (class 0 OID 0)
-- Dependencies: 274
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- TOC entry 220 (class 1259 OID 16466)
-- Name: auth_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auth_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5575 (class 0 OID 0)
-- Dependencies: 220
-- Name: auth_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auth_users_id_seq OWNED BY public.auth_users.id;


--
-- TOC entry 259 (class 1259 OID 18022)
-- Name: construction_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_projects (
    id integer NOT NULL,
    customer_name character varying(255),
    object_address text,
    contractor_name character varying(255),
    contract_number character varying(100),
    deadline date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    tenant_id character varying(255),
    status character varying(50) DEFAULT 'draft'::character varying,
    name character varying(255),
    address text,
    type character varying(100),
    total_area numeric(12,2),
    project_code character varying(50)
);


--
-- TOC entry 258 (class 1259 OID 18021)
-- Name: construction_projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.construction_projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5576 (class 0 OID 0)
-- Dependencies: 258
-- Name: construction_projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.construction_projects_id_seq OWNED BY public.construction_projects.id;


--
-- TOC entry 271 (class 1259 OID 18149)
-- Name: constructive_elements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.constructive_elements (
    id integer NOT NULL,
    object_parameters_id integer,
    element_type character varying(100) NOT NULL,
    material character varying(255),
    characteristics text,
    quantity numeric(12,2),
    unit character varying(50),
    notes text,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 270 (class 1259 OID 18148)
-- Name: constructive_elements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.constructive_elements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5577 (class 0 OID 0)
-- Dependencies: 270
-- Name: constructive_elements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.constructive_elements_id_seq OWNED BY public.constructive_elements.id;


--
-- TOC entry 285 (class 1259 OID 18318)
-- Name: customer_estimate_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_estimate_history (
    id integer NOT NULL,
    estimate_id integer,
    action character varying(50) NOT NULL,
    changes jsonb,
    old_values jsonb,
    new_values jsonb,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 284 (class 1259 OID 18317)
-- Name: customer_estimate_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_estimate_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5578 (class 0 OID 0)
-- Dependencies: 284
-- Name: customer_estimate_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_estimate_history_id_seq OWNED BY public.customer_estimate_history.id;


--
-- TOC entry 283 (class 1259 OID 18296)
-- Name: customer_estimate_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_estimate_items (
    id integer NOT NULL,
    estimate_id integer,
    item_type character varying(20) NOT NULL,
    reference_id character varying(50),
    name text NOT NULL,
    unit character varying(50),
    quantity numeric(12,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    original_unit_price numeric(12,2),
    total_amount numeric(15,2) NOT NULL,
    sort_order integer DEFAULT 0,
    notes text,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text
);


--
-- TOC entry 5579 (class 0 OID 0)
-- Dependencies: 283
-- Name: COLUMN customer_estimate_items.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_estimate_items.description IS 'Описание позиции сметы';


--
-- TOC entry 282 (class 1259 OID 18295)
-- Name: customer_estimate_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_estimate_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5580 (class 0 OID 0)
-- Dependencies: 282
-- Name: customer_estimate_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_estimate_items_id_seq OWNED BY public.customer_estimate_items.id;


--
-- TOC entry 287 (class 1259 OID 18338)
-- Name: customer_estimate_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_estimate_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    template_data jsonb NOT NULL,
    is_public boolean DEFAULT false,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 286 (class 1259 OID 18337)
-- Name: customer_estimate_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_estimate_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5581 (class 0 OID 0)
-- Dependencies: 286
-- Name: customer_estimate_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_estimate_templates_id_seq OWNED BY public.customer_estimate_templates.id;


--
-- TOC entry 281 (class 1259 OID 18264)
-- Name: customer_estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_estimates (
    id integer NOT NULL,
    project_id integer NOT NULL,
    name character varying(255) DEFAULT 'Смета заказчика'::character varying NOT NULL,
    description text,
    version integer DEFAULT 1,
    status character varying(50) DEFAULT 'draft'::character varying,
    total_amount numeric(15,2) DEFAULT 0,
    work_coefficient numeric(8,3) DEFAULT 1.000,
    material_coefficient numeric(8,3) DEFAULT 1.000,
    user_id integer,
    tenant_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    approved_by integer,
    estimate_number character varying(50) NOT NULL,
    currency character varying(10) DEFAULT 'RUB'::character varying,
    notes text,
    customer_name character varying(255),
    CONSTRAINT check_estimate_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying])::text[])))
);


--
-- TOC entry 5582 (class 0 OID 0)
-- Dependencies: 281
-- Name: COLUMN customer_estimates.customer_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.customer_estimates.customer_name IS 'Имя заказчика для сметы';


--
-- TOC entry 290 (class 1259 OID 18523)
-- Name: customer_estimates_backup_2025_10_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_estimates_backup_2025_10_05 (
    id integer,
    project_id integer,
    name character varying(255),
    description text,
    version integer,
    status character varying(50),
    total_amount numeric(15,2),
    work_coefficient numeric(8,3),
    material_coefficient numeric(8,3),
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    approved_at timestamp without time zone,
    approved_by integer
);


--
-- TOC entry 280 (class 1259 OID 18263)
-- Name: customer_estimates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_estimates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5583 (class 0 OID 0)
-- Dependencies: 280
-- Name: customer_estimates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_estimates_id_seq OWNED BY public.customer_estimates.id;


--
-- TOC entry 273 (class 1259 OID 18170)
-- Name: engineering_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineering_systems (
    id integer NOT NULL,
    object_parameters_id integer,
    system_type character varying(100) NOT NULL,
    characteristics text,
    capacity character varying(255),
    efficiency character varying(100),
    notes text,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 272 (class 1259 OID 18169)
-- Name: engineering_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.engineering_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5584 (class 0 OID 0)
-- Dependencies: 272
-- Name: engineering_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.engineering_systems_id_seq OWNED BY public.engineering_systems.id;


--
-- TOC entry 240 (class 1259 OID 16991)
-- Name: estimate_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    item_type text NOT NULL,
    work_id text,
    material_id text,
    name text NOT NULL,
    unit text,
    quantity numeric(14,4) DEFAULT 0 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    line_total numeric(14,2) GENERATED ALWAYS AS ((quantity * unit_price)) STORED,
    parent_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer,
    CONSTRAINT estimate_items_item_type_check CHECK ((item_type = ANY (ARRAY['work'::text, 'material'::text, 'custom'::text])))
);


--
-- TOC entry 239 (class 1259 OID 16957)
-- Name: estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    number text,
    version integer DEFAULT 1 NOT NULL,
    title text,
    status text DEFAULT 'draft'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer
);


--
-- TOC entry 289 (class 1259 OID 18453)
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(254) NOT NULL,
    phone character varying(20),
    company character varying(200),
    project_type character varying(50),
    budget character varying(100),
    message text,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    page_path character varying(500),
    env_name character varying(20),
    ip_address inet,
    user_agent text,
    consent boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 288 (class 1259 OID 18452)
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5585 (class 0 OID 0)
-- Dependencies: 288
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- TOC entry 234 (class 1259 OID 16784)
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id text NOT NULL,
    name text NOT NULL,
    image_url text,
    item_url text,
    unit text,
    unit_price numeric(14,2),
    expenditure numeric(14,6),
    weight numeric(14,3),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid
);


--
-- TOC entry 244 (class 1259 OID 17113)
-- Name: materials_effective; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.materials_effective AS
 SELECT DISTINCT ON (id) id,
    tenant_id,
    name,
    image_url,
    item_url,
    unit,
    unit_price,
    expenditure,
    weight,
    created_at,
    updated_at
   FROM public.materials
  WHERE ((tenant_id IS NULL) OR ((current_setting('app.tenant_id'::text, true) IS NOT NULL) AND (tenant_id = (current_setting('app.tenant_id'::text))::uuid)))
  ORDER BY id,
        CASE
            WHEN ((current_setting('app.tenant_id'::text, true) IS NOT NULL) AND (tenant_id = (current_setting('app.tenant_id'::text))::uuid)) THEN 0
            ELSE 1
        END;


--
-- TOC entry 267 (class 1259 OID 18106)
-- Name: object_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.object_parameters (
    id integer NOT NULL,
    project_id integer,
    building_type character varying(255),
    construction_category integer,
    floors_above_ground integer,
    floors_below_ground integer,
    height_above_ground numeric(10,2),
    height_below_ground numeric(10,2),
    total_area numeric(12,2),
    building_area numeric(12,2),
    estimated_cost numeric(15,2),
    construction_complexity character varying(100),
    seismic_zone integer,
    wind_load numeric(8,2),
    snow_load numeric(8,2),
    soil_conditions character varying(255),
    groundwater_level numeric(10,2),
    climate_zone character varying(100),
    user_id integer,
    tenant_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 291 (class 1259 OID 18528)
-- Name: object_parameters_backup_2025_10_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.object_parameters_backup_2025_10_05 (
    id integer,
    project_id integer,
    building_type character varying(255),
    construction_category integer,
    floors_above_ground integer,
    floors_below_ground integer,
    height_above_ground numeric(10,2),
    height_below_ground numeric(10,2),
    total_area numeric(12,2),
    building_area numeric(12,2),
    estimated_cost numeric(15,2),
    construction_complexity character varying(100),
    seismic_zone integer,
    wind_load numeric(8,2),
    snow_load numeric(8,2),
    soil_conditions character varying(255),
    groundwater_level numeric(10,2),
    climate_zone character varying(100),
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


--
-- TOC entry 266 (class 1259 OID 18105)
-- Name: object_parameters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.object_parameters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5586 (class 0 OID 0)
-- Dependencies: 266
-- Name: object_parameters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.object_parameters_id_seq OWNED BY public.object_parameters.id;


--
-- TOC entry 227 (class 1259 OID 16512)
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    tracking_no bigint NOT NULL,
    product_name character varying(255) NOT NULL,
    quantity integer NOT NULL,
    status integer DEFAULT 0,
    amount numeric(10,2) NOT NULL,
    user_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 226 (class 1259 OID 16511)
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5587 (class 0 OID 0)
-- Dependencies: 226
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- TOC entry 277 (class 1259 OID 18206)
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 276 (class 1259 OID 18205)
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5588 (class 0 OID 0)
-- Dependencies: 276
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- TOC entry 230 (class 1259 OID 16625)
-- Name: phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phases (
    id text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 269 (class 1259 OID 18127)
-- Name: project_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_rooms (
    id integer NOT NULL,
    object_parameters_id integer,
    room_name character varying(255) NOT NULL,
    area numeric(10,2),
    height numeric(8,2),
    volume numeric(12,2),
    finish_class character varying(100),
    purpose character varying(255),
    sort_order integer DEFAULT 0,
    user_id integer,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    perimeter numeric(10,2) DEFAULT 0,
    window1_width numeric(8,2) DEFAULT 0,
    window1_height numeric(8,2) DEFAULT 0,
    window2_width numeric(8,2) DEFAULT 0,
    window2_height numeric(8,2) DEFAULT 0,
    window3_width numeric(8,2) DEFAULT 0,
    window3_height numeric(8,2) DEFAULT 0,
    portal1_width numeric(8,2) DEFAULT 0,
    portal1_height numeric(8,2) DEFAULT 0,
    portal2_width numeric(8,2) DEFAULT 0,
    portal2_height numeric(8,2) DEFAULT 0,
    prostenki numeric(10,2) DEFAULT 0,
    doors_count integer DEFAULT 0,
    ceiling_area numeric(10,2) DEFAULT 0.00,
    ceiling_slopes numeric(10,2) DEFAULT 0.00
);


--
-- TOC entry 5589 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN project_rooms.ceiling_area; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_rooms.ceiling_area IS 'Площадь потолка в квадратных метрах';


--
-- TOC entry 5590 (class 0 OID 0)
-- Dependencies: 269
-- Name: COLUMN project_rooms.ceiling_slopes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.project_rooms.ceiling_slopes IS 'Откосы потолочные в метрах погонных';


--
-- TOC entry 268 (class 1259 OID 18126)
-- Name: project_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5591 (class 0 OID 0)
-- Dependencies: 268
-- Name: project_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_rooms_id_seq OWNED BY public.project_rooms.id;


--
-- TOC entry 238 (class 1259 OID 16924)
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    owner_user_id integer,
    name text NOT NULL,
    description text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    updated_by integer
);


--
-- TOC entry 293 (class 1259 OID 18647)
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5592 (class 0 OID 0)
-- Dependencies: 293
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- TOC entry 279 (class 1259 OID 18219)
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_id integer,
    permission_id integer,
    granted_by integer,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 278 (class 1259 OID 18218)
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5593 (class 0 OID 0)
-- Dependencies: 278
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- TOC entry 261 (class 1259 OID 18041)
-- Name: room_parameters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_parameters (
    id integer NOT NULL,
    project_id integer,
    room_id character varying(100) NOT NULL,
    room_name character varying(255) NOT NULL,
    room_type character varying(50) DEFAULT 'living'::character varying,
    room_order integer DEFAULT 1,
    parameter_type character varying(100) NOT NULL,
    parameter_value numeric(10,3) DEFAULT 0,
    window_length numeric(10,3) DEFAULT 0,
    window_height numeric(10,3) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 260 (class 1259 OID 18040)
-- Name: room_parameters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_parameters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5594 (class 0 OID 0)
-- Dependencies: 260
-- Name: room_parameters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_parameters_id_seq OWNED BY public.room_parameters.id;


--
-- TOC entry 231 (class 1259 OID 16635)
-- Name: stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stages (
    id text NOT NULL,
    name text NOT NULL,
    phase_id text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 229 (class 1259 OID 16526)
-- Name: statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statistics (
    id integer NOT NULL,
    metric_name character varying(255) NOT NULL,
    metric_value integer NOT NULL,
    percentage numeric(5,2),
    extra_value integer,
    is_loss boolean DEFAULT false,
    color character varying(50) DEFAULT 'primary'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 228 (class 1259 OID 16525)
-- Name: statistics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statistics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5595 (class 0 OID 0)
-- Dependencies: 228
-- Name: statistics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statistics_id_seq OWNED BY public.statistics.id;


--
-- TOC entry 232 (class 1259 OID 16650)
-- Name: substages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.substages (
    id text NOT NULL,
    name text NOT NULL,
    stage_id text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 255 (class 1259 OID 17980)
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id integer NOT NULL,
    team_id uuid,
    user_id integer,
    role character varying(100) DEFAULT 'member'::character varying,
    permissions jsonb DEFAULT '{}'::jsonb,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


--
-- TOC entry 254 (class 1259 OID 17979)
-- Name: team_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.team_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5596 (class 0 OID 0)
-- Dependencies: 254
-- Name: team_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.team_members_id_seq OWNED BY public.team_members.id;


--
-- TOC entry 246 (class 1259 OID 17167)
-- Name: tenant_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_counters (
    tenant_id uuid NOT NULL,
    estimate_seq bigint DEFAULT 0 NOT NULL
);


--
-- TOC entry 241 (class 1259 OID 17049)
-- Name: tenant_material_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_material_prices (
    tenant_id uuid NOT NULL,
    material_id text NOT NULL,
    price numeric(14,2) NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_to date
);


--
-- TOC entry 242 (class 1259 OID 17068)
-- Name: tenant_work_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_work_prices (
    tenant_id uuid NOT NULL,
    work_id text NOT NULL,
    price numeric(14,2) NOT NULL,
    valid_from date DEFAULT CURRENT_DATE NOT NULL,
    valid_to date
);


--
-- TOC entry 236 (class 1259 OID 16894)
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 253 (class 1259 OID 17964)
-- Name: user_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activities (
    id integer NOT NULL,
    user_id integer,
    activity_type character varying(100) NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 252 (class 1259 OID 17963)
-- Name: user_activities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_activities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5597 (class 0 OID 0)
-- Dependencies: 252
-- Name: user_activities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_activities_id_seq OWNED BY public.user_activities.id;


--
-- TOC entry 251 (class 1259 OID 17944)
-- Name: user_custom_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_custom_links (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(100) NOT NULL,
    url character varying(500) NOT NULL,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 250 (class 1259 OID 17943)
-- Name: user_custom_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_custom_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5598 (class 0 OID 0)
-- Dependencies: 250
-- Name: user_custom_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_custom_links_id_seq OWNED BY public.user_custom_links.id;


--
-- TOC entry 257 (class 1259 OID 17998)
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text,
    notification_type character varying(50) DEFAULT 'info'::character varying,
    is_read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 256 (class 1259 OID 17997)
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5599 (class 0 OID 0)
-- Dependencies: 256
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_notifications_id_seq OWNED BY public.user_notifications.id;


--
-- TOC entry 265 (class 1259 OID 18080)
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    id integer NOT NULL,
    user_id integer,
    role_id integer,
    tenant_id uuid,
    assigned_by integer,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true
);


--
-- TOC entry 264 (class 1259 OID 18079)
-- Name: user_role_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_role_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5600 (class 0 OID 0)
-- Dependencies: 264
-- Name: user_role_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_role_assignments_id_seq OWNED BY public.user_role_assignments.id;


--
-- TOC entry 263 (class 1259 OID 18065)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- TOC entry 262 (class 1259 OID 18064)
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5601 (class 0 OID 0)
-- Dependencies: 262
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- TOC entry 223 (class 1259 OID 16482)
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    user_agent text,
    ip_address inet,
    created_at timestamp without time zone DEFAULT now(),
    is_revoked boolean DEFAULT false NOT NULL,
    session_type character varying(20) DEFAULT 'jwt'::character varying,
    device_id character varying(255),
    is_active boolean DEFAULT true
);


--
-- TOC entry 222 (class 1259 OID 16481)
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5602 (class 0 OID 0)
-- Dependencies: 222
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- TOC entry 247 (class 1259 OID 17909)
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id integer NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 249 (class 1259 OID 17925)
-- Name: user_social_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_social_links (
    id integer NOT NULL,
    user_id integer NOT NULL,
    platform character varying(50) NOT NULL,
    url character varying(500) NOT NULL,
    is_visible boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 248 (class 1259 OID 17924)
-- Name: user_social_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_social_links_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5603 (class 0 OID 0)
-- Dependencies: 248
-- Name: user_social_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_social_links_id_seq OWNED BY public.user_social_links.id;


--
-- TOC entry 237 (class 1259 OID 16903)
-- Name: user_tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tenants (
    tenant_id uuid NOT NULL,
    user_id integer NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT false,
    CONSTRAINT user_tenants_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'estimator'::text, 'foreman'::text, 'client'::text, 'viewer'::text])))
);


--
-- TOC entry 225 (class 1259 OID 16500)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(20),
    "position" character varying(100),
    department character varying(100),
    location character varying(100),
    bio text,
    avatar text,
    updated_at timestamp with time zone DEFAULT now(),
    company character varying(255),
    skills jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone
);


--
-- TOC entry 224 (class 1259 OID 16499)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5604 (class 0 OID 0)
-- Dependencies: 224
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 235 (class 1259 OID 16793)
-- Name: work_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_materials (
    work_id text NOT NULL,
    material_id text NOT NULL,
    consumption_per_work_unit numeric(18,6),
    waste_coeff numeric(8,4) DEFAULT 1.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 292 (class 1259 OID 18556)
-- Name: work_materials_global_archive_2025_10_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_materials_global_archive_2025_10_05 (
    work_id text,
    material_id text,
    consumption_per_work_unit numeric(18,6),
    waste_coeff numeric(8,4),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- TOC entry 243 (class 1259 OID 17087)
-- Name: work_materials_tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_materials_tenant (
    tenant_id uuid NOT NULL,
    work_id text NOT NULL,
    material_id text NOT NULL,
    consumption_per_work_unit numeric(14,4) NOT NULL,
    waste_coeff numeric(14,4) DEFAULT 1.0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 16665)
-- Name: works_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.works_ref (
    id text NOT NULL,
    name text NOT NULL,
    unit text,
    unit_price numeric(14,2),
    phase_id text,
    stage_id text,
    substage_id text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_id uuid
);


--
-- TOC entry 245 (class 1259 OID 17118)
-- Name: works_effective; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.works_effective AS
 SELECT DISTINCT ON (id) id,
    tenant_id,
    name,
    unit,
    unit_price,
    phase_id,
    stage_id,
    substage_id,
    sort_order,
    created_at,
    updated_at
   FROM public.works_ref
  WHERE ((tenant_id IS NULL) OR ((current_setting('app.tenant_id'::text, true) IS NOT NULL) AND (tenant_id = (current_setting('app.tenant_id'::text))::uuid)))
  ORDER BY id,
        CASE
            WHEN ((current_setting('app.tenant_id'::text, true) IS NOT NULL) AND (tenant_id = (current_setting('app.tenant_id'::text))::uuid)) THEN 0
            ELSE 1
        END;


--
-- TOC entry 5004 (class 2604 OID 18194)
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- TOC entry 4866 (class 2604 OID 16470)
-- Name: auth_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users ALTER COLUMN id SET DEFAULT nextval('public.auth_users_id_seq'::regclass);


--
-- TOC entry 4956 (class 2604 OID 18025)
-- Name: construction_projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects ALTER COLUMN id SET DEFAULT nextval('public.construction_projects_id_seq'::regclass);


--
-- TOC entry 4998 (class 2604 OID 18152)
-- Name: constructive_elements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constructive_elements ALTER COLUMN id SET DEFAULT nextval('public.constructive_elements_id_seq'::regclass);


--
-- TOC entry 5025 (class 2604 OID 18321)
-- Name: customer_estimate_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_history ALTER COLUMN id SET DEFAULT nextval('public.customer_estimate_history_id_seq'::regclass);


--
-- TOC entry 5021 (class 2604 OID 18299)
-- Name: customer_estimate_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_items ALTER COLUMN id SET DEFAULT nextval('public.customer_estimate_items_id_seq'::regclass);


--
-- TOC entry 5027 (class 2604 OID 18341)
-- Name: customer_estimate_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_templates ALTER COLUMN id SET DEFAULT nextval('public.customer_estimate_templates_id_seq'::regclass);


--
-- TOC entry 5011 (class 2604 OID 18267)
-- Name: customer_estimates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates ALTER COLUMN id SET DEFAULT nextval('public.customer_estimates_id_seq'::regclass);


--
-- TOC entry 5001 (class 2604 OID 18173)
-- Name: engineering_systems id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_systems ALTER COLUMN id SET DEFAULT nextval('public.engineering_systems_id_seq'::regclass);


--
-- TOC entry 5031 (class 2604 OID 18456)
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- TOC entry 4976 (class 2604 OID 18109)
-- Name: object_parameters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters ALTER COLUMN id SET DEFAULT nextval('public.object_parameters_id_seq'::regclass);


--
-- TOC entry 4882 (class 2604 OID 16515)
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- TOC entry 5006 (class 2604 OID 18209)
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- TOC entry 4979 (class 2604 OID 18130)
-- Name: project_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rooms ALTER COLUMN id SET DEFAULT nextval('public.project_rooms_id_seq'::regclass);


--
-- TOC entry 5035 (class 2604 OID 18651)
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- TOC entry 5009 (class 2604 OID 18222)
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- TOC entry 4960 (class 2604 OID 18044)
-- Name: room_parameters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_parameters ALTER COLUMN id SET DEFAULT nextval('public.room_parameters_id_seq'::regclass);


--
-- TOC entry 4885 (class 2604 OID 16529)
-- Name: statistics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statistics ALTER COLUMN id SET DEFAULT nextval('public.statistics_id_seq'::regclass);


--
-- TOC entry 4946 (class 2604 OID 17983)
-- Name: team_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members ALTER COLUMN id SET DEFAULT nextval('public.team_members_id_seq'::regclass);


--
-- TOC entry 4943 (class 2604 OID 17967)
-- Name: user_activities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities ALTER COLUMN id SET DEFAULT nextval('public.user_activities_id_seq'::regclass);


--
-- TOC entry 4939 (class 2604 OID 17947)
-- Name: user_custom_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_links ALTER COLUMN id SET DEFAULT nextval('public.user_custom_links_id_seq'::regclass);


--
-- TOC entry 4951 (class 2604 OID 18001)
-- Name: user_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications ALTER COLUMN id SET DEFAULT nextval('public.user_notifications_id_seq'::regclass);


--
-- TOC entry 4973 (class 2604 OID 18083)
-- Name: user_role_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments ALTER COLUMN id SET DEFAULT nextval('public.user_role_assignments_id_seq'::regclass);


--
-- TOC entry 4968 (class 2604 OID 18068)
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- TOC entry 4872 (class 2604 OID 16485)
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- TOC entry 4935 (class 2604 OID 17928)
-- Name: user_social_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_social_links ALTER COLUMN id SET DEFAULT nextval('public.user_social_links_id_seq'::regclass);


--
-- TOC entry 4877 (class 2604 OID 16503)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5229 (class 2606 OID 18199)
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 5046 (class 2606 OID 16480)
-- Name: auth_users auth_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_email_key UNIQUE (email);


--
-- TOC entry 5048 (class 2606 OID 16478)
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- TOC entry 5181 (class 2606 OID 18031)
-- Name: construction_projects construction_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_pkey PRIMARY KEY (id);


--
-- TOC entry 5223 (class 2606 OID 18158)
-- Name: constructive_elements constructive_elements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constructive_elements
    ADD CONSTRAINT constructive_elements_pkey PRIMARY KEY (id);


--
-- TOC entry 5266 (class 2606 OID 18326)
-- Name: customer_estimate_history customer_estimate_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_history
    ADD CONSTRAINT customer_estimate_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5258 (class 2606 OID 18306)
-- Name: customer_estimate_items customer_estimate_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_items
    ADD CONSTRAINT customer_estimate_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5270 (class 2606 OID 18348)
-- Name: customer_estimate_templates customer_estimate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_templates
    ADD CONSTRAINT customer_estimate_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5245 (class 2606 OID 18279)
-- Name: customer_estimates customer_estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates
    ADD CONSTRAINT customer_estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 5226 (class 2606 OID 18179)
-- Name: engineering_systems engineering_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_systems
    ADD CONSTRAINT engineering_systems_pkey PRIMARY KEY (id);


--
-- TOC entry 5136 (class 2606 OID 17005)
-- Name: estimate_items estimate_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5132 (class 2606 OID 16968)
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- TOC entry 5142 (class 2606 OID 17886)
-- Name: tenant_material_prices ex_tmp_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_material_prices
    ADD CONSTRAINT ex_tmp_no_overlap EXCLUDE USING gist (tenant_id WITH =, material_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]'::text) WITH &&);


--
-- TOC entry 5149 (class 2606 OID 17889)
-- Name: tenant_work_prices ex_twp_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_work_prices
    ADD CONSTRAINT ex_twp_no_overlap EXCLUDE USING gist (tenant_id WITH =, work_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]'::text) WITH &&);


--
-- TOC entry 5274 (class 2606 OID 18463)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- TOC entry 5110 (class 2606 OID 16792)
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- TOC entry 5213 (class 2606 OID 18115)
-- Name: object_parameters object_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters
    ADD CONSTRAINT object_parameters_pkey PRIMARY KEY (id);


--
-- TOC entry 5215 (class 2606 OID 18262)
-- Name: object_parameters object_parameters_project_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters
    ADD CONSTRAINT object_parameters_project_id_unique UNIQUE (project_id);


--
-- TOC entry 5068 (class 2606 OID 16519)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 5235 (class 2606 OID 18217)
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- TOC entry 5237 (class 2606 OID 18215)
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5074 (class 2606 OID 16634)
-- Name: phases phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_pkey PRIMARY KEY (id);


--
-- TOC entry 5221 (class 2606 OID 18137)
-- Name: project_rooms project_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rooms
    ADD CONSTRAINT project_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 5129 (class 2606 OID 16934)
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- TOC entry 5282 (class 2606 OID 18661)
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 5284 (class 2606 OID 18663)
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- TOC entry 5241 (class 2606 OID 18225)
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5243 (class 2606 OID 18227)
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- TOC entry 5194 (class 2606 OID 18055)
-- Name: room_parameters room_parameters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_parameters
    ADD CONSTRAINT room_parameters_pkey PRIMARY KEY (id);


--
-- TOC entry 5077 (class 2606 OID 16644)
-- Name: stages stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_pkey PRIMARY KEY (id);


--
-- TOC entry 5072 (class 2606 OID 16534)
-- Name: statistics statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statistics
    ADD CONSTRAINT statistics_pkey PRIMARY KEY (id);


--
-- TOC entry 5080 (class 2606 OID 16659)
-- Name: substages substages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substages
    ADD CONSTRAINT substages_pkey PRIMARY KEY (id);


--
-- TOC entry 5175 (class 2606 OID 17991)
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- TOC entry 5159 (class 2606 OID 17172)
-- Name: tenant_counters tenant_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_counters
    ADD CONSTRAINT tenant_counters_pkey PRIMARY KEY (tenant_id);


--
-- TOC entry 5146 (class 2606 OID 17056)
-- Name: tenant_material_prices tenant_material_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_material_prices
    ADD CONSTRAINT tenant_material_prices_pkey PRIMARY KEY (tenant_id, material_id, valid_from);


--
-- TOC entry 5153 (class 2606 OID 17075)
-- Name: tenant_work_prices tenant_work_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_work_prices
    ADD CONSTRAINT tenant_work_prices_pkey PRIMARY KEY (tenant_id, work_id, valid_from);


--
-- TOC entry 5121 (class 2606 OID 16902)
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- TOC entry 5171 (class 2606 OID 17973)
-- Name: user_activities user_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);


--
-- TOC entry 5167 (class 2606 OID 17954)
-- Name: user_custom_links user_custom_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_links
    ADD CONSTRAINT user_custom_links_pkey PRIMARY KEY (id);


--
-- TOC entry 5179 (class 2606 OID 18009)
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5205 (class 2606 OID 18087)
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5207 (class 2606 OID 18089)
-- Name: user_role_assignments user_role_assignments_user_id_role_id_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_role_id_tenant_id_key UNIQUE (user_id, role_id, tenant_id);


--
-- TOC entry 5196 (class 2606 OID 18078)
-- Name: user_roles user_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_name_key UNIQUE (name);


--
-- TOC entry 5198 (class 2606 OID 18076)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- TOC entry 5059 (class 2606 OID 16490)
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 5161 (class 2606 OID 17918)
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5163 (class 2606 OID 17935)
-- Name: user_social_links user_social_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_social_links
    ADD CONSTRAINT user_social_links_pkey PRIMARY KEY (id);


--
-- TOC entry 5165 (class 2606 OID 17937)
-- Name: user_social_links user_social_links_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_social_links
    ADD CONSTRAINT user_social_links_user_id_platform_key UNIQUE (user_id, platform);


--
-- TOC entry 5126 (class 2606 OID 16911)
-- Name: user_tenants user_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_pkey PRIMARY KEY (tenant_id, user_id);


--
-- TOC entry 5062 (class 2606 OID 16510)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5064 (class 2606 OID 16508)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5119 (class 2606 OID 16802)
-- Name: work_materials work_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials
    ADD CONSTRAINT work_materials_pkey PRIMARY KEY (work_id, material_id);


--
-- TOC entry 5157 (class 2606 OID 17096)
-- Name: work_materials_tenant work_materials_tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials_tenant
    ADD CONSTRAINT work_materials_tenant_pkey PRIMARY KEY (tenant_id, work_id, material_id);


--
-- TOC entry 5097 (class 2606 OID 16674)
-- Name: works_ref works_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works_ref
    ADD CONSTRAINT works_ref_pkey PRIMARY KEY (id);


--
-- TOC entry 5230 (class 1259 OID 18259)
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at);


--
-- TOC entry 5231 (class 1259 OID 18257)
-- Name: idx_audit_log_table_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table_record ON public.audit_log USING btree (table_name, record_id);


--
-- TOC entry 5232 (class 1259 OID 18258)
-- Name: idx_audit_log_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user_tenant ON public.audit_log USING btree (user_id, tenant_id);


--
-- TOC entry 5049 (class 1259 OID 16496)
-- Name: idx_auth_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_users_email ON public.auth_users USING btree (email);


--
-- TOC entry 5050 (class 1259 OID 18448)
-- Name: idx_auth_users_email_fast; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_users_email_fast ON public.auth_users USING btree (email) WHERE (email IS NOT NULL);


--
-- TOC entry 5051 (class 1259 OID 18606)
-- Name: idx_auth_users_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_users_login ON public.auth_users USING btree (email, password_hash) WHERE (email IS NOT NULL);


--
-- TOC entry 5052 (class 1259 OID 18633)
-- Name: idx_auth_users_login_opt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_users_login_opt ON public.auth_users USING btree (email, is_active);


--
-- TOC entry 5182 (class 1259 OID 18521)
-- Name: idx_construction_projects_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_tenant ON public.construction_projects USING btree (tenant_id);


--
-- TOC entry 5183 (class 1259 OID 18646)
-- Name: idx_construction_projects_tenant_basic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_tenant_basic ON public.construction_projects USING btree (tenant_id);


--
-- TOC entry 5184 (class 1259 OID 18449)
-- Name: idx_construction_projects_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_user_id ON public.construction_projects USING btree (user_id);


--
-- TOC entry 5185 (class 1259 OID 18522)
-- Name: idx_construction_projects_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_user_tenant ON public.construction_projects USING btree (user_id, tenant_id);


--
-- TOC entry 5224 (class 1259 OID 18252)
-- Name: idx_constructive_elements_object_params; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_constructive_elements_object_params ON public.constructive_elements USING btree (object_parameters_id);


--
-- TOC entry 5267 (class 1259 OID 18361)
-- Name: idx_customer_estimate_history_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_history_action ON public.customer_estimate_history USING btree (action);


--
-- TOC entry 5268 (class 1259 OID 18360)
-- Name: idx_customer_estimate_history_estimate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_history_estimate ON public.customer_estimate_history USING btree (estimate_id);


--
-- TOC entry 5259 (class 1259 OID 18357)
-- Name: idx_customer_estimate_items_estimate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_items_estimate ON public.customer_estimate_items USING btree (estimate_id);


--
-- TOC entry 5260 (class 1259 OID 18447)
-- Name: idx_customer_estimate_items_estimate_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_items_estimate_id ON public.customer_estimate_items USING btree (estimate_id);


--
-- TOC entry 5261 (class 1259 OID 18359)
-- Name: idx_customer_estimate_items_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_items_reference ON public.customer_estimate_items USING btree (reference_id);


--
-- TOC entry 5262 (class 1259 OID 18358)
-- Name: idx_customer_estimate_items_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_items_type ON public.customer_estimate_items USING btree (item_type);


--
-- TOC entry 5271 (class 1259 OID 18362)
-- Name: idx_customer_estimate_templates_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimate_templates_user_tenant ON public.customer_estimate_templates USING btree (user_id, tenant_id);


--
-- TOC entry 5246 (class 1259 OID 18450)
-- Name: idx_customer_estimates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_created_at ON public.customer_estimates USING btree (created_at DESC);


--
-- TOC entry 5247 (class 1259 OID 18596)
-- Name: idx_customer_estimates_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_customer_name ON public.customer_estimates USING btree (customer_name);


--
-- TOC entry 5248 (class 1259 OID 18354)
-- Name: idx_customer_estimates_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_project ON public.customer_estimates USING btree (project_id);


--
-- TOC entry 5249 (class 1259 OID 18554)
-- Name: idx_customer_estimates_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_project_id ON public.customer_estimates USING btree (project_id);


--
-- TOC entry 5250 (class 1259 OID 18586)
-- Name: idx_customer_estimates_project_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customer_estimates_project_number ON public.customer_estimates USING btree (project_id, estimate_number);


--
-- TOC entry 5251 (class 1259 OID 18356)
-- Name: idx_customer_estimates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_status ON public.customer_estimates USING btree (status);


--
-- TOC entry 5252 (class 1259 OID 18588)
-- Name: idx_customer_estimates_status_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_status_tenant ON public.customer_estimates USING btree (status, tenant_id);


--
-- TOC entry 5253 (class 1259 OID 18552)
-- Name: idx_customer_estimates_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_tenant_id ON public.customer_estimates USING btree (tenant_id);


--
-- TOC entry 5254 (class 1259 OID 18587)
-- Name: idx_customer_estimates_tenant_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_tenant_project ON public.customer_estimates USING btree (tenant_id, project_id);


--
-- TOC entry 5255 (class 1259 OID 18446)
-- Name: idx_customer_estimates_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_user_id ON public.customer_estimates USING btree (user_id);


--
-- TOC entry 5256 (class 1259 OID 18355)
-- Name: idx_customer_estimates_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_estimates_user_tenant ON public.customer_estimates USING btree (user_id, tenant_id);


--
-- TOC entry 5137 (class 1259 OID 17042)
-- Name: idx_eitems_parent_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eitems_parent_sort ON public.estimate_items USING btree (tenant_id, estimate_id, parent_id, sort_order);


--
-- TOC entry 5138 (class 1259 OID 17041)
-- Name: idx_eitems_tenant_estimate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eitems_tenant_estimate ON public.estimate_items USING btree (tenant_id, estimate_id);


--
-- TOC entry 5227 (class 1259 OID 18253)
-- Name: idx_engineering_systems_object_params; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineering_systems_object_params ON public.engineering_systems USING btree (object_parameters_id);


--
-- TOC entry 5263 (class 1259 OID 18604)
-- Name: idx_estimate_items_estimate_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimate_items_estimate_sort ON public.customer_estimate_items USING btree (estimate_id, sort_order);


--
-- TOC entry 5139 (class 1259 OID 17891)
-- Name: idx_estimate_items_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimate_items_sort ON public.estimate_items USING btree (tenant_id, estimate_id, parent_id, sort_order);


--
-- TOC entry 5140 (class 1259 OID 17890)
-- Name: idx_estimate_items_tenant_estimate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimate_items_tenant_estimate ON public.estimate_items USING btree (tenant_id, estimate_id);


--
-- TOC entry 5264 (class 1259 OID 18605)
-- Name: idx_estimate_items_type_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimate_items_type_reference ON public.customer_estimate_items USING btree (item_type, reference_id);


--
-- TOC entry 5133 (class 1259 OID 16989)
-- Name: idx_estimates_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_tenant_id ON public.estimates USING btree (tenant_id);


--
-- TOC entry 5134 (class 1259 OID 16990)
-- Name: idx_estimates_tenant_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_tenant_project ON public.estimates USING btree (tenant_id, project_id);


--
-- TOC entry 5272 (class 1259 OID 18464)
-- Name: idx_leads_email_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_email_created ON public.leads USING btree (email, created_at DESC);


--
-- TOC entry 5098 (class 1259 OID 16844)
-- Name: idx_materials_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_id ON public.materials USING btree (id);


--
-- TOC entry 5099 (class 1259 OID 16847)
-- Name: idx_materials_join; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_join ON public.materials USING btree (id, name, unit, unit_price, image_url, item_url);


--
-- TOC entry 5100 (class 1259 OID 16813)
-- Name: idx_materials_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_name ON public.materials USING gin (to_tsvector('simple'::regconfig, name));


--
-- TOC entry 5101 (class 1259 OID 18597)
-- Name: idx_materials_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_name_gin ON public.materials USING gin (to_tsvector('russian'::regconfig, name));


--
-- TOC entry 5102 (class 1259 OID 18444)
-- Name: idx_materials_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_name_trgm ON public.materials USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5103 (class 1259 OID 18598)
-- Name: idx_materials_price_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_price_range ON public.materials USING btree (unit_price) WHERE (unit_price > (0)::numeric);


--
-- TOC entry 5104 (class 1259 OID 17892)
-- Name: idx_materials_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_tenant_id ON public.materials USING btree (tenant_id, id);


--
-- TOC entry 5105 (class 1259 OID 17047)
-- Name: idx_materials_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_tenant_name ON public.materials USING btree (tenant_id, name);


--
-- TOC entry 5106 (class 1259 OID 18599)
-- Name: idx_materials_tenant_price_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_tenant_price_name ON public.materials USING btree (tenant_id, unit_price, name) WHERE (unit_price > (0)::numeric);


--
-- TOC entry 5107 (class 1259 OID 16845)
-- Name: idx_materials_unit_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_unit_price ON public.materials USING btree (unit_price);


--
-- TOC entry 5108 (class 1259 OID 18632)
-- Name: idx_materials_updated_at_opt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_updated_at_opt ON public.materials USING btree (updated_at DESC);


--
-- TOC entry 5208 (class 1259 OID 18248)
-- Name: idx_object_parameters_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_object_parameters_project ON public.object_parameters USING btree (project_id);


--
-- TOC entry 5209 (class 1259 OID 18555)
-- Name: idx_object_parameters_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_object_parameters_project_id ON public.object_parameters USING btree (project_id);


--
-- TOC entry 5210 (class 1259 OID 18553)
-- Name: idx_object_parameters_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_object_parameters_tenant_id ON public.object_parameters USING btree (tenant_id);


--
-- TOC entry 5211 (class 1259 OID 18249)
-- Name: idx_object_parameters_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_object_parameters_user_tenant ON public.object_parameters USING btree (user_id, tenant_id);


--
-- TOC entry 5065 (class 1259 OID 18615)
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- TOC entry 5066 (class 1259 OID 18616)
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- TOC entry 5233 (class 1259 OID 18256)
-- Name: idx_permissions_resource_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_resource_action ON public.permissions USING btree (resource, action);


--
-- TOC entry 5216 (class 1259 OID 18593)
-- Name: idx_project_rooms_ceiling_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_rooms_ceiling_area ON public.project_rooms USING btree (ceiling_area);


--
-- TOC entry 5217 (class 1259 OID 18594)
-- Name: idx_project_rooms_ceiling_slopes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_rooms_ceiling_slopes ON public.project_rooms USING btree (ceiling_slopes);


--
-- TOC entry 5218 (class 1259 OID 18250)
-- Name: idx_project_rooms_object_params; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_rooms_object_params ON public.project_rooms USING btree (object_parameters_id);


--
-- TOC entry 5219 (class 1259 OID 18251)
-- Name: idx_project_rooms_user_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_rooms_user_tenant ON public.project_rooms USING btree (user_id, tenant_id);


--
-- TOC entry 5186 (class 1259 OID 18584)
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_created_at ON public.construction_projects USING btree (created_at);


--
-- TOC entry 5187 (class 1259 OID 18583)
-- Name: idx_projects_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_deadline ON public.construction_projects USING btree (deadline);


--
-- TOC entry 5188 (class 1259 OID 18582)
-- Name: idx_projects_project_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_project_code ON public.construction_projects USING btree (project_code);


--
-- TOC entry 5189 (class 1259 OID 18581)
-- Name: idx_projects_tenant_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_projects_tenant_code_unique ON public.construction_projects USING btree (tenant_id, project_code) WHERE ((project_code IS NOT NULL) AND (tenant_id IS NOT NULL));


--
-- TOC entry 5127 (class 1259 OID 16956)
-- Name: idx_projects_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_tenant_id ON public.projects USING btree (tenant_id);


--
-- TOC entry 5275 (class 1259 OID 18672)
-- Name: idx_refresh_tokens_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_active ON public.refresh_tokens USING btree (user_id, is_revoked, expires_at);


--
-- TOC entry 5276 (class 1259 OID 18686)
-- Name: idx_refresh_tokens_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_device_id ON public.refresh_tokens USING btree (device_id) WHERE (device_id IS NOT NULL);


--
-- TOC entry 5277 (class 1259 OID 18671)
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- TOC entry 5278 (class 1259 OID 18673)
-- Name: idx_refresh_tokens_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_lookup ON public.refresh_tokens USING btree (token_hash, expires_at, is_revoked);


--
-- TOC entry 5279 (class 1259 OID 18670)
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- TOC entry 5280 (class 1259 OID 18669)
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- TOC entry 5238 (class 1259 OID 18255)
-- Name: idx_role_permissions_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


--
-- TOC entry 5239 (class 1259 OID 18254)
-- Name: idx_role_permissions_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role_id);


--
-- TOC entry 5190 (class 1259 OID 18061)
-- Name: idx_room_parameters_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_parameters_project_id ON public.room_parameters USING btree (project_id);


--
-- TOC entry 5191 (class 1259 OID 18063)
-- Name: idx_room_parameters_project_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_parameters_project_room ON public.room_parameters USING btree (project_id, room_id);


--
-- TOC entry 5192 (class 1259 OID 18062)
-- Name: idx_room_parameters_room_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_room_parameters_room_id ON public.room_parameters USING btree (room_id);


--
-- TOC entry 5075 (class 1259 OID 16719)
-- Name: idx_stages_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stages_phase ON public.stages USING btree (phase_id);


--
-- TOC entry 5069 (class 1259 OID 18617)
-- Name: idx_statistics_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statistics_id ON public.statistics USING btree (id);


--
-- TOC entry 5070 (class 1259 OID 18635)
-- Name: idx_statistics_perf_opt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statistics_perf_opt ON public.statistics USING btree (id DESC);


--
-- TOC entry 5078 (class 1259 OID 16720)
-- Name: idx_substages_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_substages_stage ON public.substages USING btree (stage_id);


--
-- TOC entry 5172 (class 1259 OID 18018)
-- Name: idx_team_members_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_team_id ON public.team_members USING btree (team_id);


--
-- TOC entry 5173 (class 1259 OID 18017)
-- Name: idx_team_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_team_members_user_id ON public.team_members USING btree (user_id);


--
-- TOC entry 5143 (class 1259 OID 17067)
-- Name: idx_tmat_prices_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tmat_prices_lookup ON public.tenant_material_prices USING btree (tenant_id, material_id, valid_from DESC);


--
-- TOC entry 5144 (class 1259 OID 17894)
-- Name: idx_tmp_tenant_material_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tmp_tenant_material_date ON public.tenant_material_prices USING btree (tenant_id, material_id, valid_from DESC);


--
-- TOC entry 5150 (class 1259 OID 17086)
-- Name: idx_twork_prices_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twork_prices_lookup ON public.tenant_work_prices USING btree (tenant_id, work_id, valid_from DESC);


--
-- TOC entry 5151 (class 1259 OID 17895)
-- Name: idx_twp_tenant_work_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_twp_tenant_work_date ON public.tenant_work_prices USING btree (tenant_id, work_id, valid_from DESC);


--
-- TOC entry 5168 (class 1259 OID 18016)
-- Name: idx_user_activities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activities_created_at ON public.user_activities USING btree (created_at);


--
-- TOC entry 5169 (class 1259 OID 18015)
-- Name: idx_user_activities_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_activities_user_id ON public.user_activities USING btree (user_id);


--
-- TOC entry 5176 (class 1259 OID 18020)
-- Name: idx_user_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_is_read ON public.user_notifications USING btree (is_read);


--
-- TOC entry 5177 (class 1259 OID 18019)
-- Name: idx_user_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);


--
-- TOC entry 5199 (class 1259 OID 18246)
-- Name: idx_user_role_assignments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_assignments_active ON public.user_role_assignments USING btree (is_active);


--
-- TOC entry 5200 (class 1259 OID 18247)
-- Name: idx_user_role_assignments_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_assignments_expires ON public.user_role_assignments USING btree (expires_at);


--
-- TOC entry 5201 (class 1259 OID 18244)
-- Name: idx_user_role_assignments_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_assignments_role ON public.user_role_assignments USING btree (role_id);


--
-- TOC entry 5202 (class 1259 OID 18245)
-- Name: idx_user_role_assignments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_assignments_tenant ON public.user_role_assignments USING btree (tenant_id);


--
-- TOC entry 5203 (class 1259 OID 18243)
-- Name: idx_user_role_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_assignments_user ON public.user_role_assignments USING btree (user_id);


--
-- TOC entry 5053 (class 1259 OID 16498)
-- Name: idx_user_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- TOC entry 5054 (class 1259 OID 17897)
-- Name: idx_user_sessions_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_token_hash ON public.user_sessions USING btree (token_hash);


--
-- TOC entry 5055 (class 1259 OID 17898)
-- Name: idx_user_sessions_user_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_expires ON public.user_sessions USING btree (user_id, expires_at);


--
-- TOC entry 5056 (class 1259 OID 16497)
-- Name: idx_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- TOC entry 5057 (class 1259 OID 17151)
-- Name: idx_user_sessions_user_revoked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_sessions_user_revoked ON public.user_sessions USING btree (user_id, is_revoked);


--
-- TOC entry 5122 (class 1259 OID 18481)
-- Name: idx_user_tenants_current; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tenants_current ON public.user_tenants USING btree (user_id) WHERE (is_current = true);


--
-- TOC entry 5123 (class 1259 OID 16922)
-- Name: idx_user_tenants_tenant_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tenants_tenant_role ON public.user_tenants USING btree (tenant_id, role);


--
-- TOC entry 5124 (class 1259 OID 16923)
-- Name: idx_user_tenants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tenants_user ON public.user_tenants USING btree (user_id);


--
-- TOC entry 5060 (class 1259 OID 17896)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5155 (class 1259 OID 17112)
-- Name: idx_wm_tenant_work; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wm_tenant_work ON public.work_materials_tenant USING btree (tenant_id, work_id);


--
-- TOC entry 5113 (class 1259 OID 18603)
-- Name: idx_work_materials_composite; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_materials_composite ON public.work_materials USING btree (work_id, material_id) INCLUDE (consumption_per_work_unit, waste_coeff);


--
-- TOC entry 5114 (class 1259 OID 16814)
-- Name: idx_work_materials_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_materials_material ON public.work_materials USING btree (material_id);


--
-- TOC entry 5115 (class 1259 OID 16839)
-- Name: idx_work_materials_material_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_materials_material_id ON public.work_materials USING btree (material_id);


--
-- TOC entry 5116 (class 1259 OID 16838)
-- Name: idx_work_materials_work_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_materials_work_id ON public.work_materials USING btree (work_id);


--
-- TOC entry 5117 (class 1259 OID 16840)
-- Name: idx_work_materials_work_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_materials_work_material ON public.work_materials USING btree (work_id, material_id);


--
-- TOC entry 5081 (class 1259 OID 18600)
-- Name: idx_works_name_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_name_gin ON public.works_ref USING gin (to_tsvector('russian'::regconfig, name));


--
-- TOC entry 5082 (class 1259 OID 18602)
-- Name: idx_works_price_performance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_price_performance ON public.works_ref USING btree (unit_price) WHERE (unit_price > (0)::numeric);


--
-- TOC entry 5083 (class 1259 OID 16842)
-- Name: idx_works_ref_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_id ON public.works_ref USING btree (id);


--
-- TOC entry 5084 (class 1259 OID 16846)
-- Name: idx_works_ref_join; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_join ON public.works_ref USING btree (id, sort_order, name, unit, unit_price);


--
-- TOC entry 5085 (class 1259 OID 16843)
-- Name: idx_works_ref_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_name ON public.works_ref USING btree (name);


--
-- TOC entry 5086 (class 1259 OID 18445)
-- Name: idx_works_ref_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_name_trgm ON public.works_ref USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5087 (class 1259 OID 16841)
-- Name: idx_works_ref_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_sort_order ON public.works_ref USING btree (sort_order);


--
-- TOC entry 5088 (class 1259 OID 18634)
-- Name: idx_works_ref_updated_opt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_ref_updated_opt ON public.works_ref USING btree (updated_at DESC);


--
-- TOC entry 5089 (class 1259 OID 18601)
-- Name: idx_works_sort_order_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_sort_order_name ON public.works_ref USING btree (sort_order, name);


--
-- TOC entry 5090 (class 1259 OID 17893)
-- Name: idx_works_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_tenant_id ON public.works_ref USING btree (tenant_id, id);


--
-- TOC entry 5091 (class 1259 OID 17048)
-- Name: idx_works_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_works_tenant_name ON public.works_ref USING btree (tenant_id, name);


--
-- TOC entry 5092 (class 1259 OID 16721)
-- Name: idx_worksref_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worksref_stage ON public.works_ref USING btree (stage_id);


--
-- TOC entry 5093 (class 1259 OID 16722)
-- Name: idx_worksref_substage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_worksref_substage ON public.works_ref USING btree (substage_id);


--
-- TOC entry 5111 (class 1259 OID 17044)
-- Name: ux_materials_global_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_materials_global_code ON public.materials USING btree (id) WHERE (tenant_id IS NULL);


--
-- TOC entry 5112 (class 1259 OID 17043)
-- Name: ux_materials_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_materials_tenant_code ON public.materials USING btree (tenant_id, id);


--
-- TOC entry 5130 (class 1259 OID 16955)
-- Name: ux_projects_tenant_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_projects_tenant_name ON public.projects USING btree (tenant_id, name);


--
-- TOC entry 5147 (class 1259 OID 17884)
-- Name: ux_tmp_unique_start; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_tmp_unique_start ON public.tenant_material_prices USING btree (tenant_id, material_id, valid_from);


--
-- TOC entry 5154 (class 1259 OID 17887)
-- Name: ux_twp_unique_start; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_twp_unique_start ON public.tenant_work_prices USING btree (tenant_id, work_id, valid_from);


--
-- TOC entry 5094 (class 1259 OID 17046)
-- Name: ux_works_global_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_works_global_code ON public.works_ref USING btree (id) WHERE (tenant_id IS NULL);


--
-- TOC entry 5095 (class 1259 OID 17045)
-- Name: ux_works_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_works_tenant_code ON public.works_ref USING btree (tenant_id, id);


--
-- TOC entry 5363 (class 2620 OID 18680)
-- Name: refresh_tokens refresh_token_usage_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refresh_token_usage_trigger BEFORE UPDATE ON public.refresh_tokens FOR EACH ROW EXECUTE FUNCTION public.update_refresh_token_last_used();


--
-- TOC entry 5359 (class 2620 OID 17229)
-- Name: estimate_items trg_eitems_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eitems_audit BEFORE INSERT OR UPDATE ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_audit_fields();


--
-- TOC entry 5360 (class 2620 OID 17226)
-- Name: estimate_items trg_eitems_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eitems_tenant BEFORE INSERT OR UPDATE ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_child_tenant_from_estimate();


--
-- TOC entry 5356 (class 2620 OID 17228)
-- Name: estimates trg_estimates_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_estimates_audit BEFORE INSERT OR UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.tg_set_audit_fields();


--
-- TOC entry 5357 (class 2620 OID 17230)
-- Name: estimates trg_estimates_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_estimates_number BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.tg_set_estimate_number();


--
-- TOC entry 5358 (class 2620 OID 17225)
-- Name: estimates trg_estimates_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_estimates_tenant BEFORE INSERT OR UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.tg_set_tenant_from_context();


--
-- TOC entry 5354 (class 2620 OID 17227)
-- Name: projects trg_projects_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_audit BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tg_set_audit_fields();


--
-- TOC entry 5355 (class 2620 OID 17224)
-- Name: projects trg_projects_tenant; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_tenant BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.tg_set_tenant_from_context();


--
-- TOC entry 5362 (class 2620 OID 18549)
-- Name: customer_estimates trigger_customer_estimates_tenant_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_customer_estimates_tenant_check BEFORE INSERT OR UPDATE ON public.customer_estimates FOR EACH ROW EXECUTE FUNCTION public.check_customer_estimates_tenant_consistency();


--
-- TOC entry 5361 (class 2620 OID 18551)
-- Name: object_parameters trigger_object_parameters_tenant_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_object_parameters_tenant_check BEFORE INSERT OR UPDATE ON public.object_parameters FOR EACH ROW EXECUTE FUNCTION public.check_object_parameters_tenant_consistency();


--
-- TOC entry 5340 (class 2606 OID 18200)
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5326 (class 2606 OID 18032)
-- Name: construction_projects construction_projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5336 (class 2606 OID 18159)
-- Name: constructive_elements constructive_elements_object_parameters_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constructive_elements
    ADD CONSTRAINT constructive_elements_object_parameters_id_fkey FOREIGN KEY (object_parameters_id) REFERENCES public.object_parameters(id) ON DELETE CASCADE;


--
-- TOC entry 5337 (class 2606 OID 18164)
-- Name: constructive_elements constructive_elements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constructive_elements
    ADD CONSTRAINT constructive_elements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5350 (class 2606 OID 18327)
-- Name: customer_estimate_history customer_estimate_history_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_history
    ADD CONSTRAINT customer_estimate_history_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.customer_estimates(id) ON DELETE CASCADE;


--
-- TOC entry 5351 (class 2606 OID 18332)
-- Name: customer_estimate_history customer_estimate_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_history
    ADD CONSTRAINT customer_estimate_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5348 (class 2606 OID 18307)
-- Name: customer_estimate_items customer_estimate_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_items
    ADD CONSTRAINT customer_estimate_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.customer_estimates(id) ON DELETE CASCADE;


--
-- TOC entry 5349 (class 2606 OID 18312)
-- Name: customer_estimate_items customer_estimate_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_items
    ADD CONSTRAINT customer_estimate_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5352 (class 2606 OID 18349)
-- Name: customer_estimate_templates customer_estimate_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimate_templates
    ADD CONSTRAINT customer_estimate_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5344 (class 2606 OID 18290)
-- Name: customer_estimates customer_estimates_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates
    ADD CONSTRAINT customer_estimates_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5345 (class 2606 OID 18280)
-- Name: customer_estimates customer_estimates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates
    ADD CONSTRAINT customer_estimates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- TOC entry 5346 (class 2606 OID 18285)
-- Name: customer_estimates customer_estimates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates
    ADD CONSTRAINT customer_estimates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5338 (class 2606 OID 18180)
-- Name: engineering_systems engineering_systems_object_parameters_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_systems
    ADD CONSTRAINT engineering_systems_object_parameters_id_fkey FOREIGN KEY (object_parameters_id) REFERENCES public.object_parameters(id) ON DELETE CASCADE;


--
-- TOC entry 5339 (class 2606 OID 18185)
-- Name: engineering_systems engineering_systems_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_systems
    ADD CONSTRAINT engineering_systems_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5305 (class 2606 OID 17031)
-- Name: estimate_items estimate_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5306 (class 2606 OID 17011)
-- Name: estimate_items estimate_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- TOC entry 5307 (class 2606 OID 17021)
-- Name: estimate_items estimate_items_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- TOC entry 5308 (class 2606 OID 17026)
-- Name: estimate_items estimate_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.estimate_items(id) ON DELETE CASCADE;


--
-- TOC entry 5309 (class 2606 OID 17006)
-- Name: estimate_items estimate_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- TOC entry 5310 (class 2606 OID 17036)
-- Name: estimate_items estimate_items_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5311 (class 2606 OID 17016)
-- Name: estimate_items estimate_items_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_items
    ADD CONSTRAINT estimate_items_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.works_ref(id) ON DELETE SET NULL;


--
-- TOC entry 5300 (class 2606 OID 16979)
-- Name: estimates estimates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5301 (class 2606 OID 16974)
-- Name: estimates estimates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- TOC entry 5302 (class 2606 OID 16969)
-- Name: estimates estimates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- TOC entry 5303 (class 2606 OID 16984)
-- Name: estimates estimates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5347 (class 2606 OID 18533)
-- Name: customer_estimates fk_customer_estimates_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_estimates
    ADD CONSTRAINT fk_customer_estimates_project_id FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5304 (class 2606 OID 18543)
-- Name: estimates fk_estimates_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT fk_estimates_project_id FOREIGN KEY (project_id) REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5331 (class 2606 OID 18538)
-- Name: object_parameters fk_object_parameters_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters
    ADD CONSTRAINT fk_object_parameters_project_id FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5332 (class 2606 OID 18116)
-- Name: object_parameters object_parameters_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters
    ADD CONSTRAINT object_parameters_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- TOC entry 5333 (class 2606 OID 18121)
-- Name: object_parameters object_parameters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.object_parameters
    ADD CONSTRAINT object_parameters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5286 (class 2606 OID 16520)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id);


--
-- TOC entry 5334 (class 2606 OID 18138)
-- Name: project_rooms project_rooms_object_parameters_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rooms
    ADD CONSTRAINT project_rooms_object_parameters_id_fkey FOREIGN KEY (object_parameters_id) REFERENCES public.object_parameters(id) ON DELETE CASCADE;


--
-- TOC entry 5335 (class 2606 OID 18143)
-- Name: project_rooms project_rooms_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_rooms
    ADD CONSTRAINT project_rooms_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5296 (class 2606 OID 16945)
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5297 (class 2606 OID 16940)
-- Name: projects projects_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5298 (class 2606 OID 16935)
-- Name: projects projects_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;


--
-- TOC entry 5299 (class 2606 OID 16950)
-- Name: projects projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id);


--
-- TOC entry 5353 (class 2606 OID 18664)
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5341 (class 2606 OID 18238)
-- Name: role_permissions role_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5342 (class 2606 OID 18233)
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- TOC entry 5343 (class 2606 OID 18228)
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- TOC entry 5327 (class 2606 OID 18056)
-- Name: room_parameters room_parameters_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_parameters
    ADD CONSTRAINT room_parameters_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- TOC entry 5287 (class 2606 OID 16645)
-- Name: stages stages_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stages
    ADD CONSTRAINT stages_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.phases(id) ON DELETE SET NULL;


--
-- TOC entry 5288 (class 2606 OID 16660)
-- Name: substages substages_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.substages
    ADD CONSTRAINT substages_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE SET NULL;


--
-- TOC entry 5324 (class 2606 OID 17992)
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5319 (class 2606 OID 17173)
-- Name: tenant_counters tenant_counters_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_counters
    ADD CONSTRAINT tenant_counters_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 5312 (class 2606 OID 17062)
-- Name: tenant_material_prices tenant_material_prices_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_material_prices
    ADD CONSTRAINT tenant_material_prices_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- TOC entry 5313 (class 2606 OID 17057)
-- Name: tenant_material_prices tenant_material_prices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_material_prices
    ADD CONSTRAINT tenant_material_prices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 5314 (class 2606 OID 17076)
-- Name: tenant_work_prices tenant_work_prices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_work_prices
    ADD CONSTRAINT tenant_work_prices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 5315 (class 2606 OID 17081)
-- Name: tenant_work_prices tenant_work_prices_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_work_prices
    ADD CONSTRAINT tenant_work_prices_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.works_ref(id) ON DELETE CASCADE;


--
-- TOC entry 5323 (class 2606 OID 17974)
-- Name: user_activities user_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5322 (class 2606 OID 17955)
-- Name: user_custom_links user_custom_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_custom_links
    ADD CONSTRAINT user_custom_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5325 (class 2606 OID 18010)
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5328 (class 2606 OID 18100)
-- Name: user_role_assignments user_role_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.auth_users(id) ON DELETE SET NULL;


--
-- TOC entry 5329 (class 2606 OID 18095)
-- Name: user_role_assignments user_role_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- TOC entry 5330 (class 2606 OID 18090)
-- Name: user_role_assignments user_role_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5285 (class 2606 OID 16491)
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5320 (class 2606 OID 17919)
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5321 (class 2606 OID 17938)
-- Name: user_social_links user_social_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_social_links
    ADD CONSTRAINT user_social_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5294 (class 2606 OID 16912)
-- Name: user_tenants user_tenants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 5295 (class 2606 OID 16917)
-- Name: user_tenants user_tenants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- TOC entry 5292 (class 2606 OID 16808)
-- Name: work_materials work_materials_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials
    ADD CONSTRAINT work_materials_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- TOC entry 5316 (class 2606 OID 17107)
-- Name: work_materials_tenant work_materials_tenant_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials_tenant
    ADD CONSTRAINT work_materials_tenant_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- TOC entry 5317 (class 2606 OID 17097)
-- Name: work_materials_tenant work_materials_tenant_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials_tenant
    ADD CONSTRAINT work_materials_tenant_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- TOC entry 5318 (class 2606 OID 17102)
-- Name: work_materials_tenant work_materials_tenant_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials_tenant
    ADD CONSTRAINT work_materials_tenant_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.works_ref(id) ON DELETE CASCADE;


--
-- TOC entry 5293 (class 2606 OID 16803)
-- Name: work_materials work_materials_work_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_materials
    ADD CONSTRAINT work_materials_work_id_fkey FOREIGN KEY (work_id) REFERENCES public.works_ref(id) ON DELETE CASCADE;


--
-- TOC entry 5289 (class 2606 OID 16675)
-- Name: works_ref works_ref_phase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works_ref
    ADD CONSTRAINT works_ref_phase_id_fkey FOREIGN KEY (phase_id) REFERENCES public.phases(id) ON DELETE SET NULL;


--
-- TOC entry 5290 (class 2606 OID 16680)
-- Name: works_ref works_ref_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works_ref
    ADD CONSTRAINT works_ref_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.stages(id) ON DELETE SET NULL;


--
-- TOC entry 5291 (class 2606 OID 16685)
-- Name: works_ref works_ref_substage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.works_ref
    ADD CONSTRAINT works_ref_substage_id_fkey FOREIGN KEY (substage_id) REFERENCES public.substages(id) ON DELETE SET NULL;


--
-- TOC entry 5554 (class 3256 OID 18645)
-- Name: construction_projects basic_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY basic_tenant_policy ON public.construction_projects USING (((public.current_tenant_id() IS NULL) OR ((tenant_id)::text = (public.current_tenant_id())::text) OR (tenant_id IS NULL)));


--
-- TOC entry 5605 (class 0 OID 0)
-- Dependencies: 5554
-- Name: POLICY basic_tenant_policy ON construction_projects; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY basic_tenant_policy ON public.construction_projects IS 'Базовая tenant политика с мягкой изоляцией';


--
-- TOC entry 5520 (class 0 OID 18022)
-- Dependencies: 259
-- Name: construction_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.construction_projects ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5552 (class 3256 OID 18577)
-- Name: construction_projects construction_projects_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY construction_projects_tenant_select ON public.construction_projects FOR SELECT USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


--
-- TOC entry 5553 (class 3256 OID 18578)
-- Name: construction_projects construction_projects_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY construction_projects_tenant_write ON public.construction_projects USING (((tenant_id)::text = current_setting('app.tenant_id'::text, true))) WITH CHECK (((tenant_id)::text = current_setting('app.tenant_id'::text, true)));


--
-- TOC entry 5522 (class 0 OID 18264)
-- Dependencies: 281
-- Name: customer_estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_estimates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5543 (class 3256 OID 18563)
-- Name: customer_estimates customer_estimates_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_estimates_tenant_select ON public.customer_estimates FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5544 (class 3256 OID 18564)
-- Name: customer_estimates customer_estimates_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_estimates_tenant_write ON public.customer_estimates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5516 (class 0 OID 16991)
-- Dependencies: 240
-- Name: estimate_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5515 (class 0 OID 16957)
-- Dependencies: 239
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5541 (class 3256 OID 18561)
-- Name: estimates estimates_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY estimates_tenant_select ON public.estimates FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5542 (class 3256 OID 18562)
-- Name: estimates estimates_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY estimates_tenant_write ON public.estimates USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5513 (class 0 OID 16784)
-- Dependencies: 234
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5547 (class 3256 OID 18567)
-- Name: materials materials_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_tenant_select ON public.materials FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5548 (class 3256 OID 18568)
-- Name: materials materials_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_tenant_write ON public.materials USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5521 (class 0 OID 18106)
-- Dependencies: 267
-- Name: object_parameters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.object_parameters ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5545 (class 3256 OID 18565)
-- Name: object_parameters object_parameters_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY object_parameters_tenant_select ON public.object_parameters FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5546 (class 3256 OID 18566)
-- Name: object_parameters object_parameters_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY object_parameters_tenant_write ON public.object_parameters USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5533 (class 3256 OID 17139)
-- Name: estimate_items p_eitems_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_eitems_all ON public.estimate_items USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5531 (class 3256 OID 17137)
-- Name: estimates p_estimates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_estimates_select ON public.estimates FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5532 (class 3256 OID 17138)
-- Name: estimates p_estimates_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_estimates_write ON public.estimates USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5534 (class 3256 OID 17140)
-- Name: materials p_materials_overlay; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_materials_overlay ON public.materials FOR SELECT USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));


--
-- TOC entry 5535 (class 3256 OID 17141)
-- Name: materials p_materials_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_materials_write ON public.materials USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5529 (class 3256 OID 17135)
-- Name: projects p_projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_projects_select ON public.projects FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5530 (class 3256 OID 17136)
-- Name: projects p_projects_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_projects_write ON public.projects USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5538 (class 3256 OID 17144)
-- Name: tenant_material_prices p_tmat_prices_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_tmat_prices_all ON public.tenant_material_prices USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5539 (class 3256 OID 17145)
-- Name: tenant_work_prices p_twork_prices_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_twork_prices_all ON public.tenant_work_prices USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5540 (class 3256 OID 17146)
-- Name: work_materials_tenant p_wm_tenant_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_wm_tenant_all ON public.work_materials_tenant USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5536 (class 3256 OID 17142)
-- Name: works_ref p_works_overlay; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_works_overlay ON public.works_ref FOR SELECT USING (((tenant_id IS NULL) OR (tenant_id = (current_setting('app.tenant_id'::text))::uuid)));


--
-- TOC entry 5537 (class 3256 OID 17143)
-- Name: works_ref p_works_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY p_works_write ON public.works_ref USING ((tenant_id = (current_setting('app.tenant_id'::text))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text))::uuid));


--
-- TOC entry 5514 (class 0 OID 16924)
-- Dependencies: 238
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5523 (class 0 OID 18648)
-- Dependencies: 294
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5517 (class 0 OID 17049)
-- Dependencies: 241
-- Name: tenant_material_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_material_prices ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5526 (class 3256 OID 18573)
-- Name: tenant_material_prices tenant_material_prices_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_material_prices_tenant_select ON public.tenant_material_prices FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5527 (class 3256 OID 18574)
-- Name: tenant_material_prices tenant_material_prices_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_material_prices_tenant_write ON public.tenant_material_prices USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5518 (class 0 OID 17068)
-- Dependencies: 242
-- Name: tenant_work_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_work_prices ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5528 (class 3256 OID 18575)
-- Name: tenant_work_prices tenant_work_prices_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_work_prices_tenant_select ON public.tenant_work_prices FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5551 (class 3256 OID 18576)
-- Name: tenant_work_prices tenant_work_prices_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_work_prices_tenant_write ON public.tenant_work_prices USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5555 (class 3256 OID 18678)
-- Name: refresh_tokens user_refresh_tokens_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_refresh_tokens_policy ON public.refresh_tokens USING ((user_id = COALESCE((current_setting('app.current_user_id'::text, true))::integer, (current_setting('jwt.claims.userId'::text, true))::integer)));


--
-- TOC entry 5519 (class 0 OID 17087)
-- Dependencies: 243
-- Name: work_materials_tenant; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_materials_tenant ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5524 (class 3256 OID 18571)
-- Name: work_materials_tenant work_materials_tenant_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_materials_tenant_tenant_select ON public.work_materials_tenant FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5525 (class 3256 OID 18572)
-- Name: work_materials_tenant work_materials_tenant_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_materials_tenant_tenant_write ON public.work_materials_tenant USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5512 (class 0 OID 16665)
-- Dependencies: 233
-- Name: works_ref; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.works_ref ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 5549 (class 3256 OID 18569)
-- Name: works_ref works_ref_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY works_ref_tenant_select ON public.works_ref FOR SELECT USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


--
-- TOC entry 5550 (class 3256 OID 18570)
-- Name: works_ref works_ref_tenant_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY works_ref_tenant_write ON public.works_ref USING ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid)) WITH CHECK ((tenant_id = (current_setting('app.tenant_id'::text, true))::uuid));


-- Completed on 2025-10-07 16:22:00 UTC

--
-- PostgreSQL database dump complete
--

\unrestrict g0bFGf7gdC0iYtKW0iSlVcPtrrmz4kGRGGuC5D8PahRXvXjYYQUTeW8QeZufNxh

