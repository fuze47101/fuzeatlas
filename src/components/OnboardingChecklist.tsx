"use client";

/**
 * <OnboardingChecklist /> — Phase 15 IMP-4.
 *
 * Generic, surface-keyed checklist that renders across the top of a
 * portal dashboard. Self-fetches state from
 * /api/me/onboarding-state?surface=...; PATCHes back when the user
 * checks an item or dismisses the card.
 *
 * Auto-hides when all items are complete (with a brief "✓ Setup
 * complete" pill the user can dismiss) OR when the user has
 * explicitly dismissed.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ChecklistItem, Surface } from "@/lib/onboarding-checklists";

interface State {
  completedItems: string[];
  dismissed: boolean;
}

interface Props {
  surface: Surface;
  items: ChecklistItem[];
  /** Items the server can mark complete automatically (e.g. brand
   *  has a profile row, factory has placed an order). Merged with
   *  user-toggled completedItems. */
  autoCompleted?: string[];
  className?: string;
}

export default function OnboardingChecklist({
  surface,
  items,
  autoCompleted = [],
  className = "",
}: Props) {
  const [state, setState] = useState<State | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/me/onboarding-state?surface=${encodeURIComponent(surface)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) {
          setState({
            completedItems: j.completedItems || [],
            dismissed: !!j.dismissed,
          });
        } else {
          setState({ completedItems: [], dismissed: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ completedItems: [], dismissed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [surface]);

  const completedSet = useMemo(() => {
    const s = new Set<string>(state?.completedItems || []);
    for (const id of autoCompleted) s.add(id);
    return s;
  }, [state?.completedItems, autoCompleted]);

  if (!state || state.dismissed) return null;

  const remaining = items.filter((i) => !completedSet.has(i.id));
  const allDone = remaining.length === 0;

  async function patch(next: { completedItems?: string[]; dismissed?: boolean }) {
    await fetch("/api/me/onboarding-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, ...next }),
    }).catch(() => {});
  }

  async function toggle(id: string) {
    if (pending.has(id)) return;
    setPending((p) => new Set([...p, id]));
    const current = new Set<string>(state?.completedItems || []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    const nextArr = Array.from(current);
    setState((s) => (s ? { ...s, completedItems: nextArr } : s));
    await patch({ completedItems: nextArr });
    setPending((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  }

  async function dismiss() {
    setState((s) => (s ? { ...s, dismissed: true } : s));
    await patch({ dismissed: true });
  }

  return (
    <div
      className={`rounded-xl border-2 border-[#00b4c3] bg-gradient-to-br from-[#00b4c3]/5 to-white p-5 mb-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#00b4c3] mb-1">
            {allDone ? "Setup complete" : "Get started"}
          </p>
          <h2 className="text-lg font-black text-slate-900">
            {allDone
              ? `✓ You're all set. Nice work.`
              : `${items.length - remaining.length} of ${items.length} done — let's finish setup`}
          </h2>
          {!allDone && (
            <ul className="mt-4 space-y-2">
              {items.map((it) => {
                const done = completedSet.has(it.id);
                return (
                  <li
                    key={it.id}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2 border ${
                      done
                        ? "border-emerald-200 bg-emerald-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      onClick={() => toggle(it.id)}
                      aria-pressed={done}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 focus-ring ${
                        done
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-slate-300 hover:border-[#00b4c3] bg-white"
                      } flex items-center justify-center text-xs`}
                      title={done ? "Mark incomplete" : "Mark complete"}
                    >
                      {done ? "✓" : ""}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold ${
                          done ? "text-emerald-800 line-through" : "text-slate-900"
                        }`}
                      >
                        {it.label}
                      </p>
                      {it.hint && (
                        <p className="text-xs text-slate-600 mt-0.5">{it.hint}</p>
                      )}
                      {it.secondaryHref && it.secondaryLabel && (
                        <Link
                          href={it.secondaryHref}
                          className="inline-block text-xs text-[#00b4c3] font-semibold hover:underline mt-1"
                        >
                          {it.secondaryLabel} →
                        </Link>
                      )}
                    </div>
                    {!done && (
                      <Link
                        href={it.href}
                        className="shrink-0 text-xs text-[#00b4c3] font-bold hover:underline focus-ring rounded px-1"
                      >
                        Open →
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {allDone && (
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                ✓ Setup complete
              </span>
              <button
                onClick={dismiss}
                className="text-xs text-slate-600 hover:text-slate-900 focus-ring rounded"
              >
                Hide this card
              </button>
            </div>
          )}
        </div>
        {!allDone && (
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none focus-ring rounded px-1"
            title="Dismiss"
            aria-label="Dismiss onboarding checklist"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
