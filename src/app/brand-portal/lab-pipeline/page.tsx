"use client";

/**
 * /brand-portal/lab-pipeline — Phase 4F.
 *
 * Cross-cutting view of every TestRequest + brand-visible TestRun
 * for fabrics in the brand's supply chain.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface PendingRow {
  id: string;
  poNumber: string | null;
  status: string;
  requestedAt: string;
  pricingTier: string | null;
  lab: { id: string; name: string; city: string | null; country: string | null } | null;
  fabric: { id: string; fuzeNumber: number | null; customerCode: string | null } | null;
  submission: {
    id: string;
    factoryId: string | null;
    factory: { id: string; name: string } | null;
    fuzeFabricNumber: number | null;
  } | null;
  lines: Array<{ id: string; testType: string }>;
}

interface ResultRow {
  id: string;
  testType: string;
  testReportNumber: string | null;
  testDate: string | null;
  brandVisible: boolean;
  submission: {
    id: string;
    factoryId: string | null;
    factory: { id: string; name: string } | null;
    fuzeFabricNumber: number | null;
  } | null;
  lab: { id: string; name: string } | null;
  fabric: { id: string; fuzeNumber: number | null } | null;
  icpResult: { agValue: number | null } | null;
  abResult: { pass: boolean | null } | null;
  fungalResult: { pass: boolean | null } | null;
  odorResult: { pass: boolean | null } | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function classifyResult(t: ResultRow): "pass" | "fail" | "pending" {
  if (t.testType === "ICP") {
    if (typeof t.icpResult?.agValue !== "number") return "pending";
    return t.icpResult.agValue >= 0.25 ? "pass" : "fail";
  }
  if (t.testType === "ANTIBACTERIAL") {
    if (t.abResult?.pass === true) return "pass";
    if (t.abResult?.pass === false) return "fail";
    return "pending";
  }
  if (t.testType === "FUNGAL") {
    if (t.fungalResult?.pass === true) return "pass";
    if (t.fungalResult?.pass === false) return "fail";
    return "pending";
  }
  if (t.testType === "ODOR") {
    if (t.odorResult?.pass === true) return "pass";
    if (t.odorResult?.pass === false) return "fail";
    return "pending";
  }
  return "pending";
}

export default function BrandPortalLabPipelinePage() {
  const { t } = useI18n();
  const tx = t.brandPortal.labPipeline;
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [tab, setTab] = useState<"pending" | "results">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand-portal/lab-pipeline")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setPending(j.pending || []);
        setResults(j.results || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-[1300px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${
            tab === "pending" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"
          }`}
        >
          {tx.tabPending.replace("{n}", String(pending.length))}
        </button>
        <button
          onClick={() => setTab("results")}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${
            tab === "results" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"
          }`}
        >
          {tx.tabResults.replace("{n}", String(results.length))}
        </button>
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-500">{tx.noPending}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">{tx.colPo}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colFactory}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colFabric}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colLab}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colTier}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colTests}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colStatus}</th>
                    <th className="text-left px-4 py-3 font-bold">{tx.colRequested}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-[#00b4c3]">
                        {p.poNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {p.submission?.factory?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        FUZE {p.submission?.fuzeFabricNumber || p.fabric?.fuzeNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{p.lab?.name || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{p.pricingTier || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.lines?.length || 0}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(p.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">{tx.noResults}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colReport}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colTest}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFactory}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFabric}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLab}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colDate}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colResult}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => {
                  const cls = classifyResult(r);
                  const pillStyle =
                    cls === "pass"
                      ? "bg-emerald-100 text-emerald-700"
                      : cls === "fail"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600";
                  const label =
                    cls === "pass" ? tx.resultPass : cls === "fail" ? tx.resultFail : tx.resultPending;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">{r.testReportNumber || "—"}</td>
                      <td className="px-4 py-3 text-slate-700">{r.testType}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.submission?.factory?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        FUZE {r.submission?.fuzeFabricNumber || r.fabric?.fuzeNumber || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.lab?.name || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.testDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pillStyle}`}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
