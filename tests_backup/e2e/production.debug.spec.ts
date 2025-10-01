import { test, expect } from '@playwright/test';

test.describe('Production Build Debug Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Включаем логирование консоли браузера
    page.on('console', msg => console.log('🔧 BROWSER:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('❌ PAGEERROR:', err.message));
    page.on('requestfailed', req => console.log('🚫 REQFAILED:', req.url(), req.failure()?.errorText));
  });

  test('debug production app loading', async ({ page }) => {
    console.log('🕵️ Диагностика production build...');
    
    // Переходим на страницу с детальным логированием
    await page.goto('http://127.0.0.1:4174/', { 
      waitUntil: 'commit',
      timeout: 8000 
    });
    
    console.log('📄 Страница загружена, ждем инициализации...');
    
    // Ждем дольше для полной загрузки JavaScript
    await page.waitForTimeout(5000);
    
    // Проверяем содержимое страницы
    const pageContent = await page.content();
    console.log(`📄 HTML размер: ${pageContent.length} символов`);
    
    // Проверяем, есть ли root element
    const rootExists = await page.locator('#root').count();
    console.log(`🏗️ Root elements: ${rootExists}`);
    
    // Проверяем, загружены ли скрипты
    const scriptTags = await page.locator('script[src]').count();
    console.log(`📜 Script tags: ${scriptTags}`);
    
    // Проверяем React объекты в window
    const hasReact = await page.evaluate(() => {
      return {
        react: typeof window.React !== 'undefined',
        reactDOM: typeof window.ReactDOM !== 'undefined',
        rootHasContent: document.getElementById('root')?.innerHTML?.length || 0
      };
    });
    
    console.log(`⚛️ React loaded: ${hasReact.react}, ReactDOM: ${hasReact.reactDOM}`);
    console.log(`📦 Root content size: ${hasReact.rootHasContent} chars`);
    
    // Ищем любые интерактивные элементы
    const elements = await page.evaluate(() => {
      return {
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        divs: document.querySelectorAll('div').length,
        totalElements: document.querySelectorAll('*').length
      };
    });
    
    console.log('📊 Элементы на странице:', elements);
    
    // Проверим Network requests
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        type: r.initiatorType,
        size: r.transferSize,
        duration: r.duration
      }));
    });
    
    console.log(`🌐 Загружено ресурсов: ${resources.length}`);
    resources.forEach(r => {
      if (r.name.includes('.js') || r.name.includes('api')) {
        console.log(`  📦 ${r.type}: ${r.name} (${r.size} bytes, ${r.duration.toFixed(1)}ms)`);
      }
    });
    
    expect(rootExists).toBeGreaterThan(0);
  });
});