import { test, expect } from '@playwright/test';

test.describe('Production Build HTTP Tests', () => {
  test('production server responds with correct content', async ({ request }) => {
    console.log('🌐 HTTP тестирование production build...');
    
    const startTime = Date.now();
    
    // Проверяем основную страницу
    const response = await request.get('http://127.0.0.1:4174/');
    const loadTime = Date.now() - startTime;
    
    console.log(`⚡ HTTP ответ за: ${loadTime}ms`);
    console.log(`📊 Статус: ${response.status()}`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const body = await response.text();
    console.log(`📄 Размер контента: ${body.length} символов`);
    
    // Проверяем основные элементы HTML
    expect(body).toContain('Mantis React Admin Dashboard');
    expect(body).toContain('<!doctype html>');
    expect(body).toContain('<div id="root"></div>');
    expect(body).toContain('type="module"');
    
    console.log('✅ Production build HTTP тест пройден!');
  });
  
  test('static assets are accessible', async ({ request }) => {
    console.log('📦 Проверка статических ресурсов...');
    
    // Получаем главную страницу для поиска ресурсов
    const htmlResponse = await request.get('http://127.0.0.1:4174/');
    const html = await htmlResponse.text();
    
    // Ищем основной JS файл
    const jsMatch = html.match(/src="([^"]*\.js)"/);
    if (jsMatch && jsMatch[1]) {
      const jsUrl = jsMatch[1].startsWith('/') ? 
        `http://127.0.0.1:4174${jsMatch[1]}` : 
        `http://127.0.0.1:4174/${jsMatch[1]}`;
      
      console.log(`🔧 Проверяем JS: ${jsUrl}`);
      
      const jsResponse = await request.get(jsUrl);
      console.log(`📊 JS статус: ${jsResponse.status()}`);
      expect(jsResponse.ok()).toBeTruthy();
      
      const jsContent = await jsResponse.text();
      console.log(`📄 JS размер: ${jsContent.length} символов`);
      expect(jsContent.length).toBeGreaterThan(1000); // Минимальный размер
    }
    
    // Проверяем favicon
    const faviconResponse = await request.get('http://127.0.0.1:4174/images/favicon-Bksy1JPm.svg');
    if (faviconResponse.ok()) {
      console.log('✅ Favicon доступен');
    } else {
      console.log('⚠️ Favicon недоступен (не критично)');
    }
    
    console.log('✅ Статические ресурсы проверены!');
  });
  
  test('API health check works', async ({ request }) => {
    console.log('🔍 Проверка API health...');
    
    const response = await request.get('http://127.0.0.1:3001/api/health');
    
    console.log(`📊 API статус: ${response.status()}`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log(`💓 API health: ${JSON.stringify(data)}`);
    
    expect(data.status).toBe('OK');
    expect(data.message).toContain('Backend');
    
    console.log('✅ API работает корректно!');
  });
});