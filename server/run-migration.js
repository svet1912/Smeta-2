// Скрипт для применения миграции добавления полей потолка
import { Pool } from 'pg';
import fs from 'fs';
import { config } from './config.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('aiven') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Применяем миграцию: добавление полей потолка...');
    
    // Читаем SQL миграцию
    const migrationSQL = fs.readFileSync('./migrations/add_ceiling_fields_to_rooms.sql', 'utf8');
    
    // Выполняем миграцию
    await client.query(migrationSQL);
    
    console.log('✅ Миграция успешно применена!');
    
    // Проверяем что поля добавились
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'project_rooms' 
      AND column_name IN ('ceiling_area', 'ceiling_slopes')
      ORDER BY column_name;
    `);
    
    console.log('📋 Добавленные поля:');
    result.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
    });
    
    // Проверяем сколько записей обновилось
    const countResult = await client.query('SELECT COUNT(*) as count FROM project_rooms WHERE ceiling_area > 0');
    console.log(`🔢 Обновлено записей с ceiling_area: ${countResult.rows[0].count}`);
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем миграцию
runMigration().catch(console.error);