"use client";

/**
 * <ErrorPanel /> — Phase 13C.
 *
 * Unified error rendering. Every API failure that bubbles to the
 * UI should use this instead of dumping raw `error.message` to the
 * screen.
 *
 * Props:
 *   - context   what the user was trying to do ("Load supply chain")
 *   - error     the underlying error (string or Error)
 *   - onRetry?  if set, renders a "Try again" button
 *   - className optional wrapper class
 *
 * The plain-English `why` falls back to a generic message when the
 * underlying error is technical (Prisma codes, HTTP 5xx).
 */
import Link from "next/link";

interface Props {
  context: string;
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

function plainEnglishWhy(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error";
  const lc = raw.toLowerCase();
  if (lc.includes("network") || lc.includes("fetch")) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (lc.includes("unauthorized") || lc.includes("401")) {
    return "Your session expired. Sign in again to continue.";
  }
  if (lc.includes("forbidden") || lc.includes("403")) {
    return "Your account doesn't have permission for this action.";
  }
  if (lc.includes("not found") || lc.includes("404")) {
    return "We couldn't find what you were looking for. It may have been moved or deleted.";
  }
  if (lc.includes("p2002") || lc.includes("duplicate") || lc.includes("unique constraint")) {
    return "Something with that identifier already exists.";
  }
  if (lc.includes("p20")) {
    return "The database rejected the request. An admin has been notified.";
  }
  if (lc.includes("timeout")) {
    return "The request took too long. Try again in a moment.";
  }
  // Default — show the raw message if it looks human, else generic.
  if (raw.length < 160 && /^[A-Za-z0-9 .,'"!?:;()\/\-]+$/.test(raw)) {
    return raw;
  }
  return "An unexpected error happened. An admin has been notified.";
}

export default function ErrorPanel({ context, error, onRetry, className = "" }: Props) {
  const why = plainEnglishWhy(error);
  const rawTechnical =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : null;

  return (
    <div
      className={`rounded-xl border-l-4 border-red-400 bg-red-50 p-5 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-red-900">{context} — failed</p>
          <p className="text-sm text-red-800 mt-1">{why}</p>
          {rawTechnical && rawTechnical !== why && (
            <details className="mt-2">
              <summary className="text-[11px] text-red-700 cursor-pointer hover:underline">
                Technical detail
              </summary>
              <p className="mt-1 text-[11px] font-mono text-red-700 break-all">
                {rawTechnical}
              </p>
            </details>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-1"
              >
                Try again
              </button>
            )}
            <Link
              href="/support"
              className="px-3 py-1 rounded border border-red-300 text-red-800 text-xs font-bold hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            >
              Tell us about this →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
