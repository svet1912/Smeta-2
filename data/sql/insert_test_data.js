const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Настройка подключения к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function insertTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Подключение к базе данных...');
    
    // Читаем SQL файл
    const sqlFile = path.join(__dirname, 'insert_test_data_final.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📊 Выполнение SQL скрипта...');
    
    // Выполняем SQL
    const result = await client.query(sql);
    
    console.log('✅ Тестовые данные успешно добавлены!');
    console.log('📈 Результат:', result.rows || result);
    
  } catch (error) {
    console.error('❌ Ошибка при добавлении тестовых данных:', error);
    
    if (error.message.includes('duplicate key')) {
      console.log('ℹ️  Некоторые данные уже существуют в базе');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем скрипт
insertTestData();