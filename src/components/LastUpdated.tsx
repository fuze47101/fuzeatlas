"use client";

/**
 * <LastUpdated at={...} /> — Phase 13J.
 *
 * Renders "Last updated 2h ago" near the page title via
 * Intl.RelativeTimeFormat. Re-computes every 60 seconds so a page
 * left open doesn't show stale "now" forever.
 *
 * Accepts a Date, ISO string, or null. Renders nothing when null.
 */
import { useEffect, useState } from "react";

interface Props {
  at: Date | string | null | undefined;
  prefix?: string;
  className?: string;
}

const fmt =
  typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto" })
    : null;

function relative(date: Date): string {
  if (!fmt) return date.toLocaleString();
  const diffMs = date.getTime() - Date.now();
  const absSec = Math.abs(diffMs / 1000);
  if (absSec < 60) return fmt.format(Math.round(diffMs / 1000), "second");
  if (absSec < 3600) return fmt.format(Math.round(diffMs / 60_000), "minute");
  if (absSec < 86400) return fmt.format(Math.round(diffMs / 3_600_000), "hour");
  if (absSec < 30 * 86400) return fmt.format(Math.round(diffMs / 86_400_000), "day");
  if (absSec < 365 * 86400) return fmt.format(Math.round(diffMs / (30 * 86_400_000)), "month");
  return fmt.format(Math.round(diffMs / (365 * 86_400_000)), "year");
}

export default function LastUpdated({ at, prefix = "Last updated", className = "" }: Props) {
  const date = at ? (at instanceof Date ? at : new Date(at)) : null;
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!date || isNaN(date.getTime())) return null;

  return (
    <span
      className={`text-xs text-slate-600 ${className}`}
      title={date.toLocaleString()}
    >
      {prefix} {relative(date)}
    </span>
  );
}
