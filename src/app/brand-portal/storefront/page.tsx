"use client";

/**
 * /brand-portal/storefront — Phase 12G.
 *
 * Brand-owner view of the public surface: 30-day traffic + QR scan
 * totals + top paths + top referrers, scoped to caller's brand.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Payload {
  ok: boolean;
  windowDays: number;
  totalViews: number;
  topPaths: { path: string; count: number }[];
  topReferers: { referer: string; count: number }[];
  qrTotalScans: number;
  qrTokenCount: number;
}

export default function StorefrontTrafficPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.storefrontPage;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand-portal/storefront")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Public-page visits + QR hangtag scans over the last {data.windowDays}{" "}
          days.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Tile label="Page views (30d)" value={data.totalViews} />
        <Tile label="QR scans (lifetime)" value={data.qrTotalScans} />
        <Tile label="QR tokens minted" value={data.qrTokenCount} />
        <Tile label="Top path" value={data.topPaths[0]?.path || "—"} mono small />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Top pages</h2>
          {data.topPaths.length === 0 ? (
            <p className="text-xs text-slate-400">No views yet.</p>
          ) : (
            <ul className="text-sm divide-y divide-slate-100">
              {data.topPaths.map((p) => (
                <li key={p.path} className="flex justify-between py-1.5">
                  <span className="font-mono text-xs truncate max-w-[60%]">
                    {p.path}
                  </span>
                  <span className="font-bold tabular-nums">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Top referrers</h2>
          {data.topReferers.length === 0 ? (
            <p className="text-xs text-slate-400">No referrers tracked.</p>
          ) : (
            <ul className="text-sm divide-y divide-slate-100">
              {data.topReferers.map((r) => (
                <li key={r.referer} className="flex justify-between py-1.5">
                  <span className="text-xs truncate max-w-[60%]">
                    {r.referer}
                  </span>
                  <span className="font-bold tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mt-6">
        Visits sourced from a client-side beacon — bots are filtered by a basic
        UA heuristic. IPs are SHA-256 hashed (first 8 chars) for unique-visitor
        estimation only; we never store raw IPs.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>
      <p
        className={`font-black text-slate-900 ${
          small ? "text-base" : "text-2xl"
        } ${mono ? "font-mono" : "tabular-nums"} truncate`}
      >
        {value}
      </p>
    </div>
  );
}
