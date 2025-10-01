import { test, expect } from '@playwright/test';

test.describe('Full App Load Test', () => {
  test('wait for react app to fully load', async ({ page }) => {
    console.log('⚛️ Ждем полной загрузки React приложения...');
    
    page.setDefaultTimeout(300000); // 5 минут
    
    await page.goto('http://localhost:3000/', { 
      waitUntil: 'commit',
      timeout: 120000 
    });
    
    console.log('📍 HTML загружен');
    
    // Ждем появления любого React содержимого
    console.log('⏳ Ожидаем появления React контента...');
    
    for (let i = 0; i < 30; i++) { // До 30 попыток по 5 секунд = 150 секунд
      await page.waitForTimeout(5000);
      
      const rootContent = await page.locator('#root').innerHTML();
      console.log(`🔍 Попытка ${i + 1}: root содержит ${rootContent.length} символов`);
      
      if (rootContent.length > 50) { // Если есть какое-то содержимое
        console.log('✅ React контент обнаружен!');
        
        // Ищем элементы формы входа или dashboard
        const emailInput = await page.locator('input[type="email"]').count();
        const anyButton = await page.locator('button').count();
        const anyInput = await page.locator('input').count();
        const anyText = await page.locator('h1, h2, h3, .ant-typography').count();
        
        console.log(`📧 Email поля: ${emailInput}`);
        console.log(`🔲 Кнопки: ${anyButton}`);
        console.log(`📝 Поля ввода: ${anyInput}`);
        console.log(`📄 Текстовые элементы: ${anyText}`);
        
        if (emailInput > 0 || anyButton > 0 || anyText > 0) {
          console.log('🎉 Приложение загружено!');
          break;
        }
      }
      
      if (i === 29) {
        console.log('❌ Время ожидания истекло');
      }
    }
    
    const finalContent = await page.locator('#root').innerHTML();
    console.log(`📄 Финальное содержимое root (первые 500 символов):`);
    console.log(finalContent.substring(0, 500));
    
    expect(finalContent.length).toBeGreaterThan(10);
  });
});