import { describe, it, expect, beforeAll } from 'vitest';
import { api, waitForServer } from './utils/test-server.js';

describe('Catalog endpoints', () => {
  beforeAll(async () => {
    // Ждем готовности сервера перед тестами
    console.log('⏳ Ожидание готовности сервера...');
    await waitForServer();
  });
  it('GET /api/materials search+pagination returns <= limit and cache headers', async () => {
    // Материалы доступны без токена, проверим сначала без него
    const limit = 20;
    const res = await api.get('/api/materials?search=бетон&limit=' + limit).expect(200);

    expect(res.body).toBeTypeOf('object');
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(limit);

    // Кеш заголовки из шага 3
    const cc = res.headers['cache-control'] || '';
    expect(cc).toContain('public');
    expect(cc).toMatch(/max-age=\d+/);
  });

  it('GET /api/works search+pagination returns <= limit', async () => {
    // Работы также доступны без токена
    const res = await api.get('/api/works?search=штукатурка&limit=10').expect(200);

    expect(res.body).toBeTypeOf('object');
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(10);
  });

  it('GET /api/materials without search returns paginated results', async () => {
    const res = await api.get('/api/materials?limit=5').expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(5);
  });

  it('GET /api/works without search returns paginated results', async () => {
    const res = await api.get('/api/works?limit=5').expect(200);

    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.limit).toBe(5);
  });
});
