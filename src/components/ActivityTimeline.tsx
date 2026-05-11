"use client";

/**
 * <ActivityTimeline events={...} /> — Phase 14H.
 *
 * Pure presentational. Takes a normalized event array, renders a
 * vertical timeline with date / actor / type / description / link.
 *
 * Callers (e.g. /brands/[id] Activity tab) build the event list
 * from any combination of Note, Notification, AuditLog,
 * BrandStageTransition rows etc. and pass them in.
 *
 * Event normalization shape:
 *   { id, kind, at, actor, title, body?, link?, severity? }
 */
import Link from "next/link";

export interface TimelineEvent {
  id: string;
  kind: string; // "note" | "stage_change" | "approval" | "upload" | ...
  at: string | Date;
  actor?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  severity?: "info" | "warn" | "error" | "success";
}

const KIND_ICON: Record<string, string> = {
  note: "📝",
  stage_change: "🔁",
  approval: "✓",
  rejection: "✕",
  upload: "📤",
  email: "📧",
  meeting: "🤝",
  test_result: "🧪",
  order: "📦",
  spec_change: "📋",
  default: "•",
};

const SEV_RING: Record<NonNullable<TimelineEvent["severity"]>, string> = {
  info: "bg-slate-200",
  warn: "bg-amber-400",
  error: "bg-red-500",
  success: "bg-emerald-500",
};

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h ago`;
  if (abs < 30 * 86_400_000) return `${Math.round(abs / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

export default function ActivityTimeline({
  events,
  className = "",
  emptyMessage = "No activity yet.",
}: {
  events: TimelineEvent[];
  className?: string;
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600 ${className}`}>
        {emptyMessage}
      </div>
    );
  }
  // Newest first.
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <ol className={`relative border-l-2 border-slate-200 pl-6 space-y-5 ${className}`}>
      {sorted.map((e) => {
        const d = e.at instanceof Date ? e.at : new Date(e.at);
        const icon = KIND_ICON[e.kind] || KIND_ICON.default;
        const sev = e.severity || "info";
        return (
          <li key={e.id} className="relative">
            <span
              className={`absolute -left-[33px] top-1 w-4 h-4 rounded-full ring-2 ring-white ${SEV_RING[sev]} flex items-center justify-center text-[9px]`}
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-bold text-slate-900 text-sm">{e.title}</p>
              <p className="text-[11px] text-slate-500 shrink-0" title={d.toLocaleString()}>
                {relative(d)}
              </p>
            </div>
            {e.body && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{e.body}</p>}
            <div className="flex items-center gap-3 mt-1">
              {e.actor && (
                <span className="text-[11px] text-slate-500">by {e.actor}</span>
              )}
              {e.link && (
                <Link href={e.link} className="text-[11px] text-[#00b4c3] hover:underline focus-ring">
                  Open →
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
