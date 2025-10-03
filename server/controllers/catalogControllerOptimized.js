/**
 * Оптимизированные API контроллеры для работы с каталогом материалов и работ
 * Использует QueryOptimizer для улучшения производительности
 */
import { query } from '../database.js';
import { getCurrentUser } from '../middleware/auth.js';
import queryOptimizer from '../services/queryOptimizer.js';

/**
 * Оптимизированное получение списка материалов
 * GET /materials
 */
export async function getMaterials(req, res) {
  try {
    // Для публичного маршрута не требуется пользователь
    const { 
      search = '', 
      limit = 50, 
      offset = 0,
      showOnlyOverrides = false 
    } = req.query;

    // Строим WHERE условие для поиска
    let whereCondition = '';
    const params = [];
    let paramIndex = 1;

    if (search) {
      whereCondition = `WHERE name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (showOnlyOverrides === 'true') {
      const andOr = whereCondition ? 'AND' : 'WHERE';
      whereCondition += ` ${andOr} tenant_id IS NOT NULL`;
    }

    // Используем оптимизированный запрос с кэшированием
    const result = await queryOptimizer.optimizedQuery(`
      SELECT 
        id, 
        name, 
        image_url,
        item_url,
        unit, 
        unit_price, 
        expenditure,
        weight,
        tenant_id IS NOT NULL as is_tenant_override,
        created_at,
        updated_at
      FROM materials
      ${whereCondition}
      ORDER BY name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), parseInt(offset)], {
      cacheKey: `materials_${search}_${showOnlyOverrides}_${limit}_${offset}`,
      cacheTTL: 600000 // 10 минут
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения материалов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Оптимизированное получение списка работ
 * GET /works
 */
export async function getWorks(req, res) {
  try {
    // Для публичного маршрута не требуется пользователь
    const { 
      search = '', 
      limit = 50, 
      offset = 0 
    } = req.query;

    const filters = {
      search
    };
    
    const pagination = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const result = await queryOptimizer.getWorksOptimized(filters, pagination);
    
    // Преобразуем данные в нужный формат
    const works = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      unit_price: row.unit_price,
      phase_name: row.phase_name,
      stage_name: row.stage_name,
      substage_name: row.substage_name,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    console.log(`🔨 Получено работ: ${works.length} из ${result.rows.length}`);

    res.json({
      success: true,
      data: works,
      pagination: {
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + works.length) < result.rows.length
      }
    });
  } catch (error) {
    console.error('Ошибка получения работ:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получение фаз работ
 * GET /phases
 */
export async function getPhases(req, res) {
  try {
    const result = await queryOptimizer.optimizedQuery(`
      SELECT id, name, sort_order
      FROM phases
      ORDER BY sort_order, name
    `, [], {
      cacheKey: 'phases_all',
      cacheTTL: 1800000 // 30 минут (фазы редко меняются)
    });

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения фаз:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получение всех материалов работ
 * GET /work-materials
 */
export async function getWorkMaterials(req, res) {
  try {
    const { 
      limit = 50, 
      offset = 0,
      workId = null
    } = req.query;
    
    // Строим WHERE условие
    let whereCondition = '';
    const params = [];
    let paramIndex = 1;

    if (workId) {
      whereCondition = `WHERE wm.work_id = $${paramIndex}`;
      params.push(workId);
      paramIndex++;
    }
    
    const result = await queryOptimizer.optimizedQuery(`
      SELECT 
        wm.work_id,
        wm.material_id,
        wm.consumption_per_work_unit,
        wm.waste_coeff,
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        m.name as material_name,
        m.unit as material_unit,
        m.unit_price as material_unit_price,
        m.image_url as material_image_url,
        ((wm.consumption_per_work_unit * wm.waste_coeff) * m.unit_price) as material_cost_per_work_unit,
        w.name as work_name,
        w.unit as work_unit
      FROM work_materials wm
      JOIN materials m ON wm.material_id = m.id
      JOIN works_ref w ON wm.work_id = w.id
      ${whereCondition}
      ORDER BY w.name, m.name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, parseInt(limit), parseInt(offset)], {
      cacheKey: `work_materials_${workId || 'all'}_${limit}_${offset}`,
      cacheTTL: 900000 // 15 минут
    });

    // Получаем общее количество
    const countResult = await queryOptimizer.optimizedQuery(`
      SELECT COUNT(*) as total
      FROM work_materials wm
      ${whereCondition}
    `, params, {
      cacheKey: `work_materials_count_${workId || 'all'}`,
      cacheTTL: 900000
    });

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения материалов работ:', error);
    res.status(500).json({ 
      error: 'Ошибка получения материалов работ',
      code: 'WORK_MATERIALS_FETCH_ERROR'
    });
  }
}

/**
 * Создание нового материала (требует авторизации)
 * POST /materials
 */
export async function createMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { name, unit, unit_price, expenditure = 1.0, weight, image_url, item_url } = req.body;

    if (!name || !unit || unit_price === undefined) {
      return res.status(400).json({
        error: 'Обязательные поля: name, unit, unit_price',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO materials (tenant_id, name, unit, unit_price, expenditure, weight, image_url, item_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, unit, unit_price, expenditure, weight, image_url, item_url, created_at
    `, [user.tenantId, name, unit, parseFloat(unit_price), parseFloat(expenditure), weight, image_url, item_url]);

    // Очищаем кэш материалов
    queryOptimizer.clearCache();

    res.status(201).json({
      success: true,
      material: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания материала:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Обновление материала (требует авторизации)
 * PUT /materials/:id
 */
export async function updateMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { id } = req.params;
    const { name, unit, unit_price, expenditure, weight, image_url, item_url } = req.body;

    const result = await query(`
      UPDATE materials 
      SET name = COALESCE($2, name),
          unit = COALESCE($3, unit),
          unit_price = COALESCE($4, unit_price),
          expenditure = COALESCE($5, expenditure),
          weight = COALESCE($6, weight),
          image_url = COALESCE($7, image_url),
          item_url = COALESCE($8, item_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $9
      RETURNING id, name, unit, unit_price, expenditure, weight, image_url, item_url, updated_at
    `, [id, name, unit, unit_price ? parseFloat(unit_price) : null, expenditure ? parseFloat(expenditure) : null, weight, image_url, item_url, user.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Материал не найден',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    // Очищаем кэш материалов
    queryOptimizer.clearCache();

    res.json({
      success: true,
      material: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления материала:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Удаление материала (требует авторизации)
 * DELETE /materials/:id
 */
export async function deleteMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { id } = req.params;

    const result = await query(`
      DELETE FROM materials 
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name
    `, [id, user.tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Материал не найден',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    // Очищаем кэш материалов
    queryOptimizer.clearCache();

    res.json({
      success: true,
      message: `Материал "${result.rows[0].name}" удален`
    });
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Создание новой работы (требует авторизации)
 * POST /works
 */
export async function createWork(req, res) {
  try {
    const user = getCurrentUser(req);
    const { name, unit, unit_price, description, sort_order = 0 } = req.body;

    if (!name || !unit || unit_price === undefined) {
      return res.status(400).json({
        error: 'Обязательные поля: name, unit, unit_price',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO works_ref (tenant_id, name, unit, unit_price, description, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, unit, unit_price, description, sort_order, created_at
    `, [user.tenantId, name, unit, parseFloat(unit_price), description, parseInt(sort_order)]);

    // Очищаем кэш работ
    queryOptimizer.clearCache();

    res.status(201).json({
      success: true,
      work: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания работы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Добавление материала к работе (требует авторизации)
 * POST /works/:workId/materials
 */
export async function addWorkMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { workId } = req.params;
    const { material_id, consumption_per_work_unit, waste_coeff = 1.0 } = req.body;

    if (!material_id || consumption_per_work_unit === undefined) {
      return res.status(400).json({
        error: 'Обязательные поля: material_id, consumption_per_work_unit',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff)
      VALUES ($1, $2, $3, $4)
      RETURNING work_id, material_id, consumption_per_work_unit, waste_coeff
    `, [workId, material_id, parseFloat(consumption_per_work_unit), parseFloat(waste_coeff)]);

    // Очищаем кэш материалов работ
    queryOptimizer.clearCache();

    res.status(201).json({
      success: true,
      workMaterial: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка добавления материала к работе:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Обновление связи работа-материал (требует авторизации)
 * PUT /works/:workId/materials/:materialId
 */
export async function updateWorkMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { workId, materialId } = req.params;
    const { consumption_per_work_unit, waste_coeff } = req.body;

    const result = await query(`
      UPDATE work_materials 
      SET consumption_per_work_unit = COALESCE($3, consumption_per_work_unit),
          waste_coeff = COALESCE($4, waste_coeff)
      WHERE work_id = $1 AND material_id = $2
      RETURNING work_id, material_id, consumption_per_work_unit, waste_coeff
    `, [workId, materialId, consumption_per_work_unit ? parseFloat(consumption_per_work_unit) : null, waste_coeff ? parseFloat(waste_coeff) : null]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Связь работа-материал не найдена',
        code: 'WORK_MATERIAL_NOT_FOUND'
      });
    }

    // Очищаем кэш материалов работ
    queryOptimizer.clearCache();

    res.json({
      success: true,
      workMaterial: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления связи работа-материал:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Удаление связи работа-материал (требует авторизации)
 * DELETE /works/:workId/materials/:materialId
 */
export async function deleteWorkMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { workId, materialId } = req.params;

    const result = await query(`
      DELETE FROM work_materials 
      WHERE work_id = $1 AND material_id = $2
      RETURNING work_id, material_id
    `, [workId, materialId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Связь работа-материал не найдена',
        code: 'WORK_MATERIAL_NOT_FOUND'
      });
    }

    // Очищаем кэш материалов работ
    queryOptimizer.clearCache();

    res.json({
      success: true,
      message: 'Связь работа-материал удалена'
    });
  } catch (error) {
    console.error('Ошибка удаления связи работа-материал:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Экспорт всех контроллеров
export default {
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getWorks,
  createWork,
  getPhases,
  getWorkMaterials,
  addWorkMaterial,
  updateWorkMaterial,
  deleteWorkMaterial
};
