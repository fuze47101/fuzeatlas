"use client";

/**
 * /admin/bd/calendar — Phase 9G.
 *
 * Weekly grid of upcoming BD touchpoints. Sources are merged on
 * the server (see /api/admin/bd/calendar): meetings + open
 * CrmTasks + scheduled BDSequence steps + brand engagement
 * warnings (75d+ inactivity).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Item {
  kind: "MEETING" | "TASK" | "SEQUENCE_STEP" | "WARNING";
  id: string;
  at: string;
  title: string;
  brandId: string | null;
  brandName: string | null;
  meta: any;
  link: string | null;
}

interface Payload {
  ok: boolean;
  from: string;
  to: string;
  mine: boolean;
  items: Item[];
}

const KIND_STYLES: Record<Item["kind"], string> = {
  MEETING: "bg-blue-50 text-blue-700 border-blue-200",
  TASK: "bg-amber-50 text-amber-700 border-amber-200",
  SEQUENCE_STEP: "bg-indigo-50 text-indigo-700 border-indigo-200",
  WARNING: "bg-red-50 text-red-700 border-red-200",
};
const KIND_ICON: Record<Item["kind"], string> = {
  MEETING: "🤝",
  TASK: "✅",
  SEQUENCE_STEP: "📤",
  WARNING: "⚠",
};

function startOfWeek(d: Date) {
  const out = new Date(d);
  const day = out.getDay();
  out.setDate(out.getDate() - day);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function CalendarPage() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [data, setData] = useState<Payload | null>(null);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = anchor;
  const weekEnd = useMemo(() => addDays(anchor, 6), [anchor]);

  useEffect(() => {
    const from = new Date(weekStart).toISOString();
    const to = addDays(weekEnd, 1).toISOString();
    const url = `/api/admin/bd/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${mine ? "&mine=1" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "Failed");
      })
      .catch((e) => setError(e.message));
  }, [weekStart, weekEnd, mine]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    if (!data) return map;
    for (const item of data.items) {
      const d = new Date(item.at);
      const key = d.toDateString();
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [data]);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/admin/bd" className="hover:text-[#00b4c3]">BD</Link>
            <span>·</span>
            <span className="text-slate-800 font-medium">Calendar</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            Touchpoint calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {fmtDay(weekStart)} – {fmtDay(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50"
            onClick={() => setAnchor(addDays(anchor, -7))}
          >
            ← Prev
          </button>
          <button
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50"
            onClick={() => setAnchor(startOfWeek(new Date()))}
          >
            This week
          </button>
          <button
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm hover:bg-slate-50"
            onClick={() => setAnchor(addDays(anchor, 7))}
          >
            Next →
          </button>
          <label className="ml-2 inline-flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setMine(e.target.checked)}
            />
            Mine only
          </label>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
        {days.map((d) => {
          const items = byDay.get(d.toDateString()) || [];
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div
              key={d.toISOString()}
              className={`rounded-xl border ${isToday ? "border-[#00b4c3]" : "border-slate-200"} bg-white p-3 min-h-[180px]`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className={`text-lg font-black ${isToday ? "text-[#00b4c3]" : "text-slate-900"}`}>
                  {d.getDate()}
                </p>
              </div>
              <div className="space-y-1.5">
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-300">no touchpoints</p>
                ) : (
                  items.map((it) => (
                    <Link
                      key={it.id}
                      href={it.link || "#"}
                      className={`block rounded-md border px-2 py-1 text-[11px] ${KIND_STYLES[it.kind]} hover:opacity-80`}
                    >
                      <span className="mr-1">{KIND_ICON[it.kind]}</span>
                      <span className="font-semibold">{it.title}</span>
                      {it.brandName && (
                        <div className="text-[10px] opacity-70 truncate">
                          {it.brandName}
                        </div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
