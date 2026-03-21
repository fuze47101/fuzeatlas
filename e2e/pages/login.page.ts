import { Page } from '@playwright/test';

/**
 * Page Object Model for Login Page
 *
 * This demonstrates using the Page Object Model (POM) pattern
 * which makes tests more maintainable by centralizing selectors
 * and page interactions in dedicated classes.
 */

export class LoginPage {
  constructor(private page: Page) {}

  // Selectors (centralized for easy maintenance)
  private emailInputSelector = 'input[type="email"]';
  private passwordInputSelector = 'input[type="password"]';
  private submitButtonSelector = 'button[type="submit"]';
  private rememberMeSelector = 'input[type="checkbox"]';
  private errorMessageSelector = '[role="alert"], .error, [data-error]';
  private pageHeadingSelector = 'h1, h2, [role="heading"]';

  // Navigation
  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  // Getters for page elements
  getEmailInput() {
    return this.page.locator(this.emailInputSelector);
  }

  getPasswordInput() {
    return this.page.locator(this.passwordInputSelector);
  }

  getSubmitButton() {
    return this.page.locator(this.submitButtonSelector);
  }

  getRememberMeCheckbox() {
    return this.page.locator(this.rememberMeSelector);
  }

  getErrorMessage() {
    return this.page.locator(this.errorMessageSelector);
  }

  getPageHeading() {
    return this.page.locator(this.pageHeadingSelector).first();
  }

  // Actions
  async fillEmail(email: string): Promise<void> {
    await this.getEmailInput().fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.getPasswordInput().fill(password);
  }

  async fillEmailAndPassword(email: string, password: string): Promise<void> {
    await this.fillEmail(email);
    await this.fillPassword(password);
  }

  async clickSubmit(): Promise<void> {
    await this.getSubmitButton().click();
  }

  async login(email: string, password: string): Promise<void> {
    await this.goto();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSubmit();
  }

  async checkRememberMe(): Promise<void> {
    const checkbox = this.getRememberMeCheckbox();
    if (await checkbox.isVisible()) {
      await checkbox.check();
    }
  }

  async toggleRememberMe(): Promise<void> {
    const checkbox = this.getRememberMeCheckbox();
    if (await checkbox.isVisible()) {
      const isChecked = await checkbox.isChecked();
      if (isChecked) {
        await checkbox.uncheck();
      } else {
        await checkbox.check();
      }
    }
  }

  // Assertions
  async isEmailInputVisible(): Promise<boolean> {
    return this.getEmailInput().isVisible();
  }

  async isPasswordInputVisible(): Promise<boolean> {
    return this.getPasswordInput().isVisible();
  }

  async isSubmitButtonVisible(): Promise<boolean> {
    return this.getSubmitButton().isVisible();
  }

  async isErrorMessageVisible(): Promise<boolean> {
    return this.getErrorMessage().isVisible();
  }

  async getErrorMessageText(): Promise<string> {
    return this.getErrorMessage().textContent() || '';
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  // Wait functions
  async waitForEmailInput(): Promise<void> {
    await this.getEmailInput().waitFor({ state: 'visible' });
  }

  async waitForError(): Promise<void> {
    await this.getErrorMessage().waitFor({ state: 'visible' });
  }

  async waitForNavigation(): Promise<void> {
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }
}
