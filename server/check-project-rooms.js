// Скрипт для проверки структуры таблицы project_rooms
import { Pool } from 'pg';
import { config } from './config.js';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('aiven') ? { rejectUnauthorized: false } : false
});

async function checkProjectRooms() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Проверяем структуру таблицы project_rooms...');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'project_rooms' 
      ORDER BY ordinal_position;
    `);
    
    console.log('🏠 Структура таблицы project_rooms:');
    columnsResult.rows.forEach((row) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'NULL'}, nullable: ${row.is_nullable})`);
    });
    
    // Проверяем есть ли уже поля потолка
    const ceilingFields = columnsResult.rows.filter((row) => 
      row.column_name === 'ceiling_area' || row.column_name === 'ceiling_slopes'
    );
    
    if (ceilingFields.length > 0) {
      console.log('\n✅ Найдены поля потолка:');
      ceilingFields.forEach((row) => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('\n❌ Поля потолка не найдены. Нужно добавить ceiling_area и ceiling_slopes');
    }
    
    // Проверяем количество записей
    const countResult = await client.query('SELECT COUNT(*) as count FROM project_rooms');
    console.log(`\n📊 Всего записей в project_rooms: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Ошибка при проверке таблицы:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем проверку
checkProjectRooms().catch(console.error);