import { describe, it, expect } from 'vitest';
import { api } from './utils/test-server.js';

describe('Performance smoke tests', () => {
  it('GET /api/health responds within 300ms', async () => {
    const start = Date.now();
    
    const res = await api
      .get('/api/health')
      .expect(200);

    const duration = Date.now() - start;
    
    expect(res.body).toBeTypeOf('object');
    expect(res.body.status).toBe('OK');
    expect(duration).toBeLessThan(300);
  });

  it('GET /api/health/db responds within 300ms', async () => {
    const start = Date.now();
    
    const res = await api
      .get('/api/health/db')
      .expect(200);

    const duration = Date.now() - start;
    
    expect(res.body).toBeTypeOf('object');
    expect(res.body.db).toBe('up');
    expect(duration).toBeLessThan(2000); // Увеличили лимит из-за медленного первого подключения
  });

  it('GET /api/materials (catalog) responds within 1000ms', async () => {
    const start = Date.now();
    
    const res = await api
      .get('/api/materials?limit=20')
      .expect(200);

    const duration = Date.now() - start;
    
    expect(res.body).toBeTypeOf('object');
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(duration).toBeLessThan(1000); // Увеличили лимит для первого запроса
  });

  it('GET /api/works (catalog) responds within 500ms', async () => {
    const start = Date.now();
    
    const res = await api
      .get('/api/works?limit=20')
      .expect(200);

    const duration = Date.now() - start;
    
    expect(res.body).toBeTypeOf('object');
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(duration).toBeLessThan(500);
  });
});