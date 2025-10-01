import { test, expect } from '@playwright/test';

test.describe('Page Debug Test', () => {
  test('check what page we land on', async ({ page }) => {
    console.log('🔍 Проверяем на какую страницу мы попадаем...');
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    console.log('📍 Страница загружена, ждем React...');
    
    // Ждем когда React отрендерит содержимое (более толерантно)
    try {
      await page.waitForSelector('#root > *', { timeout: 30000 });
      console.log('⚛️ React компоненты загружены');
    } catch (error) {
      console.log('⚠️ React компоненты не загрузились в течение 30с, продолжаем...');
    }
    
    // Дополнительная пауза для загрузки
    await page.waitForTimeout(3000);
    
    // Получаем URL
    const currentUrl = page.url();
    console.log(`🌐 Текущий URL: ${currentUrl}`);
    
    // Получаем заголовок
    const title = await page.title();
    console.log(`📄 Заголовок: ${title}`);
    
    // Проверяем наличие различных элементов
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const loginButton = page.locator('button', { hasText: /войти|login/i });
    const dashboardElements = page.locator('[data-testid*="dashboard"], .dashboard, h1, .ant-layout');
    
    const hasEmailInput = await emailInput.count();
    const hasLoginButton = await loginButton.count();
    const hasDashboard = await dashboardElements.count();
    
    console.log(`📧 Email поля найдено: ${hasEmailInput}`);
    console.log(`🔐 Кнопки входа найдено: ${hasLoginButton}`);
    console.log(`📊 Dashboard элементов найдено: ${hasDashboard}`);
    
    // Получаем весь HTML для анализа
    const bodyHTML = await page.locator('body').innerHTML();
    console.log(`📝 Найдены ключевые слова:`);
    console.log(`- "вход": ${bodyHTML.includes('вход') || bodyHTML.includes('Вход')}`);
    console.log(`- "email": ${bodyHTML.includes('email')}`);
    console.log(`- "password": ${bodyHTML.includes('password')}`);
    console.log(`- "dashboard": ${bodyHTML.includes('dashboard')}`);
    
    // Выведем первые 500 символов HTML
    console.log(`\n📄 Начало HTML:\n${bodyHTML.substring(0, 500)}...`);
    
    expect(currentUrl).toBeTruthy();
  });
});