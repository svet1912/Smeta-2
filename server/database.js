import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Явная загрузка .env из текущей папки server
const envPath = path.resolve('.env');
dotenv.config({ path: envPath });
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL не найден после загрузки .env по пути:', envPath);
} else {
  // Не логируем полный пароль, только первые символы
  const sanitized = process.env.DATABASE_URL.replace(/:(.*?)@/, (m, p1) => ':***@');
  console.log('🔑 DATABASE_URL загружен:', sanitized);
}

const { Pool } = pg;

// --- Diagnostic parsing of DATABASE_URL ---
function parseDatabaseUrl(rawUrl) {
  try {
    if (!rawUrl) return {};
    const u = new URL(rawUrl);
    return {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace(/^\//, '') || undefined,
      user: u.username,
      password: decodeURIComponent(u.password || ''),
      hasPassword: !!u.password
    };
  } catch (e) {
    console.warn('⚠️ Ошибка разбора DATABASE_URL:', e.message);
    return {};
  }
}

// --- SSL / Connection Helper ---
function buildSslConfig(dbMeta) {
  const url = process.env.DATABASE_URL || '';
  const sslModeMatch = url.match(/sslmode=([^&]+)/i);
  let sslMode = (process.env.DATABASE_SSLMODE || (sslModeMatch ? sslModeMatch[1] : 'require')).toLowerCase();

  // Для Aiven Cloud используем prefer режим и не переопределяем
  if (url.includes('aivencloud.com')) {
    console.log('🔧 Aiven Cloud: используем sslmode=prefer');
  } else {
    // Heuristic: Aiven / managed ports usually enforce SSL. If disable specified but port >= 10000, override to require.
    if ((sslMode === 'disable' || sslMode === 'off') && dbMeta.port && parseInt(dbMeta.port,10) >= 10000) {
      console.warn('ℹ️ Переопределяем sslmode=disable -> require (порт выглядит как управляемый, вероятно требуется TLS)');
      sslMode = 'require';
    }
  }

  if (sslMode === 'disable' || sslMode === 'off' || process.env.DATABASE_SSL === 'false') {
    return false;
  }

  const caPath = process.env.DATABASE_CA_CERT_PATH || './ca.pem';
  let ca = undefined;
  if (caPath) {
    try { ca = fs.readFileSync(caPath).toString(); } catch (e) { console.warn('⚠️ Не удалось прочитать CA сертификат:', e.message); }
  }

  const base = { rejectUnauthorized: sslMode === 'verify-full' || sslMode === 'verify-ca', ca };
  if (sslMode === 'require' || sslMode === 'prefer') base.rejectUnauthorized = false;
  
  // Для Aiven Cloud принудительно отключаем проверку сертификата
  if (url.includes('aivencloud.com')) {
    base.rejectUnauthorized = false;
    console.log('🔧 Aiven Cloud: отключена проверка SSL сертификата');
  }
  return base;
}

const dbMeta = parseDatabaseUrl(process.env.DATABASE_URL || '');
if (dbMeta.password && typeof dbMeta.password !== 'string') {
  // Теоретически не случится, но оставим на случай прокси-оберток
  dbMeta.password = String(dbMeta.password);
}
console.log('🔍 DB META:', {
  host: dbMeta.host,
  port: dbMeta.port,
  user: dbMeta.user,
  passwordLength: dbMeta.password ? dbMeta.password.length : 0,
  hasPassword: dbMeta.hasPassword,
  database: dbMeta.database
});
if (!dbMeta.password) {
  console.warn('⚠️ В DATABASE_URL отсутствует пароль — авторизация провалится');
}

let initialSsl = buildSslConfig(dbMeta);

function createPool(overrideSsl) {
  const effectiveSsl = typeof overrideSsl !== 'undefined' ? overrideSsl : initialSsl;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.PG_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '10000', 10),
    query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT || '10000', 10),
    statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT || '10000', 10),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: effectiveSsl
  });

  pool.on('connect', () => {
    console.log('✅ Подключение к PostgreSQL установлено (ssl:', effectiveSsl ? 'on' : 'off', ')');
  });

  pool.on('error', (err) => {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
  });

  return pool;
}

let pool = createPool();
let sslFallbackTried = false;
let insecureFallbackTried = false;

async function ensureConnection() {
  try {
    const client = await pool.connect();
    client.release();
  } catch (err) {
    // Если сервер не поддерживает SSL и мы ещё не пробовали без него
  if (!sslFallbackTried && /(does not support SSL|ssl is not enabled|handshake failure)/i.test(err.message)) {
      console.warn('⚠️ Сервер не поддерживает SSL — выполняем fallback на не-SSL соединение');
      sslFallbackTried = true;
      pool.end().catch(()=>{});
      pool = createPool(false);
    } else if (!insecureFallbackTried && /self-signed certificate/i.test(err.message)) {
      console.warn('⚠️ Обнаружен self-signed certificate — выполняем fallback c rejectUnauthorized=false');
      insecureFallbackTried = true;
      try { pool.end().catch(()=>{}); } catch {}
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.PG_POOL_MAX || '10', 10),
        idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '10000', 10),
        query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT || '10000', 10),
        statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT || '10000', 10),
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: { rejectUnauthorized: false }
      });
      pool.on('connect', () => console.log('✅ Пул пересоздан с insecure SSL (rejectUnauthorized=false)'));
    } else {
      throw err;
    }
  }
}

// Выполним раннюю проверку (лениво, без падения)
ensureConnection().catch(e => console.warn('⚠️ Первичная проверка подключения не удалась:', e.message));

export const query = async (text, params) => {
  const start = Date.now();
  let client;
  try {
    client = await pool.connect();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Выполнен запрос:', {
      text: text.substring(0, 50) + '...',
      duration: duration + 'ms',
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Ошибка выполнения запроса:', {
      text: text.substring(0, 50) + '...',
      duration: duration + 'ms',
      error: error.message
    });
    // Авто-fallback если внезапно обнаружилось отсутствие SSL поддержки
  if (!sslFallbackTried && /(does not support SSL|ssl is not enabled|handshake failure)/i.test(error.message)) {
      console.warn('🔁 Повторное создание пула без SSL после ошибки в запросе');
      sslFallbackTried = true;
      try { pool.end().catch(()=>{}); } catch {}
      pool = createPool(false);
    } else if (!insecureFallbackTried && /self-signed certificate/i.test(error.message)) {
      console.warn('🔁 Повторное создание пула с insecure SSL (rejectUnauthorized=false) после self-signed ошибки');
      insecureFallbackTried = true;
      try { pool.end().catch(()=>{}); } catch {}
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: parseInt(process.env.PG_POOL_MAX || '10', 10),
        idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
        connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '10000', 10),
        query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT || '10000', 10),
        statement_timeout: parseInt(process.env.PG_STATEMENT_TIMEOUT || '10000', 10),
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: { rejectUnauthorized: false }
      });
      pool.on('connect', () => console.log('✅ Пул пересоздан с insecure SSL (rejectUnauthorized=false)'));
    }
    throw error;
  } finally {
    if (client) client.release();
  }
};

export const getClient = async () => pool.connect();

export default pool;
