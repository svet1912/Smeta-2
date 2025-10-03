/**
 * Database Service
 * Централизованный сервис для работы с базой данных
 */
import { query } from '../database.js';

class DatabaseService {
  /**
   * Инициализация таблиц базы данных
   */
  async initializeTables() {
    try {
      console.log('🚀 Инициализация таблиц базы данных...');
      
      // Основные таблицы
      await this.createAuthTables();
      await this.createCatalogTables();
      await this.createProjectTables();
      await this.createEstimateTables();
      await this.createSystemTables();
      
      // Индексы для производительности
      await this.createIndexes();
      
      console.log('✅ Таблицы инициализированы успешно');
    } catch (error) {
      console.error('❌ Ошибка инициализации таблиц:', error);
      throw error;
    }
  }

  /**
   * Создание таблиц аутентификации
   */
  async createAuthTables() {
    const authTables = [
      `CREATE TABLE IF NOT EXISTS auth_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        firstname VARCHAR(255) NOT NULL,
        lastname VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        phone VARCHAR(20),
        position VARCHAR(255),
        location VARCHAR(255),
        bio TEXT,
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of authTables) {
      await query(tableSQL);
    }
  }

  /**
   * Создание таблиц каталогов
   */
  async createCatalogTables() {
    const catalogTables = [
      `CREATE TABLE IF NOT EXISTS materials (
        id VARCHAR(50) PRIMARY KEY,
        name TEXT NOT NULL,
        unit VARCHAR(50),
        unit_price DECIMAL(12,2) DEFAULT 0,
        expenditure DECIMAL(10,6),
        weight DECIMAL(10,3),
        image_url TEXT,
        item_url TEXT,
        tenant_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS works_ref (
        id VARCHAR(50) PRIMARY KEY,
        name TEXT NOT NULL,
        unit VARCHAR(50),
        unit_price DECIMAL(12,2) DEFAULT 0,
        phase_id VARCHAR(50),
        stage_id VARCHAR(50),
        substage_id VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        tenant_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS work_materials (
        work_id VARCHAR(50) NOT NULL,
        material_id VARCHAR(50) NOT NULL,
        consumption_per_work_unit DECIMAL(10,6),
        waste_coeff DECIMAL(5,3) DEFAULT 1.000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (work_id, material_id),
        FOREIGN KEY (work_id) REFERENCES works_ref(id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      )`
    ];

    for (const tableSQL of catalogTables) {
      await query(tableSQL);
    }
  }

  /**
   * Создание таблиц проектов
   */
  async createProjectTables() {
    const projectTables = [
      `CREATE TABLE IF NOT EXISTS construction_projects (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        object_address TEXT NOT NULL,
        contractor_name VARCHAR(255) NOT NULL,
        contract_number VARCHAR(100) NOT NULL,
        deadline DATE NOT NULL,
        tenant_id VARCHAR(255),
        created_by INTEGER REFERENCES auth_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of projectTables) {
      await query(tableSQL);
    }
  }

  /**
   * Создание таблиц смет
   */
  async createEstimateTables() {
    const estimateTables = [
      `CREATE TABLE IF NOT EXISTS customer_estimates (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES construction_projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES auth_users(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        total_amount DECIMAL(15,2) DEFAULT 0,
        work_coefficient DECIMAL(5,2) DEFAULT 1.00,
        material_coefficient DECIMAL(5,2) DEFAULT 1.00,
        version INTEGER DEFAULT 1,
        tenant_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of estimateTables) {
      await query(tableSQL);
    }
  }

  /**
   * Создание системных таблиц
   */
  async createSystemTables() {
    const systemTables = [
      `CREATE TABLE IF NOT EXISTS statistics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC,
        metric_unit VARCHAR(50),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of systemTables) {
      await query(tableSQL);
    }
  }

  /**
   * Создание индексов для производительности
   */
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name)',
      'CREATE INDEX IF NOT EXISTS idx_works_ref_name ON works_ref(name)',
      'CREATE INDEX IF NOT EXISTS idx_work_materials_work_id ON work_materials(work_id)',
      'CREATE INDEX IF NOT EXISTS idx_work_materials_material_id ON work_materials(material_id)'
    ];

    for (const indexSQL of indexes) {
      await query(indexSQL);
    }
  }

  /**
   * Инициализация ролей и разрешений
   */
  async initializeRolesAndPermissions() {
    // Базовая инициализация ролей
    console.log('📋 Инициализация ролей...');
  }

  /**
   * Вставка демонстрационных данных
   */
  async insertDemoData() {
    try {
      // Проверяем, есть ли уже данные
      const userCount = await query('SELECT COUNT(*) FROM auth_users');
      if (parseInt(userCount.rows[0].count) === 0) {
        console.log('📝 Вставка демо данных...');
        // Здесь можно добавить демо данные
      }
    } catch (error) {
      console.log('⚠️ Пропускаем вставку демо данных:', error.message);
    }
  }

  /**
   * Проверка состояния базы данных
   */
  async healthCheck() {
    try {
      const result = await query('SELECT NOW() as current_time, version() as db_version');
      return {
        status: 'healthy',
        timestamp: result.rows[0].current_time,
        version: result.rows[0].db_version
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default new DatabaseService();
