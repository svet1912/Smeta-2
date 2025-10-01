import { test, expect } from '@playwright/test';

test.describe('Production Build Simple Tests', () => {
  test('minimal production check', async ({ page }) => {
    console.log('🔧 Минимальная проверка production...');
    
    // Логируем все события
    page.on('console', msg => console.log(`CONSOLE [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText));
    
    try {
      // Просто переходим на страницу
      const response = await page.goto('http://127.0.0.1:4174/', { 
        waitUntil: 'commit',
        timeout: 8000 
      });
      
      console.log(`📊 Response status: ${response?.status()}`);
      
      // Ждем немного
      await page.waitForTimeout(2000);
      
      // Проверяем заголовок
      const title = await page.title();
      console.log(`📄 Title: ${title}`);
      
      // Проверяем HTML
      const htmlExists = await page.locator('html').count();
      const bodyExists = await page.locator('body').count();  
      const rootExists = await page.locator('#root').count();
      
      console.log(`📋 HTML: ${htmlExists}, Body: ${bodyExists}, Root: ${rootExists}`);
      
      // Это должно пройти
      expect(title).toContain('Mantis');
      expect(rootExists).toBe(1);
      
      console.log('✅ Минимальная проверка прошла');
      
    } catch (error) {
      console.log('❌ Ошибка:', error.message);
      throw error;
    }
  });
});