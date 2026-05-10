"use client";

/**
 * PortalActivityFeed — Phase 8A.
 * Mounted on every portal landing (/brand-portal, /factory-portal,
 * /distributor-portal, /lab-portal). Renders the last 10 events
 * from /api/portal-feed.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

type Severity = "info" | "warn" | "error";

interface FeedEvent {
  id: string;
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  severity: Severity;
  kind: string | null;
  createdAt: string;
}

const SEVERITY_BORDER: Record<Severity, string> = {
  info: "border-l-slate-300",
  warn: "border-l-amber-400",
  error: "border-l-red-500",
};

function relativeTime(iso: string) {
  try {
    const t = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - t);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 14) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function PortalActivityFeed() {
  const { t } = useI18n();
  const tx = t.portalFeed;
  const [events, setEvents] = useState<FeedEvent[] | null>(null);

  useEffect(() => {
    fetch("/api/portal-feed")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvents(j.events || []);
        else setEvents([]);
      })
      .catch(() => setEvents([]));
  }, []);

  if (events === null) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
        <h2 className="text-sm font-bold text-slate-900 mb-1">{tx.header}</h2>
        <p className="text-xs text-slate-400">{tx.loading}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
        <h2 className="text-sm font-bold text-slate-900 mb-1">{tx.header}</h2>
        <p className="text-xs text-slate-500">{tx.empty}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-900">{tx.header}</h2>
        <span className="text-xs text-slate-400">{tx.blurb}</span>
      </div>
      <ul className="space-y-2">
        {events.map((e) => (
          <li
            key={e.id}
            className={`border-l-4 pl-3 py-1.5 ${SEVERITY_BORDER[e.severity]} ${
              e.read ? "opacity-70" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 truncate">{e.title}</p>
              <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                {relativeTime(e.createdAt)}
              </span>
            </div>
            {e.message ? (
              <p className="text-xs text-slate-600 line-clamp-2">{e.message}</p>
            ) : null}
            {e.link ? (
              <Link
                href={e.link}
                className="text-xs font-semibold text-[#00b4c3] hover:underline"
              >
                {tx.goTo}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
