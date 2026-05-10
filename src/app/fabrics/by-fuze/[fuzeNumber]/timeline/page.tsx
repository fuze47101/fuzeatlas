"use client";

/**
 * /fabrics/by-fuze/[fuzeNumber]/timeline — Phase 8B.
 *
 * "Where is FUZE-2503 right now?" answer. Vertical timeline
 * grouped by month with filter chips. Permission gated server-
 * side via /api/fabrics/by-fuze/[fuzeNumber]/timeline.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";

type EventKind =
  | "fabric_created"
  | "submission"
  | "test_request"
  | "test_run"
  | "recipe_graduated"
  | "order_placed"
  | "consumption"
  | "approval";

type Severity = "info" | "warn" | "error";

interface TimelineEvent {
  type: EventKind;
  timestamp: string;
  actor: string | null;
  summary: string;
  severity: Severity;
  deepLinkUrl: string | null;
}

interface FabricInfo {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  construction: string | null;
  color: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
}

const SEVERITY_DOT: Record<Severity, string> = {
  info: "bg-slate-400",
  warn: "bg-amber-500",
  error: "bg-red-600",
};

const TYPE_LABEL: Record<EventKind, string> = {
  fabric_created: "Created",
  submission: "Submission",
  test_request: "Test request",
  test_run: "Test",
  recipe_graduated: "Recipe",
  order_placed: "Order",
  consumption: "Consumption",
  approval: "Approval",
};

function monthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}
function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FILTER_KEYS: Array<{ key: string; types: EventKind[] }> = [
  { key: "filterAll", types: [] },
  { key: "filterSubmissions", types: ["submission"] },
  { key: "filterTests", types: ["test_run", "test_request"] },
  { key: "filterRecipes", types: ["recipe_graduated"] },
  { key: "filterOrders", types: ["order_placed"] },
  { key: "filterConsumption", types: ["consumption"] },
];

export default function FabricTimelinePage() {
  const params = useParams<{ fuzeNumber: string }>();
  const fuzeNumber = params?.fuzeNumber as string | undefined;

  const { t } = useI18n();
  const tx = t.fabricTimeline;

  const [fabric, setFabric] = useState<FabricInfo | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("filterAll");

  useEffect(() => {
    if (!fuzeNumber) return;
    fetch(`/api/fabrics/by-fuze/${encodeURIComponent(fuzeNumber)}/timeline`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          if (j.error?.toLowerCase().includes("forbidden")) setError(tx.forbidden);
          else if (j.error?.toLowerCase().includes("not found")) setError(tx.notFound);
          else setError(j.error || "Failed to load");
          return;
        }
        setFabric(j.fabric);
        setEvents(j.events || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fuzeNumber]);

  const filtered = useMemo(() => {
    const def = FILTER_KEYS.find((f) => f.key === activeFilter);
    if (!def || def.types.length === 0) return events;
    return events.filter((e) => def.types.includes(e.type));
  }, [events, activeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const e of filtered) {
      const k = monthKey(e.timestamp);
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }
  if (error || !fabric) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || tx.notFound}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href={`/fabrics/${fabric.id}`} className="hover:text-[#00b4c3]">
              FUZE {fabric.fuzeNumber}
            </Link>
            <span>›</span>
            <span>{tx.crumbCurrent}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {tx.pageTitle.replace("{n}", String(fabric.fuzeNumber))}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {tx.pageSubtitle.replace("{n}", String(fabric.fuzeNumber))}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            {fabric.brand?.name ? <span>Brand: {fabric.brand.name}</span> : null}
            {fabric.factory?.name ? <span>Factory: {fabric.factory.name}</span> : null}
            {fabric.construction ? <span>{fabric.construction}</span> : null}
            {fabric.color ? <span>{fabric.color}</span> : null}
          </div>
        </div>
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="hidden sm:inline-block px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          {tx.print}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_KEYS.map((f) => {
          const label = (tx as any)[f.key] || f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                activeFilter === f.key
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500">{tx.empty}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, list]) => (
            <section key={month}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                {month}
              </h2>
              <ol className="relative border-l-2 border-slate-200 pl-6 space-y-4">
                {list.map((e, i) => (
                  <li key={`${e.type}-${e.timestamp}-${i}`}>
                    <span
                      className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white ${SEVERITY_DOT[e.severity]}`}
                      aria-hidden="true"
                    />
                    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-2">
                            {TYPE_LABEL[e.type]}
                          </span>
                          {e.summary}
                        </p>
                        <span className="text-xs text-slate-400">{dayLabel(e.timestamp)}</span>
                      </div>
                      {e.actor ? (
                        <p className="text-xs text-slate-500 mt-1">{e.actor}</p>
                      ) : null}
                      {e.deepLinkUrl ? (
                        <Link
                          href={e.deepLinkUrl}
                          className="text-xs font-bold text-[#00b4c3] hover:underline mt-1 inline-block"
                        >
                          Open →
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
