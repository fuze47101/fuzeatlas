/**
 * src/lib/format-date.ts — NICE-3 canonical date formatting.
 *
 * Atlas was littered with one-off
 * `new Date(...).toLocaleString()` and
 * `.toISOString().split("T")[0]` patterns that ignored both the
 * user's locale and their timezone. This wraps `Intl.DateTimeFormat`
 * so every surface ends up consistent and respects User.timezone
 * (added Phase 10).
 *
 * Pass the SessionUser as the second arg where available; we read
 * `.timezone` (IANA) off it. Falls back to the browser / server
 * default when null.
 *
 * Three exports:
 *   - formatDate(d, user?)       → "May 13, 2026"
 *   - formatDateTime(d, user?)   → "May 13, 2026, 2:47 PM"
 *   - formatRelative(d, user?)   → "3 hours ago" / "in 2 days" / "Just now"
 *
 * Server callers pass `null` for user (or omit it) — they still get
 * a locale-respecting "en-US" fallback that matches the prior
 * `toLocaleString()` behaviour, so this is a drop-in for sweeps.
 */

interface UserWithTimezone {
  timezone?: string | null;
  locale?: string | null;
}

type DateInput = Date | string | number | null | undefined;

function pickTimeZone(user?: UserWithTimezone | null): string | undefined {
  return user?.timezone || undefined;
}

function pickLocale(user?: UserWithTimezone | null): string | undefined {
  return user?.locale || undefined;
}

function toDate(input: DateInput): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(input: DateInput, user?: UserWithTimezone | null): string {
  const d = toDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(pickLocale(user) || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: pickTimeZone(user),
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export function formatDateTime(input: DateInput, user?: UserWithTimezone | null): string {
  const d = toDate(input);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(pickLocale(user) || undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: pickTimeZone(user),
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Returns a human-readable "X ago" / "in X" string. Uses
 * Intl.RelativeTimeFormat where supported; falls back to absolute
 * date otherwise.
 */
export function formatRelative(input: DateInput, user?: UserWithTimezone | null): string {
  const d = toDate(input);
  if (!d) return "—";
  const diffMs = d.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  // Under 45 seconds we just say "just now".
  if (absMs < 45_000) return diffMs >= 0 ? "in a moment" : "just now";

  // Pick the biggest unit that fits.
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: "year", ms: 365 * 86400_000 },
    { unit: "month", ms: 30 * 86400_000 },
    { unit: "week", ms: 7 * 86400_000 },
    { unit: "day", ms: 86400_000 },
    { unit: "hour", ms: 3600_000 },
    { unit: "minute", ms: 60_000 },
    { unit: "second", ms: 1_000 },
  ];
  const chosen = units.find((u) => absMs >= u.ms) || units[units.length - 1];
  const value = Math.round(diffMs / chosen.ms);

  try {
    return new Intl.RelativeTimeFormat(pickLocale(user) || undefined, {
      numeric: "auto",
    }).format(value, chosen.unit);
  } catch {
    return formatDate(d, user);
  }
}

/**
 * ISO date helper for query-string / form input use cases. Returns
 * "YYYY-MM-DD" in the user's timezone. Replaces the
 * `.toISOString().split("T")[0]` pattern that silently shifted dates
 * across timezone boundaries.
 */
export function formatYmd(input: DateInput, user?: UserWithTimezone | null): string {
  const d = toDate(input);
  if (!d) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: pickTimeZone(user),
    }).format(d);
    return parts; // en-CA returns "YYYY-MM-DD"
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
