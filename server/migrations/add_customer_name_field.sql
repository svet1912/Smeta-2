-- Добавляем поле customer_name в таблицу customer_estimates
-- Дата: 2025-10-06

-- Добавляем поле для имени заказчика
ALTER TABLE customer_estimates 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Создаем индекс для поиска по имени заказчика
CREATE INDEX IF NOT EXISTS idx_customer_estimates_customer_name 
ON customer_estimates(customer_name);

-- Обновляем комментарий к таблице
COMMENT ON COLUMN customer_estimates.customer_name IS 'Имя заказчика для сметы';

-- Добавляем поле description в customer_estimate_items если не существует
ALTER TABLE customer_estimate_items 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN customer_estimate_items.description IS 'Описание позиции сметы';