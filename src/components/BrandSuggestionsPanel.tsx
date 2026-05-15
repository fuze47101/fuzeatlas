"use client";

/**
 * <BrandSuggestionsPanel /> — BONUS-3 next-moves panel.
 *
 * Drop on /admin/brands/[id] (or any brand detail surface). Loads
 * suggestions from /api/admin/brands/[id]/suggestions, renders cards
 * with severity color + CTA + dismiss button. Dismissals POST to the
 * same endpoint and silence the suggestion for 7 days.
 *
 * Silent on empty result so a perfectly-tended brand doesn't get a
 * "no suggestions" panel taking up space.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Suggestion {
  id: string;
  severity: "info" | "warn" | "urgent";
  title: string;
  body?: string;
  href?: string;
  cta?: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; pill: string }> = {
  urgent: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-900",
    pill: "bg-red-100 text-red-700",
  },
  warn: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-900",
    pill: "bg-amber-100 text-amber-700",
  },
  info: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-800",
    pill: "bg-slate-100 text-slate-600",
  },
};

const SEVERITY_ICONS: Record<string, string> = {
  urgent: "🚨",
  warn: "⚠️",
  info: "💡",
};

export default function BrandSuggestionsPanel({ brandId }: { brandId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/brands/${brandId}/suggestions`);
      const j = await r.json().catch(() => null);
      if (j?.ok) setSuggestions(j.suggestions || []);
    } catch {
      /* silent — decorative panel */
    } finally {
      setLoaded(true);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  async function dismiss(id: string) {
    setDismissing(id);
    try {
      const r = await fetch(`/api/admin/brands/${brandId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: id }),
      });
      if (r.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setDismissing(null);
    }
  }

  if (!loaded || suggestions.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Suggested next moves
        </p>
        <span className="text-[11px] text-slate-400">{suggestions.length}</span>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s) => {
          const styles = SEVERITY_STYLES[s.severity] || SEVERITY_STYLES.info;
          return (
            <li
              key={s.id}
              className={`rounded-lg ${styles.bg} ${styles.border} border p-3 flex items-start justify-between gap-3`}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className="shrink-0 text-base" aria-hidden="true">
                  {SEVERITY_ICONS[s.severity] || "💡"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${styles.text}`}>{s.title}</p>
                  {s.body && (
                    <p className="text-xs text-slate-600 mt-0.5">{s.body}</p>
                  )}
                  {s.href && s.cta && (
                    <Link
                      href={s.href}
                      className="inline-block mt-1.5 text-xs font-bold text-[#00b4c3] hover:underline"
                    >
                      {s.cta}
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismiss(s.id)}
                disabled={dismissing === s.id}
                className="shrink-0 text-[10px] text-slate-500 hover:text-slate-800 underline decoration-dotted"
                title="Dismiss for 7 days"
              >
                {dismissing === s.id ? "…" : "Dismiss"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
