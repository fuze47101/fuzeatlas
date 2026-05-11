"use client";

/**
 * <NextActionPanel actions={...} /> — Phase 14G.
 *
 * Renders the "Suggested next action" list near the top of every
 * entity detail page. Source the `actions` from one of the
 * heuristic helpers in src/lib/next-action.ts.
 */
import Link from "next/link";
import type { NextAction } from "@/lib/next-action";

const SEV_STYLE: Record<NextAction["severity"], string> = {
  error: "border-red-400 bg-red-50 text-red-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-indigo-200 bg-indigo-50/40 text-indigo-900",
};
const SEV_ICON: Record<NextAction["severity"], string> = {
  error: "⚠",
  warn: "⏰",
  info: "💡",
};

export default function NextActionPanel({
  actions,
  className = "",
}: {
  actions: NextAction[];
  className?: string;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <aside className={`space-y-2 ${className}`}>
      <h2 className="text-xs uppercase tracking-wider text-slate-600 font-bold">
        Suggested next action{actions.length > 1 ? "s" : ""}
      </h2>
      {actions.map((a, i) => (
        <Link
          key={`${a.kind}-${i}`}
          href={a.href}
          className={`block rounded-xl border-l-4 p-4 hover:shadow-md transition-all focus-ring ${SEV_STYLE[a.severity]}`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xl leading-none">{SEV_ICON[a.severity]}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold">{a.title}</p>
              <p className="text-sm mt-1 opacity-90">{a.body}</p>
            </div>
            <span className="text-xs font-bold opacity-70">→</span>
          </div>
        </Link>
      ))}
    </aside>
  );
}
