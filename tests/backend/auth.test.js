import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/index.js';

describe('Auth', () => {
  it('POST /api/auth/login returns token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@smeta360.ru', password: 'password123' }).expect(200);

    expect(res.body).toBeTypeOf('object');
    expect(res.body.success).toBe(true);
    expect(res.body.data?.token || res.body.token || res.body.accessToken).toBeTruthy();
  });

  it('POST /api/auth/login with wrong credentials returns 401', async () => {
    await request(app).post('/api/auth/login').send({ email: 'wrong@email.com', password: 'wrongpass' }).expect(401);
  });

  it('Protected route requires auth (401/403)', async () => {
    // Проверим эндпоинт который требует авторизации
    const res = await request(app).get('/api/auth/me');
    expect([401, 403]).toContain(res.status);
  });
});
