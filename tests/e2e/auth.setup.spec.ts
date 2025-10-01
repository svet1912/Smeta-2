import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  console.log('🔐 Настройка аутентификации для E2E тестов...');
  
  // Переходим на страницу входа (production build на порту 4173)
  await page.goto('http://localhost:4173/', { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });
  console.log('📍 Переход на главную страницу (production build)');
  
  // Ищем поля для логина с использованием data-testid (приоритет) или fallback селекторов
  const emailInput = page.locator('[data-testid="login-email-input"]').or(
    page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
  );
  const passwordInput = page.locator('[data-testid="login-password-input"]').or(
    page.locator('input[type="password"], input[name="password"]')
  );
  const loginButton = page.locator('[data-testid="login-submit-button"]').or(
    page.locator('button[type="submit"], button:has-text("войти"), button:has-text("Войти")')
  );
  
  // Заполняем форму входа
  await emailInput.fill(process.env.E2E_ADMIN_EMAIL || 'admin@mantis.ru');
  await passwordInput.fill(process.env.E2E_ADMIN_PASSWORD || 'password123');
  
  console.log('� Данные для входа заполнены');
  
  // Нажимаем кнопку входа
  await loginButton.click();
  console.log('🚪 Попытка входа...');
  
  // Ожидаем успешного входа - проверяем редирект на dashboard или наличие меню пользователя
  await expect(page).toHaveURL(/dashboard|home|main/, { timeout: 30000 });
  console.log('✅ Успешный вход в систему');
  
  // Сохраняем состояние аутентификации
  await page.context().storageState({ path: authFile });
  console.log('💾 Состояние аутентификации сохранено');
});