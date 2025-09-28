import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3002,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  bcryptRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  databaseUrl: process.env.DATABASE_URL,
  enableLocalFallback: process.env.ENABLE_LOCAL_FALLBACK === 'true'
};

export default config;