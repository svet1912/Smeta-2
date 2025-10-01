import { test, expect } from '@playwright/test';

test.describe('Manual Browser Test', () => {
  test('simple browser check', async ({ page }) => {
    console.log('🌐 Простая проверка браузера...');
    
    // Устанавливаем очень длинные таймауты
    page.setDefaultTimeout(180000); // 3 минуты
    
    console.log('🔄 Переходим на localhost:3000...');
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit', // Самое быстрое условие
      timeout: 120000 
    });
    
    console.log('✅ Базовая загрузка завершена');
    
    // Ожидаем хотя бы 10 секунд для загрузки JS
    console.log('⏳ Ждем 10 секунд для загрузки JavaScript...');
    await page.waitForTimeout(10000);
    
    const currentUrl = page.url();
    console.log(`🌍 Текущий URL: ${currentUrl}`);
    
    const title = await page.title();
    console.log(`📋 Title: ${title}`);
    
    // Проверяем содержимое root
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`📄 Root содержимое (первые 200 символов):`);
    console.log(rootContent.substring(0, 200));
    
    expect(title).toContain('Mantis');
    console.log('✅ Тест завершен успешно!');
  });
});