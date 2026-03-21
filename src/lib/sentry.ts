/**
 * Sentry Error Tracking Configuration
 *
 * SETUP REQUIRED:
 * 1. Create a Sentry account at https://sentry.io
 * 2. Create a new Next.js project in Sentry
 * 3. Add your DSN to .env: NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 * 4. Install: npm install @sentry/nextjs
 * 5. Run: npx @sentry/wizard@latest -i nextjs
 *
 * Until @sentry/nextjs is installed, this module provides a lightweight
 * fallback that captures errors to console + stores them for review.
 */

interface ErrorEvent {
  message: string;
  stack?: string;
  url?: string;
  userId?: string;
  extra?: Record<string, unknown>;
  timestamp: string;
  level: "error" | "warning" | "info";
}

// In-memory error buffer (last 100 errors) — viewable at /api/admin/errors
const errorBuffer: ErrorEvent[] = [];
const MAX_BUFFER = 100;

export function captureException(
  error: Error | string,
  context?: { userId?: string; url?: string; extra?: Record<string, unknown> }
) {
  const event: ErrorEvent = {
    message: typeof error === "string" ? error : error.message,
    stack: typeof error === "string" ? undefined : error.stack,
    url: context?.url,
    userId: context?.userId,
    extra: context?.extra,
    timestamp: new Date().toISOString(),
    level: "error",
  };

  // Always log to console
  console.error("[SENTRY-STUB]", event.message, event.extra || "");

  // Buffer for /api/admin/errors endpoint
  errorBuffer.push(event);
  if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();

  // When Sentry is installed, this will be replaced with:
  // Sentry.captureException(error, { extra: context?.extra });
}

export function captureMessage(
  message: string,
  level: "error" | "warning" | "info" = "info",
  extra?: Record<string, unknown>
) {
  const event: ErrorEvent = {
    message,
    level,
    extra,
    timestamp: new Date().toISOString(),
  };

  console.log(`[SENTRY-STUB][${level}]`, message, extra || "");
  errorBuffer.push(event);
  if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();
}

export function getRecentErrors(): ErrorEvent[] {
  return [...errorBuffer].reverse();
}
