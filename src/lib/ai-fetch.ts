/**
 * ai-fetch.ts — Shared utility for calling AI APIs with:
 *  1. Exponential-backoff retry on 429 / 5xx
 *  2. Per-request logging so we can audit who is burning tokens
 *
 * Drop-in replacement for raw `fetch()` when calling OpenAI / Anthropic.
 */

import { PrismaClient } from "@prisma/client";

// Re-use a single Prisma instance (same pattern as prisma.ts)
const prisma = new PrismaClient();

// ─── Types ───────────────────────────────────────────

interface AiFetchOptions {
  /** Which AI provider ("openai" | "anthropic") — used for logging */
  provider: "openai" | "anthropic";
  /** Which internal route triggered this call (e.g. "chat", "research", "test-review") */
  callerRoute: string;
  /** Max retries on 429 / 5xx (default 3) */
  maxRetries?: number;
  /** Base delay in ms before first retry (default 1000) — doubled each attempt */
  baseDelayMs?: number;
  /** Optional user ID from the request (for audit trail) */
  userId?: string;
}

interface AiFetchResult {
  response: Response;
  retries: number;
}

// ─── Retry-aware fetch ───────────────────────────────

export async function aiFetch(
  url: string,
  init: RequestInit,
  opts: AiFetchOptions
): Promise<AiFetchResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const startMs = Date.now();
    const response = await fetch(url, init);
    const durationMs = Date.now() - startMs;

    // Log every call (fire-and-forget so it doesn't slow down the response)
    logApiCall({
      provider: opts.provider,
      callerRoute: opts.callerRoute,
      userId: opts.userId,
      statusCode: response.status,
      durationMs,
      attempt,
      url,
    }).catch((err) => console.error("Failed to log API call:", err));

    // Success — return immediately
    if (response.ok) {
      return { response, retries: attempt };
    }

    lastResponse = response;

    // Only retry on 429 (rate limit) or 5xx (server error)
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxRetries) {
      break;
    }

    // Check for Retry-After header (seconds)
    const retryAfter = response.headers.get("retry-after");
    let delayMs: number;
    if (retryAfter && !isNaN(Number(retryAfter))) {
      delayMs = Number(retryAfter) * 1000;
    } else {
      // Exponential backoff: 1s → 2s → 4s (+ small jitter)
      delayMs = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
    }

    console.warn(
      `[ai-fetch] ${opts.provider}/${opts.callerRoute} got ${response.status}, ` +
        `retrying in ${Math.round(delayMs)}ms (attempt ${attempt + 1}/${maxRetries})`
    );

    await sleep(delayMs);
  }

  // All retries exhausted — return the last response so caller can handle
  return { response: lastResponse!, retries: maxRetries };
}

// ─── Audit logger ────────────────────────────────────

interface LogEntry {
  provider: string;
  callerRoute: string;
  userId?: string;
  statusCode: number;
  durationMs: number;
  attempt: number;
  url: string;
}

async function logApiCall(entry: LogEntry) {
  // Log to console for immediate visibility in Vercel / dev logs
  const tag =
    entry.statusCode === 429
      ? "⚠️  RATE-LIMITED"
      : entry.statusCode >= 400
      ? "❌ ERROR"
      : "✅ OK";

  console.log(
    `[AI-AUDIT] ${tag} | ${entry.provider} | route=${entry.callerRoute} | ` +
      `user=${entry.userId || "unknown"} | status=${entry.statusCode} | ` +
      `${entry.durationMs}ms | attempt=${entry.attempt}`
  );

  // Also persist to DB so you can query who's been making calls
  // Uses (prisma as any) to avoid TS errors before migration runs
  try {
    await (prisma as any).apiCallLog?.create({
      data: {
        provider: entry.provider,
        callerRoute: entry.callerRoute,
        userId: entry.userId || null,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        attempt: entry.attempt,
        createdAt: new Date(),
      },
    });
  } catch {
    // Table might not exist yet — that's fine, console log is the fallback
  }
}

// ─── Helpers ─────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract user ID from Next.js request headers.
 * The middleware sets x-user-id on every authenticated request.
 */
export function getUserIdFromHeaders(headers: Headers): string | undefined {
  return headers.get("x-user-id") || undefined;
}
