import { Page, expect } from '@playwright/test';

/**
 * Common test utility functions for E2E tests
 */

/**
 * Wait for API call to complete
 * Useful for waiting for data to load after user interaction
 *
 * @param page - Playwright Page object
 * @param urlPattern - URL pattern to match (e.g., '/api/brands')
 * @param timeout - Max time to wait in milliseconds
 */
export async function waitForAPICall(
  page: Page,
  urlPattern: string,
  timeout = 10000
): Promise<void> {
  try {
    await page.waitForResponse(
      (response) => response.url().includes(urlPattern) && response.status() === 200,
      { timeout }
    );
  } catch (error) {
    console.warn(`Timeout waiting for API call to ${urlPattern}`, error);
  }
}

/**
 * Fill and submit a login form
 *
 * @param page - Playwright Page object
 * @param email - User email
 * @param password - User password
 */
export async function submitLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

/**
 * Verify user is authenticated by checking for auth cookie
 *
 * @param page - Playwright Page object
 * @returns true if auth cookie found
 */
export async function isUserAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some(
    (cookie) =>
      cookie.name.toLowerCase().includes('auth') ||
      cookie.name.toLowerCase().includes('token') ||
      cookie.name.includes('session')
  );
}

/**
 * Get the current user's ID from auth cookie (if available)
 *
 * @param page - Playwright Page object
 * @returns User ID or null
 */
export async function getUserIdFromCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name.toLowerCase().includes('auth'));

  // Note: JWT payloads are base64 encoded. This is a simple extraction.
  // For real JWT decoding, you'd want to use a JWT library.
  if (authCookie?.value) {
    try {
      // Try to extract from cookie value if it's a JWT
      // Format: header.payload.signature
      const parts = authCookie.value.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.sub || payload.userId || payload.id || null;
      }
    } catch (error) {
      console.warn('Could not parse user ID from cookie:', error);
    }
  }

  return null;
}

/**
 * Wait for an element to be visible and optionally have specific text
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector or test ID
 * @param text - Optional text to match
 * @param timeout - Max time to wait
 */
export async function waitForElement(
  page: Page,
  selector: string,
  text?: string,
  timeout = 10000
): Promise<void> {
  const locator = text
    ? page.locator(`${selector}:has-text("${text}")`)
    : page.locator(selector);

  await expect(locator).toBeVisible({ timeout });
}

/**
 * Take a screenshot with a descriptive name
 * Useful for documentation and debugging
 *
 * @param page - Playwright Page object
 * @param name - Descriptive screenshot name
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: `screenshots/${filename}` });
  return filename;
}

/**
 * Clear browser storage (localStorage, sessionStorage)
 *
 * @param page - Playwright Page object
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get all console messages from the page
 *
 * @param page - Playwright Page object
 * @returns Array of console messages
 */
export async function getConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });

  return logs;
}

/**
 * Intercept and mock API responses
 *
 * @param page - Playwright Page object
 * @param urlPattern - URL pattern to intercept
 * @param responseData - Data to return
 * @param statusCode - HTTP status code
 */
export async function mockAPIResponse(
  page: Page,
  urlPattern: string,
  responseData: any,
  statusCode = 200
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.abort('blockedbyclient');

    // Can't directly return custom response with abort, so use fulfill instead:
    // Actually, for mocking we should use this:
  });

  // Better approach: use route.fulfill()
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}

/**
 * Check if element exists on page
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector
 * @returns true if element exists
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const count = await page.locator(selector).count();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Get text content of an element
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector
 * @returns Text content or empty string
 */
export async function getElementText(page: Page, selector: string): Promise<string> {
  try {
    return await page.locator(selector).first().textContent() || '';
  } catch {
    return '';
  }
}

/**
 * Verify HTTP status code
 *
 * @param response - Playwright Response object
 * @param expectedStatus - Expected HTTP status code
 */
export function verifyStatusCode(
  response: any,
  expectedStatus: number | number[]
): void {
  const statuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  expect(statuses).toContain(response.status());
}

/**
 * Check for accessibility issues (basic)
 * Note: For comprehensive a11y testing, use @axe-core/playwright
 *
 * @param page - Playwright Page object
 * @returns Array of potential issues
 */
export async function checkBasicAccessibility(page: Page): Promise<string[]> {
  const issues: string[] = [];

  // Check for images without alt text
  const imagesWithoutAlt = await page.locator('img:not([alt])').count();
  if (imagesWithoutAlt > 0) {
    issues.push(`Found ${imagesWithoutAlt} images without alt text`);
  }

  // Check for inputs without labels
  const inputsWithoutLabel = await page.locator('input:not([aria-label]):not([id])').count();
  if (inputsWithoutLabel > 0) {
    issues.push(`Found ${inputsWithoutLabel} inputs without labels`);
  }

  // Check for headings in order
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  for (let i = 1; i < headings.length; i++) {
    const prevLevel = parseInt(await headings[i - 1].evaluate((el) => el.tagName[1]));
    const currLevel = parseInt(await headings[i].evaluate((el) => el.tagName[1]));
    if (currLevel - prevLevel > 1) {
      issues.push(`Heading hierarchy issue: h${prevLevel} followed by h${currLevel}`);
    }
  }

  return issues;
}

/**
 * Simulate slow network
 *
 * @param page - Playwright Page object
 * @param delayMs - Delay in milliseconds
 */
export async function simulateSlowNetwork(page: Page, delayMs = 1000): Promise<void> {
  await page.route('**/*', (route) => {
    setTimeout(() => route.continue(), delayMs);
  });
}

/**
 * Get network requests made during a function
 *
 * @param page - Playwright Page object
 * @param fn - Async function to track requests during
 * @returns Array of request URLs
 */
export async function trackNetworkRequests(
  page: Page,
  fn: () => Promise<void>
): Promise<string[]> {
  const requests: string[] = [];

  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      requests.push(request.url());
    }
  });

  await fn();

  return requests;
}
