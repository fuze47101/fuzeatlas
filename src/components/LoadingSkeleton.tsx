"use client";

/**
 * <LoadingSkeleton /> — Phase 13B.
 *
 * Unified shimmer placeholder. Drop in any page that's waiting on
 * an async fetch. Accepts a `variant` prop:
 *   - "page"  (default) — full-page panel with header + rows
 *   - "table" — just rows
 *   - "card"  — one card-sized block
 *   - "lines" — N text-line shimmers (lines={n})
 *
 * The shimmer uses Tailwind animate-pulse so it works with the
 * existing tailwind.config.js without adding a custom keyframe.
 */
interface Props {
  variant?: "page" | "table" | "card" | "lines";
  lines?: number;
  className?: string;
  label?: string;
}

export default function LoadingSkeleton({
  variant = "page",
  lines = 4,
  className = "",
  label,
}: Props) {
  if (variant === "lines") {
    return (
      <div className={`space-y-2 animate-pulse ${className}`} role="status" aria-label={label || "Loading"}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-slate-200"
            style={{ width: `${60 + Math.random() * 35}%` }}
          />
        ))}
        <span className="sr-only">{label || "Loading"}</span>
      </div>
    );
  }
  if (variant === "card") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white p-5 animate-pulse ${className}`}
        role="status"
        aria-label={label || "Loading"}
      >
        <div className="h-5 w-1/3 rounded bg-slate-200 mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-200" />
          <div className="h-3 w-5/6 rounded bg-slate-200" />
          <div className="h-3 w-4/6 rounded bg-slate-200" />
        </div>
        <span className="sr-only">{label || "Loading"}</span>
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div
        className={`rounded-xl border border-slate-200 bg-white overflow-hidden animate-pulse ${className}`}
        role="status"
        aria-label={label || "Loading"}
      >
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-4">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="h-3 w-20 rounded bg-slate-200" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-slate-100 flex gap-4">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-4 w-20 rounded bg-slate-200" />
          </div>
        ))}
        <span className="sr-only">{label || "Loading"}</span>
      </div>
    );
  }
  // page (default)
  return (
    <div
      className={`max-w-5xl mx-auto p-4 sm:p-6 animate-pulse ${className}`}
      role="status"
      aria-label={label || "Loading"}
    >
      <div className="h-7 w-1/3 rounded bg-slate-200 mb-2" />
      <div className="h-4 w-1/2 rounded bg-slate-200 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-1/2 rounded bg-slate-200 mb-3" />
            <div className="h-8 w-3/4 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-slate-200" style={{ width: `${65 + Math.random() * 30}%` }} />
        ))}
      </div>
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}
