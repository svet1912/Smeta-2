import { test, expect } from '@playwright/test';

test.describe('Landing to App Flow', () => {
  test('should redirect from landing to login and then to app after auth', async ({ page }) => {
    // 1. Открываем лендинг
    await page.goto('/');
    
    // 2. Проверяем, что мы на лендинге
    await expect(page.locator('h1')).toContainText('SMETA360');
    
    // 3. Нажимаем "Открыть приложение" в навигации
    await page.click('text="Открыть приложение"');
    
    // 4. Проверяем, что попали на страницу логина
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h3')).toContainText('Вход');
    
    // 5. Вводим учетные данные (поля уже заполнены)
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    await expect(emailInput).toHaveValue('kiy026@yandex.ru');
    await expect(passwordInput).toHaveValue('Apsni09332');
    
    // 6. Нажимаем кнопку входа
    await page.click('button[type="submit"]');
    
    // 7. Ждем редиректа в приложение
    await page.waitForURL('/app/dashboard/default', { timeout: 10000 });
    
    // 8. Проверяем, что мы в приложении
    await expect(page).toHaveURL('/app/dashboard/default');
  });

  test('should work from Hero CTA button', async ({ page }) => {
    // 1. Открываем лендинг
    await page.goto('/');
    
    // 2. Нажимаем кнопку "Начать работу" в Hero секции
    await page.click('text="Начать работу"');
    
    // 3. Проверяем редирект на логин
    await expect(page).toHaveURL('/login');
  });

  test('should work from pricing section', async ({ page }) => {
    // 1. Открываем лендинг
    await page.goto('/');
    
    // 2. Нажимаем "Начать бесплатно" в тарифах
    await page.click('text="Начать бесплатно"');
    
    // 3. Проверяем редирект на логин
    await expect(page).toHaveURL('/login');
  });

  test('should work from CTA section', async ({ page }) => {
    // 1. Открываем лендинг
    await page.goto('/');
    
    // 2. Прокручиваем до CTA секции
    await page.locator('text="Начать работу сейчас"').scrollIntoViewIfNeeded();
    
    // 3. Нажимаем кнопку в CTA
    await page.click('text="Начать работу сейчас"');
    
    // 4. Проверяем редирект на логин
    await expect(page).toHaveURL('/login');
  });

  test('should work from footer link', async ({ page }) => {
    // 1. Открываем лендинг
    await page.goto('/');
    
    // 2. Прокручиваем в footer
    await page.locator('footer').scrollIntoViewIfNeeded();
    
    // 3. Нажимаем ссылку "Приложение"
    await page.click('footer >> text="Приложение"');
    
    // 4. Проверяем редирект на логин
    await expect(page).toHaveURL('/login');
  });
});