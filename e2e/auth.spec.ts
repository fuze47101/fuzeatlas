import { test, expect, Page } from '@playwright/test';

/**
 * Authentication E2E Tests for FUZE Atlas
 *
 * These tests verify:
 * - Login page loads and renders correctly
 * - Form validation and error handling
 * - Successful authentication with JWT cookies
 * - Logout and session clearing
 */

test.describe('Authentication Flow', () => {
  // Valid test user credentials - should be created in test database
  const validUser = {
    email: 'test@fuzeatlas.com',
    password: 'TestPassword123!',
  };

  // Invalid credentials for testing error states
  const invalidUser = {
    email: 'invalid@fuzeatlas.com',
    password: 'WrongPassword123!',
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to login page before each test
    await page.goto('/login');
  });

  test('should load login page with email and password fields', async ({ page }) => {
    // Verify page title or heading
    await expect(page).toHaveTitle(/login|sign in/i);

    // Verify email input field exists
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Verify password input field exists
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Verify submit button exists
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should show validation error on empty form submission', async ({ page }) => {
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Expect validation error to appear
    // (Adjust selector based on your actual error message element)
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
  });

  test('should show error message on wrong credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('input[type="email"]', invalidUser.email);
    await page.fill('input[type="password"]', invalidUser.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Expect error message
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/invalid|incorrect|failed/i);

    // User should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should successfully login with valid credentials and redirect to dashboard', async ({ page }) => {
    // Fill in valid credentials
    await page.fill('input[type="email"]', validUser.email);
    await page.fill('input[type="password"]', validUser.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    // (Adjust URL based on your actual dashboard path)
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify we're on the dashboard
    expect(page.url()).toContain('/dashboard');

    // Verify authentication token is set in cookies
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((cookie) =>
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('token') ||
      cookie.name === '__Secure-authjs.session-token' // Next-Auth pattern
    );
    expect(authCookie).toBeDefined();
    expect(authCookie?.httpOnly).toBe(true); // Security best practice
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', validUser.email);
    await page.fill('input[type="password"]', validUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Get initial URL (should be dashboard)
    const dashboardUrl = page.url();

    // Reload the page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    expect(page.url()).toContain('/dashboard');

    // Verify auth cookie is still present
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((cookie) =>
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('token')
    );
    expect(authCookie).toBeDefined();
  });

  test('should clear session on logout', async ({ page }) => {
    // First, login
    await page.fill('input[type="email"]', validUser.email);
    await page.fill('input[type="password"]', validUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Find and click logout button
    // (Adjust selector based on your actual logout button)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout-button"]').first();

    if (await logoutButton.isVisible()) {
      await logoutButton.click();

      // Wait for redirect to login
      await page.waitForURL('**/login', { timeout: 10000 });

      // Verify we're back on login page
      expect(page.url()).toContain('/login');

      // Verify auth cookies are cleared
      const cookies = await page.context().cookies();
      const authCookie = cookies.find((cookie) =>
        cookie.name.toLowerCase().includes('auth') ||
        cookie.name.toLowerCase().includes('token')
      );
      expect(authCookie).toBeUndefined();
    }
  });

  test('should prevent accessing protected routes without authentication', async ({ page, context }) => {
    // Clear all cookies to ensure no authentication
    await context.clearCookies();

    // Try to access dashboard directly
    await page.goto('/dashboard');

    // Should be redirected to login
    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('should handle remember me functionality (if implemented)', async ({ page }) => {
    // Check if remember me checkbox exists
    const rememberMeCheckbox = page.locator('input[type="checkbox"]').first();

    if (await rememberMeCheckbox.isVisible()) {
      // Check the remember me box
      await rememberMeCheckbox.check();

      // Login
      await page.fill('input[type="email"]', validUser.email);
      await page.fill('input[type="password"]', validUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 });

      // Verify persistent cookie is set (longer expiration)
      const cookies = await page.context().cookies();
      const authCookie = cookies.find((cookie) =>
        cookie.name.toLowerCase().includes('auth') ||
        cookie.name.toLowerCase().includes('token')
      );

      if (authCookie) {
        // Persistent cookie should have longer expiration
        expect(authCookie.expires).toBeGreaterThan(Date.now() / 1000 + 86400); // > 1 day
      }
    }
  });
});
