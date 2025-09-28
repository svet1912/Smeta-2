-- SQL скрипт для создания точной копии структуры БД works_ref
-- Основан на реальной схеме из проекта smetafixed

-- =============================
-- 1. ИЕРАРХИЯ РАБОТ (3 уровня)
-- =============================

-- Фазы строительства (верхний уровень)
CREATE TABLE phases (
    id text PRIMARY KEY,
    name text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Стадии работ (второй уровень)
CREATE TABLE stages (
    id text PRIMARY KEY,
    name text NOT NULL,
    phase_id text REFERENCES phases(id) ON DELETE SET NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Подстадии работ (третий уровень)
CREATE TABLE substages (
    id text PRIMARY KEY,
    name text NOT NULL,
    stage_id text REFERENCES stages(id) ON DELETE SET NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Справочник работ (основная таблица)
CREATE TABLE works_ref (
    id text PRIMARY KEY,
    name text NOT NULL,
    unit text,
    unit_price numeric(14,2),
    phase_id text REFERENCES phases(id) ON DELETE SET NULL,
    stage_id text REFERENCES stages(id) ON DELETE SET NULL,
    substage_id text REFERENCES substages(id) ON DELETE SET NULL,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================
-- 2. МАТЕРИАЛЫ И НОРМАТИВЫ
-- =============================

-- Справочник материалов
CREATE TABLE materials (
    id text PRIMARY KEY,
    name text NOT NULL,
    image_url text,
    item_url text,
    unit text,
    unit_price numeric(14,2),
    expenditure numeric(14,6),
    weight numeric(14,3),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Нормативная связка работы и материалов (многие-ко-многим)
CREATE TABLE work_materials (
    work_id text NOT NULL REFERENCES works_ref(id) ON DELETE CASCADE,
    material_id text NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    consumption_per_work_unit numeric(18,6),
    waste_coeff numeric(8,4) DEFAULT 1.0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (work_id, material_id)
);

-- =============================
-- 3. ИНДЕКСЫ ПРОИЗВОДИТЕЛЬНОСТИ
-- =============================

-- Иерархические связи
CREATE INDEX idx_stages_phase ON stages(phase_id);
CREATE INDEX idx_substages_stage ON substages(stage_id);
CREATE INDEX idx_worksref_stage ON works_ref(stage_id);
CREATE INDEX idx_worksref_substage ON works_ref(substage_id);

-- Связи материалов
CREATE INDEX idx_work_materials_material ON work_materials(material_id);

-- Полнотекстовый поиск
CREATE INDEX idx_materials_name ON materials USING gin (to_tsvector('simple', name));

-- =============================
-- 4. ПРИМЕРЫ ДАННЫХ (для тестирования)
-- =============================

-- Вставка примеров фаз
INSERT INTO phases (id, name, sort_order) VALUES 
('10', 'Демонтажные работы', 10),
('360', 'Электромонтажные работы', 360),
('390', 'Сантехнические работы (Демонтаж)', 390),
('417', 'Проемы', 417);

-- Вставка примеров стадий
INSERT INTO stages (id, name, phase_id, sort_order) VALUES 
('s.1', 'Потолочные работы (Демонтаж)', '10', 1),
('s.6', 'Потолочные работы', '360', 6),
('s.11', 'Электромонтажные работы', '360', 11),
('s.4', 'Сантехнические работы (Демонтаж)', '390', 4),
('s.12', 'Проемы', '417', 12);

-- Вставка примеров подстадий
INSERT INTO substages (id, name, stage_id, sort_order) VALUES 
('ss.1.1', '1.1 Потолок', 's.1', 1),
('ss.6.2', '6.2 Тепло-звукоизоляция потолка', 's.6', 2),
('ss.6.3', '6.3 ГКЛ потолок', 's.6', 3),
('ss.6.4', '6.4 Малярные работы потолок', 's.6', 4);

-- Вставка примеров работ
INSERT INTO works_ref (id, name, unit, unit_price, phase_id, stage_id, substage_id, sort_order) VALUES 
('w.1', 'Очистка потолка от масляной краски или клея', 'м2', 1.00, '10', 's.1', 'ss.1.1', 1),
('w.2', 'Очистка потолка от шпаклевки/водоэмульсионной краски', 'м2', 2.00, '10', 's.1', 'ss.1.1', 2),
('w.3', 'Демонтаж штукатурки с потолка', 'м2', 3.00, '10', 's.1', 'ss.1.1', 3),
('w.107', 'Изготовление металлокаркаса для прямолинейных торцов потолочных конструкций шириной до 40 см', 'м.пог', 107.00, '360', 's.6', 'ss.6.3', 107),
('w.108', 'Обшивка ГКЛ прямолинейных торцов потолочных конструкций металлокаркаса шириной до 40 см', 'м.пог', 108.00, '360', 's.6', 'ss.6.3', 108),
('w.109', 'Монтаж скрытого люка под покраску на потолок из ГКЛ с устройством портала', 'шт.', 109.00, '360', 's.6', 'ss.6.3', 109);

-- Вставка примеров материалов
-- (Реальные данные импортируются из CSV файла BDM (1).csv через скрипт import_materials.js)

-- Вставка примеров нормативов расхода
INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff) VALUES 
('w.1', 'm.1001', 1.000000, 1.0000),
('w.1', 'm.1025', 1.000000, 1.0000),
('w.1', 'm.682', 1.000000, 1.0000),
('w.2', 'm.1025', 0.500000, 1.1000),
('w.3', 'm.682', 2.000000, 1.2000);

-- =============================
-- 5. ПОЛЕЗНЫЕ ЗАПРОСЫ
-- =============================

-- Получение всех работ с полной иерархией
/*
SELECT 
    p.name as phase_name,
    s.name as stage_name,
    ss.name as substage_name,
    wr.id as work_code,
    wr.name as work_name,
    wr.unit,
    wr.unit_price
FROM works_ref wr
LEFT JOIN phases p ON wr.phase_id = p.id
LEFT JOIN stages s ON wr.stage_id = s.id  
LEFT JOIN substages ss ON wr.substage_id = ss.id
ORDER BY p.sort_order, s.sort_order, ss.sort_order, wr.sort_order;
*/

-- Получение материалов для работы
/*
SELECT 
    m.id,
    m.name,
    m.unit,
    m.unit_price,
    wm.consumption_per_work_unit,
    wm.waste_coeff,
    (wm.consumption_per_work_unit * wm.waste_coeff * m.unit_price) as material_cost_per_work_unit
FROM work_materials wm
JOIN materials m ON wm.material_id = m.id
WHERE wm.work_id = 'w.1';
*/

-- Статистика по структуре
/*
SELECT 
    (SELECT count(*) FROM phases) as phases_count,
    (SELECT count(*) FROM stages) as stages_count,
    (SELECT count(*) FROM substages) as substages_count,
    (SELECT count(*) FROM works_ref) as works_count,
    (SELECT count(*) FROM materials) as materials_count,
    (SELECT count(*) FROM work_materials) as work_materials_count;
*/