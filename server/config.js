import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем .env файл из директории server/
dotenv.config({ path: path.join(__dirname, '.env') });

// Также пробуем загрузить из корневой директории проекта
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Генерируем сильные секреты если не заданы
const generateStrongSecret = () => crypto.randomBytes(64).toString('hex');

export const config = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || generateStrongSecret(),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || generateStrongSecret(),
  bcryptRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  databaseUrl: process.env.DATABASE_URL,
  enableLocalFallback: process.env.ENABLE_LOCAL_FALLBACK === 'true',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS,
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 минут
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
  authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  leadRateLimitMax: parseInt(process.env.LEAD_RATE_LIMIT_MAX || '3', 10)
};

export default config;
