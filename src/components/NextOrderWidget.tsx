"use client";

/**
 * <NextOrderWidget /> — NICE-7 factory portal reorder predictor.
 *
 * Mounted on /factory-portal. Polls /api/factory-portal/reorder-prediction,
 * renders nothing on history-less factories (no spam on day-one), and
 * progressively gets louder as projected empty-date approaches:
 *   - >30 days  → muted indigo "you're set" banner
 *   - 14-30     → amber "plan a reorder" banner
 *   - <14       → red "place an order now" banner
 *
 * The "Place order now" CTA links into /factory-portal/orders which
 * already has the NEED-3 auto-fill defaults — including the suggested
 * unit (carboy / gaylord / container) from this same endpoint, so the
 * factory user opens the modal and the right unit is already picked.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface Prediction {
  onHandLiters: number;
  dailyBurnLiters: number | null;
  daysOfStockLeft: number | null;
  projectedEmptyDate: string | null;
  urgency: "ok" | "soon" | "now" | "unknown";
  hasHistory: boolean;
  suggested: { unit: string; liters: number; label: string; qty: number };
  targetDaysForward: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

const URGENCY_STYLES: Record<string, { bg: string; border: string; text: string; cta: string }> = {
  ok: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-900",
    cta: "bg-indigo-600 hover:bg-indigo-700",
  },
  soon: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    cta: "bg-amber-600 hover:bg-amber-700",
  },
  now: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-900",
    cta: "bg-red-600 hover:bg-red-700",
  },
  unknown: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-900",
    cta: "bg-[#00b4c3] hover:bg-[#009ba8]",
  },
};

export default function NextOrderWidget() {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/factory-portal/reorder-prediction");
        const j = await r.json().catch(() => null);
        if (cancelled) return;
        if (j?.ok) setPred(j);
      } catch {
        /* silent — widget is decorative */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely until we know whether to show something. Also hide
  // for factories with no consumption history — they don't have a
  // burn rate yet and "you'll run out in 0 days" would mislead.
  if (!loaded || !pred || !pred.hasHistory) return null;

  const styles = URGENCY_STYLES[pred.urgency] || URGENCY_STYLES.unknown;
  const daysLabel =
    pred.daysOfStockLeft != null && pred.daysOfStockLeft >= 0
      ? `${pred.daysOfStockLeft} day${pred.daysOfStockLeft === 1 ? "" : "s"}`
      : null;
  const emptyDateLabel = fmtDate(pred.projectedEmptyDate);
  const unitLabel = pred.suggested.qty > 1
    ? `${pred.suggested.qty} × ${pred.suggested.label}`
    : `fresh ${pred.suggested.label}`;

  const headline =
    pred.urgency === "now"
      ? `Place an order now — you'll be out by ${emptyDateLabel}.`
      : pred.urgency === "soon"
        ? `Plan a reorder — at your current rate, you'll need a ${unitLabel} by ${emptyDateLabel}.`
        : `You're set through ${emptyDateLabel}. Reorder a ${unitLabel} before then.`;

  return (
    <div
      className={`mb-6 rounded-2xl border ${styles.bg} ${styles.border} p-5 flex items-start justify-between gap-4`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="text-2xl shrink-0" aria-hidden="true">
          {pred.urgency === "now" ? "🚨" : pred.urgency === "soon" ? "⏳" : "📦"}
        </span>
        <div className="min-w-0">
          <p className={`font-bold ${styles.text}`}>{headline}</p>
          <p className="text-xs text-slate-600 mt-1">
            On hand:{" "}
            <span className="font-semibold">
              {Math.round(pred.onHandLiters).toLocaleString()} L
            </span>{" "}
            · burn:{" "}
            <span className="font-semibold">
              {pred.dailyBurnLiters?.toFixed(1) ?? "—"} L/day
            </span>
            {daysLabel && (
              <>
                {" "}
                · stock lasts <span className="font-semibold">{daysLabel}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <Link
        href="/factory-portal/orders"
        className={`shrink-0 ${styles.cta} text-white text-sm font-bold px-4 py-2 rounded-lg whitespace-nowrap`}
      >
        {pred.urgency === "now" ? "Order now →" : "Place order →"}
      </Link>
    </div>
  );
}
