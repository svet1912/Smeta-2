// Page Object Model для надежных E2E тестов
export class LoginPage {
  constructor(page) {
    this.page = page;
  }

  // Надежные селекторы для элементов логина
  get emailInput() {
    return this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="почт"]').first();
  }

  get passwordInput() {
    return this.page
      .locator('input[type="password"], input[name="password"], input[placeholder*="пароль"], input[placeholder*="password"]')
      .first();
  }

  get loginButton() {
    return this.page
      .locator(`
        button[type="submit"], 
        button:has-text("войти"), 
        button:has-text("Войти"), 
        button:has-text("Sign In"),
        .ant-btn-primary,
        button.MuiButton-containedPrimary
      `)
      .first();
  }

  // Методы для надежного взаимодействия
  async waitForLoginForm(timeout = 10000) {
    try {
      await this.emailInput.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async fillCredentials(email = 'admin@mantis.ru', password = 'password123', timeout = 10000) {
    // Ждем и заполняем email
    await this.emailInput.waitFor({ state: 'visible', timeout });
    await this.emailInput.fill(email);

    // Ждем и заполняем пароль
    await this.passwordInput.waitFor({ state: 'visible', timeout });
    await this.passwordInput.fill(password);

    console.log('✅ Учетные данные заполнены');
  }

  async clickLogin(timeout = 5000) {
    await this.loginButton.waitFor({ state: 'visible', timeout });
    await this.loginButton.click();
    console.log('🔐 Кнопка входа нажата');
  }

  async performLogin(email = 'admin@mantis.ru', password = 'password123') {
    if (await this.waitForLoginForm()) {
      await this.fillCredentials(email, password);
      await this.clickLogin();
      
      // Даем время на обработку
      await this.page.waitForTimeout(3000);
      return true;
    }
    return false;
  }
}

export class AppPage {
  constructor(page) {
    this.page = page;
  }

  // Надежные селекторы для приложения
  get dashboardElements() {
    return this.page.locator(`
      .ant-layout, 
      .dashboard, 
      h1:has-text("Dashboard"), 
      h1:has-text("Главная"),
      .MuiContainer-root,
      [data-testid="dashboard"]
    `);
  }

  get navigationElements() {
    return this.page.locator(`
      .ant-menu, 
      nav, 
      .sidebar, 
      [role="navigation"],
      .MuiDrawer-root
    `);
  }

  async waitForApp(timeout = 15000) {
    try {
      await this.dashboardElements.first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async isLoggedIn() {
    const url = this.page.url();
    const hasAppElements = (await this.dashboardElements.count()) > 0;
    const isAppUrl = /\/(dashboard|app|main|home)/.test(url);
    
    return hasAppElements || isAppUrl;
  }
}