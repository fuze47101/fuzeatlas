"use client";

import { Component, ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Shared diagnostic frame for client pages where Andrew's reported
 * "buttons do nothing" symptom is most likely caused by silent
 * hydration failure (component throws on hydrate → entire page's
 * event handlers never attach).
 *
 * Three responsibilities:
 *
 *  1. <ErrorBoundary> — catches render errors and shows a rose stack
 *     trace instead of blanking. Same pattern as the d4bc5f1 wizard
 *     fix, extracted so it can be applied to /my-tasks, /admin/all-tasks,
 *     /admin/projects, /admin/projects/weekly, /admin/projects/[id].
 *
 *  2. <HydrationOkPill> — a tiny green "Hydration OK ✓" pill in the
 *     top-right corner, rendered only via useEffect after mount.
 *     If the pill never appears, hydration didn't run — the failure
 *     class is React-startup itself (broken bundle, blocked JS, etc.)
 *     not a per-component exception.
 *
 *  3. [PAGE-MOUNT] log — useEffect at the top of every page logs the
 *     pathname + mount timestamp so the operator can verify a fresh
 *     mount happened after every navigation. Pairs with the existing
 *     [CLICK] / [CLICK-RESULT] / [FETCH] instrumentation.
 */
export class ErrorBoundary extends Component<{ name: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.name}] hydration/render error:`, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6">
            <h1 className="text-lg font-semibold text-rose-900">
              {this.props.name} failed to render
            </h1>
            <p className="mt-2 text-sm text-rose-800">{this.state.error.message}</p>
            <pre className="mt-3 whitespace-pre-wrap text-[10px] text-rose-700 bg-white border border-rose-200 rounded p-2 max-h-[60vh] overflow-auto">
              {this.state.error.stack}
            </pre>
            <p className="mt-3 text-xs text-rose-700">
              This is the diagnostic mode added 2026-06-01 for the "buttons do nothing"
              investigation. Screenshot this and share so the exact failing component
              is visible.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function HydrationOkPill() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div
      className="fixed top-2 right-2 z-[9999] rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-semibold shadow-md"
      title="Client React hydrated successfully — onClick handlers should be attached."
    >
      Hydration OK ✓
    </div>
  );
}

/**
 * Single-line useEffect log on mount. Use it inside any page component
 * (before the body returns) so the operator can verify a fresh mount
 * in the Console after each navigation.
 */
export function useMountLog(pageTag: string) {
  const pathname = usePathname();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[PAGE-MOUNT]", new Date().toISOString(), "pathname=" + pathname, "page=" + pageTag);
    if (typeof window !== "undefined") {
      (window as any).__lastPageMount = { pathname, pageTag, ts: Date.now() };
    }
  }, [pathname, pageTag]);
}

/**
 * Frame wrapper — combines ErrorBoundary + HydrationOkPill. The
 * useMountLog hook can't be a side-effect of a class component, so
 * pages call it themselves; this just covers the visible UI parts.
 */
export function HydrationFrame({ name, children }: { name: string; children: ReactNode }) {
  return (
    <ErrorBoundary name={name}>
      <HydrationOkPill />
      {children}
    </ErrorBoundary>
  );
}

/**
 * Lightweight wrapped fetch that logs [FETCH] before, [FETCH-RESULT]
 * after, and re-throws so the caller's existing error-handling path
 * still fires. Drop-in replacement for `fetch(...)` calls.
 */
export async function loggedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const url = typeof input === "string" ? input : (input as Request).url;
  // eslint-disable-next-line no-console
  console.log("[FETCH]", new Date().toISOString(), method, url);
  try {
    const r = await fetch(input, init);
    // eslint-disable-next-line no-console
    console.log("[FETCH-RESULT]", new Date().toISOString(), method, url, "status=" + r.status);
    return r;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[FETCH-RESULT]", new Date().toISOString(), method, url, "threw:", e?.message);
    throw e;
  }
}
