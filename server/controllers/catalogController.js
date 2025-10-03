/**
 * API контроллеры для работы с каталогом материалов и работ
 * Исправленная версия для новой архитектуры
 */
import { query } from '../database.js';
import { getCurrentUser } from '../middleware/auth.js';

/**
 * Получение списка эффективных материалов с учетом тенанта
 * GET /catalog/materials
 */
export async function getMaterials(req, res) {
  try {
    const user = getCurrentUser(req);
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

    // Выполняем запрос к VIEW materials_effective (автоматически учитывает tenant_id из app.tenant_id)
    const result = await query(`
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
      FROM materials_effective 
      ${whereCondition}
      ORDER BY name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Подсчитываем общее количество
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM materials_effective 
      ${whereCondition};
    `, params);

    const materials = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      imageUrl: row.image_url,
      itemUrl: row.item_url,
      unit: row.unit,
      unitPrice: parseFloat(row.unit_price) || 0,
      expenditure: parseFloat(row.expenditure) || 0,
      weight: parseFloat(row.weight) || 0,
      isTenantOverride: row.is_tenant_override,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    console.log(`📚 Получено материалов: ${materials.length}, tenant=${user.tenantId.substring(0,8)}`);

    res.json({
      success: true,
      data: materials,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + materials.length) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения материалов:', error);
    res.status(500).json({
      error: 'Ошибка получения материалов',
      code: 'MATERIALS_FETCH_ERROR'
    });
  }
}

/**
 * Создание/обновление переопределения материала для тенанта
 * POST /catalog/materials/override
 */
export async function overrideMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { 
      baseId, 
      name, 
      unit, 
      unitPrice, 
      expenditure, 
      weight,
      imageUrl,
      itemUrl 
    } = req.body;

    if (!baseId || !name) {
      return res.status(400).json({
        error: 'Базовый ID и название материала обязательны',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Создаем уникальный ID для тенантского переопределения
    const overrideId = `${baseId}_tenant_${user.tenantId.substring(0, 8)}`;

    // Создаем или обновляем переопределение
    const result = await query(`
      INSERT INTO materials (
        id, tenant_id, name, unit, unit_price, expenditure, weight, image_url, item_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        unit = EXCLUDED.unit,
        unit_price = EXCLUDED.unit_price,
        expenditure = EXCLUDED.expenditure,
        weight = EXCLUDED.weight,
        image_url = EXCLUDED.image_url,
        item_url = EXCLUDED.item_url,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, name, unit, unit_price, expenditure, weight;
    `, [
      overrideId,
      user.tenantId,
      name,
      unit,
      parseFloat(unitPrice) || 0,
      parseFloat(expenditure) || 0,
      parseFloat(weight) || 0,
      imageUrl || null,
      itemUrl || null
    ]);

    const material = result.rows[0];

    console.log(`🏢 Создано переопределение материала: ${material.name}, tenant=${user.tenantId.substring(0,8)}`);

    res.json({
      success: true,
      data: {
        id: material.id,
        name: material.name,
        unit: material.unit,
        unitPrice: parseFloat(material.unit_price),
        expenditure: parseFloat(material.expenditure),
        weight: parseFloat(material.weight),
        isTenantOverride: true
      }
    });

  } catch (error) {
    console.error('❌ Ошибка создания переопределения материала:', error);
    res.status(500).json({
      error: 'Ошибка создания переопределения материала',
      code: 'MATERIAL_OVERRIDE_ERROR'
    });
  }
}

/**
 * Удаление переопределения материала (сброс к глобальному)
 * DELETE /catalog/materials/override/:id
 */
export async function resetMaterialOverride(req, res) {
  try {
    const user = getCurrentUser(req);
    const { id } = req.params;

    // Удаляем только тенантские переопределения
    const result = await query(`
      DELETE FROM materials
      WHERE id = $1 AND tenant_id = $2;
    `, [id, user.tenantId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Переопределение не найдено',
        code: 'OVERRIDE_NOT_FOUND'
      });
    }

    console.log(`🌍 Сброшено переопределение материала: ${id}, tenant=${user.tenantId.substring(0,8)}`);

    res.json({
      success: true,
      message: 'Переопределение удалено, материал сброшен к глобальному'
    });

  } catch (error) {
    console.error('❌ Ошибка сброса переопределения материала:', error);
    res.status(500).json({
      error: 'Ошибка сброса переопределения материала',
      code: 'MATERIAL_RESET_ERROR'
    });
  }
}

/**
 * Получение списка эффективных работ с учетом тенанта
 * GET /catalog/works
 */
export async function getWorks(req, res) {
  try {
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

    // Выполняем запрос к таблице works_ref
    const result = await query(`
      SELECT 
        id, 
        name, 
        unit, 
        unit_price, 
        tenant_id IS NOT NULL as is_tenant_override,
        created_at,
        updated_at
      FROM works_ref 
      ${whereCondition}
      ORDER BY name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Подсчитываем общее количество
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM works_ref 
      ${whereCondition};
    `, params);

    const works = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      unit: row.unit,
      unitPrice: parseFloat(row.unit_price) || 0,
      isTenantOverride: row.is_tenant_override,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    console.log(`🔨 Получено работ: ${works.length} из ${countResult.rows[0].total}`);

    res.json({
      success: true,
      data: works,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + works.length) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения работ:', error);
    res.status(500).json({
      error: 'Ошибка получения работ',
      code: 'WORKS_FETCH_ERROR'
    });
  }
}

/**
 * Получение эффективного состава работы (материалы)
 * GET /catalog/works/:id/materials
 */
export async function getWorkMaterials(req, res) {
  try {
    const user = getCurrentUser(req);
    const { id } = req.params;

    // Используем функцию get_effective_work_materials для получения состава
    const result = await query(`
      SELECT * FROM get_effective_work_materials($1);
    `, [id]);

    const materials = result.rows.map(row => ({
      materialId: row.material_id,
      materialName: row.material_name || 'Неизвестный материал',
      consumptionPerWorkUnit: parseFloat(row.consumption_per_work_unit),
      wasteCoeff: parseFloat(row.waste_coeff),
      isTenantOverride: row.is_tenant_override
    }));

    console.log(`🔗 Получен состав работы ${id}: ${materials.length} материалов, tenant=${user.tenantId.substring(0,8)}`);

    res.json({
      success: true,
      data: {
        workId: id,
        materials
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения состава работы:', error);
    res.status(500).json({
      error: 'Ошибка получения состава работы',
      code: 'WORK_MATERIALS_ERROR'
    });
  }
}

/**
 * Получение эффективной цены материала на дату
 * GET /catalog/materials/:id/price?date=YYYY-MM-DD
 */
export async function getMaterialPrice(req, res) {
  try {
    const user = getCurrentUser(req);
    const { id } = req.params;
    const { date } = req.query;

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Используем функцию effective_material_price для получения цены на дату
    const result = await query(`
      SELECT effective_material_price($1, $2) as effective_price;
    `, [id, targetDate]);

    const effectivePrice = result.rows[0].effective_price;

    console.log(`💰 Цена материала ${id} на ${targetDate}: ${effectivePrice}, tenant=${user.tenantId.substring(0,8)}`);

    res.json({
      success: true,
      data: {
        materialId: id,
        date: targetDate,
        price: effectivePrice ? parseFloat(effectivePrice) : null,
        hasDatePrice: effectivePrice !== null
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения цены материала:', error);
    res.status(500).json({
      error: 'Ошибка получения цены материала',
      code: 'MATERIAL_PRICE_ERROR'
    });
  }
}

/**
 * Health check эндпоинт
 * GET /health
 */
export async function health(req, res) {
  try {
    // Простая проверка подключения к БД
    const result = await query('SELECT 1 as status;');
    
    res.json({
      success: true,
      status: 'healthy',
      database: result.rows.length > 0 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Создание нового материала
 * POST /materials
 */
export async function createMaterial(req, res) {
  try {
    const user = getCurrentUser(req);
    const { name, unit, unit_price, expenditure, weight, image_url, item_url } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: 'Название и единица измерения обязательны',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO materials (name, unit, unit_price, expenditure, weight, image_url, item_url, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, unit, parseFloat(unit_price) || 0, parseFloat(expenditure) || 0, parseFloat(weight) || 0, image_url, item_url, user?.tenantId || null]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка создания материала:', error);
    res.status(500).json({
      error: 'Ошибка создания материала',
      code: 'MATERIAL_CREATE_ERROR'
    });
  }
}

/**
 * Обновление материала
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
      WHERE id = $1
      RETURNING *
    `, [id, name, unit, unit_price, expenditure, weight, image_url, item_url]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Материал не найден',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления материала:', error);
    res.status(500).json({
      error: 'Ошибка обновления материала',
      code: 'MATERIAL_UPDATE_ERROR'
    });
  }
}

/**
 * Удаление материала
 * DELETE /materials/:id
 */
export async function deleteMaterial(req, res) {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM materials WHERE id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Материал не найден',
        code: 'MATERIAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Материал удален'
    });

  } catch (error) {
    console.error('❌ Ошибка удаления материала:', error);
    res.status(500).json({
      error: 'Ошибка удаления материала',
      code: 'MATERIAL_DELETE_ERROR'
    });
  }
}

/**
 * Создание новой работы
 * POST /works
 */
export async function createWork(req, res) {
  try {
    const user = getCurrentUser(req);
    const { name, unit, unit_price, phase_id, stage_id } = req.body;

    if (!name || !unit) {
      return res.status(400).json({
        error: 'Название и единица измерения обязательны',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO works_ref (name, unit, unit_price, phase_id, stage_id, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, unit, parseFloat(unit_price) || 0, phase_id, stage_id, user?.tenantId || null]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка создания работы:', error);
    res.status(500).json({
      error: 'Ошибка создания работы',
      code: 'WORK_CREATE_ERROR'
    });
  }
}

/**
 * Получение этапов работ
 * GET /phases
 */
export async function getPhases(req, res) {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(`
      SELECT id, name, description, sort_order
      FROM phases
      ORDER BY sort_order, name
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    const countResult = await query(`SELECT COUNT(*) as total FROM phases`);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения этапов:', error);
    res.status(500).json({
      error: 'Ошибка получения этапов',
      code: 'PHASES_FETCH_ERROR'
    });
  }
}

/**
 * Добавление материала к работе
 * POST /works/:workId/materials
 */
export async function addWorkMaterial(req, res) {
  try {
    const { workId } = req.params;
    const { material_id, consumption_per_work_unit, waste_coeff } = req.body;

    if (!material_id || !consumption_per_work_unit) {
      return res.status(400).json({
        error: 'ID материала и расход обязательны',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const result = await query(`
      INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [workId, material_id, parseFloat(consumption_per_work_unit), parseFloat(waste_coeff) || 1.0]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка добавления материала к работе:', error);
    res.status(500).json({
      error: 'Ошибка добавления материала к работе',
      code: 'WORK_MATERIAL_ADD_ERROR'
    });
  }
}

/**
 * Обновление связи работы и материала
 * PUT /works/:workId/materials/:materialId
 */
export async function updateWorkMaterial(req, res) {
  try {
    const { workId, materialId } = req.params;
    const { consumption_per_work_unit, waste_coeff } = req.body;

    const result = await query(`
      UPDATE work_materials 
      SET consumption_per_work_unit = COALESCE($3, consumption_per_work_unit),
          waste_coeff = COALESCE($4, waste_coeff)
      WHERE work_id = $1 AND material_id = $2
      RETURNING *
    `, [workId, materialId, consumption_per_work_unit, waste_coeff]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Связь работы и материала не найдена',
        code: 'WORK_MATERIAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления связи работы и материала:', error);
    res.status(500).json({
      error: 'Ошибка обновления связи работы и материала',
      code: 'WORK_MATERIAL_UPDATE_ERROR'
    });
  }
}

/**
 * Удаление связи работы и материала
 * DELETE /works/:workId/materials/:materialId
 */
export async function deleteWorkMaterial(req, res) {
  try {
    const { workId, materialId } = req.params;

    const result = await query(`
      DELETE FROM work_materials WHERE work_id = $1 AND material_id = $2
    `, [workId, materialId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Связь работы и материала не найдена',
        code: 'WORK_MATERIAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Связь работы и материала удалена'
    });

  } catch (error) {
    console.error('❌ Ошибка удаления связи работы и материала:', error);
    res.status(500).json({
      error: 'Ошибка удаления связи работы и материала',
      code: 'WORK_MATERIAL_DELETE_ERROR'
    });
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
