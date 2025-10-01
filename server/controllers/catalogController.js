/**
 * API контроллеры для работы с каталогом материалов и работ
 * Шаг 9.4 — Защищенные каталог API эндпоинты с автоматическим tenant контекстом
 */
import { query } from '../database.js';
import { getCurrentUser } from '../middleware/tenantContext.js';

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

    // Выполняем запрос к VIEW works_effective (автоматически учитывает tenant_id из app.tenant_id)
    const result = await query(`
      SELECT 
        id, 
        name, 
        unit, 
        unit_price, 
        tenant_id IS NOT NULL as is_tenant_override,
        created_at,
        updated_at
      FROM works_effective 
      ${whereCondition}
      ORDER BY name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `, [...params, parseInt(limit), parseInt(offset)]);

    // Подсчитываем общее количество
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM works_effective 
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

    console.log(`🔨 Получено работ: ${works.length}, tenant=${user.tenantId.substring(0,8)}`);

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

// Экспорт всех контроллеров
export default {
  getMaterials,
  overrideMaterial,
  resetMaterialOverride,
  getWorks,
  getWorkMaterials,
  getMaterialPrice,
  health
};
