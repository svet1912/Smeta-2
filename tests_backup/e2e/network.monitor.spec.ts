import { test, expect } from '@playwright/test';

test.describe('Network Monitoring', () => {
  test('monitor network requests', async ({ page }) => {
    console.log('🌐 Мониторинг сетевых запросов...');
    
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
      console.log(`📤 REQUEST: ${request.method()} ${request.url()}`);
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      });
      console.log(`📥 RESPONSE: ${response.status()} ${response.url()}`);
    });
    
    page.on('requestfailed', request => {
      console.log(`❌ FAILED: ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit',
      timeout: 60000 
    });
    
    console.log('📍 Страница загружена, ждем запросы...');
    
    // Ждем 30 секунд для всех запросов
    await page.waitForTimeout(30000);
    
    console.log(`📊 Всего запросов: ${requests.length}`);
    console.log(`📊 Всего ответов: ${responses.length}`);
    
    const failedResponses = responses.filter(r => !r.ok);
    console.log(`❌ Неудачных ответов: ${failedResponses.length}`);
    
    failedResponses.forEach(r => {
      console.log(`  - ${r.status} ${r.url}`);
    });
    
    // Ищем JavaScript файлы
    const jsRequests = requests.filter(r => 
      r.url.includes('.js') || r.url.includes('.jsx') || r.url.includes('/src/')
    );
    
    console.log(`⚛️ JS файлов загружается: ${jsRequests.length}`);
    jsRequests.forEach(r => {
      console.log(`  - ${r.url}`);
    });
  });
});