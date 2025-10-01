import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { api, waitForServer } from './utils/test-server.js';
import {
  Material, MaterialsResponse,
  Work, WorksResponse,
  Estimate, Estimates,
  HealthCheck,
  UserProfile,
  ApiResponse,
  PaginatedResponse
} from '../contracts/schemas.js';

describe('API Contract Tests', () => {
  beforeAll(async () => {
    await waitForServer();
  });

  describe('Health endpoint contract', () => {
    it('should match HealthCheck schema', async () => {
      const response = await api.get('/api/health').expect(200);
      
      const result = HealthCheck.safeParse(response.body);
      if (!result.success) {
        console.log('Health response validation errors:', result.error.issues);
        console.log('Actual response:', JSON.stringify(response.body, null, 2));
      }
      
      expect(result.success).toBe(true);
    });
  });

  describe('Materials API contract', () => {
    it('should validate materials response structure', async () => {
      const response = await api.get('/api/materials?limit=5').expect(200);
      
      // Проверяем полную структуру ответа с пагинацией
      const result = MaterialsResponse.safeParse(response.body);
      if (!result.success) {
        console.log('Materials response validation errors:', result.error.issues);
        console.log('Actual response structure:', Object.keys(response.body));
      }
      
      expect(result.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should validate individual material schema', async () => {
      const response = await api.get('/api/materials?limit=1').expect(200);
      
      if (response.body.data && response.body.data.length > 0) {
        const material = response.body.data[0];
        const result = Material.safeParse(material);
        
        if (!result.success) {
          console.log('Material validation errors:', result.error.issues);
          console.log('Actual material:', JSON.stringify(material, null, 2));
        }
        
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Works API contract', () => {
    it('should validate works response structure', async () => {
      const response = await api.get('/api/works?limit=5').expect(200);
      
      const result = WorksResponse.safeParse(response.body);
      if (!result.success) {
        console.log('Works response validation errors:', result.error.issues);
        console.log('Actual response structure:', Object.keys(response.body));
      }
      
      expect(result.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should validate individual work schema', async () => {
      const response = await api.get('/api/works?limit=1').expect(200);
      
      if (response.body.data && response.body.data.length > 0) {
        const work = response.body.data[0];
        const result = Work.safeParse(work);
        
        if (!result.success) {
          console.log('Work validation errors:', result.error.issues);
          console.log('Actual work:', JSON.stringify(work, null, 2));
        }
        
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Database structure contracts', () => {
    it('should validate data types consistency', async () => {
      // Проверяем что ID всегда string в формате "m.XXX" или "w.XXX"
      const [materials, works] = await Promise.all([
        api.get('/api/materials?limit=3').expect(200),
        api.get('/api/works?limit=3').expect(200)
      ]);

      // Все ID материалов должны быть строками
      materials.body.data.forEach((item: any, index: number) => {
        expect(typeof item.id).toBe('string');
        expect(item.id).toMatch(/^m\./); // Формат "m.XXX"
      });

      works.body.data.forEach((item: any, index: number) => {
        expect(typeof item.id).toBe('string'); 
        expect(item.id).toMatch(/^w\./); // Формат "w.XXX"
      });
    });

    it('should validate required fields presence', async () => {
      const materials = await api.get('/api/materials?limit=5').expect(200);
      
      materials.body.data.forEach((material: any, index: number) => {
        expect(material).toHaveProperty('id');
        expect(material).toHaveProperty('name');
        expect(typeof material.name).toBe('string');
      });
    });
  });

  describe('Estimate contracts', () => {
    it('should validate estimate schema structure', async () => {
      // Создаем тестовую схему для проверки
      const testEstimate = {
        id: 1,
        name: 'Test Estimate',
        status: 'draft' as const,
        total_amount: null,
        user_id: 1,
        description: 'Test description'
      };

      const result = Estimate.safeParse(testEstimate);
      if (!result.success) {
        console.log('Estimate validation errors:', result.error.issues);
      }
      
      expect(result.success).toBe(true);
    });

    it('should validate estimate status enum values', async () => {
      const validStatuses = ['draft', 'active', 'completed'];
      
      validStatuses.forEach(status => {
        const testEstimate = {
          id: 1,
          name: 'Test',
          status: status as 'draft' | 'active' | 'completed'
        };
        
        const result = Estimate.safeParse(testEstimate);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Real API pagination validation', () => {
    it('should validate materials pagination structure', async () => {
      const response = await api.get('/api/materials?limit=2').expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should validate works pagination structure', async () => {
      const response = await api.get('/api/works?limit=2').expect(200);
      
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination'); 
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('User Profile contracts', () => {
    it('should validate UserProfile schema', async () => {
      const testUser = {
        id: 1,
        email: 'test@example.com',
        firstname: 'John',
        lastname: 'Doe',
        company: 'Test Company',
        is_active: true,
        email_verified: true
      };
      
      const result = UserProfile.safeParse(testUser);
      if (!result.success) {
        console.log('UserProfile validation errors:', result.error.issues);
      }
      
      expect(result.success).toBe(true);
    });

    it('should validate email format in UserProfile', async () => {
      const invalidEmailUser = {
        id: 1,
        email: 'invalid-email',
        firstname: 'John',
        lastname: 'Doe'
      };
      
      const result = UserProfile.safeParse(invalidEmailUser);
      expect(result.success).toBe(false);
      
      // Проверяем что есть ошибка валидации email
      expect(result.error?.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Real API data validation', () => {
    it('should validate actual material fields from API', async () => {
      const response = await api.get('/api/materials?limit=1').expect(200);
      
      if (response.body.data && response.body.data.length > 0) {
        const material = response.body.data[0];
        
        // Проверяем обязательные поля
        expect(material).toHaveProperty('id');
        expect(material).toHaveProperty('name');
        expect(typeof material.id).toBe('string');
        expect(typeof material.name).toBe('string');
        
        // Проверяем что ID в правильном формате
        expect(material.id).toMatch(/^m\./);
      }
    });

    it('should validate actual work fields from API', async () => {
      const response = await api.get('/api/works?limit=1').expect(200);
      
      if (response.body.data && response.body.data.length > 0) {
        const work = response.body.data[0];
        
        // Проверяем обязательные поля
        expect(work).toHaveProperty('id');
        expect(work).toHaveProperty('name');
        expect(work).toHaveProperty('unit');
        expect(typeof work.id).toBe('string');
        expect(typeof work.name).toBe('string');
        
        // Проверяем что ID в правильном формате
        expect(work.id).toMatch(/^w\./);
      }
    });
  });
});