"use client";

/**
 * <Skeleton /> — NICE-2 skeleton loaders.
 *
 * Replaces `<div className="animate-spin"/>` blockers on the portal
 * landing pages. Skeletons mirror the shape of the loaded content so
 * the layout doesn't reflow when data arrives — reduces perceived
 * latency, especially on slow connections (China, India).
 *
 * Usage:
 *   <SkeletonStatGrid />              // 4 stat cards across a grid
 *   <SkeletonCard />                  // generic card-shaped block
 *   <SkeletonRow lines={3} />         // a list-item-style block
 *   <Skeleton className="h-4 w-24" /> // raw shimmer rectangle
 */

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-pulse rounded bg-slate-200/70 ${className}`}
    />
  );
}

export function SkeletonStatGrid({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Skeleton className="h-3 w-32 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 ${className}`}>
      <Skeleton className="h-4 w-40 mb-3" />
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-5/6 mb-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonRow({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-4 space-y-2 ${className}`}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === 0 ? "w-2/3" : i === lines - 1 ? "w-1/2" : "w-3/4"}`} />
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="mb-8">
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-7 w-64 mb-2" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

/**
 * Page-shaped skeleton for the standard portal landing layout:
 * header strip → 4-card stat grid → 2-card content grid. Drop-in
 * replacement for the spinner currently rendered while the page is
 * loading.
 */
export function SkeletonPortalLanding() {
  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <SkeletonHeader />
      <SkeletonStatGrid cards={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
