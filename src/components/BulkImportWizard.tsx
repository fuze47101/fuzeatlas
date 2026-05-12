"use client";

/**
 * <BulkImportWizard /> — NEED-2 shared bulk-import surface.
 *
 * Used by `/admin/import/brands` and `/admin/import/factories`. Each
 * page passes a config (title, target API, field defs, sample CSV).
 *
 * Flow:
 *   1. Source — paste CSV or upload .csv file.
 *   2. Parse → detect headers.
 *   3. Map — pick a header for each target field. Auto-guesses by
 *      case-insensitive substring match against header text.
 *   4. Preview — POST with dryRun=true; render a validation table.
 *   5. Confirm — POST with dryRun=false; show success/failure counts.
 *
 * XLSX is deferred (Excel users can "Save as CSV"). Cap is 500 rows
 * per import (server enforces).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface BulkImportConfig {
  title: string;
  subtitle: string;
  apiPath: string;
  fields: ImportField[];
  csvSample: string;
  /** Optional link back to the home of this entity type. */
  backHref?: string;
  backLabel?: string;
}

type Stage = "source" | "map" | "preview" | "done";

interface Props {
  config: BulkImportConfig;
}

export default function BulkImportWizard({ config }: Props) {
  const [stage, setStage] = useState<Stage>("source");
  const [pasted, setPasted] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [imported, setImported] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStage("source");
    setPasted("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setSubmitError(null);
    setPreview(null);
    setImported(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  function autoMap(detected: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of config.fields) {
      const match = detected.find(
        (h) =>
          h.toLowerCase() === f.key.toLowerCase() ||
          h.toLowerCase().replace(/[^a-z0-9]+/g, "") ===
            f.key.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
          h.toLowerCase().includes(f.key.toLowerCase()) ||
          h.toLowerCase().includes(f.label.toLowerCase()),
      );
      if (match) out[f.key] = match;
    }
    return out;
  }

  const parseSource = useCallback(
    (csv: string) => {
      setParseError(null);
      const trimmed = csv.trim();
      if (!trimmed) {
        setParseError("Source is empty.");
        return;
      }
      const result = Papa.parse(trimmed, {
        header: true,
        skipEmptyLines: true,
      });
      if (result.errors && result.errors.length > 0) {
        const first = result.errors[0];
        setParseError(`CSV parse error: ${first.message} (row ${first.row})`);
        return;
      }
      const detectedHeaders = result.meta?.fields || [];
      if (detectedHeaders.length === 0) {
        setParseError("Couldn't detect any column headers. First row must be header names.");
        return;
      }
      const parsedRows = (result.data as any[]).filter(
        (r) => r && typeof r === "object" && Object.values(r).some((v) => v && String(v).trim()),
      );
      if (parsedRows.length === 0) {
        setParseError("No data rows found below the header row.");
        return;
      }
      if (parsedRows.length > 500) {
        setParseError(
          `Found ${parsedRows.length} rows — the import cap is 500. Split the file and try again.`,
        );
        return;
      }
      setHeaders(detectedHeaders);
      setRows(parsedRows);
      setMapping(autoMap(detectedHeaders));
      setStage("map");
    },
    [config.fields],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setParseError("File is larger than 5MB — please split or compress.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setPasted(text);
      parseSource(text);
    };
    reader.onerror = () => setParseError("Couldn't read the file.");
    reader.readAsText(file);
  };

  const requiredMappingsSet = useMemo(
    () => config.fields.filter((f) => f.required).every((f) => !!mapping[f.key]),
    [config.fields, mapping],
  );

  const runPreview = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping, dryRun: true }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setSubmitError(j?.error || `Preview failed (HTTP ${res.status}).`);
        return;
      }
      setPreview(j);
      setStage("preview");
    } catch (e: any) {
      setSubmitError(e?.message || "Network error while previewing.");
    } finally {
      setSubmitting(false);
    }
  };

  const runImport = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(config.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping, dryRun: false }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setSubmitError(j?.error || `Import failed (HTTP ${res.status}).`);
        return;
      }
      setImported(j);
      setStage("done");
    } catch (e: any) {
      setSubmitError(e?.message || "Network error while importing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          {config.backHref ? (
            <Link href={config.backHref} className="hover:text-[#00b4c3]">
              {config.backLabel || "Admin"}
            </Link>
          ) : (
            <span>Admin</span>
          )}
          <span>›</span>
          <span>Bulk import</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{config.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{config.subtitle}</p>
      </div>

      {/* Stage strip */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {(["source", "map", "preview", "done"] as Stage[]).map((s, i) => {
          const active = s === stage;
          const passed = ["source", "map", "preview", "done"].indexOf(stage) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full font-bold uppercase tracking-wider ${
                  active
                    ? "bg-[#00b4c3] text-white"
                    : passed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}. {s}
              </span>
              {i < 3 && <span className="text-slate-300">›</span>}
            </div>
          );
        })}
      </div>

      {parseError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {parseError}
        </div>
      )}
      {submitError && (
        <div className="mb-4">
          <ErrorPanel context="Import" error={submitError} />
        </div>
      )}

      {/* ── Source ── */}
      {stage === "source" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-1">1. Paste CSV or upload .csv</h2>
          <p className="text-xs text-slate-500 mb-4">
            First row should be the column headers. We'll auto-map them to the right fields
            on the next step. Excel users: File → Save As → CSV first. XLSX is deferred.
            Cap is 500 rows per import.
          </p>

          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={config.csvSample}
            rows={10}
            className="w-full font-mono text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
          />
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => parseSource(pasted)}
              disabled={!pasted.trim()}
              className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009ba8] disabled:bg-slate-300 text-white rounded-lg text-sm font-bold"
            >
              Parse CSV
            </button>
            <div className="text-xs text-slate-500">or</div>
            <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium cursor-pointer">
              Upload .csv
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFileChange}
                className="hidden"
              />
            </label>
            <button
              onClick={() => {
                setPasted(config.csvSample);
              }}
              className="text-xs text-slate-500 hover:text-[#00b4c3] underline"
            >
              Paste sample
            </button>
          </div>
        </div>
      )}

      {/* ── Mapping ── */}
      {stage === "map" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">2. Map columns to fields</h2>
            <span className="text-xs text-slate-500">
              {rows.length} row{rows.length !== 1 ? "s" : ""} parsed · {headers.length} headers
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            We auto-guessed where we could. Required fields are marked. Pick a column for each
            required field — optional fields can stay unmapped.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {config.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                  {f.hint && (
                    <span className="ml-2 font-normal text-slate-400">{f.hint}</span>
                  )}
                </label>
                <select
                  value={mapping[f.key] || ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f.key]: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                >
                  <option value="">— Unmapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runPreview}
              disabled={!requiredMappingsSet || submitting}
              className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009ba8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold"
            >
              {submitting ? "Previewing…" : "Preview validation"}
            </button>
            <button
              onClick={reset}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {stage === "preview" && preview && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-1">3. Preview</h2>
          <p className="text-xs text-slate-500 mb-4">
            Nothing has been written yet. Review the badges per row; confirm to apply.
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4 text-xs">
            <Badge label="Total" value={preview.counts?.total ?? 0} color="slate" />
            <Badge label="Ready" value={preview.counts?.valid ?? 0} color="emerald" />
            <Badge label="Will create" value={preview.counts?.new ?? 0} color="cyan" />
            <Badge
              label="Already exists"
              value={preview.counts?.exists ?? 0}
              color="amber"
            />
            <Badge label="Invalid" value={preview.counts?.invalid ?? 0} color="red" />
          </div>

          <ResultsTable results={preview.results} config={config} />

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={runImport}
              disabled={submitting || preview.counts?.valid === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold"
            >
              {submitting ? "Importing…" : `Confirm — import ${preview.counts?.valid ?? 0} row(s)`}
            </button>
            <button
              onClick={() => setStage("map")}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
            >
              Back to mapping
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {stage === "done" && imported && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-1">4. Done</h2>
          <p className="text-xs text-slate-500 mb-4">
            Import complete. Rows below were processed in the live database.
          </p>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4 text-xs">
            <Badge label="Total" value={imported.counts?.total ?? 0} color="slate" />
            <Badge label="Created" value={imported.counts?.created ?? 0} color="emerald" />
            <Badge label="Filled" value={imported.counts?.filled ?? 0} color="cyan" />
            <Badge label="No-op" value={imported.counts?.noop ?? 0} color="slate" />
            <Badge label="Errors" value={imported.counts?.invalid ?? 0} color="red" />
          </div>

          <ResultsTable results={imported.results} config={config} />

          <div className="mt-4">
            <button
              onClick={reset}
              className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009ba8] text-white rounded-lg text-sm font-bold"
            >
              Import another batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: number; color: string }) {
  const palettes: Record<string, string> = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className={`rounded-lg p-2 border ${palettes[color] || palettes.slate}`}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-75">{label}</div>
    </div>
  );
}

