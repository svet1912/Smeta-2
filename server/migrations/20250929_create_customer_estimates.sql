-- Миграция для создания таблиц смет заказчика
-- Дата: 2025-09-29

-- Сметы заказчика
CREATE TABLE IF NOT EXISTS customer_estimates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Смета заказчика',
    description TEXT,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft', -- draft, approved, archived
    total_amount DECIMAL(15,2) DEFAULT 0,
    work_coefficient DECIMAL(8,3) DEFAULT 1.000,
    material_coefficient DECIMAL(8,3) DEFAULT 1.000,
    user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL
);

-- Позиции сметы заказчика
CREATE TABLE IF NOT EXISTS customer_estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER REFERENCES customer_estimates(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL, -- 'work' или 'material'
    reference_id VARCHAR(50), -- ID из справочника работ/материалов
    name TEXT NOT NULL,
    unit VARCHAR(50),
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    original_unit_price DECIMAL(12,2), -- для отслеживания коэффициентов
    total_amount DECIMAL(15,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    notes TEXT,
    user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- История изменений смет (для аудита)
CREATE TABLE IF NOT EXISTS customer_estimate_history (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER REFERENCES customer_estimates(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, updated, item_added, item_removed, coefficient_applied, coefficient_reset
    changes JSONB, -- детали изменений
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Шаблоны смет (для повторного использования)
CREATE TABLE IF NOT EXISTS customer_estimate_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL, -- структура сметы для копирования
    is_public BOOLEAN DEFAULT false,
    user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_customer_estimates_project ON customer_estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimates_user_tenant ON customer_estimates(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimates_status ON customer_estimates(status);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_estimate ON customer_estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_type ON customer_estimate_items(item_type);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_reference ON customer_estimate_items(reference_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_history_estimate ON customer_estimate_history(estimate_id);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_history_action ON customer_estimate_history(action);
CREATE INDEX IF NOT EXISTS idx_customer_estimate_templates_user_tenant ON customer_estimate_templates(user_id, tenant_id);

-- Ограничения (constraints)
ALTER TABLE customer_estimates ADD CONSTRAINT chk_version_positive CHECK (version > 0);
ALTER TABLE customer_estimates ADD CONSTRAINT chk_total_amount_non_negative CHECK (total_amount >= 0);
ALTER TABLE customer_estimates ADD CONSTRAINT chk_coefficients_positive CHECK (work_coefficient > 0 AND material_coefficient > 0);
ALTER TABLE customer_estimate_items ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
ALTER TABLE customer_estimate_items ADD CONSTRAINT chk_unit_price_non_negative CHECK (unit_price >= 0);
ALTER TABLE customer_estimate_items ADD CONSTRAINT chk_total_amount_non_negative CHECK (total_amount >= 0);
ALTER TABLE customer_estimate_items ADD CONSTRAINT chk_item_type_valid CHECK (item_type IN ('work', 'material'));

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Применяем триггер к таблицам
DROP TRIGGER IF EXISTS update_customer_estimates_updated_at ON customer_estimates;
CREATE TRIGGER update_customer_estimates_updated_at
    BEFORE UPDATE ON customer_estimates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_estimate_items_updated_at ON customer_estimate_items;
CREATE TRIGGER update_customer_estimate_items_updated_at
    BEFORE UPDATE ON customer_estimate_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_estimate_templates_updated_at ON customer_estimate_templates;
CREATE TRIGGER update_customer_estimate_templates_updated_at
    BEFORE UPDATE ON customer_estimate_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблицам и полям
COMMENT ON TABLE customer_estimates IS 'Сметы заказчика с привязкой к проектам';
COMMENT ON COLUMN customer_estimates.status IS 'Статус сметы: draft, approved, archived';
COMMENT ON COLUMN customer_estimates.work_coefficient IS 'Коэффициент для работ (по умолчанию 1.000)';
COMMENT ON COLUMN customer_estimates.material_coefficient IS 'Коэффициент для материалов (по умолчанию 1.000)';

COMMENT ON TABLE customer_estimate_items IS 'Позиции сметы заказчика (работы и материалы)';
COMMENT ON COLUMN customer_estimate_items.item_type IS 'Тип позиции: work или material';
COMMENT ON COLUMN customer_estimate_items.reference_id IS 'Ссылка на ID в справочнике работ или материалов';
COMMENT ON COLUMN customer_estimate_items.original_unit_price IS 'Исходная цена до применения коэффициентов';

COMMENT ON TABLE customer_estimate_history IS 'История изменений смет для аудита';
COMMENT ON COLUMN customer_estimate_history.action IS 'Тип действия: created, updated, item_added, item_removed, coefficient_applied, coefficient_reset';

COMMENT ON TABLE customer_estimate_templates IS 'Шаблоны смет для повторного использования';
COMMENT ON COLUMN customer_estimate_templates.template_data IS 'JSON структура сметы для копирования';