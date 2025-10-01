-- Добавление тестового пользователя и смет для kiy026@yandex.ru

-- 1. Добавляем пользователя если его нет
INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
VALUES ('kiy026@yandex.ru', '$2b$10$rN1I8Ql4vJxOYDa5kD2KXu8vTNLI8QG7Z6Y8.vKz4Y9vYl9uKz8aA', 'Константин', 'Иванович', 'СМЕТА 360°', true, true)
ON CONFLICT (email) DO NOTHING;

-- 2. Получаем ID пользователя для дальнейшего использования
-- (в реальном запросе мы будем использовать подзапрос)

-- 3. Создаем тестовые проекты
INSERT INTO construction_projects (customer_name, object_address, contractor_name, contract_number, deadline, user_id)
VALUES 
  ('ООО "Строитель"', 'г. Москва, ул. Строительная, д. 10', 'ООО "ГлавСтрой"', 'ДГВ-2024-001', '2024-12-31', 
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
  ('ИП Петров А.С.', 'г. Санкт-Петербург, пр. Ленина, д. 25', 'АО "СтройМонтаж"', 'ДГВ-2024-002', '2025-03-15',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
  ('ПАО "РосСтрой"', 'г. Екатеринбург, ул. Промышленная, д. 15', 'ООО "УралСтрой"', 'ДГВ-2024-003', '2025-06-30',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'))
ON CONFLICT DO NOTHING;

-- 4. Создаем тестовые сметы заказчика
INSERT INTO customer_estimates (
  project_id, name, description, version, status, total_amount, 
  work_coefficient, material_coefficient, user_id, customer_name
)
VALUES 
  -- Смета 1: Отделочные работы
  ((SELECT id FROM construction_projects WHERE customer_name = 'ООО "Строитель"' LIMIT 1),
   'Отделочные работы офиса', 
   'Полный комплекс отделочных работ в офисном здании площадью 250 кв.м.',
   1, 'draft', 850000.00, 1.200, 1.150, 
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'),
   'ООО "Строитель"'),
   
  -- Смета 2: Ремонт квартиры  
  ((SELECT id FROM construction_projects WHERE customer_name = 'ИП Петров А.С.' LIMIT 1),
   'Капитальный ремонт 3-комнатной квартиры',
   'Полный ремонт квартиры с заменой инженерных систем и отделкой',
   1, 'in_progress', 1250000.00, 1.100, 1.200,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'),
   'ИП Петров А.С.'),
   
  -- Смета 3: Строительство дома
  ((SELECT id FROM construction_projects WHERE customer_name = 'ПАО "РосСтрой"' LIMIT 1),
   'Строительство загородного дома',
   'Строительство 2-этажного дома из газобетона с мансардой',
   1, 'approved', 3500000.00, 1.000, 1.100,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'),
   'ПАО "РосСтрой"')
ON CONFLICT DO NOTHING;

-- 5. Добавляем элементы в первую смету (Отделочные работы)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id
)
VALUES 
  -- Работы
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'work', 'w.15.01.023.01', 'Устройство стяжек цементных толщиной 20 мм', 'м2', 250.00, 420.00, 105000.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'work', 'w.15.04.013.02', 'Окраска водоэмульсионными составами потолков', 'м2', 250.00, 180.00, 45000.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'work', 'w.15.04.015.01', 'Окраска стен водоэмульсионными составами', 'м2', 800.00, 160.00, 128000.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Материалы
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'material', 'm.401.0001', 'Цемент портландский М400', 'т', 5.20, 8500.00, 44200.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'material', 'm.402.0045', 'Краска водоэмульсионная белая', 'кг', 85.00, 320.00, 27200.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'))
ON CONFLICT DO NOTHING;

-- 6. Добавляем элементы во вторую смету (Ремонт квартиры)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id
)
VALUES 
  -- Сантехнические работы
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'work', 'w.10.01.018.01', 'Установка ванн стальных', 'шт', 1.00, 2800.00, 2800.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'work', 'w.10.01.033.01', 'Установка унитазов', 'шт', 2.00, 1500.00, 3000.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Электромонтажные работы  
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'work', 'w.08.01.004.02', 'Прокладка проводов и кабелей', 'м', 350.00, 85.00, 29750.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Материалы для ремонта
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'material', 'm.143.0120', 'Ванна стальная 170x70', 'шт', 1.00, 15500.00, 15500.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'material', 'm.144.0058', 'Унитаз напольный с бачком', 'шт', 2.00, 12800.00, 25600.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'material', 'm.531.0021', 'Кабель ВВГ 3x2.5', 'м', 350.00, 125.00, 43750.00, 6,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'))
ON CONFLICT DO NOTHING;

-- 7. Добавляем элементы в третью смету (Строительство дома)
INSERT INTO customer_estimate_items (
  estimate_id, item_type, reference_id, name, unit, quantity, 
  unit_price, total_amount, sort_order, user_id
)
VALUES 
  -- Фундаментные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'work', 'w.05.01.001.01', 'Устройство ленточных фундаментов', 'м3', 45.00, 4200.00, 189000.00, 1,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Кладочные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'work', 'w.07.01.011.04', 'Кладка стен из газобетонных блоков', 'м3', 85.00, 2800.00, 238000.00, 2,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Кровельные работы
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'work', 'w.12.01.002.05', 'Устройство кровли из металлочерепицы', 'м2', 180.00, 950.00, 171000.00, 3,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  -- Материалы для строительства
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'material', 'm.401.0002', 'Бетон В25 (М350)', 'м3', 45.00, 5200.00, 234000.00, 4,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'material', 'm.105.0325', 'Блоки газобетонные 625x250x300', 'м3', 85.00, 4800.00, 408000.00, 5,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'material', 'm.241.0124', 'Металлочерепица 0.5 мм', 'м2', 200.00, 650.00, 130000.00, 6,
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'))
ON CONFLICT DO NOTHING;

-- 8. Добавляем записи в историю изменений смет
INSERT INTO customer_estimate_history (
  estimate_id, action, changes, user_id
)
VALUES 
  ((SELECT id FROM customer_estimates WHERE name = 'Отделочные работы офиса' LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 850000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 1250000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Капитальный ремонт 3-комнатной квартиры' LIMIT 1),
   'status_changed', '{"old_status": "draft", "new_status": "in_progress", "message": "Смета принята в работу"}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'created', '{"message": "Смета создана", "initial_amount": 3500000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru')),
   
  ((SELECT id FROM customer_estimates WHERE name = 'Строительство загородного дома' LIMIT 1),
   'approved', '{"message": "Смета согласована и утверждена заказчиком", "approved_amount": 3500000.00}',
   (SELECT id FROM auth_users WHERE email = 'kiy026@yandex.ru'))
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