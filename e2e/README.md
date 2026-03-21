# FUZE Atlas E2E Tests

End-to-end test suite for FUZE Atlas Next.js application using Playwright.

## Setup

Playwright is pre-configured in `playwright.config.ts`. To run tests:

```bash
# Run all tests
npx playwright test

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests matching pattern
npx playwright test --grep "login"

# Run tests in debug mode
npx playwright test --debug

# View test report
npx playwright show-report
```

## Test Files

### `auth.spec.ts`
Tests authentication flows including:
- Login page rendering
- Form validation
- Successful login and redirect
- Session persistence
- Logout functionality
- Protected route access

**Key test credentials:**
- Valid user: `test@fuzeatlas.com` / `TestPassword123!`
- Must be created in test database before running tests

### `navigation.spec.ts`
Tests routing and navigation including:
- Unauthenticated redirect to login
- Protected route access
- Sidebar navigation
- Active state indicators
- Breadcrumb navigation
- Browser back/forward buttons
- 404 error handling

### `api-health.spec.ts`
Tests API endpoints including:
- Health check endpoints (`/api/health`, `/api/auth/setup-check`)
- Protected endpoint security (401 on missing auth)
- Authenticated endpoint access
- Rate limiting enforcement
- Security headers
- Error handling and proper HTTP status codes
- Response performance

### `fixtures/auth.ts`
Shared authentication utilities:
- `loginViaAPI()`: Fast API-based login for test setup
- `loginViaUI()`: UI-based login for testing login flow
- `authenticatedPage` fixture: Pre-authenticated page for tests
- Test credentials export

## Configuration

`playwright.config.ts` defines:
- **baseURL**: http://localhost:3000 (override with `PLAYWRIGHT_BASE_URL`)
- **timeout**: 30 seconds per test
- **browsers**: Chromium, Firefox, WebKit
- **retries**: 1 on CI, 0 locally
- **webServer**: Auto-starts `npm run dev`
- **reporters**: HTML report with traces/screenshots

## Environment Variables

```bash
# Override base URL (useful for testing staging/production)
PLAYWRIGHT_BASE_URL=https://staging.fuzeatlas.com npx playwright test

# Run on CI
CI=true npx playwright test
```

## Before Running Tests

1. Ensure test database has test user:
   - Email: `test@fuzeatlas.com`
   - Password: `TestPassword123!`
   - Or modify credentials in test files

2. Verify API endpoints exist:
   - `/api/auth/login`
   - `/api/health`
   - `/api/auth/setup-check`
   - `/api/user`
   - `/api/brands`

3. Start dev server (automatic via config):
   ```bash
   npm run dev
   ```

## Best Practices

### Writing Tests
- Use descriptive test names
- Test one thing per test
- Use `test.describe()` for grouping related tests
- Add comments explaining what's being tested

### Fixtures
- Create custom fixtures for repeated setup
- Use built-in fixtures: `page`, `context`, `browser`, `request`
- Pre-authenticate users for protected route tests

### Locators
- Prefer semantic selectors: `[role="button"]`, `button:has-text("Login")`
- Use `data-testid` attributes when needed
- Avoid brittle selectors: nth-child, absolute XPath

### Waits
- Use `waitForURL()` for navigation
- Use `waitForLoadState('networkidle')` for async operations
- Avoid `page.waitForTimeout()` - use explicit waits instead

## Debugging

```bash
# Run with browser visible
npx playwright test --headed

# Debug mode (step through tests)
npx playwright test --debug

# Run single test
npx playwright test auth.spec.ts:45

# Trace viewer for failed tests
npx playwright show-report
```

## CI/CD Integration

In GitHub Actions or similar:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run E2E tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}

- name: Upload test report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Common Issues

### Tests timeout waiting for navigation
- Verify login endpoint returns proper redirects
- Check network tab in headed mode
- Ensure middleware doesn't redirect authenticated users away

### "Timeout waiting for event networkidle"
- Use `waitForURL()` instead for page navigation
- Or set shorter timeout: `waitForLoadState('domcontentloaded')`

### Auth cookie not persisting
- Verify `httpOnly` flag is set correctly
- Check cookie domain/path matching
- Ensure `SameSite` attribute allows API calls

### Tests pass locally but fail in CI
- Verify test data exists in CI database
- Check environment variables are set
- Review timezone-dependent assertions

## Performance Tips

- Use `context.clearCookies()` instead of full logout when testing auth
- Re-use authenticated context across tests in same spec
- Use API calls (`page.request`) for setup instead of UI interactions
- Run tests in parallel with `fullyParallel: true`

## Extending Tests

### Add new test file
```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/my-feature');
    // test assertions
  });
});
```

### Add authenticated test
```typescript
import { test, expect } from './fixtures/auth';

test('authenticated action', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/protected-page');
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)
