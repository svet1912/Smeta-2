#!/usr/bin/env node

/**
 * SMETA360-2 Database Migration System
 * Phase 4 Step 2: Automated Database Migrations with Rollback Support
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'migration.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class DatabaseMigrationManager {
  constructor(databaseUrl) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
    this.backupDir = path.join(__dirname, '..', 'backups');
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    logger.info('Initializing database migration system...');
    
    try {
      // Ensure directories exist
      await fs.mkdir(this.migrationsDir, { recursive: true });
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create migrations table if not exists
      await this.createMigrationsTable();
      
      logger.info('Migration system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize migration system', { error: error.message });
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW(),
        rollback_sql TEXT,
        checksum VARCHAR(255),
        execution_time_ms INTEGER,
        applied_by VARCHAR(255) DEFAULT 'system'
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
      ON schema_migrations (version);
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON schema_migrations (applied_at DESC);
    `;
    
    await this.executeQuery(query);
    logger.info('Migrations table created/verified');
  }

  /**
   * Generate new migration file
   */
  async generateMigration(name, description = '') {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
    const version = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${version}.sql`;
    const filepath = path.join(this.migrationsDir, filename);
    
    const template = `-- Migration: ${name}
-- Version: ${version}
-- Description: ${description}
-- Created: ${new Date().toISOString()}

-- ============================
-- FORWARD MIGRATION (UP)
-- ============================

-- Add your forward migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );

-- CREATE INDEX idx_example_table_name ON example_table (name);

-- INSERT INTO example_table (name) VALUES ('Initial data');

-- ============================
-- ROLLBACK MIGRATION (DOWN)
-- ============================
-- ROLLBACK_START
-- Add your rollback SQL here (will be extracted for rollback)
-- Example:
-- DROP INDEX IF EXISTS idx_example_table_name;
-- DROP TABLE IF EXISTS example_table;
-- ROLLBACK_END

