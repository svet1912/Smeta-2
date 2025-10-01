-- Добавление тестового пользователя и смет для kiy026@yandex.ru

-- 1. Добавляем пользователя если его нет
INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
VALUES ('kiy026@yandex.ru', '$2b$10$rN1I8Ql4vJxOYDa5kD2KXu8vTNLI8QG7Z6Y8.vKz4Y9vYl9uKz8aA', 'Константин', 'Иванович', 'СМЕТА 360°', true, true)
ON CONFLICT (email) DO NOTHING;

-- 2. Создаем тестовые проекты
INSERT INTO construction_projects (customer_name, object_address, contractor_name, contract_number, deadline, user_id, created_at, updated_at, status)
VALUES 
  ('ООО "БизнесЦентр"', 'г. Москва, ул. Тверская, 15', 'ООО "СтройПроект"', 'СП-2024-001', '2024-12-31', 
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW(), 'in_progress'),
  ('Иванов Петр Сергеевич', 'г. Москва, ул. Новый Арбат, 24', 'ИП Строитель', 'ИП-2024-002', '2025-03-15',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW(), 'draft'),
  ('ИП Сидоров А.В.', 'МО, Одинцовский район, д. Жуковка', 'ООО "ДомСтрой"', 'ДС-2024-003', '2025-06-30',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW(), 'completed')
ON CONFLICT DO NOTHING;

-- 3. Создаем тестовые сметы заказчика
INSERT INTO customer_estimates (
  project_id, name, description, version, status, total_amount, 
  work_coefficient, material_coefficient, user_id, created_at, updated_at
)
VALUES 
  -- Смета 1: Отделочные работы офиса
  ((SELECT id FROM construction_projects WHERE customer_name = 'ООО "БизнесЦентр"' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'Отделочные работы офиса', 
   'Полный комплекс отделочных работ в офисном здании площадью 120 кв.м.',
   1, 'draft', 850000.00, 1.200, 1.150, 
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Смета 2: Ремонт квартиры  
  ((SELECT id FROM construction_projects WHERE customer_name = 'Иванов Петр Сергеевич' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'Капитальный ремонт 3-комнатной квартиры',
   'Полный ремонт квартиры площадью 85 кв.м с заменой инженерных систем и отделкой',
   1, 'active', 1250000.00, 1.100, 1.200,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Смета 3: Строительство дома
  ((SELECT id FROM construction_projects WHERE customer_name = 'ИП Сидоров А.В.' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'Строительство загородного дома',
   'Строительство 2-этажного дома из газобетона площадью 250 кв.м',
   1, 'completed', 3500000.00, 1.000, 1.100,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. Добавляем элементы в первую смету (Отделочные работы)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id, created_at, updated_at
)
VALUES 
  -- Работы по отделке офиса
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.15.01.023.01', 'Устройство стяжек цементных толщиной 20 мм', 'м2', 120.00, 420.00, 50400.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.15.04.013.02', 'Окраска водоэмульсионными составами потолков', 'м2', 120.00, 180.00, 21600.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.15.04.015.01', 'Окраска стен водоэмульсионными составами', 'м2', 350.00, 160.00, 56000.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Материалы для офиса
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.401.0001', 'Цемент портландский М400', 'т', 2.50, 8500.00, 21250.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.402.0045', 'Краска водоэмульсионная белая', 'кг', 45.00, 320.00, 14400.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. Добавляем элементы во вторую смету (Ремонт квартиры)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id, created_at, updated_at
)
VALUES 
  -- Сантехнические работы
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.10.01.018.01', 'Установка ванн стальных', 'шт', 1.00, 2800.00, 2800.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.10.01.033.01', 'Установка унитазов', 'шт', 2.00, 1500.00, 3000.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Электромонтажные работы  
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.08.01.004.02', 'Прокладка проводов и кабелей', 'м', 200.00, 85.00, 17000.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Материалы для ремонта
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.143.0120', 'Ванна стальная 170x70', 'шт', 1.00, 15500.00, 15500.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.144.0058', 'Унитаз напольный с бачком', 'шт', 2.00, 12800.00, 25600.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.531.0021', 'Кабель ВВГ 3x2.5', 'м', 200.00, 125.00, 25000.00, 6,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. Добавляем элементы в третью смету (Строительство дома)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id, created_at, updated_at
)
VALUES 
  -- Фундаментные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.05.01.001.01', 'Устройство ленточных фундаментов', 'м3', 35.00, 4200.00, 147000.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Кладочные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.07.01.011.04', 'Кладка стен из газобетонных блоков', 'м3', 65.00, 2800.00, 182000.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Кровельные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'work', 'w.12.01.002.05', 'Устройство кровли из металлочерепицы', 'м2', 160.00, 950.00, 152000.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  -- Материалы для строительства
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.401.0002', 'Бетон В25 (М350)', 'м3', 35.00, 5200.00, 182000.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.105.0325', 'Блоки газобетонные 625x250x300', 'м3', 65.00, 4800.00, 312000.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'material', 'm.241.0124', 'Металлочерепица 0.5 мм', 'м2', 170.00, 650.00, 110500.00, 6,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 7. Добавляем записи в историю изменений смет
INSERT INTO customer_estimate_history (
  estimate_id, action, changes, user_id, created_at
)
VALUES 
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 850000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 1250000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'status_changed', '{"old_status": "draft", "new_status": "active", "message": "Смета принята в работу"}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 3500000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW()),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' AND user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru') LIMIT 1),
   'approved', '{"message": "Смета согласована и утверждена заказчиком", "approved_amount": 3500000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'), NOW())
ON CONFLICT DO NOTHING;

-- Выводим информацию о созданных данных
SELECT 
  'Пользователи' as type,
  COUNT(*) as count
FROM auth_users 
WHERE email = 'kiy026@yandex.ru'

UNION ALL

SELECT 
  'Проекты' as type,
  COUNT(*) as count
FROM construction_projects
WHERE user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')

UNION ALL

SELECT 
  'Сметы' as type,
  COUNT(*) as count
FROM customer_estimates
WHERE user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')

UNION ALL

SELECT 
  'Элементы смет' as type,
  COUNT(*) as count
FROM customer_estimate_items
WHERE user_id = (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru');