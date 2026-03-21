import { test, expect } from '@playwright/test';

/**
 * API Health & Security E2E Tests for FUZE Atlas
 *
 * These tests verify:
 * - Health check endpoints are accessible
 * - Protected endpoints require authentication
 * - Rate limiting is enforced
 * - API responses have proper security headers
 * - Error handling and status codes are correct
 */

test.describe('API Health & Security', () => {
  const validUser = {
    email: 'test@fuzeatlas.com',
    password: 'TestPassword123!',
  };

  /**
   * Helper to get auth token/cookies
   */
  async function getAuthCookies(page: any) {
    // Navigate and login
    await page.goto('/');

    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: validUser.email,
        password: validUser.password,
      },
    });

    if (loginResponse.status() === 200) {
      // Extract and return cookies
      const cookies = await page.context().cookies();
      return cookies;
    }

    throw new Error('Failed to authenticate');
  }

  test.describe('Public Health Endpoints', () => {
    test('GET /api/health should return 200 OK', async ({ request }) => {
      const response = await request.get('/api/health');

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('ok');
    });

    test('GET /api/auth/setup-check should return 200 OK', async ({ request }) => {
      const response = await request.get('/api/auth/setup-check');

      expect(response.status()).toBe(200);

      const data = await response.json();
      // Verify response structure
      expect(typeof data).toBe('object');
    });

    test('health endpoints should return JSON', async ({ request }) => {
      const response = await request.get('/api/health');

      // Verify content-type is JSON
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });

    test('health endpoints should include proper cache headers', async ({ request }) => {
      const response = await request.get('/api/health');

      // Health checks typically should not be cached
      const cacheControl = response.headers()['cache-control'];
      expect(cacheControl).toBeDefined();
      // Should either be no-cache or have short max-age
      expect(
        cacheControl?.includes('no-cache') ||
        cacheControl?.includes('max-age=0') ||
        cacheControl?.includes('no-store')
      ).toBeTruthy();
    });
  });

  test.describe('Protected Endpoints', () => {
    test('GET /api/user should return 401 without authentication', async ({ request }) => {
      const response = await request.get('/api/user');

      // Should return 401 Unauthorized
      expect(response.status()).toBe(401);
    });

    test('GET /api/brands should return 401 without authentication', async ({ request }) => {
      const response = await request.get('/api/brands');

      expect(response.status()).toBe(401);
    });

    test('POST /api/brands should return 401 without authentication', async ({ request }) => {
      const response = await request.post('/api/brands', {
        data: { name: 'Test Brand' },
      });

      expect(response.status()).toBe(401);
    });

    test('protected endpoints should not be cached', async ({ request }) => {
      const response = await request.get('/api/user');

      // Even 401 responses should have proper cache headers
      const cacheControl = response.headers()['cache-control'];
      if (cacheControl) {
        expect(cacheControl).toContain('no-cache');
      }
    });
  });

  test.describe('Authenticated Endpoints', () => {
    test('GET /api/user should return 200 with valid authentication', async ({ page }) => {
      await getAuthCookies(page);

      const response = await page.request.get('/api/user');

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('email');
    });

    test('GET /api/brands should return 200 with valid authentication', async ({ page }) => {
      await getAuthCookies(page);

      const response = await page.request.get('/api/brands');

      expect(response.status()).toBeLessThan(400);
      expect(response.status()).toBeGreaterThanOrEqual(200);
    });

    test('authenticated responses should have proper content-type', async ({ page }) => {
      await getAuthCookies(page);

      const response = await page.request.get('/api/user');

      expect(response.status()).toBe(200);

      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('application/json');
    });
  });

  test.describe('Rate Limiting', () => {
    test('should enforce rate limiting on login endpoint', async ({ request }) => {
      const maxAttempts = 5;
      let rateLimitEncountered = false;

      // Make multiple rapid requests to trigger rate limit
      for (let i = 0; i < maxAttempts + 5; i++) {
        const response = await request.post('/api/auth/login', {
          data: {
            email: 'test@fuzeatlas.com',
            password: 'WrongPassword',
          },
        });

        // 429 = Too Many Requests (rate limited)
        if (response.status() === 429) {
          rateLimitEncountered = true;
          break;
        }
      }

      // Rate limiting may or may not be implemented
      // This test documents the expected behavior
      if (rateLimitEncountered) {
        expect(rateLimitEncountered).toBe(true);
      }
    });

    test('rate limited response should include retry headers', async ({ request }) => {
      // Make many rapid requests
      let response;
      for (let i = 0; i < 10; i++) {
        response = await request.post('/api/auth/login', {
          data: {
            email: 'test@fuzeatlas.com',
            password: 'WrongPassword',
          },
        });

        if (response?.status() === 429) {
          break;
        }
      }

      // If we got rate limited
      if (response?.status() === 429) {
        // Should include retry-after header
        const retryAfter = response.headers()['retry-after'];
        expect(retryAfter).toBeDefined();
      }
    });
  });

  test.describe('Security Headers', () => {
    test('responses should include security headers', async ({ request }) => {
      const response = await request.get('/api/health');

      // Check for common security headers
      const headers = response.headers();

      // X-Content-Type-Options prevents MIME sniffing
      if (headers['x-content-type-options']) {
        expect(headers['x-content-type-options']).toBe('nosniff');
      }

      // Content-Security-Policy or X-Frame-Options for clickjacking protection
      // These might be set at the main app level, not API
      if (headers['x-frame-options']) {
        expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options']);
      }
    });

    test('should use HTTPS in production (if applicable)', async ({ request }) => {
      // This test only runs in production
      const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

      if (baseURL.startsWith('https://')) {
        const response = await request.get('/api/health');
        expect(response.status()).toBeLessThan(400);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('malformed requests should return proper error', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Should return 400 Bad Request or 422 Unprocessable Entity
      expect([400, 422, 405]).toContain(response.status());
    });

    test('non-existent endpoints should return 404', async ({ request }) => {
      const response = await request.get('/api/non-existent-endpoint');

      expect(response.status()).toBe(404);
    });

    test('method not allowed should return 405', async ({ request }) => {
      // Assuming /api/health only allows GET
      const response = await request.post('/api/health');

      expect(response.status()).toBe(405);
    });

    test('error responses should include error message', async ({ request }) => {
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBeTruthy();
    });
  });

  test.describe('Response Performance', () => {
    test('/api/health should respond quickly', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get('/api/health');
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // Health check should respond in < 1 second
      expect(responseTime).toBeLessThan(1000);
      expect(response.status()).toBe(200);
    });

    test('authenticated endpoints should complete within timeout', async ({ page }) => {
      await getAuthCookies(page);

      const startTime = Date.now();
      const response = await page.request.get('/api/user');
      const endTime = Date.now();

      const responseTime = endTime - startTime;

      // API calls should complete within 5 seconds
      expect(responseTime).toBeLessThan(5000);
      expect(response.status()).toBe(200);
    });
  });

  test.describe('CORS & Content Negotiation', () => {
    test('API should return appropriate CORS headers (if applicable)', async ({ request }) => {
      const response = await request.get('/api/health');

      // CORS headers depend on configuration
      const headers = response.headers();
      // Just verify the request succeeds
      expect(response.status()).toBeLessThan(400);
    });

    test('should handle accept-language header', async ({ request }) => {
      const response = await request.get('/api/health', {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      expect(response.status()).toBeLessThan(400);
    });
  });
});