-- ============================
-- POST MIGRATION VALIDATION
-- ============================
-- VALIDATION_START
-- Add validation queries here (optional)
-- Example:
-- SELECT COUNT(*) FROM example_table WHERE name IS NOT NULL;
-- VALIDATION_END
`;

    await fs.writeFile(filepath, template);
    
    logger.info('Migration generated', { 
      version, 
      filename, 
      filepath 
    });
    
    return { version, filename, filepath };
  }

  /**
   * Get all migration files
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      const migrations = [];
      
      for (const file of migrationFiles) {
        const filepath = path.join(this.migrationsDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const version = file.replace('.sql', '');
        
        // Extract rollback SQL
        const rollbackMatch = content.match(/-- ROLLBACK_START\n([\s\S]*?)\n-- ROLLBACK_END/);
        const rollbackSql = rollbackMatch ? rollbackMatch[1].trim() : '';
        
        // Extract validation SQL
        const validationMatch = content.match(/-- VALIDATION_START\n([\s\S]*?)\n-- VALIDATION_END/);
        const validationSql = validationMatch ? validationMatch[1].trim() : '';
        
        // Calculate checksum
        const checksum = require('crypto')
          .createHash('md5')
          .update(content)
          .digest('hex');
        
        migrations.push({
          version,
          filename: file,
          filepath,
          content,
          rollbackSql,
          validationSql,
          checksum
        });
      }
      
      return migrations;
    } catch (error) {
      logger.error('Failed to read migration files', { error: error.message });
      throw error;
    }
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations() {
    const query = `
      SELECT version, name, applied_at, checksum, execution_time_ms
      FROM schema_migrations 
      ORDER BY applied_at ASC
    `;
    
    const result = await this.executeQuery(query);
    return result.rows;
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations() {
    const allMigrations = await this.getMigrationFiles();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));
    
    return allMigrations.filter(migration => !appliedVersions.has(migration.version));
  }

  /**
   * Create database backup before migration
   */
  async createBackup(migrationVersion) {
    const backupId = `backup_${migrationVersion}_${Date.now()}`;
    const backupFile = path.join(this.backupDir, `${backupId}.sql`);
    
    logger.info('Creating database backup', { backupId, backupFile });
    
    try {
      // Get database connection info
      const dbUrl = new URL(this.pool.options.connectionString);
      const dbName = dbUrl.pathname.slice(1);
      const host = dbUrl.hostname;
      const port = dbUrl.port || 5432;
      const username = dbUrl.username;
      
      // Create pg_dump command
      const { spawn } = require('child_process');
      
      const dumpProcess = spawn('pg_dump', [
        '--host', host,
        '--port', port,
        '--username', username,
        '--dbname', dbName,
        '--schema-only',
        '--no-password',
        '--file', backupFile
      ], {
        env: {
          ...process.env,
          PGPASSWORD: dbUrl.password
        }
      });
      
      return new Promise((resolve, reject) => {
        dumpProcess.on('close', (code) => {
          if (code === 0) {
            logger.info('Database backup created', { backupId, backupFile });
            resolve({ backupId, backupFile });
          } else {
            reject(new Error(`pg_dump failed with code ${code}`));
          }
        });
        
        dumpProcess.on('error', reject);
      });
      
    } catch (error) {
      logger.error('Failed to create backup', { 
        error: error.message, 
        migrationVersion 
      });
      throw error;
    }
  }

  /**
   * Apply single migration
   */
  async applyMigration(migration, createBackup = true) {
    const startTime = Date.now();
    let backup = null;
    
    logger.info('Applying migration', { 
      version: migration.version,
      filename: migration.filename 
    });
    
    const client = await this.pool.connect();
    
    try {
      // Create backup if requested
      if (createBackup) {
        backup = await this.createBackup(migration.version);
      }
      
      // Start transaction
      await client.query('BEGIN');
      
      // Clean SQL content (remove comments and rollback sections)
      const cleanSql = migration.content
        .replace(/-- ROLLBACK_START[\s\S]*?-- ROLLBACK_END/g, '')
        .replace(/-- VALIDATION_START[\s\S]*?-- VALIDATION_END/g, '')
        .replace(/^\s*--.*$/gm, '') // Remove comment lines
        .replace(/\n\s*\n/g, '\n') // Remove empty lines
        .trim();
      
      if (!cleanSql) {
        throw new Error('Migration file contains no executable SQL');
      }
      
      // Execute migration
      await client.query(cleanSql);
      
      // Run validation if present
      if (migration.validationSql) {
        logger.info('Running post-migration validation', { 
          version: migration.version 
        });
        await client.query(migration.validationSql);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Record migration
      await client.query(`
        INSERT INTO schema_migrations 
        (version, name, rollback_sql, checksum, execution_time_ms, applied_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        migration.version,
        migration.filename,
        migration.rollbackSql,
        migration.checksum,
        executionTime,
        process.env.USER || 'system'
      ]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      logger.info('Migration applied successfully', {
        version: migration.version,
        executionTime: `${executionTime}ms`,
        backup: backup?.backupId
      });
      
      return {
        success: true,
        version: migration.version,
        executionTime,
        backup
      };
      
    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK');
      
      logger.error('Migration failed', {
        version: migration.version,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply all pending migrations
   */
  async migrate(options = {}) {
    const { dryRun = false, createBackups = true } = options;
    
    logger.info('Starting migration process', { dryRun, createBackups });
    
    try {
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return { success: true, applied: [] };
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      if (dryRun) {
        logger.info('DRY RUN - Migrations that would be applied:');
        pendingMigrations.forEach(migration => {
          logger.info(`  - ${migration.version}: ${migration.filename}`);
        });
        return { success: true, applied: [], dryRun: true };
      }
      
      const applied = [];
      
      for (const migration of pendingMigrations) {
        const result = await this.applyMigration(migration, createBackups);
        applied.push(result);
      }
      
      logger.info('All migrations applied successfully', { 
        count: applied.length 
      });
      
      return { success: true, applied };
      
    } catch (error) {
      logger.error('Migration process failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Rollback last migration
   */
  async rollback(steps = 1) {
    logger.info(`Rolling back last ${steps} migration(s)`);
    
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return { success: true, rolledBack: [] };
      }
      
      const toRollback = appliedMigrations
        .slice(-steps)
        .reverse(); // Rollback in reverse order
      
      const rolledBack = [];
      
      for (const migration of toRollback) {
        await this.rollbackMigration(migration);
        rolledBack.push(migration);
      }
      
      logger.info('Rollback completed successfully', { 
        count: rolledBack.length 
      });
      
      return { success: true, rolledBack };
      
    } catch (error) {
      logger.error('Rollback failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Rollback single migration
   */
  async rollbackMigration(migration) {
    logger.info('Rolling back migration', { version: migration.version });
    
    const client = await this.pool.connect();
    
    try {
      // Get rollback SQL from database
      const result = await client.query(
        'SELECT rollback_sql FROM schema_migrations WHERE version = $1',
        [migration.version]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Migration ${migration.version} not found in database`);
      }
      
      const rollbackSql = result.rows[0].rollback_sql;
      
      if (!rollbackSql) {
        throw new Error(`No rollback SQL available for migration ${migration.version}`);
      }
      
      // Start transaction
      await client.query('BEGIN');
      
      // Execute rollback SQL
      await client.query(rollbackSql);
      
      // Remove migration record
      await client.query(
        'DELETE FROM schema_migrations WHERE version = $1',
        [migration.version]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      logger.info('Migration rolled back successfully', { 
        version: migration.version 
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Migration rollback failed', {
        version: migration.version,
        error: error.message
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    try {
      const allMigrations = await this.getMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = await this.getPendingMigrations();
      
      return {
        total: allMigrations.length,
        applied: appliedMigrations.length,
        pending: pendingMigrations.length,
        migrations: {
          all: allMigrations.map(m => ({
            version: m.version,
            filename: m.filename,
            checksum: m.checksum
          })),
          applied: appliedMigrations,
          pending: pendingMigrations.map(m => ({
            version: m.version,
            filename: m.filename,
            checksum: m.checksum
          }))
        }
      };
    } catch (error) {
      logger.error('Failed to get migration status', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute database query
   */
  async executeQuery(query, params = []) {
    const client = await this.pool.connect();
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
    logger.info('Database connection closed');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  const migrationManager = new DatabaseMigrationManager(databaseUrl);
  
  try {
    await migrationManager.initialize();
    
    switch (command) {
      case 'generate':
        const name = args[1];
        const description = args.slice(2).join(' ');
        if (!name) {
          console.error('Usage: node migration-manager.js generate <name> [description]');
          process.exit(1);
        }
        await migrationManager.generateMigration(name, description);
        break;
        
      case 'migrate':
        const dryRun = args.includes('--dry-run');
        const noBackup = args.includes('--no-backup');
        await migrationManager.migrate({ 
          dryRun, 
          createBackups: !noBackup 
        });
        break;
        
      case 'rollback':
        const steps = parseInt(args[1]) || 1;
        await migrationManager.rollback(steps);
        break;
        
      case 'status':
        const status = await migrationManager.getStatus();
        console.log('Migration Status:');
        console.log(`  Total migrations: ${status.total}`);
        console.log(`  Applied: ${status.applied}`);
        console.log(`  Pending: ${status.pending}`);
        
        if (status.migrations.pending.length > 0) {
          console.log('\nPending migrations:');
          status.migrations.pending.forEach(m => {
            console.log(`  - ${m.version}: ${m.filename}`);
          });
        }
        break;
        
      default:
        console.log(`
SMETA360-2 Database Migration Manager

Usage:
  node migration-manager.js generate <name> [description]  Generate new migration
  node migration-manager.js migrate [--dry-run] [--no-backup]  Apply pending migrations
  node migration-manager.js rollback [steps]               Rollback migrations
  node migration-manager.js status                         Show migration status

Examples:
  node migration-manager.js generate "add_user_preferences" "Add user preferences table"
  node migration-manager.js migrate --dry-run
  node migration-manager.js migrate
  node migration-manager.js rollback 2
  node migration-manager.js status
        `);
        break;
    }
    
  } catch (error) {
    console.error('Migration operation failed:', error.message);
    process.exit(1);
  } finally {
    await migrationManager.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMigrationManager;