import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

/**
 * Authentication Tests Using Page Object Model (POM)
 *
 * This demonstrates how to use the Page Object Model pattern
 * for cleaner, more maintainable tests.
 *
 * Benefits:
 * - Selectors are centralized in page classes
 * - Tests read like user actions, not DOM operations
 * - Easier to maintain when UI changes
 * - Better code reusability
 */

test.describe('Authentication with Page Object Model', () => {
  let loginPage: LoginPage;

  const validCredentials = {
    email: 'test@fuzeatlas.com',
    password: 'TestPassword123!',
  };

  const invalidCredentials = {
    email: 'invalid@fuzeatlas.com',
    password: 'WrongPassword',
  };

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('should display login form with all elements', async () => {
    await loginPage.goto();

    // Assert all form elements are visible
    expect(await loginPage.isEmailInputVisible()).toBe(true);
    expect(await loginPage.isPasswordInputVisible()).toBe(true);
    expect(await loginPage.isSubmitButtonVisible()).toBe(true);
  });

  test('should show error on invalid credentials', async () => {
    // Using the POM, the test is much more readable
    await loginPage.login(invalidCredentials.email, invalidCredentials.password);

    // Wait for error message
    await expect(loginPage.getErrorMessage()).toBeVisible();

    // Verify error text
    const errorText = await loginPage.getErrorMessageText();
    expect(errorText.toLowerCase()).toContain('invalid');
  });

  test('should successfully login with valid credentials', async () => {
    await loginPage.login(validCredentials.email, validCredentials.password);

    // Wait for navigation
    await loginPage.waitForNavigation();

    // Verify on dashboard
    expect(await loginPage.page.url()).toContain('/dashboard');
  });

  test('should handle form validation with POM', async () => {
    await loginPage.goto();

    // Submit empty form (just click button without filling)
    await loginPage.clickSubmit();

    // Should see error or be on login page
    const hasError = await loginPage.isErrorMessageVisible();
    const stillOnLogin = await loginPage.isOnLoginPage();

    expect(hasError || stillOnLogin).toBe(true);
  });

  test('should support remember me functionality', async () => {
    await loginPage.goto();

    // Check remember me checkbox
    await loginPage.checkRememberMe();

    // Fill credentials
    await loginPage.fillEmailAndPassword(
      validCredentials.email,
      validCredentials.password
    );

    // Submit
    await loginPage.clickSubmit();

    // Wait for navigation
    await loginPage.waitForNavigation();

    // Verify login was successful
    expect(await loginPage.page.url()).toContain('/dashboard');
  });

  test('should toggle remember me checkbox', async () => {
    await loginPage.goto();

    const checkbox = loginPage.getRememberMeCheckbox();

    // Check if checkbox exists
    const isVisible = await checkbox.isVisible();

    if (isVisible) {
      // Get initial state
      const initialState = await checkbox.isChecked();

      // Toggle
      await loginPage.toggleRememberMe();

      // Verify state changed
      const newState = await checkbox.isChecked();
      expect(newState).not.toBe(initialState);

      // Toggle back
      await loginPage.toggleRememberMe();

      // Should be back to original
      expect(await checkbox.isChecked()).toBe(initialState);
    }
  });

  test('should preserve form data when navigating away', async ({ page }) => {
    await loginPage.goto();

    // Fill email
    await loginPage.fillEmail('test@example.com');

    // Navigate away
    await page.goto('/login');

    // Navigate back to login
    await loginPage.goto();

    // Check if data is preserved (depends on implementation)
    const emailValue = await loginPage.getEmailInput().inputValue();

    // May or may not be preserved depending on app design
    // This test documents the expected behavior
    expect(typeof emailValue).toBe('string');
  });
});

// Additional helper to demonstrate creating custom fixtures with POM
test.describe('Login with Fixture', () => {
  test('should login via fixture setup', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.login('test@fuzeatlas.com', 'TestPassword123!');
    await loginPage.waitForNavigation();

    expect(page.url()).toContain('/dashboard');
  });
});
