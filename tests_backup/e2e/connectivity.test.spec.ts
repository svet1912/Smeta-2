import { test, expect } from '@playwright/test';

test.describe('Basic Connectivity Test', () => {
  test('can connect to localhost:3000', async ({ page }) => {
    console.log('🔗 Проверяем базовое соединение с localhost:3000...');
    
    try {
      // Упрощенный переход без ожидания networkidle
      await page.goto('http://localhost:3000/', { 
        waitUntil: 'commit',
        timeout: 30000 
      });
      
      console.log('✅ Страница загружена');
      
      // Проверяем что есть хотя бы div#root или любой элемент
      const rootElement = page.locator('#root, body, html').first();
      await expect(rootElement).toBeVisible({ timeout: 10000 });
      
      console.log('✅ Root элемент найден');
      
      // Проверяем заголовок страницы
      const title = await page.title();
      console.log(`📄 Заголовок страницы: ${title}`);
      
      expect(title).toBeTruthy();
      console.log('✅ Заголовок страницы получен успешно');
      
    } catch (error) {
      console.log(`❌ Ошибка подключения: ${error.message}`);
      throw error;
    }
  });
});