function ResultsTable({
  results,
  config,
}: {
  results: any[];
  config: BulkImportConfig;
}) {
  if (!results || results.length === 0)
    return <div className="text-sm text-slate-500 py-4">No rows.</div>;

  const requiredKeys = config.fields.filter((f) => f.required).map((f) => f.key);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Status</th>
            {requiredKeys.map((k) => (
              <th key={k} className="px-3 py-2 text-left">
                {k}
              </th>
            ))}
            <th className="px-3 py-2 text-left">Outcome / error</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((r) => (
            <tr key={r.index} className={r.ok ? "" : "bg-red-50/30"}>
              <td className="px-3 py-2 text-slate-400">{r.index + 1}</td>
              <td className="px-3 py-2">
                {r.ok ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold uppercase text-[10px]">
                    OK
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold uppercase text-[10px]">
                    INVALID
                  </span>
                )}
              </td>
              {requiredKeys.map((k) => {
                const colName = (r.row && Object.keys(r.row)).find?.(
                  (h: string) => h.toLowerCase() === k.toLowerCase(),
                );
                const v = colName ? r.row?.[colName] : "";
                return (
                  <td key={k} className="px-3 py-2 text-slate-700 max-w-[200px] truncate">
                    {v || (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2">
                {r.ok ? (
                  <span className="text-slate-600">
                    {r.outcome || "ok"}
                    {r.brandsLinked?.length
                      ? ` · linked ${r.brandsLinked.length} brand(s)`
                      : ""}
                    {r.brandsMissing?.length
                      ? ` · missing ${r.brandsMissing.join(", ")}`
                      : ""}
                    {r.distributorSkipped
                      ? ` · distributor "${r.distributorSkipped}" not found`
                      : ""}
                  </span>
                ) : (
                  <span className="text-red-700">{r.error}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
