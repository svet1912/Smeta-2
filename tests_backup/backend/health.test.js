import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Импортируем app из server/app.js, но поскольку весь код в index.js, импортируем оттуда
import app from '../../server/index.js';

describe('Health endpoint', () => {
  it('GET /api/health returns 200 and basic payload', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toBeTypeOf('object');
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('OK');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/health/db returns database status', async () => {
    const res = await request(app).get('/api/health/db');
    // Ожидаем либо 200 (db up) либо 503 (db down)
    expect([200, 503]).toContain(res.status);
    expect(res.body).toBeTypeOf('object');
    expect(res.body).toHaveProperty('db');
    expect(['up', 'down']).toContain(res.body.db);
  });
});