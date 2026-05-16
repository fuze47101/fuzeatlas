"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * TRACK 3 — Tina's admin home activity feed.
 *
 * 30 most-recent events from the last 7 days, auto-refreshes every
 * 60s. Renders explicit error/empty/loading states (standing rule:
 * never silently render zeros).
 */

interface Event {
  id: string;
  type: string;
  actorName: string;
  actorRole: string | null;
  action: string;
  timestamp: string;
  link: string;
  entityName?: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  FABRIC_SUBMISSION: "🧵",
  FUZE_ORDER: "📦",
  TEST_REQUEST: "🧪",
  USER_REGISTERED: "👤",
  SAMPLE_TRIAL: "🧫",
  OUTREACH: "📧",
  MEETING: "📅",
};

const TYPE_COLORS: Record<string, string> = {
  FABRIC_SUBMISSION: "bg-cyan-50 text-cyan-700",
  FUZE_ORDER: "bg-indigo-50 text-indigo-700",
  TEST_REQUEST: "bg-amber-50 text-amber-700",
  USER_REGISTERED: "bg-emerald-50 text-emerald-700",
  SAMPLE_TRIAL: "bg-violet-50 text-violet-700",
  OUTREACH: "bg-slate-50 text-slate-700",
  MEETING: "bg-rose-50 text-rose-700",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function HomeActivityFeed() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch("/api/admin/home-activity");
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || `HTTP ${res.status}`);
        return;
      }
      setEvents(j.events || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <p className="text-sm text-slate-500">Loading activity…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
        <p className="font-bold text-red-700 mb-1">Couldn't load activity feed</p>
        <p className="text-red-600 text-xs mb-2">{error}</p>
        <button
          onClick={load}
          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  const types = Array.from(new Set(events.map((e) => e.type)));
  const filtered = filter ? events.filter((e) => e.type === filter) : events;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Recent activity</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Last 7 days · auto-refreshes every minute
          </p>
        </div>
        <Link href="/admin/audit-log" className="text-[10px] text-[#00b4c3] font-semibold hover:underline">
          Full audit log →
        </Link>
      </div>

      {/* Filter chips */}
      {types.length > 1 && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              !filter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({events.length})
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? null : t)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                filter === t
                  ? "bg-slate-900 text-white"
                  : `${TYPE_COLORS[t] || "bg-slate-100 text-slate-600"} hover:opacity-80`
              }`}
            >
              {TYPE_ICONS[t] || "•"} {t.replace(/_/g, " ").toLowerCase()} ({events.filter((e) => e.type === t).length})
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Nothing in this window yet. Activity will land here as it happens.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((e) => (
            <li key={e.id} className="py-2 flex items-start gap-3 text-sm">
              <span className="text-base shrink-0 mt-0.5">{TYPE_ICONS[e.type] || "•"}</span>
              <div className="flex-1 min-w-0">
                <Link href={e.link} className="text-slate-800 hover:text-[#00b4c3] block">
                  <span className="font-semibold">{e.actorName}</span>
                  {e.actorRole && (
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({e.actorRole.replace(/_/g, " ").toLowerCase()})
                    </span>
                  )}{" "}
                  <span className="text-slate-600">{e.action}</span>
                </Link>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(e.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
