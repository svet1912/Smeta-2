// Простой тест API для смет заказчика
import express from 'express';
import cors from 'cors';
import { query } from './database.js';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Простая аутентификация для тестов
const simpleAuth = (req, res, next) => {
  req.user = { id: 9, role: 'admin' }; // Фиксированный тестовый пользователь
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server working' });
});

// Получить все сметы заказчика (тестовая версия)
app.get('/api/customer-estimates', simpleAuth, async (req, res) => {
  try {
    console.log('📝 Запрос на получение смет заказчика');
    
    const result = await query(`
      SELECT 
        ce.*,
        cp.name as project_name,
        u.username as creator_name,
        COUNT(cei.id) as items_count,
        COALESCE(SUM(cei.total_cost), 0) as total_estimate_cost
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN auth_users u ON ce.user_id = u.id
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      GROUP BY ce.id, cp.name, u.username
      ORDER BY ce.created_at DESC
    `);
    
    console.log('✅ Найдено смет:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Ошибка получения смет:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Создать новую смету заказчика (тестовая версия)
app.post('/api/customer-estimates', simpleAuth, async (req, res) => {
  try {
    console.log('📝 Создание новой сметы заказчика:', req.body);
    
    const { project_id, name, description, coefficients, status = 'draft' } = req.body;
    
    const result = await query(`
      INSERT INTO customer_estimates (
        project_id, user_id, name, description,
        coefficients, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [project_id, req.user.id, name, description, 
        JSON.stringify(coefficients || {}), status]);
    
    console.log('✅ Смета создана:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Ошибка создания сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

// Получить проекты для тестирования
app.get('/api/projects', simpleAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM construction_projects ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Ошибка получения проектов:', error);
    res.status(500).json({ message: 'Ошибка сервера', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Тестовый сервер запущен на порту ${PORT}`);
  console.log(`🔗 API доступно: http://localhost:${PORT}/api`);
});

export default app;