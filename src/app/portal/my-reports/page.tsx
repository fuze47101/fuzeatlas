// @ts-nocheck
"use client";

/**
 * /portal/my-reports
 *
 * Customer-facing landing for the Full Application Reports they've
 * received. Lists every report visible to the logged-in user, sorted
 * newest-first, searchable by fabric reference / brand / FUZE number.
 *
 * Each row links to /report/[token] which opens the full report
 * without a download or extra step. Internal users see all reports
 * (handy for support).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

interface Report {
  id: string;
  token: string;
  recipientEmail: string;
  recipientName: string | null;
  sentAt: string;
  expiresAt: string;
  viewedCount: number;
  lastViewedAt: string | null;
  revokedAt: string | null;
  tier: string;
  subjectLine: string | null;
  fabric: {
    id: string;
    fuzeNumber: number | null;
    customerCode: string | null;
    factoryCode: string | null;
    customerReference: string | null;
    fabricCategory: string | null;
    color: string | null;
    weightGsm: number | null;
    brand: { id: string; name: string } | null;
    factory: { id: string; name: string } | null;
  };
}

export default function MyReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const url = q
          ? `/api/portal/my-reports?q=${encodeURIComponent(q)}`
          : `/api/portal/my-reports`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.ok) setReports(json.reports);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, q]);

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">My Reports</h1>
        <p className="text-slate-600 mt-1">
          FUZE Application & Validation Reports issued to you. Click any
          report to open it — no download required.
        </p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by your reference, item #, FUZE number, or brand..."
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">📄</span>
          <p className="text-slate-600 font-semibold mb-1">
            No reports yet.
          </p>
          <p className="text-slate-500 text-sm">
            When FUZE Biotech sends you an Application & Validation
            Report, it will appear here. Reports are sorted newest-first
            and searchable by your customer reference, item number, FUZE
            number, or brand.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const expired = new Date(r.expiresAt).getTime() < Date.now();
            return (
              <Link
                key={r.id}
                href={`/report/${r.token}`}
                className={`block bg-white border rounded-xl p-4 hover:shadow-md transition ${
                  expired
                    ? "border-slate-200 opacity-60"
                    : "border-slate-200 hover:border-[#00b4c3]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                      {r.fabric.brand?.name || "—"}
                      {r.fabric.factory?.name && (
                        <> · {r.fabric.factory.name}</>
                      )}
                    </p>
                    <p className="text-lg font-black text-slate-900 mt-0.5">
                      {r.fabric.customerReference ||
                        r.fabric.customerCode ||
                        `FUZE-${r.fabric.fuzeNumber}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2">
                      <span>
                        FUZE-
                        <span className="font-mono">{r.fabric.fuzeNumber}</span>
                      </span>
                      {r.fabric.customerCode && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>
                            customer #{" "}
                            <span className="font-mono">
                              {r.fabric.customerCode}
                            </span>
                          </span>
                        </>
                      )}
                      {r.fabric.factoryCode && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>
                            factory #{" "}
                            <span className="font-mono">
                              {r.fabric.factoryCode}
                            </span>
                          </span>
                        </>
                      )}
                      {r.fabric.fabricCategory && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="capitalize">
                            {r.fabric.fabricCategory}
                          </span>
                        </>
                      )}
                      {r.fabric.weightGsm && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span>{r.fabric.weightGsm} g/m²</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500 whitespace-nowrap">
                    <p className="font-bold text-[#00b4c3]">{r.tier}</p>
                    <p className="mt-1">Sent {fmtDate(r.sentAt)}</p>
                    {expired ? (
                      <p className="text-amber-600 font-semibold">expired</p>
                    ) : (
                      <p>expires {fmtDate(r.expiresAt)}</p>
                    )}
                    {r.viewedCount > 0 && (
                      <p className="text-slate-400 mt-1">
                        viewed {r.viewedCount}×
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-6">
        Direct download links in your email stay live for 90 days. After
        expiry, sign in here to pull a fresh copy with any new lab
        results. Trouble? Reply to the email this report came from — it
        routes to your FUZE account manager.
      </p>
    </div>
  );
}
