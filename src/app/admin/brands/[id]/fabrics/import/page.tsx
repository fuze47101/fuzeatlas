// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

/**
 * /admin/brands/[id]/fabrics/import — Phase 18 importer UI.
 *
 * Flow:
 *   1. File picker / drag-drop
 *   2. Auto-fires dry-run on selection
 *   3. Renders preview: errors, warnings, summary, first 5 rows
 *   4. If any mills are unresolved → renders alias-pick UI
 *   5. Commit button enables when (no errors) && (all mills resolved)
 *   6. Success: summary + link to brand fabrics
 */

interface FactoryOption {
  id: string;
  name: string;
  country: string | null;
}

interface DryRunResult {
  ok: boolean;
  brand?: { id: string; name: string };
  summary?: {
    totalRows: number;
    validRows: number;
    distinctMills: number;
  };
  errors?: Array<{ rowNumber: number; field?: string; message: string }>;
  warnings?: Array<{ rowNumber: number; field?: string; message: string }>;
  millNames?: string[];
  unknownHeaders?: string[];
  millResolution?: {
    resolved: Record<string, string>;
    unresolved: string[];
    newAliasesPlanned: number;
  };
  rowsPreview?: any[];
  error?: string;
}

export default function ImportFabricCsvPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const T = (t as any).fabricCsvImport || {};

  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [factorySearch, setFactorySearch] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [aliasResolutions, setAliasResolutions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "dry" | "commit">("");
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load brand + factory directory
  useEffect(() => {
    if (!brandId) return;
    fetch(`/api/admin/brands/${brandId}/fabrics/import`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setBrand(d.brand);
        else setErrorBanner(d.error || "Brand not found");
      })
      .catch((e) => setErrorBanner(e.message));
    fetch("/api/factories?pageSize=500")
      .then((r) => r.json())
      .then((d) => setFactories(d.factories || d.items || []))
      .catch(() => {});
  }, [brandId]);

  const filteredFactories = useMemo(() => {
    const q = factorySearch.trim().toLowerCase();
    if (!q) return factories.slice(0, 50);
    return factories
      .filter((f) =>
        [f.name, f.country].filter(Boolean).some((s) => String(s).toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [factories, factorySearch]);

  async function handleFileSelected(f: File) {
    setFile(f);
    setCommitResult(null);
    setDryRun(null);
    setAliasResolutions({});
    setErrorBanner(null);
    const text = await f.text();
    setCsvText(text);
    await runDryRun(text, {});
  }

  async function runDryRun(text: string, aliasMap: Record<string, string>) {
    setBusy("dry");
    try {
      const fd = new FormData();
      fd.append("file", new Blob([text], { type: "text/csv" }), file?.name || "import.csv");
      if (Object.keys(aliasMap).length > 0) {
        fd.append("aliasResolutions", JSON.stringify(aliasMap));
      }
      const res = await fetch(
        `/api/admin/brands/${brandId}/fabrics/import?dryRun=true`,
        { method: "POST", body: fd },
      );
      const d = await res.json();
      setDryRun(d);
      if (!d.ok && d.error) setErrorBanner(d.error);
    } catch (e: any) {
      setErrorBanner(e.message || "Dry-run failed");
    } finally {
      setBusy("");
    }
  }

  async function handleCommit() {
    if (!file || !csvText) return;
    setBusy("commit");
    setErrorBanner(null);
    try {
      const fd = new FormData();
      fd.append("file", new Blob([csvText], { type: "text/csv" }), file.name);
      if (Object.keys(aliasResolutions).length > 0) {
        fd.append("aliasResolutions", JSON.stringify(aliasResolutions));
      }
      const res = await fetch(`/api/admin/brands/${brandId}/fabrics/import`, {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!d.ok) {
        setErrorBanner(d.error || "Import failed");
        // If 409 — surface unresolved mills so user can map them.
        if (d.requiresFactoryAlias) {
          setDryRun((prev) =>
            prev
              ? {
                  ...prev,
                  millResolution: {
                    resolved: prev.millResolution?.resolved || {},
                    unresolved: d.requiresFactoryAlias,
                    newAliasesPlanned: 0,
                  },
                }
              : prev,
          );
        }
      } else {
        setCommitResult(d);
      }
    } catch (e: any) {
      setErrorBanner(e.message || "Import failed");
    } finally {
      setBusy("");
    }
  }

  const unresolved = dryRun?.millResolution?.unresolved || [];
  const errors = dryRun?.errors || [];
  const warnings = dryRun?.warnings || [];
  const summary = dryRun?.summary;
  const canCommit =
    !!file && !!dryRun?.ok && errors.length === 0 && unresolved.every((m) => aliasResolutions[m]);

  if (user && !["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role)) {
    return (
      <div className="p-8 text-sm text-slate-600">
        You don't have permission to import fabric portfolios for this brand.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/admin/brands/${brandId}/fabrics`}
          className="text-xs text-[#00b4c3] hover:underline"
        >
          {T.backToBrand || "← Back to brand"}
        </Link>
        <h1 className="text-3xl font-black text-slate-900 mt-1">
          {T.pageTitle || "Import Fabric Portfolio"}
          {brand && <span className="text-slate-500 font-medium"> · {brand.name}</span>}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {T.templateBlurb ||
            "Don't have a template? Download the canonical CSV format below."}{" "}
          <a
            href={`/api/admin/brands/${brandId}/fabrics/import?template=1`}
            download="Brand_Fabric_Portfolio_Template.csv"
            className="text-[#00b4c3] font-semibold hover:underline"
          >
            {T.downloadTemplate || "Download CSV template"}
          </a>
        </p>
      </div>

      {errorBanner && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="font-bold text-red-700">{T.errorHeadline || "Import failed"}</p>
          <p className="text-red-600 text-xs mt-1">{errorBanner}</p>
        </div>
      )}

      {commitResult ? (
        <SuccessPanel result={commitResult} brandId={brandId} T={T} />
      ) : (
        <>
          {/* File upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileSelected(f);
            }}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#00b4c3] hover:bg-cyan-50/30 transition-colors cursor-pointer"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,text/csv";
              input.onchange = (ev: any) => {
                const f = ev.target.files?.[0];
                if (f) handleFileSelected(f);
              };
              input.click();
            }}
          >
            {file ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {(T.fileSelected || "Selected: {filename}").replace("{filename}", file.name)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {busy === "dry" ? T.parsing || "Parsing…" : `${(file.size / 1024).toFixed(1)} KB`}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {T.dropZoneLabel || "Drop a CSV here, or click to choose"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {T.dropZoneAccept || "CSV only · max 5 MB"}
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          {dryRun && (
            <div className="mt-6 space-y-4">
              {/* Summary cards */}
              {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile label={T.summaryTotalRows || "Total rows"} value={summary.totalRows} />
                  <StatTile label={T.summaryValidRows || "Valid rows"} value={summary.validRows} />
                  <StatTile
                    label={T.summaryDistinctMills || "Distinct mills"}
                    value={summary.distinctMills}
                  />
                  <StatTile
                    label="Unresolved"
                    value={unresolved.length}
                    danger={unresolved.length > 0}
                  />
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-700 mb-2">
                    {T.errorsTitle || "Validation errors"} ({errors.length})
                  </p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
                    {errors.map((e, i) => (
                      <li key={i}>
                        <strong>Row {e.rowNumber}</strong>
                        {e.field && <span className="text-red-500"> · {e.field}</span>}
                        {" — "}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-800 mb-2">
                    {T.warningsTitle || "Warnings (non-blocking)"} ({warnings.length})
                  </p>
                  <ul className="text-xs text-amber-800 space-y-1 max-h-40 overflow-y-auto">
                    {warnings.map((w, i) => (
                      <li key={i}>
                        <strong>Row {w.rowNumber}</strong>
                        {w.field && <span> · {w.field}</span>}
                        {" — "}
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unknown headers */}
              {dryRun.unknownHeaders && dryRun.unknownHeaders.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-700 mb-1">
                    {T.unknownHeaderTitle || "Unmapped columns"} ({dryRun.unknownHeaders.length})
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    {T.unknownHeaderBlurb ||
                      "These columns weren't recognized. Values are preserved as notes on each fabric row."}
                  </p>
                  <p className="text-xs font-mono text-slate-600">
                    {dryRun.unknownHeaders.join(", ")}
                  </p>
                </div>
              )}

              {/* Alias resolution */}
              {unresolved.length > 0 && (
                <div className="bg-cyan-50/40 border border-cyan-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-800 mb-1">
                    {T.aliasesUnresolvedTitle || "Map each mill to an existing factory"} (
                    {unresolved.length})
                  </p>
                  <p className="text-xs text-slate-600 mb-3">
                    {T.aliasesUnresolvedBlurb ||
                      "We couldn't match these mill names. Pick an existing factory or create a new one before committing."}
                  </p>
                  <input
                    type="text"
                    value={factorySearch}
                    onChange={(e) => setFactorySearch(e.target.value)}
                    placeholder={T.aliasFactorySearch || "Search factories"}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs mb-3"
                  />
                  <div className="space-y-2">
                    {unresolved.map((mill) => (
                      <div key={mill} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs uppercase text-slate-500">
                            {T.aliasMillLabel || "Mill name in CSV"}
                          </div>
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {mill}
                          </div>
                        </div>
                        <select
                          value={aliasResolutions[mill] || ""}
                          onChange={(e) =>
                            setAliasResolutions((prev) => ({ ...prev, [mill]: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded text-xs"
                        >
                          <option value="">{T.aliasFactoryPlaceholder || "Pick a factory…"}</option>
                          {filteredFactories.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                              {f.country ? ` · ${f.country}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unresolved.length === 0 && summary && summary.distinctMills > 0 && (
                <p className="text-xs text-emerald-700 font-semibold">
                  ✓ {T.aliasAllResolved || "All mills resolved · ready to import."}
                </p>
              )}

              {/* Row preview */}
              {dryRun.rowsPreview && dryRun.rowsPreview.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-slate-700 mb-2">
                    {T.rowsPreviewLabel || "First 5 rows"}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="text-slate-500 uppercase">
                        <tr>
                          <th className="text-left pb-1">#</th>
                          <th className="text-left pb-1">Mill</th>
                          <th className="text-left pb-1">Fabric #</th>
                          <th className="text-left pb-1">Type</th>
                          <th className="text-left pb-1">Content</th>
                          <th className="text-right pb-1">GSM</th>
                          <th className="text-left pb-1">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRun.rowsPreview.map((r: any) => (
                          <tr key={r.rowNumber} className="border-t border-slate-100">
                            <td className="py-1 text-slate-400">{r.rowNumber}</td>
                            <td className="py-1"><bdi>{r.mill}</bdi></td>
                            <td className="py-1 font-mono text-slate-700">{r.millFabricNumber}</td>
                            <td className="py-1">{r.type}</td>
                            <td className="py-1 truncate max-w-[160px]">{r.content || "—"}</td>
                            <td className="py-1 text-right tabular-nums">{r.weightGsm ?? "—"}</td>
                            <td className="py-1">{r.workflowStatus || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => {
                    setFile(null);
                    setCsvText("");
                    setDryRun(null);
                    setAliasResolutions({});
                    setErrorBanner(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  {T.cancel || "Cancel"}
                </button>
                <button
                  onClick={() => runDryRun(csvText, aliasResolutions)}
                  disabled={!file || busy !== ""}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                >
                  {busy === "dry" ? T.parsing || "Parsing…" : T.btnDryRun || "Run preview"}
                </button>
                <button
                  onClick={handleCommit}
                  disabled={!canCommit || busy !== ""}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#00b4c3] rounded-lg hover:bg-[#009aa8] disabled:opacity-50"
                >
                  {busy === "commit"
                    ? T.committing || "Importing…"
                    : T.btnCommit || "Commit import"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 text-center border ${
        danger
          ? "bg-rose-50 border-rose-200 text-rose-700"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function SuccessPanel({ result, brandId, T }: { result: any; brandId: string; T: any }) {
  const s = result.summary || {};
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
      <h2 className="text-2xl font-black text-emerald-800">
        ✓ {T.successHeadline || "Import complete"}
      </h2>
      <p className="text-sm text-emerald-700 mt-1">
        {(T.successBlurb || "{n} fabrics processed. {created} created, {updated} updated.")
          .replace("{n}", String((s.fabricsCreated || 0) + (s.fabricsUpdated || 0)))
          .replace("{created}", String(s.fabricsCreated || 0))
          .replace("{updated}", String(s.fabricsUpdated || 0))}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <StatTile label={T.summaryFabricsCreated || "Fabrics created"} value={s.fabricsCreated || 0} />
        <StatTile label={T.summaryFabricsUpdated || "Fabrics updated"} value={s.fabricsUpdated || 0} />
        <StatTile label={T.summaryAliases || "Factory aliases learned"} value={s.aliasesCreated || 0} />
        <StatTile label={T.summaryIcpRows || "ICP records"} value={s.icpRowsCreated || 0} />
        <StatTile label={T.summaryAmRows || "Antimicrobial records"} value={s.amRowsCreated || 0} />
      </div>
      <div className="mt-4">
        <Link
          href={result.viewUrl || `/admin/brands/${brandId}/fabrics`}
          className="inline-block px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-bold hover:bg-emerald-800"
        >
          {T.btnViewFabrics || "View brand fabrics →"}
        </Link>
      </div>
    </div>
  );
}
