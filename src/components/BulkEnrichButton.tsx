"use client";

/**
 * Reusable bulk-enrich-empty-brands button. Drop into any admin page
 * (BD Wizard empty state, /admin/brand-discovery, /admin/brand-pipeline,
 * etc.) and let any admin trigger Apollo people-search across LEAD
 * brands missing contacts — without ever touching a terminal.
 *
 * Each click POSTs to /api/admin/bulk-enrich-empty-brands with a
 * batch limit. The endpoint is bounded to fit under Vercel's function
 * timeout (~50 brands per call ≈ 30-60s). For large backlogs the user
 * clicks "Run Again (N left)" until remaining hits 0.
 *
 * Variants:
 *   compact  — for inline placement in a header / nav strip. Single
 *              row, label + count + button.
 *   banner   — for empty states / hero placements. Full description,
 *              progress tiles, action row.
 *
 * Optional onPipelineReady callback fires when remaining hits 0 — use
 * to refresh whatever list / wizard is on the page.
 */

import { useEffect, useState } from "react";

interface Props {
  variant?: "compact" | "banner";
  /** Called after a batch where remaining drops to 0. */
  onPipelineReady?: () => void;
  /** Override the per-batch limit (default 50, hard-capped server-side at 200). */
  batchLimit?: number;
  /** Auto-fetch the current "still empty" count on mount so we can show
   *  the badge before the user clicks anything. Defaults to true. */
  autoFetchRemaining?: boolean;
}

interface Progress {
  totalEnriched: number;
  totalContactsCreated: number;
  remaining: number;
  lastBatchSize: number;
  error?: string;
}

export default function BulkEnrichButton({
  variant = "banner",
  onPipelineReady,
  batchLimit = 50,
  autoFetchRemaining = true,
}: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  // Initial "still empty" count, fetched without any enrichment work.
  const [initialRemaining, setInitialRemaining] = useState<number | null>(null);

  // On mount, ask the server for the current "empty brands" count so
  // the button can show "Bulk-Enrich Now (1083 left)" before the user
  // does anything. Reuses the same pipeline-status logic.
  useEffect(() => {
    if (!autoFetchRemaining) return;
    let cancelled = false;
    fetch("/api/admin/bd/wizard/next-brand", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const n = j?.summary?.leadNoContacts;
        if (typeof n === "number") setInitialRemaining(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [autoFetchRemaining]);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/bulk-enrich-empty-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: batchLimit }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setProgress((p) => ({
          totalEnriched: p?.totalEnriched || 0,
          totalContactsCreated: p?.totalContactsCreated || 0,
          remaining: p?.remaining ?? initialRemaining ?? 0,
          lastBatchSize: 0,
          error: data.error || `HTTP ${res.status}`,
        }));
        return;
      }
      setProgress((p) => ({
        totalEnriched: (p?.totalEnriched || 0) + (data.brandsEnriched || 0),
        totalContactsCreated:
          (p?.totalContactsCreated || 0) + (data.contactsCreated || 0),
        remaining: data.brandsRemainingNoContacts ?? 0,
        lastBatchSize: data.brandsEnriched || 0,
      }));
      // BUG 1 (Barth 2026-06-05) — used to only fire onPipelineReady
      // when remaining hit 0. Barth ran AI Research, saw new brands
      // get created mid-batch, but the parent list never refreshed
      // until he hit reload. Fire after EVERY successful batch so the
      // pipeline list reflects what just got added.
      if ((data.brandsEnriched || 0) > 0) {
        onPipelineReady?.();
      }
    } catch (e: any) {
      setProgress((p) => ({
        totalEnriched: p?.totalEnriched || 0,
        totalContactsCreated: p?.totalContactsCreated || 0,
        remaining: p?.remaining ?? initialRemaining ?? 0,
        lastBatchSize: 0,
        error: e?.message || "Network error",
      }));
    } finally {
      setRunning(false);
    }
  }

  const remaining = progress?.remaining ?? initialRemaining ?? null;
  const isDone = progress != null && progress.remaining === 0;

  // ─── Compact variant — fits in a header strip ─────────────
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={running || (remaining != null && remaining === 0)}
          className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded-lg hover:bg-cyan-700 disabled:opacity-50"
          title="Run Apollo people-search on the next batch of empty LEAD brands. ~30-60 seconds per click."
        >
          {running
            ? "⏳ Enriching…"
            : isDone
              ? "✓ All enriched"
              : remaining != null && remaining > 0
                ? `⚡ Bulk-Enrich (${remaining} empty)`
                : "⚡ Bulk-Enrich"}
        </button>
        {progress && progress.totalEnriched > 0 && !isDone && (
          <span className="text-xs text-slate-500">
            +{progress.totalContactsCreated} contacts so far
          </span>
        )}
        {progress?.error && (
          <span className="text-xs text-red-700">{progress.error}</span>
        )}
      </div>
    );
  }

  // ─── Banner variant — for empty states / hero placements ──
  return (
    <div className="p-4 bg-cyan-50 border-2 border-cyan-300 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="text-2xl">⚡</div>
        <div className="flex-1 text-left">
          <p className="font-bold text-cyan-900">
            Bulk-Enrich Empty Brands
          </p>
          <p className="text-xs text-cyan-800 mt-0.5">
            Calls Apollo people-search by domain on LEAD brands missing
            contacts and attaches up to 8 senior people per brand
            (founder / C-suite / VP / head / director). Each click
            processes up to {batchLimit} brands and takes ~30–60
            seconds. Click again to chew through the rest.
          </p>

          {(progress || initialRemaining != null) && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs bg-white rounded border border-cyan-200 p-2">
              <div>
                <p className="text-slate-500 font-bold uppercase text-[10px]">
                  Brands enriched
                </p>
                <p className="text-base font-black text-cyan-900">
                  {progress?.totalEnriched ?? 0}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-bold uppercase text-[10px]">
                  Contacts attached
                </p>
                <p className="text-base font-black text-cyan-900">
                  {progress?.totalContactsCreated ?? 0}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-bold uppercase text-[10px]">
                  Still empty
                </p>
                <p
                  className={`text-base font-black ${
                    remaining === 0
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {remaining ?? "—"}
                </p>
              </div>
            </div>
          )}
          {progress?.error && (
            <p className="text-xs text-red-700 mt-2 font-semibold">
              {progress.error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={run}
              disabled={running || isDone}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 disabled:opacity-50"
            >
              {running
                ? "⏳ Enriching… (30-60s)"
                : isDone
                  ? "✓ All enriched"
                  : progress
                    ? `Run Again (${progress.remaining} left)`
                    : remaining != null && remaining > 0
                      ? `⚡ Bulk-Enrich Now (${remaining})`
                      : "⚡ Bulk-Enrich Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
