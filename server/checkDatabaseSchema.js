import { query } from './database.js';

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Проверка структуры базы данных...\n');

    // Получаем список всех таблиц
    const tablesResult = await query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Список таблиц в базе данных:');
    tablesResult.rows.forEach((row) => {
      console.log(`  - ${row.table_name}`);
    });

    console.log('\n' + '='.repeat(60) + '\n');

    // Для каждой таблицы получаем структуру
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;

      console.log(`📊 Таблица: ${tableName}`);

      // Получаем колонки
      const columnsResult = await query(
        `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position;
      `,
        [tableName]
      );

      if (columnsResult.rows.length === 0) {
        console.log('  ❌ Таблица пуста или недоступна');
        continue;
      }

      console.log('  Колонки:');
      columnsResult.rows.forEach((col) => {
        let type = col.data_type;
        if (col.character_maximum_length) {
          type += `(${col.character_maximum_length})`;
        }
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`    - ${col.column_name}: ${type} ${nullable}${defaultVal}`);
      });

      // Получаем количество записей
      const countResult = await query(`SELECT COUNT(*) as count FROM ${tableName};`);
      console.log(`  Записей: ${countResult.rows[0].count}`);

      // Получаем первичные ключи
      const pkResult = await query(
        `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
          AND tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public';
      `,
        [tableName]
      );

      if (pkResult.rows.length > 0) {
        const pkColumns = pkResult.rows.map((row) => row.column_name).join(', ');
        console.log(`  Первичный ключ: ${pkColumns}`);
      }

      // Получаем индексы
      const indexesResult = await query(
        `
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = $1 AND schemaname = 'public';
      `,
        [tableName]
      );

      if (indexesResult.rows.length > 0) {
        console.log('  Индексы:');
        indexesResult.rows.forEach((idx) => {
          console.log(`    - ${idx.indexname}`);
        });
      }

      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✅ Анализ структуры БД завершен');
  } catch (error) {
    console.error('❌ Ошибка при анализе структуры БД:', error);
  }
}

checkDatabaseSchema();
