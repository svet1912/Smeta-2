import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/index.js';

describe('Cache Headers Tests', () => {
  it('should include cache headers in materials API response', async () => {
    const response = await request(app)
      .get('/api/materials?limit=5')
      .expect(200);

    // Проверяем наличие cache headers
    expect(response.headers).toHaveProperty('etag');
    expect(response.headers['cache-control']).toBeDefined();
  });

  it('should include cache headers in works API response', async () => {
    const response = await request(app)
      .get('/api/works?limit=5')
      .expect(200);

    // Проверяем наличие cache headers
    expect(response.headers).toHaveProperty('etag');
    expect(response.headers['cache-control']).toBeDefined();
  });

  it('should include etag headers in responses', async () => {
    // Health endpoint должен иметь ETag
    const healthResponse = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(healthResponse.headers.etag).toBeDefined();

    // Materials endpoint должен иметь ETag  
    const materialsResponse = await request(app)
      .get('/api/materials?limit=1')
      .expect(200);
    
    expect(materialsResponse.headers.etag).toBeDefined();
  });

  it('should handle basic cache scenarios', async () => {
    // Проверяем что ответы имеют необходимые заголовки для кэширования
    const response = await request(app)
      .get('/api/materials?limit=1')
      .expect(200);
    
    // ETag обязателен для кэширования
    expect(response.headers.etag).toBeDefined();
    
    // Vary нужен для корректного кэширования
    expect(response.headers.vary).toBeDefined();
  });

  it('should include vary header for content negotiation', async () => {
    const response = await request(app)
      .get('/api/materials?limit=1')
      .expect(200);

    // Проверяем Vary header для корректного кэширования
    expect(response.headers).toHaveProperty('vary');
  });
});