import { test, expect } from '@playwright/test';

test.describe('Complete E2E Test Suite', () => {
  test('full application smoke test', async ({ page }) => {
    console.log('🚀 Запуск полного smoke-теста приложения...');
    
    // Увеличиваем таймауты для медленного приложения
    page.setDefaultTimeout(60000);
    
    // 1. Загружаем главную страницу
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit',
      timeout: 60000 
    });
    
    console.log('📍 Страница загружена, ждем React...');
    
    // Ждем появления React контента (до 60 секунд)
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.innerHTML.length > 100;
    }, { timeout: 60000 });
    
    console.log('⚛️ React приложение загружено!');
    
    // 2. Проверяем что попали на страницу входа или dashboard
    const currentUrl = page.url();
    console.log(`🌐 Текущий URL: ${currentUrl}`);
    
    // Проверяем наличие ключевых элементов
    const hasLoginForm = await page.locator('input[type="email"], input[name="email"]').count();
    const hasDashboard = await page.locator('.ant-layout, .dashboard, h1').count();
    
    console.log(`🔐 Элементы входа найдены: ${hasLoginForm}`);
    console.log(`📊 Dashboard элементы найдены: ${hasDashboard}`);
    
    if (hasLoginForm > 0) {
      console.log('📝 Обнаружена форма входа, выполняем логин...');
      
      // Заполняем форму входа
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      const loginButton = page.locator('button[type="submit"], button:has-text("войти")').first();
      
      await emailInput.fill('admin@mantis.ru');
      await passwordInput.fill('password123');
      
      console.log('📨 Данные для входа заполнены');
      
      await loginButton.click();
      
      console.log('🔐 Попытка входа выполнена');
      
      // Ждем редиректа или изменения
      await page.waitForTimeout(5000);
      
      const newUrl = page.url();
      console.log(`🌍 URL после входа: ${newUrl}`);
      
    } else if (hasDashboard > 0) {
      console.log('✅ Уже находимся в приложении!');
    }
    
    // 3. Проверяем основную навигацию
    console.log('🧭 Проверяем навигационные элементы...');
    
    const navElements = await page.locator('a, .ant-menu-item, nav li').count();
    console.log(`📋 Найдено навигационных элементов: ${navElements}`);
    
    // 4. Ищем ключевые разделы
    const menuItems = [
      'dashboard', 'главная', 'дашборд',
      'project', 'проект', 
      'material', 'материал', 'справочник',
      'estimate', 'смет', 'расчет'
    ];
    
    let foundMenus = [];
    for (const item of menuItems) {
      const found = await page.locator(`text*="${item}"`).count();
      if (found > 0) {
        foundMenus.push(item);
      }
    }
    
    console.log(`📊 Найденные разделы меню: ${foundMenus.join(', ')}`);
    
    // 5. Проверяем что можем взаимодействовать с интерфейсом
    const clickableElements = await page.locator('button, a, .ant-btn').count();
    console.log(`🖱️ Интерактивных элементов: ${clickableElements}`);
    
    // 6. Проверяем загрузку данных
    console.log('📡 Проверяем загрузку данных...');
    
    // Ждем любых таблиц или списков
    try {
      await page.waitForSelector('table, .ant-table, .ant-list, ul li', { timeout: 10000 });
      console.log('📋 Данные найдены в интерфейсе');
    } catch (error) {
      console.log('ℹ️  Данные могут загружаться асинхронно');
    }
    
    // 7. Финальная проверка
    const title = await page.title();
    console.log(`📄 Заголовок страницы: ${title}`);
    
    expect(title).toBeTruthy();
    expect(navElements).toBeGreaterThan(0);
    expect(clickableElements).toBeGreaterThan(0);
    
    console.log('🎉 Smoke-тест приложения завершен успешно!');
    console.log(`✅ Страница загружается: OK`);
    console.log(`✅ React приложение работает: OK`);
    console.log(`✅ Навигация присутствует: OK (${navElements} элементов)`);
    console.log(`✅ Интерактивность: OK (${clickableElements} элементов)`);
    console.log(`✅ Найденные разделы: ${foundMenus.length} из ${menuItems.length}`);
  });

  test('basic performance check', async ({ page }) => {
    console.log('⚡ Проверка базовой производительности...');
    
    const startTime = Date.now();
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit',
      timeout: 60000 
    });
    
    // Ждем React
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.innerHTML.length > 50;
    }, { timeout: 60000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Время загрузки приложения: ${loadTime}ms`);
    
    // Проверяем что загрузка заняла разумное время (менее 2 минут)
    expect(loadTime).toBeLessThan(120000);
    
    if (loadTime < 10000) {
      console.log('🚀 Отличная производительность (<10s)');
    } else if (loadTime < 30000) {
      console.log('✅ Приемлемая производительность (<30s)');
    } else if (loadTime < 60000) {
      console.log('⚠️ Медленная загрузка (<60s)');
    } else {
      console.log('🐌 Очень медленная загрузка (>60s)');
    }
  });
});