// Скрипт для применения миграции добавления полей потолка
import { Pool } from 'pg';
import fs from 'fs';
import { config } from './config.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('aiven') ? { rejectUnauthorized: false } : false
});

async function runMigration(migrationFile = 'add_ceiling_fields_to_rooms.sql') {
  const client = await pool.connect();
  
  try {
    console.log(`🔄 Применяем миграцию: ${migrationFile}...`);
    
    // Читаем SQL миграцию
    const migrationSQL = fs.readFileSync(`./migrations/${migrationFile}`, 'utf8');
    
    // Выполняем миграцию
    await client.query(migrationSQL);
    
    console.log('✅ Миграция успешно применена!');
    
    // Проверяем созданные индексы
    const indexResult = await client.query(`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE indexname LIKE 'idx_%'
      AND schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('📋 Созданные индексы:');
      indexResult.rows.forEach((row) => {
        console.log(`  - ${row.indexname} на ${row.tablename}`);
      });
    } else {
      console.log('� Миграция выполнена успешно');
    }
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем миграцию
const migrationFile = process.argv[2];
runMigration(migrationFile).catch(console.error);