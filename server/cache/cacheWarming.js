// Cache Warming Strategies - предварительная загрузка критических данных
import { smartCacheWarm } from './smartCache.js';

// Mock services для демонстрации - в реальном проекте заменить на настоящие сервисы
const mockProjectsService = {
  getRecentProjects: async (limit) => Array.from({ length: Math.min(limit, 5) }, (_, i) => ({ id: i + 1, name: `Project ${i + 1}` })),
  getArchivedProjects: async () => [{ id: 999, name: 'Archived Project', status: 'archived' }],
  getTotalCount: async () => 42,
  getActiveCount: async () => 15,
  getCompletedCount: async () => 27
};

const mockWorksService = {
  getPopularWorks: async (limit) =>
    Array.from({ length: Math.min(limit, 10) }, (_, i) => ({ id: i + 1, name: `Work ${i + 1}`, popularity: 100 - i })),
  getTopRates: async (limit) => Array.from({ length: Math.min(limit, 20) }, (_, i) => ({ workId: i + 1, rate: 1000 + i * 50 })),
  getTotalCount: async () => 150,
  getCategoriesCount: async () => 12
};

const mockMaterialsService = {
  getCategories: async () => ['Строительные материалы', 'Отделочные материалы', 'Инструменты', 'Оборудование'],
  getAllMaterials: async () => Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `Material ${i + 1}`, category: 'General' })),
  getTotalCount: async () => 500,
  getCategoriesCount: async () => 8
};

/**
 * Стратегии cache warming для разных типов данных
 */
export class CacheWarmingService {
  constructor() {
    this.warmingStrategies = {
      critical: [], // Критические данные - загружаются при старте
      popular: [], // Популярные данные - загружаются по расписанию
      onDemand: [] // По требованию - загружаются при первом обращении
    };
  }

  /**
   * Инициализация стратегий warming
   */
  init() {
    this._setupCriticalStrategies();
    this._setupPopularStrategies();
    this._setupOnDemandStrategies();
  }

  /**
   * Запуск warming для критических данных (при старте сервера)
   */
  async warmCriticalData() {
    console.log('🔥 Starting critical data warming...');

    try {
      await smartCacheWarm(this.warmingStrategies.critical);
      console.log('✅ Critical data warming completed');
    } catch (error) {
      console.error('❌ Critical data warming failed:', error.message);
    }
  }

  /**
   * Запуск warming для популярных данных (по расписанию)
   */
  async warmPopularData() {
    console.log('🔥 Starting popular data warming...');

    try {
      await smartCacheWarm(this.warmingStrategies.popular);
      console.log('✅ Popular data warming completed');
    } catch (error) {
      console.error('❌ Popular data warming failed:', error.message);
    }
  }

  /**
   * Запуск warming по требованию
   */
  async warmOnDemand(category = 'all') {
    console.log(`🔥 Starting on-demand warming for: ${category}...`);

    try {
      const tasks =
        category === 'all' ? this.warmingStrategies.onDemand : this.warmingStrategies.onDemand.filter((task) => task.category === category);

      await smartCacheWarm(tasks);
      console.log(`✅ On-demand warming completed for: ${category}`);
    } catch (error) {
      console.error(`❌ On-demand warming failed for ${category}:`, error.message);
    }
  }

  /**
   * Настройка критических стратегий
   */
  _setupCriticalStrategies() {
    // Глобальные настройки системы
    this.warmingStrategies.critical.push({
      key: 'system:global-config',
      ttl: 3600, // 1 час
      dependencies: ['system'],
      category: 'system',
      producer: async () => {
        return {
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          features: {
            multitenancy: true,
            caching: true,
            authentication: true
          }
        };
      }
    });

    // Статистика пользователей (агрегированная)
    this.warmingStrategies.critical.push({
      key: 'users:stats',
      ttl: 1800, // 30 минут
      dependencies: ['users'],
      category: 'users',
      producer: async () => {
        // Здесь будет реальный запрос к БД
        return {
          totalUsers: 0,
          activeUsers: 0,
          newUsersToday: 0,
          lastUpdate: new Date().toISOString()
        };
      }
    });
  }

