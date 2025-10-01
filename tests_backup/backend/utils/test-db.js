import { Pool } from 'pg';

export const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1, // 1 соединение для последовательных транзакций в тестах
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

export async function withTx(run) {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('ROLLBACK'); // всегда откатываем
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}