const db = require('../database');

// Получить все сметы заказчика
exports.getAllCustomerEstimates = async (req, res) => {
  try {
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    let query = `
      SELECT 
        ce.*,
        cp.name as project_name,
        u.username as creator_name,
        COUNT(cei.id) as items_count,
        SUM(cei.total_cost) as total_estimate_cost
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN auth_users u ON ce.user_id = u.id
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      WHERE ce.tenant_id = $1
    `;
    
    const params = [tenant_id];
    
    // Роли viewer и estimator видят только свои сметы
    if (userRole === 'viewer' || userRole === 'estimator') {
      query += ' AND ce.user_id = $2';
      params.push(req.user.id);
    }
    
    query += `
      GROUP BY ce.id, cp.name, u.username
      ORDER BY ce.created_at DESC
    `;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения смет заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить смету заказчика по ID
exports.getCustomerEstimateById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    let query = `
      SELECT 
        ce.*,
        cp.name as project_name,
        u.username as creator_name
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN auth_users u ON ce.user_id = u.id
      WHERE ce.id = $1 AND ce.tenant_id = $2
    `;
    
    const params = [id, tenant_id];
    
    // Роли viewer и estimator видят только свои сметы
    if (userRole === 'viewer' || userRole === 'estimator') {
      query += ' AND ce.user_id = $3';
      params.push(req.user.id);
    }
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Создать новую смету заказчика
exports.createCustomerEstimate = async (req, res) => {
  try {
    const { tenant_id } = req.tenantContext;
    const { project_id, name, description, coefficients, status = 'draft' } = req.body;
    
    // Проверяем роль пользователя
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для создания сметы' });
    }
    
    // Проверяем существование проекта
    const projectCheck = await db.query(
      'SELECT id FROM construction_projects WHERE id = $1 AND tenant_id = $2',
      [project_id, tenant_id]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Проект не найден' });
    }
    
    const result = await db.query(`
      INSERT INTO customer_estimates (
        tenant_id, project_id, user_id, name, description,
        coefficients, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [tenant_id, project_id, req.user.id, name, description, 
        JSON.stringify(coefficients), status]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Обновить смету заказчика
exports.updateCustomerEstimate = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.tenantContext;
    const { name, description, coefficients, status } = req.body;
    const userRole = req.user.role;
    
    // Проверяем существование сметы и права доступа
    let checkQuery = 'SELECT * FROM customer_estimates WHERE id = $1 AND tenant_id = $2';
    const checkParams = [id, tenant_id];
    
    if (userRole === 'viewer' || userRole === 'estimator') {
      checkQuery += ' AND user_id = $3';
      checkParams.push(req.user.id);
    }
    
    const existingEstimate = await db.query(checkQuery, checkParams);
    
    if (existingEstimate.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    // Viewer не может редактировать
    if (userRole === 'viewer') {
      return res.status(403).json({ message: 'Недостаточно прав для редактирования' });
    }
    
    const result = await db.query(`
      UPDATE customer_estimates 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          coefficients = COALESCE($3, coefficients),
          status = COALESCE($4, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `, [name, description, coefficients ? JSON.stringify(coefficients) : null, 
        status, id, tenant_id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Удалить смету заказчика
exports.deleteCustomerEstimate = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    // Проверяем права доступа
    if (!['super_admin', 'admin', 'project_manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для удаления сметы' });
    }
    
    const result = await db.query(
      'DELETE FROM customer_estimates WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenant_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена' });
    }
    
    res.json({ message: 'Смета успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить элементы сметы
exports.getEstimateItems = async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    // Проверяем доступ к смете
    let checkQuery = 'SELECT id FROM customer_estimates WHERE id = $1 AND tenant_id = $2';
    const checkParams = [estimateId, tenant_id];
    
    if (userRole === 'viewer' || userRole === 'estimator') {
      checkQuery += ' AND user_id = $3';
      checkParams.push(req.user.id);
    }
    
    const estimateCheck = await db.query(checkQuery, checkParams);
    
    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    const result = await db.query(`
      SELECT * FROM customer_estimate_items 
      WHERE estimate_id = $1 
      ORDER BY position ASC, created_at ASC
    `, [estimateId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения элементов сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Добавить элемент в смету
exports.addEstimateItem = async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    const {
      item_type, reference_id, custom_name, unit, quantity,
      unit_price, total_cost, position, metadata
    } = req.body;
    
    // Проверяем права и существование сметы
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для добавления элементов' });
    }
    
    let checkQuery = 'SELECT id FROM customer_estimates WHERE id = $1 AND tenant_id = $2';
    const checkParams = [estimateId, tenant_id];
    
    if (userRole === 'estimator') {
      checkQuery += ' AND user_id = $3';
      checkParams.push(req.user.id);
    }
    
    const estimateCheck = await db.query(checkQuery, checkParams);
    
    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    const result = await db.query(`
      INSERT INTO customer_estimate_items (
        estimate_id, item_type, reference_id, custom_name,
        unit, quantity, unit_price, total_cost, position, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [estimateId, item_type, reference_id, custom_name,
        unit, quantity, unit_price, total_cost, position,
        metadata ? JSON.stringify(metadata) : null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Обновить элемент сметы
exports.updateEstimateItem = async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    const {
      custom_name, unit, quantity, unit_price, total_cost, position, metadata
    } = req.body;
    
    // Проверяем права доступа
    if (userRole === 'viewer') {
      return res.status(403).json({ message: 'Недостаточно прав для редактирования' });
    }
    
    // Проверяем существование элемента и права доступа к смете
    let checkQuery = `
      SELECT cei.* FROM customer_estimate_items cei
      JOIN customer_estimates ce ON cei.estimate_id = ce.id
      WHERE cei.id = $1 AND cei.estimate_id = $2 AND ce.tenant_id = $3
    `;
    const checkParams = [itemId, estimateId, tenant_id];
    
    if (userRole === 'estimator') {
      checkQuery += ' AND ce.user_id = $4';
      checkParams.push(req.user.id);
    }
    
    const itemCheck = await db.query(checkQuery, checkParams);
    
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Элемент сметы не найден или нет прав доступа' });
    }
    
    const result = await db.query(`
      UPDATE customer_estimate_items 
      SET custom_name = COALESCE($1, custom_name),
          unit = COALESCE($2, unit),
          quantity = COALESCE($3, quantity),
          unit_price = COALESCE($4, unit_price),
          total_cost = COALESCE($5, total_cost),
          position = COALESCE($6, position),
          metadata = COALESCE($7, metadata),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [custom_name, unit, quantity, unit_price, total_cost, position,
        metadata ? JSON.stringify(metadata) : null, itemId]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Удалить элемент сметы
exports.deleteEstimateItem = async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    // Проверяем права доступа
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для удаления элементов' });
    }
    
    // Проверяем существование элемента и права доступа к смете
    let checkQuery = `
      SELECT cei.* FROM customer_estimate_items cei
      JOIN customer_estimates ce ON cei.estimate_id = ce.id
      WHERE cei.id = $1 AND cei.estimate_id = $2 AND ce.tenant_id = $3
    `;
    const checkParams = [itemId, estimateId, tenant_id];
    
    if (userRole === 'estimator') {
      checkQuery += ' AND ce.user_id = $4';
      checkParams.push(req.user.id);
    }
    
    const itemCheck = await db.query(checkQuery, checkParams);
    
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Элемент сметы не найден или нет прав доступа' });
    }
    
    await db.query('DELETE FROM customer_estimate_items WHERE id = $1', [itemId]);
    
    res.json({ message: 'Элемент сметы успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить историю изменений сметы
exports.getEstimateHistory = async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    // Проверяем доступ к смете
    let checkQuery = 'SELECT id FROM customer_estimates WHERE id = $1 AND tenant_id = $2';
    const checkParams = [estimateId, tenant_id];
    
    if (userRole === 'viewer' || userRole === 'estimator') {
      checkQuery += ' AND user_id = $3';
      checkParams.push(req.user.id);
    }
    
    const estimateCheck = await db.query(checkQuery, checkParams);
    
    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    const result = await db.query(`
      SELECT 
        ceh.*,
        u.username as user_name
      FROM customer_estimate_history ceh
      LEFT JOIN auth_users u ON ceh.user_id = u.id
      WHERE ceh.estimate_id = $1
      ORDER BY ceh.created_at DESC
    `, [estimateId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения истории сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Получить шаблоны смет
exports.getEstimateTemplates = async (req, res) => {
  try {
    const { tenant_id } = req.tenantContext;
    const userRole = req.user.role;
    
    let query = `
      SELECT 
        cet.*,
        u.username as creator_name
      FROM customer_estimate_templates cet
      LEFT JOIN auth_users u ON cet.user_id = u.id
      WHERE cet.tenant_id = $1
    `;
    
    const params = [tenant_id];
    
    // Роли viewer и estimator видят только свои шаблоны и публичные
    if (userRole === 'viewer' || userRole === 'estimator') {
      query += ' AND (cet.user_id = $2 OR cet.is_public = true)';
      params.push(req.user.id);
    }
    
    query += ' ORDER BY cet.name ASC';
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения шаблонов смет:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Создать шаблон сметы
exports.createEstimateTemplate = async (req, res) => {
  try {
    const { tenant_id } = req.tenantContext;
    const { name, description, template_data, is_public = false } = req.body;
    
    // Проверяем роль пользователя
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Недостаточно прав для создания шаблонов' });
    }
    
    const result = await db.query(`
      INSERT INTO customer_estimate_templates (
        tenant_id, user_id, name, description, template_data, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [tenant_id, req.user.id, name, description, 
        JSON.stringify(template_data), is_public]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания шаблона сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};