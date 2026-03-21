/**
 * In-memory rate limiter for API routes.
 * Uses a sliding-window counter per IP address.
 *
 * For production at scale, replace with Upstash Redis or Vercel KV.
 * This works well for Vercel serverless on moderate traffic.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  identifier: string,
  opts: RateLimitOptions
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const windowMs = opts.windowSec * 1000;
  const key = identifier;

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit: opts.limit, remaining: opts.limit - 1, retryAfterSec: 0 };
  }

  if (entry.count >= opts.limit) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, limit: opts.limit, remaining: 0, retryAfterSec };
  }

  entry.count++;
  return {
    allowed: true,
    limit: opts.limit,
    remaining: opts.limit - entry.count,
    retryAfterSec: 0,
  };
}

/**
 * Extract client IP from request headers.
 * Vercel sets x-forwarded-for; falls back to x-real-ip.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
