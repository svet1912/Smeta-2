-- Добавление полей для расчета потолка в таблицу project_rooms
-- Миграция: add_ceiling_fields_to_project_rooms
-- Дата: 2025-10-06

ALTER TABLE project_rooms 
ADD COLUMN ceiling_area DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN ceiling_slopes DECIMAL(10,2) DEFAULT 0.00;

-- Добавляем комментарии к новым полям
COMMENT ON COLUMN project_rooms.ceiling_area IS 'Площадь потолка в квадратных метрах';
COMMENT ON COLUMN project_rooms.ceiling_slopes IS 'Откосы потолочные в метрах погонных';

-- Обновляем существующие записи - устанавливаем площадь потолка равной площади помещения
UPDATE project_rooms SET ceiling_area = area WHERE ceiling_area = 0.00 AND area IS NOT NULL;

-- Индексы для ускорения запросов (опционально)
CREATE INDEX idx_project_rooms_ceiling_area ON project_rooms(ceiling_area);
CREATE INDEX idx_project_rooms_ceiling_slopes ON project_rooms(ceiling_slopes);