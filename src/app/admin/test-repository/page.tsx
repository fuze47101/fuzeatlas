"use client";

/**
 * /admin/test-repository — Phase 10E.
 *
 * Filterable archive of every TestRun. Sidebar facets, sortable
 * row table, side-by-side compare, CSV export, aggregate stats
 * footer.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Row {
  id: string;
  testType: string;
  testReportNumber: string | null;
  testMethodStd: string | null;
  testDate: string | null;
  washCount: number | null;
  brandVisible: boolean;
  brandApprovalStatus: string | null;
  lab: { id: string; name: string } | null;
  icpResult: { agValue: number | null; unit: string | null } | null;
  abResult: { organism1: string | null; result1: number | null; result2: number | null; pass: boolean | null } | null;
  fungalResult: { pass: boolean | null } | null;
  odorResult: { pass: boolean | null } | null;
  submission: {
    id: string;
    fuzeFabricNumber: number | null;
    fuzeTier: string | null;
    brand: { id: string; name: string } | null;
    factory: { id: string; name: string; country: string | null } | null;
    fabric: {
      id: string;
      fuzeNumber: number | null;
      customerCode: string | null;
      construction: string | null;
      weightGsm: number | null;
      fabricCategory: string | null;
    } | null;
  } | null;
}

interface Payload {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
  aggregates: {
    count: number;
    passRate: number;
    abReduction: { mean: number | null; std: number | null };
    icpAg: { mean: number | null; std: number | null };
  };
}

const TEST_TYPES = ["", "ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER"];
const TIERS = ["", "F1", "F2", "F3", "F4"];

export default function TestRepositoryPage() {
  const [filters, setFilters] = useState({
    testType: "",
    fuzeTier: "",
    passed: "",
    washCountMin: "",
    washCountMax: "",
    from: "",
    to: "",
    brandId: "",
    factoryId: "",
    labId: "",
  });
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) qs.set(k, v);
    }
    const res = await fetch(`/api/admin/test-repository?${qs.toString()}`);
    const j = await res.json();
    setData(j);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRows = useMemo(
    () => (data?.rows || []).filter((r) => selected.has(r.id)),
    [data, selected],
  );

  function exportCsv() {
    if (!data?.rows) return;
    const headers = [
      "id",
      "testType",
      "testDate",
      "lab",
      "brand",
      "factory",
      "fabricFuze",
      "fuzeTier",
      "washCount",
      "report",
      "icpAg",
      "abResult1",
      "abResult2",
      "passed",
      "approvalStatus",
    ];
    const lines = [headers.join(",")];
    for (const r of data.rows) {
      const row = [
        r.id,
        r.testType,
        r.testDate || "",
        r.lab?.name || "",
        r.submission?.brand?.name || "",
        r.submission?.factory?.name || "",
        r.submission?.fuzeFabricNumber || r.submission?.fabric?.fuzeNumber || "",
        r.submission?.fuzeTier || "",
        r.washCount ?? "",
        r.testReportNumber || "",
        r.icpResult?.agValue ?? "",
        r.abResult?.result1 ?? "",
        r.abResult?.result2 ?? "",
        r.abResult?.pass ?? r.fungalResult?.pass ?? r.odorResult?.pass ?? "",
        r.brandApprovalStatus || "",
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `test-repository-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Test repository</h1>
          <p className="text-sm text-slate-500">
            Every TestRun queryable. Compare {selected.size} selected · Export CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={selected.size < 2}
            onClick={() => setShowCompare(!showCompare)}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {showCompare ? "Close compare" : `Compare (${selected.size})`}
          </button>
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <select
          value={filters.testType}
          onChange={(e) => setFilters({ ...filters, testType: e.target.value })}
          className="px-2 py-1 border border-slate-300 rounded text-sm"
        >
          {TEST_TYPES.map((t) => (
            <option key={t} value={t}>
              {t || "any type"}
            </option>
          ))}
        </select>
        <select
          value={filters.fuzeTier}
          onChange={(e) => setFilters({ ...filters, fuzeTier: e.target.value })}
          className="px-2 py-1 border border-slate-300 rounded text-sm"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t || "any tier"}
            </option>
          ))}
        </select>
        <select
          value={filters.passed}
          onChange={(e) => setFilters({ ...filters, passed: e.target.value })}
          className="px-2 py-1 border border-slate-300 rounded text-sm"
        >
          <option value="">any result</option>
          <option value="true">passed</option>
          <option value="false">failed</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          className="px-2 py-1 border border-slate-300 rounded text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          className="px-2 py-1 border border-slate-300 rounded text-sm"
        />
        <button
          onClick={load}
          className="px-3 py-1 bg-[#00b4c3] text-white rounded text-sm font-bold hover:bg-[#009aa8]"
        >
          {loading ? "…" : "Apply"}
        </button>
      </div>

      {/* Aggregate footer / header */}
      {data?.aggregates && data.aggregates.count > 0 && (
        <div className="rounded-xl border border-slate-200 bg-indigo-50/40 p-4 mb-4 text-sm">
          <span className="font-bold text-indigo-900">
            {data.aggregates.count} test{data.aggregates.count === 1 ? "" : "s"} match
          </span>
          <span className="ml-3 text-slate-600">
            pass rate <b>{(data.aggregates.passRate * 100).toFixed(1)}%</b>
          </span>
          {data.aggregates.icpAg.mean != null && (
            <span className="ml-3 text-slate-600">
              avg ICP Ag <b>{data.aggregates.icpAg.mean.toFixed(2)}</b> ppm (σ {data.aggregates.icpAg.std?.toFixed(2)})
            </span>
          )}
          {data.aggregates.abReduction.mean != null && (
            <span className="ml-3 text-slate-600">
              avg AB reduction <b>{data.aggregates.abReduction.mean.toFixed(2)}</b> log (σ {data.aggregates.abReduction.std?.toFixed(2)})
            </span>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-center px-2 py-2 w-10"></th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Brand</th>
              <th className="text-left px-3 py-2">Factory</th>
              <th className="text-left px-3 py-2">Fabric</th>
              <th className="text-left px-3 py-2">Tier</th>
              <th className="text-left px-3 py-2">Lab</th>
              <th className="text-right px-3 py-2">Wash</th>
              <th className="text-left px-3 py-2">Result</th>
              <th className="text-left px-3 py-2">Approval</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.rows || []).map((r) => {
              const result =
                r.testType === "ICP" && r.icpResult?.agValue != null
                  ? `Ag ${r.icpResult.agValue.toFixed(2)} ${r.icpResult.unit || "ppm"}`
                  : r.testType === "ANTIBACTERIAL" && r.abResult?.result1 != null
                    ? `${r.abResult.result1.toFixed(1)} log${r.abResult.result2 != null ? ` / ${r.abResult.result2.toFixed(1)}` : ""}`
                    : r.fungalResult?.pass !== undefined
                      ? r.fungalResult.pass
                        ? "PASS"
                        : "FAIL"
                      : r.odorResult?.pass !== undefined
                        ? r.odorResult.pass
                          ? "PASS"
                          : "FAIL"
                        : "—";
              const fuzeNum =
                r.submission?.fuzeFabricNumber || r.submission?.fabric?.fuzeNumber || null;
              return (
                <tr
                  key={r.id}
                  className={selected.has(r.id) ? "bg-amber-50/40" : "hover:bg-slate-50"}
                >
                  <td className="text-center px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(r.id) : next.delete(r.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.testDate ? new Date(r.testDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 font-bold text-slate-900">{r.testType}</td>
                  <td className="px-3 py-2">
                    {r.submission?.brand ? (
                      <Link
                        href={`/brands/${r.submission.brand.id}`}
                        className="text-[#00b4c3] hover:underline"
                      >
                        {r.submission.brand.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.submission?.factory?.name || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 font-mono text-xs">
                    {fuzeNum ? `FUZE-${fuzeNum}` : "—"}
                    {r.submission?.fabric?.customerCode && (
                      <span className="text-slate-400"> · {r.submission.fabric.customerCode}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.submission?.fuzeTier || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{r.lab?.name || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.washCount ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{result}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.brandApprovalStatus ? (
                      <span
                        className={
                          r.brandApprovalStatus === "APPROVED"
                            ? "text-emerald-700"
                            : r.brandApprovalStatus === "REJECTED"
                              ? "text-red-700"
                              : "text-amber-700"
                        }
                      >
                        {r.brandApprovalStatus}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {data?.rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-10 text-slate-400">
                  No tests match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCompare && selectedRows.length >= 2 && (
        <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50/40 p-4">
          <h2 className="font-bold text-slate-900 mb-3">Compare</h2>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="text-left px-3 py-1 text-xs uppercase text-slate-500"></th>
                  {selectedRows.map((r) => (
                    <th key={r.id} className="text-left px-3 py-1 text-xs font-bold">
                      {r.testReportNumber || r.id.slice(-6)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {[
                  ["Test type", (r: Row) => r.testType],
                  ["Date", (r: Row) => (r.testDate ? new Date(r.testDate).toLocaleDateString() : "—")],
                  ["Brand", (r: Row) => r.submission?.brand?.name || "—"],
                  ["Factory", (r: Row) => r.submission?.factory?.name || "—"],
                  ["Tier", (r: Row) => r.submission?.fuzeTier || "—"],
                  ["Wash count", (r: Row) => r.washCount ?? "—"],
                  ["Lab", (r: Row) => r.lab?.name || "—"],
                  [
                    "ICP Ag",
                    (r: Row) =>
                      r.icpResult?.agValue != null ? `${r.icpResult.agValue.toFixed(2)} ppm` : "—",
                  ],
                  [
                    "AB result 1",
                    (r: Row) =>
                      r.abResult?.result1 != null ? `${r.abResult.result1.toFixed(2)} log` : "—",
                  ],
                  [
                    "Pass?",
                    (r: Row) =>
                      r.abResult?.pass ?? r.fungalResult?.pass ?? r.odorResult?.pass ?? "—",
                  ],
                ].map(([label, fn]: any) => (
                  <tr key={label}>
                    <td className="px-3 py-1 text-xs uppercase text-slate-500 font-bold">{label}</td>
                    {selectedRows.map((r) => (
                      <td key={r.id} className="px-3 py-1 font-mono">
                        {String(fn(r))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
