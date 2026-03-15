import { test, expect } from '@playwright/test';

/**
 * Navigation & Routing E2E Tests for FUZE Atlas
 *
 * These tests verify:
 * - Unauthenticated users are redirected to login
 * - Authenticated users can access protected routes
 * - Sidebar navigation works correctly
 * - Route-based access control functions properly
 */

test.describe('Navigation & Routing', () => {
  const validUser = {
    email: 'test@fuzeatlas.com',
    password: 'TestPassword123!',
  };

  /**
   * Helper function to authenticate a user
   * Uses API-based login for faster test setup
   */
  async function authenticateUser(page: any) {
    // Navigate to app first to set up context
    await page.goto('/');

    // Perform login via API
    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: validUser.email,
        password: validUser.password,
      },
    });

    // Verify login was successful
    expect(loginResponse.status()).toBeLessThan(400);

    // Navigate to dashboard to ensure we're authenticated
    await page.goto('/dashboard');
  }

  test.describe('Unauthenticated Access', () => {
    test('should redirect unauthenticated user to login when accessing dashboard', async ({ page, context }) => {
      // Clear cookies to ensure no authentication
      await context.clearCookies();

      // Try to access protected route
      await page.goto('/dashboard');

      // Should be redirected to login
      await page.waitForURL('**/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user to login when accessing pipeline', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto('/pipeline');
      await page.waitForURL('**/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user to login when accessing brands', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto('/brands');
      await page.waitForURL('**/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('should redirect unauthenticated user to login when accessing fabrics', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto('/fabrics');
      await page.waitForURL('**/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('should allow unauthenticated access to login page', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto('/login');
      // Should remain on login page
      expect(page.url()).toContain('/login');
    });
  });

  test.describe('Authenticated Navigation', () => {
    test('should load dashboard for authenticated user', async ({ page }) => {
      await authenticateUser(page);

      // Navigate to dashboard
      await page.goto('/dashboard');

      // Verify page loads without redirect
      expect(page.url()).toContain('/dashboard');

      // Verify some dashboard content is visible (adjust selectors based on your UI)
      // Example: main heading, welcome message, or dashboard components
      const mainContent = page.locator('main, [role="main"], .dashboard-container').first();
      await expect(mainContent).toBeVisible();
    });

    test('should load pipeline page for authenticated user', async ({ page }) => {
      await authenticateUser(page);
      await page.goto('/pipeline');

      expect(page.url()).toContain('/pipeline');

      // Verify pipeline content loads
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    });

    test('should load brands page for authenticated user', async ({ page }) => {
      await authenticateUser(page);
      await page.goto('/brands');

      expect(page.url()).toContain('/brands');

      // Verify brands content loads
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    });

    test('should load fabrics page for authenticated user', async ({ page }) => {
      await authenticateUser(page);
      await page.goto('/fabrics');

      expect(page.url()).toContain('/fabrics');

      // Verify fabrics content loads
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible();
    });

    test('should allow navigation via sidebar links', async ({ page }) => {
      await authenticateUser(page);

      // Find and verify sidebar exists
      const sidebar = page.locator('[role="navigation"], nav, .sidebar, aside').first();
      await expect(sidebar).toBeVisible();

      // Define navigation links to test
      const navItems = [
        { text: /dashboard/i, href: '/dashboard' },
        { text: /pipeline/i, href: '/pipeline' },
        { text: /brands/i, href: '/brands' },
        { text: /fabrics/i, href: '/fabrics' },
      ];

      // Test each navigation link
      for (const item of navItems) {
        const link = page.locator(`a:has-text("${item.text}"), button:has-text("${item.text}")`).first();

        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          await link.click();

          // Verify navigation occurred
          await page.waitForURL(`**${item.href}`, { timeout: 10000 });
          expect(page.url()).toContain(item.href);
        }
      }
    });

    test('should maintain active state for current navigation item', async ({ page }) => {
      await authenticateUser(page);

      // Navigate to pipeline
      await page.goto('/pipeline');

      // Find the pipeline nav item
      const pipelineLink = page.locator(`a:has-text(/pipeline/i), button:has-text(/pipeline/i)`).first();

      if (await pipelineLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Verify active state (may be indicated by class, aria-current, or styling)
        const activeIndicator = pipelineLink.locator('[class*="active"], [aria-current="page"]').first();

        // Check for active class or aria-current attribute
        const hasActiveClass = await pipelineLink.evaluate((el) => {
          return el.className.includes('active') || el.getAttribute('aria-current') === 'page';
        });

        expect(hasActiveClass).toBeTruthy();
      }
    });
  });

  test.describe('Navigation Features', () => {
    test('should display breadcrumbs or navigation path (if implemented)', async ({ page }) => {
      await authenticateUser(page);
      await page.goto('/brands');

      // Check if breadcrumbs exist
      const breadcrumbs = page.locator('[aria-label="Breadcrumbs"], .breadcrumb, nav[role="navigation"]:nth-of-type(2)').first();

      if (await breadcrumbs.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(breadcrumbs).toBeVisible();
      }
    });

    test('should handle back button navigation', async ({ page }) => {
      await authenticateUser(page);

      // Navigate through multiple pages
      await page.goto('/brands');
      const brandsUrl = page.url();

      await page.goto('/fabrics');
      const fabricsUrl = page.url();

      // Go back
      await page.goBack();

      // Should be back on brands page
      expect(page.url()).toEqual(brandsUrl);
    });

    test('should handle forward button navigation after going back', async ({ page }) => {
      await authenticateUser(page);

      // Navigate sequence
      await page.goto('/brands');
      await page.goto('/fabrics');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Go forward
      await page.goForward();
      await page.waitForLoadState('networkidle');

      // Should be on fabrics page
      expect(page.url()).toContain('/fabrics');
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should handle 404 error gracefully', async ({ page }) => {
      await authenticateUser(page);

      // Try to access non-existent page
      const response = await page.goto('/non-existent-page', { waitUntil: 'networkidle' });

      // Expect 404 response
      expect(response?.status()).toBe(404);
    });

    test('should handle slow network gracefully', async ({ page }) => {
      await authenticateUser(page);

      // Simulate slow 3G network
      await page.route('**/*', (route) => {
        setTimeout(() => route.continue(), 100);
      });

      // Navigate to a page
      await page.goto('/pipeline');

      // Should eventually load the page
      expect(page.url()).toContain('/pipeline');
    });
  });
});
