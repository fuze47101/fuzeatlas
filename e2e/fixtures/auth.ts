import { test as base, expect, Page } from '@playwright/test';

/**
 * Test credentials for E2E testing
 * These should match test users in your development database
 */
const TEST_USER = {
  email: 'test@fuzeatlas.com',
  password: 'TestPassword123!',
};

const TEST_WRONG_CREDENTIALS = {
  email: 'test@fuzeatlas.com',
  password: 'WrongPassword123!',
};

/**
 * Authenticates a user programmatically via the API
 * This is faster and more reliable than logging in through the UI for fixture setup
 *
 * @param page - Playwright Page object
 * @param email - User email
 * @param password - User password
 * @returns Promise resolving to true if login successful
 */
async function loginViaAPI(
  page: Page,
  email: string,
  password: string
): Promise<boolean> {
  try {
    const response = await page.request.post('/api/auth/login', {
      data: {
        email,
        password,
      },
    });

    if (response.status() === 200) {
      // Extract cookies from response headers
      const setCookieHeaders = response.headers()['set-cookie'];
      if (setCookieHeaders) {
        // The cookies are automatically handled by Playwright context
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Login via API failed:', error);
    return false;
  }
}

/**
 * Authenticates a user through the login page UI
 * Used for testing the actual login flow
 *
 * @param page - Playwright Page object
 * @param email - User email
 * @param password - User password
 */
async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation to complete
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

/**
 * Custom test fixture that provides authenticated context
 * Usage: test('my test', async ({ authenticatedPage }) => { ... })
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Perform login before test runs
    const loginSuccess = await loginViaAPI(page, TEST_USER.email, TEST_USER.password);

    if (!loginSuccess) {
      throw new Error('Failed to authenticate test user');
    }

    // Navigation check to verify we're authenticated
    await page.goto('/');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Use the page in the test
    await use(page);

    // Cleanup after test (optional)
    // You could add logout here if needed
  },
});

export { expect };

export const testCredentials = {
  valid: TEST_USER,
  invalid: TEST_WRONG_CREDENTIALS,
};
