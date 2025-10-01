import { test, expect } from '@playwright/test';

test.describe('Console Error Check', () => {
  test('check for console errors', async ({ page }) => {
    console.log('🔍 Проверяем ошибки в консоли браузера...');
    
    // Слушаем все события консоли
    page.on('console', msg => {
      console.log(`🖥️ CONSOLE ${msg.type()}: ${msg.text()}`);
    });
    
    // Слушаем ошибки страницы
    page.on('pageerror', error => {
      console.log(`❌ PAGE ERROR: ${error.message}`);
    });
    
    // Слушаем неудачные запросы
    page.on('requestfailed', request => {
      console.log(`🌐 REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit',
      timeout: 60000 
    });
    
    console.log('📍 Страница загружена, ждем ошибки...');
    
    // Ждем 30 секунд и смотрим что происходит
    await page.waitForTimeout(30000);
    
    console.log('✅ Мониторинг консоли завершен');
  });
});