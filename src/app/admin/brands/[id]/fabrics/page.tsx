"use client";

/**
 * /admin/brands/[id]/fabrics — Brand fabric portfolio view.
 *
 * Replaces the per-brand spreadsheet Tina previously maintained
 * (SanMar / KUIU / etc.). Shows every fabric linked to a brand
 * across all factories, with workflow status, ICP / AM rollup,
 * latest test date and ICP value, and editable developmentStatus.
 *
 * Built May 18 — Tina spreadsheet replacement.
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";
import {
  FABRIC_DEV_STATUSES,
  FABRIC_DEV_STATUS_LABEL,
  FABRIC_DEV_STATUS_COLOR,
  FabricDevStatus,
} from "@/lib/fabric-development-status";

interface FabricRow {
  id: string;
  fuzeNumber: number | null;
  factory: { id: string | null; name: string } | null;
  factoryCode: string | null;
  customerCode: string | null;
  customerReference: string | null;
  type: string | null;
  content: string | null;
  weightGsm: number | null;
  targetFuzeTier: string | null;
  developmentStatus: FabricDevStatus | null;
  trialComplete: boolean;
  hasIcpResult: boolean;
  hasAmResult: boolean;
  latestIcpValue: number | null;
  latestIcpUnit: string;
  latestTestDate: string | null;
  testRunCount: number;
  submissionId: string | null;
  submissionStatus: string | null;
}

interface Group {
  factory: { id: string | null; name: string };
  rows: FabricRow[];
}

interface ApiResponse {
  ok: boolean;
  brand: { id: string; name: string; pipelineStage: string };
  total: number;
  rows: FabricRow[];
  grouped: Group[];
}

export default function BrandFabricsPage() {
  const { t } = useI18n();
  const T = t.brandFabricsAdmin;
  const params = useParams<{ id: string }>();
  const brandId = params.id;

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [factoryFilter, setFactoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Inline status save state
  const [savingFabricId, setSavingFabricId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`/api/admin/brands/${brandId}/fabrics`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || T.errorFailedLoad);
      setData(j);
    } catch (e: any) {
      setError(e?.message || T.errorFailedLoad);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function updateStatus(fabricId: string, newStatus: FabricDevStatus | null) {
    setSavingFabricId(fabricId);
    setSaveError(null);
    try {
      const r = await fetch(`/api/admin/fabrics/${fabricId}/development-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || T.errorSave);
      // Optimistic update locally
      if (data) {
        setData({
          ...data,
          rows: data.rows.map((row) =>
            row.id === fabricId ? { ...row, developmentStatus: newStatus } : row,
          ),
          grouped: data.grouped.map((g) => ({
            ...g,
            rows: g.rows.map((row) =>
              row.id === fabricId ? { ...row, developmentStatus: newStatus } : row,
            ),
          })),
        });
      }
    } catch (e: any) {
      setSaveError(e?.message || T.errorSave);
    } finally {
      setSavingFabricId(null);
    }
  }

  // Apply filters to grouped data
  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.grouped
      .map((g) => {
        if (factoryFilter !== "ALL" && (g.factory.id || "_none") !== factoryFilter) {
          return { ...g, rows: [] };
        }
        const rows = g.rows.filter((r) => {
          if (statusFilter !== "ALL" && r.developmentStatus !== statusFilter) return false;
          if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
          if (q) {
            const blob = [
              r.factoryCode,
              r.customerCode,
              r.customerReference,
              r.content,
              String(r.fuzeNumber ?? ""),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!blob.includes(q)) return false;
          }
          return true;
        });
        return { ...g, rows };
      })
      .filter((g) => g.rows.length > 0);
  }, [data, statusFilter, typeFilter, factoryFilter, search]);

  const filteredTotal = filteredGroups.reduce((sum, g) => sum + g.rows.length, 0);

  function downloadCsv() {
    if (!data) return;
    const headers = [
      "Mill",
      "FUZE #",
      "Mill Fabric #",
      "Type",
      "Content",
      "Weight (gsm)",
      "Customer Code",
      "Customer Reference",
      "Trial Complete",
      "ICP Result",
      "Antimicrobial Result",
      "ICP Value",
      "ICP Unit",
      "Latest Test Date",
      "Target Tier",
      "Status",
    ];
    const lines = [headers.join(",")];
    for (const g of filteredGroups) {
      for (const r of g.rows) {
        const cells = [
          g.factory.name,
          r.fuzeNumber != null ? `FUZE-${r.fuzeNumber}` : "",
          r.factoryCode || "",
          r.type || "",
          r.content || "",
          r.weightGsm != null ? String(r.weightGsm) : "",
          r.customerCode || "",
          r.customerReference || "",
          r.trialComplete ? "YES" : "NO",
          r.hasIcpResult ? "YES" : "NO",
          r.hasAmResult ? "YES" : "NO",
          r.latestIcpValue != null ? String(r.latestIcpValue) : "",
          r.latestIcpUnit || "",
          r.latestTestDate ? new Date(r.latestTestDate).toISOString().slice(0, 10) : "",
          r.targetFuzeTier || "",
          r.developmentStatus ? FABRIC_DEV_STATUS_LABEL[r.developmentStatus] : "",
        ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
        lines.push(cells.join(","));
      }
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (data.brand.name || "brand").replace(/[^a-z0-9-]+/gi, "_");
    a.download = `${safeName}-fabric-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-sm text-slate-500">{T.loading}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          <div className="font-bold mb-1">{T.errorTitle}</div>
          <div>{error || T.errorUnknown}</div>
          <button
            onClick={load}
            className="mt-3 px-3 py-1.5 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700"
          >
            {T.btnTryAgain}
          </button>
        </div>
      </div>
    );
  }

  const allFactories = data.grouped.map((g) => g.factory);

  return (
    <div className="max-w-[1800px] mx-auto p-4 md:p-6">
      {/* Breadcrumb + header */}
      <div className="text-xs text-slate-500 mb-2">
        <Link href="/brands" className="hover:text-slate-700">{T.crumbPartners}</Link>{" "}
        <span className="mx-1">›</span>{" "}
        <Link href={`/brands/${data.brand.id}`} className="hover:text-slate-700">{data.brand.name}</Link>{" "}
        <span className="mx-1">›</span>{" "}
        <span className="text-slate-700 font-medium">{T.crumbHere}</span>
      </div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            {data.brand.name} {T.titleSuffix}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.subtitle.replace("{shown}", String(filteredTotal)).replace("{total}", String(data.total))}
          </p>
        </div>
        <button
          onClick={downloadCsv}
          className="shrink-0 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          {T.btnExportCsv}
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={T.searchPlaceholder}
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={factoryFilter}
          onChange={(e) => setFactoryFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="ALL">{T.filterAllMills}</option>
          {allFactories.map((f) => (
            <option key={f.id || "_none"} value={f.id || "_none"}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="ALL">{T.filterAllTypes}</option>
          <option value="DEVELOPMENT">{T.typeDevelopment}</option>
          <option value="ACTUAL">{T.typeActualBulk}</option>
          <option value="FORECAST">{T.typeForecast}</option>
          <option value="RD">{T.typeRd}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white"
        >
          <option value="ALL">{T.filterAllStatuses}</option>
          {FABRIC_DEV_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FABRIC_DEV_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {saveError && (
          <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {saveError}
          </span>
        )}
      </div>

      {/* Tables grouped by factory */}
      {filteredGroups.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">{T.emptyFabric}</div>
          <div className="text-sm font-bold text-slate-700">{T.emptyTitle}</div>
          <div className="text-xs text-slate-500 mt-1">
            {T.emptySub}
          </div>
        </div>
      )}

      {filteredGroups.map((g) => (
        <section
          key={g.factory.id || "_none"}
          className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden"
        >
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-black text-slate-900">{g.factory.name}</div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                {g.rows.length} {g.rows.length === 1 ? T.fabricSingular : T.fabricPlural}
              </span>
            </div>
            {g.factory.id && (
              <Link
                href={`/factories/${g.factory.id}`}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
              >
                {T.openFactory}
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colFuze}</th>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colMillFabric}</th>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colType}</th>
                  <th className="text-left px-3 py-2 font-bold">{T.colContent}</th>
                  <th className="text-right px-3 py-2 font-bold whitespace-nowrap">{T.colGsm}</th>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colCustomerCode}</th>
                  <th className="text-center px-3 py-2 font-bold whitespace-nowrap">{T.colTrial}</th>
                  <th className="text-center px-3 py-2 font-bold whitespace-nowrap">{T.colICP}</th>
                  <th className="text-center px-3 py-2 font-bold whitespace-nowrap">{T.colAM}</th>
                  <th className="text-right px-3 py-2 font-bold whitespace-nowrap">{T.colICPValue}</th>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colTestDate}</th>
                  <th className="text-left px-3 py-2 font-bold whitespace-nowrap">{T.colStatus}</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, idx) => {
                  const statusColor = r.developmentStatus
                    ? FABRIC_DEV_STATUS_COLOR[r.developmentStatus]
                    : null;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                    >
                      <td className="px-3 py-2 font-mono text-slate-900 whitespace-nowrap">
                        {r.fuzeNumber ? (
                          <Link href={`/fabrics/${r.id}`} className="text-blue-700 hover:underline font-bold">
                            FUZE-{r.fuzeNumber}
                          </Link>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">{T.unassigned}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {r.factoryCode ? (
                          <Link href={`/fabrics/${r.id}`} className="text-slate-800 hover:underline">
                            {r.factoryCode}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {r.type === "ACTUAL"
                          ? T.typeBulkProduction
                          : r.type === "DEVELOPMENT"
                            ? T.typeDevelopment
                            : r.type === "FORECAST"
                              ? T.typeForecast
                              : r.type === "RD"
                                ? T.typeRd
                                : r.type || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[280px]">
                        <span className="line-clamp-2">{r.content || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {r.weightGsm ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-[180px]">
                        <span className="line-clamp-2">{r.customerCode || r.customerReference || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-base">
                        {r.trialComplete ? "✅" : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-base">
                        {r.hasIcpResult ? "✅" : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-base">
                        {r.hasAmResult ? "✅" : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-semibold">
                        {r.latestIcpValue != null
                          ? `${r.latestIcpValue} ${r.latestIcpUnit}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {r.latestTestDate
                          ? new Date(r.latestTestDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.developmentStatus || ""}
                          onChange={(e) =>
                            updateStatus(r.id, e.target.value === "" ? null : (e.target.value as FabricDevStatus))
                          }
                          disabled={savingFabricId === r.id}
                          className={`px-2 py-1 rounded text-[11px] font-bold border ${
                            statusColor
                              ? `${statusColor.bg} ${statusColor.text} ${statusColor.border}`
                              : "bg-white text-slate-500 border-slate-300"
                          } cursor-pointer`}
                        >
                          <option value="">{T.notSet}</option>
                          {FABRIC_DEV_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {FABRIC_DEV_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Link
                          href={`/fabrics/${r.id}`}
                          className="text-blue-700 hover:text-blue-900 text-xs font-bold"
                          title={T.titleOpenFabric}
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