  /**
   * Настройка популярных стратегий
   */
  _setupPopularStrategies() {
    // Популярные проекты
    this.warmingStrategies.popular.push({
      key: 'projects:popular',
      ttl: 900, // 15 минут
      dependencies: ['projects'],
      category: 'projects',
      producer: async () => {
        try {
          // Получаем последние 10 проектов
          const projects = await mockProjectsService.getRecentProjects(10);
          return projects;
        } catch (error) {
          console.warn('Failed to load popular projects:', error.message);
          return [];
        }
      }
    });

    // Популярные работы
    this.warmingStrategies.popular.push({
      key: 'works:popular',
      ttl: 1800, // 30 минут
      dependencies: ['works'],
      category: 'works',
      producer: async () => {
        try {
          const works = await mockWorksService.getPopularWorks(50);
          return works;
        } catch (error) {
          console.warn('Failed to load popular works:', error.message);
          return [];
        }
      }
    });

    // Каталог материалов (основные категории)
    this.warmingStrategies.popular.push({
      key: 'materials:categories',
      ttl: 3600, // 1 час
      dependencies: ['materials'],
      category: 'materials',
      producer: async () => {
        try {
          const categories = await mockMaterialsService.getCategories();
          return categories;
        } catch (error) {
          console.warn('Failed to load material categories:', error.message);
          return [];
        }
      }
    });

    // Актуальные расценки (топ-100)
    this.warmingStrategies.popular.push({
      key: 'pricing:top-rates',
      ttl: 7200, // 2 часа
      dependencies: ['pricing', 'works'],
      category: 'pricing',
      producer: async () => {
        try {
          const rates = await mockWorksService.getTopRates(100);
          return rates;
        } catch (error) {
          console.warn('Failed to load top rates:', error.message);
          return [];
        }
      }
    });
  }

  /**
   * Настройка стратегий по требованию
   */
  _setupOnDemandStrategies() {
    // Детальная информация о материалах
    this.warmingStrategies.onDemand.push({
      key: 'materials:detailed',
      ttl: 1800, // 30 минут
      dependencies: ['materials'],
      category: 'materials',
      producer: async () => {
        try {
          const materials = await mockMaterialsService.getAllMaterials();
          return materials;
        } catch (error) {
          console.warn('Failed to load detailed materials:', error.message);
          return [];
        }
      }
    });

    // Архив проектов
    this.warmingStrategies.onDemand.push({
      key: 'projects:archive',
      ttl: 3600, // 1 час
      dependencies: ['projects'],
      category: 'projects',
      producer: async () => {
        try {
          const archivedProjects = await mockProjectsService.getArchivedProjects();
          return archivedProjects;
        } catch (error) {
          console.warn('Failed to load archived projects:', error.message);
          return [];
        }
      }
    });

    // Полная статистика системы
    this.warmingStrategies.onDemand.push({
      key: 'system:full-stats',
      ttl: 600, // 10 минут
      dependencies: ['system', 'users', 'projects'],
      category: 'analytics',
      producer: async () => {
        try {
          return {
            projects: {
              total: await mockProjectsService.getTotalCount(),
              active: await mockProjectsService.getActiveCount(),
              completed: await mockProjectsService.getCompletedCount()
            },
            works: {
              total: await mockWorksService.getTotalCount(),
              categories: await mockWorksService.getCategoriesCount()
            },
            materials: {
              total: await mockMaterialsService.getTotalCount(),
              categories: await mockMaterialsService.getCategoriesCount()
            },
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          console.warn('Failed to load full system stats:', error.message);
          return { error: error.message };
        }
      }
    });
  }

  /**
   * Получение информации о стратегиях
   */
  getStrategiesInfo() {
    return {
      critical: {
        count: this.warmingStrategies.critical.length,
        keys: this.warmingStrategies.critical.map((s) => s.key)
      },
      popular: {
        count: this.warmingStrategies.popular.length,
        keys: this.warmingStrategies.popular.map((s) => s.key)
      },
      onDemand: {
        count: this.warmingStrategies.onDemand.length,
        keys: this.warmingStrategies.onDemand.map((s) => s.key)
      }
    };
  }

  /**
   * Создание пользовательской стратегии warming
   */
  addCustomStrategy(strategy, type = 'onDemand') {
    if (!this.warmingStrategies[type]) {
      throw new Error(`Invalid strategy type: ${type}`);
    }

    const requiredFields = ['key', 'producer'];
    const missingFields = requiredFields.filter((field) => !strategy[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Устанавливаем значения по умолчанию
    const fullStrategy = {
      ttl: 300, // 5 минут по умолчанию
      dependencies: [],
      category: 'custom',
      ...strategy
    };

    this.warmingStrategies[type].push(fullStrategy);

    console.log(`✅ Added custom warming strategy: ${fullStrategy.key} (${type})`);
  }
}

// Глобальный экземпляр сервиса
const cacheWarmingService = new CacheWarmingService();

/**
 * Инициализация сервиса warming (вызывается при старте сервера)
 */
export function initCacheWarming() {
  cacheWarmingService.init();
  return cacheWarmingService;
}

/**
 * Получение экземпляра сервиса
 */
export function getCacheWarmingService() {
  return cacheWarmingService;
}

// Экспорт основных функций для удобства
export const { warmCriticalData, warmPopularData, warmOnDemand } = cacheWarmingService;
export default cacheWarmingService;