// Скрипт для проверки структуры БД
import { Pool } from 'pg';
import { config } from './config.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('aiven') ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Проверяем структуру базы данных...');
    
    // Проверяем все таблицы
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Существующие таблицы:');
    tablesResult.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Если есть таблица rooms, проверяем ее структуру
    if (tablesResult.rows.some((row) => row.table_name === 'rooms')) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'rooms' 
        ORDER BY ordinal_position;
      `);
      
      console.log('\n🏠 Структура таблицы rooms:');
      columnsResult.rows.forEach((row) => {
        console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'NULL'})`);
      });
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке БД:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем проверку
checkDatabase().catch(console.error);