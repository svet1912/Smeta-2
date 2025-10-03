/**
 * Profile Controller
 * Контроллер для управления профилями пользователей и проектами
 */
import { query } from '../database.js';

// Неиспользуемые функции getUserProfile и updateUserProfile удалены

// Получение проектов пользователя
export async function getUserProjects(req, res) {
  try {
    const user = req.user;
    
    const result = await query(`
      SELECT cp.*, 
             COUNT(ce.id) as estimates_count
      FROM construction_projects cp
      LEFT JOIN customer_estimates ce ON cp.id = ce.project_id
      WHERE cp.user_id = $1
      GROUP BY cp.id
      ORDER BY cp.created_at DESC
    `, [user.id]);
    
    res.json({
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Ошибка получения проектов:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Создание нового проекта
export async function createProject(req, res) {
  try {
    const user = req.user;
    const { customer_name, object_address, contractor_name, contract_number, deadline } = req.body;
    
    if (!customer_name || !object_address || !contractor_name || !contract_number || !deadline) {
      return res.status(400).json({
        error: 'Все поля обязательны для заполнения',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    const result = await query(`
      INSERT INTO construction_projects (
        customer_name, object_address, contractor_name, 
        contract_number, deadline, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [customer_name, object_address, contractor_name, contract_number, deadline, user.id]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка создания проекта:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Default export для совместимости с роутером
export default {
  getUserProjects,
  createProject
};
