// @ts-nocheck
"use client";

/**
 * HubSpot CSV import — client-side flow for the cases where the
 * HubSpot API key won't auth (developer accounts, expired Personal
 * Access Keys, etc.).
 *
 * Flow:
 *   1. User exports Companies + Contacts CSVs from HubSpot UI.
 *   2. Drops them on this component. We parse client-side using
 *      Papa Parse (loaded from CDN — keeps it out of the server
 *      bundle).
 *   3. We classify every company row using
 *      src/lib/hubspot-classifier.ts, show the user the bucket
 *      counts (KEEP / REVIEW / EXCLUDE) so they know exactly what
 *      will be imported, what will be flagged for review, and what
 *      will be dropped.
 *   4. User clicks "Import" — we chunk into 100-row batches and
 *      POST to /api/admin/hubspot-import/csv-companies (and then
 *      /csv-contacts), accumulating stats.
 *
 * The classifier filters out the medical / pharma / hospital /
 * finance / software / etc. rows that HubSpot accumulated over the
 * years but aren't FUZE customers. Anything ambiguous (no industry
 * tag, borderline industries like "Chemicals") lands in REVIEW
 * with validationStatus="pending_review" so a human eyeballs it
 * before it shows up in the BD wizard.
 */

import { useEffect, useRef, useState } from "react";
import { classifyHubSpotCompanyRow } from "@/lib/hubspot-classifier";

declare const Papa: any;

const PAPA_CDN = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";

const COMPANY_BATCH = 100;
const CONTACT_BATCH = 100;

type Bucket = "KEEP" | "REVIEW" | "EXCLUDE";

type CompanyRow = Record<string, string>;
type ContactRow = Record<string, string>;

type PreviewStats = {
  total: number;
  byBucket: Record<Bucket, number>;
  byReason: Record<string, number>;
  excludedSamples: Array<{ name: string; reason: string; matchedTerm?: string }>;
  reviewSamples: Array<{ name: string; reason: string; matchedTerm?: string }>;
  keepSamples: Array<{ name: string; reason: string; matchedTerm?: string }>;
};

type DedupeSample = {
  csvName: string;
  csvEmail?: string;
  matchedAtlasName?: string;
  matchedAtlasId?: string;
  matchedAtlasEmail?: string;
  status: string;
};

type ImportProgress = {
  running: boolean;
  done: boolean;
  dryRun: boolean;
  totalProcessed: number;
  batches: number;
  stats: Record<string, number>;
  error: string | null;
  // Up to 8 sample rows that would be updated, so the admin can
  // sanity-check the dedupe match before committing.
  updateSamples: DedupeSample[];
  createSamples: DedupeSample[];
};

const initialProgress: ImportProgress = {
  running: false,
  done: false,
  dryRun: false,
  totalProcessed: 0,
  batches: 0,
  stats: {},
  error: null,
  updateSamples: [],
  createSamples: [],
};

function loadPapa(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof Papa !== "undefined") return resolve();
    const existing = document.querySelector(`script[src="${PAPA_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Papa Parse load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = PAPA_CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Papa Parse load failed"));
    document.head.appendChild(s);
  });
}

function parseCsvFile(file: File): Promise<CompanyRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      worker: false,
      complete: (res: any) => {
        if (res.errors?.length) {
          // Non-fatal — Papa still returns parsed rows; just log.
          console.warn("[hubspot-csv] parse warnings:", res.errors.slice(0, 3));
        }
        resolve(res.data || []);
      },
      error: (err: any) => reject(err),
    });
  });
}

function classifyCompanies(rows: CompanyRow[]): PreviewStats {
  const stats: PreviewStats = {
    total: rows.length,
    byBucket: { KEEP: 0, REVIEW: 0, EXCLUDE: 0 },
    byReason: {},
    excludedSamples: [],
    reviewSamples: [],
    keepSamples: [],
  };
  for (const row of rows) {
    const c = classifyHubSpotCompanyRow(row);
    stats.byBucket[c.bucket]++;
    stats.byReason[c.reason] = (stats.byReason[c.reason] || 0) + 1;
    const name = row["Company name"] || row["Company Name"] || "(no name)";
    if (c.bucket === "EXCLUDE" && stats.excludedSamples.length < 8) {
      stats.excludedSamples.push({
        name,
        reason: c.reason,
        matchedTerm: c.matchedTerm,
      });
    }
    if (c.bucket === "REVIEW" && stats.reviewSamples.length < 8) {
      stats.reviewSamples.push({
        name,
        reason: c.reason,
        matchedTerm: c.matchedTerm,
      });
    }
    if (c.bucket === "KEEP" && stats.keepSamples.length < 8) {
      stats.keepSamples.push({
        name,
        reason: c.reason,
        matchedTerm: c.matchedTerm,
      });
    }
  }
  return stats;
}

const SAMPLE_CAP = 8;

async function importInBatches<T>(
  endpoint: string,
  rows: T[],
  batchSize: number,
  bodyExtra: any,
  onTick: (s: ImportProgress) => void,
  current: ImportProgress,
  isDryRun: boolean,
): Promise<ImportProgress> {
  let s = { ...current, running: true, error: null, dryRun: isDryRun };
  onTick(s);
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: chunk, ...bodyExtra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      s = {
        ...s,
        running: false,
        error: data.error || `HTTP ${res.status} on batch ${s.batches + 1}`,
      };
      onTick(s);
      return s;
    }
    // Merge stats (sum any numeric keys returned)
    const merged: Record<string, number> = { ...s.stats };
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "number") {
        merged[k] = (merged[k] || 0) + v;
      }
    }
    // Pull update/create samples out of the per-row log so the UI
    // can show "Spanx matches Atlas brand 'Spanx Inc.'", etc.
    const updateSamples = [...s.updateSamples];
    const createSamples = [...s.createSamples];
    if (Array.isArray(data.log)) {
      for (const entry of data.log) {
        const status = String(entry?.status || "");
        if (
          updateSamples.length < SAMPLE_CAP &&
          status.startsWith("dry_run_would_update_by_")
        ) {
          updateSamples.push({
            csvName: entry.name || entry.email || "(no name)",
            csvEmail: entry.email,
            matchedAtlasName: entry.matchedAtlasName,
            matchedAtlasId: entry.matchedAtlasBrandId || entry.matchedAtlasContactId,
            matchedAtlasEmail: entry.matchedAtlasContactEmail,
            status,
          });
        } else if (
          createSamples.length < SAMPLE_CAP &&
          status === "dry_run_would_create"
        ) {
          createSamples.push({
            csvName: entry.name || entry.email || "(no name)",
            csvEmail: entry.email,
            status,
          });
        }
      }
    }
    s = {
      running: true,
      done: false,
      dryRun: isDryRun,
      totalProcessed: s.totalProcessed + chunk.length,
      batches: s.batches + 1,
      stats: merged,
      error: null,
      updateSamples,
      createSamples,
    };
    onTick(s);
  }
  s = { ...s, running: false, done: true };
  onTick(s);
  return s;
}

export default function HubSpotCSVImport() {
  const [papaReady, setPapaReady] = useState(false);
  const [papaError, setPapaError] = useState<string | null>(null);

  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [companyPreview, setCompanyPreview] = useState<PreviewStats | null>(null);
  const [companyProgress, setCompanyProgress] = useState<ImportProgress>({
    ...initialProgress,
  });

  const [contactRows, setContactRows] = useState<ContactRow[]>([]);
  const [contactProgress, setContactProgress] = useState<ImportProgress>({
    ...initialProgress,
  });
  const [allowOrphans, setAllowOrphans] = useState(false);

  const companyFileRef = useRef<HTMLInputElement | null>(null);
  const contactFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadPapa()
      .then(() => setPapaReady(true))
      .catch((e) => setPapaError(e.message || "Failed to load CSV parser"));
  }, []);

  async function onCompanyFile(file: File) {
    setCompanyProgress({ ...initialProgress });
    setCompanyPreview(null);
    setCompanyRows([]);
    try {
      const rows = await parseCsvFile(file);
      setCompanyRows(rows);
      setCompanyPreview(classifyCompanies(rows));
    } catch (e: any) {
      setCompanyPreview(null);
      alert(`CSV parse failed: ${e?.message || e}`);
    }
  }

  async function onContactFile(file: File) {
    setContactProgress({ ...initialProgress });
    setContactRows([]);
    try {
      const rows = await parseCsvFile(file);
      setContactRows(rows);
    } catch (e: any) {
      alert(`CSV parse failed: ${e?.message || e}`);
    }
  }

  async function importCompanies(dryRun = false) {
    if (companyRows.length === 0) return;
    await importInBatches(
      "/api/admin/hubspot-import/csv-companies",
      companyRows,
      COMPANY_BATCH,
      { dryRun },
      setCompanyProgress,
      { ...initialProgress, dryRun },
      dryRun,
    );
  }

  async function importContacts(dryRun = false) {
    if (contactRows.length === 0) return;
    await importInBatches(
      "/api/admin/hubspot-import/csv-contacts",
      contactRows,
      CONTACT_BATCH,
      { dryRun, allowOrphans },
      setContactProgress,
      { ...initialProgress, dryRun },
      dryRun,
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            CSV Import (offline path)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
            Use this if the HubSpot API token isn't working. Export
            Companies + Contacts as CSV from HubSpot UI, drop them
            here, and we'll parse + classify + import in chunks.
            Medical / pharma / hospital / finance / software rows get
            filtered out automatically.
          </p>
        </div>
        {!papaReady && !papaError && (
          <span className="text-xs text-slate-500">Loading CSV parser…</span>
        )}
        {papaError && (
          <span className="text-xs text-red-700">{papaError}</span>
        )}
        {papaReady && (
          <span className="text-xs text-emerald-700 font-semibold">
            ✓ CSV parser ready
          </span>
        )}
      </div>

      {/* Step 1 — Companies */}
      <div className="mt-4 border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-900">
          1. Companies CSV → Brands
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Drop your <code>all-companies.csv</code> export. We classify
          every row and only import textile + surface-disinfectant
          customers. EXCLUDE rows are dropped (audit log only).
          REVIEW rows import with{" "}
          <code className="bg-slate-100 px-1 rounded">
            validationStatus=pending_review
          </code>{" "}
          and stay out of the BD wizard until approved.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={companyFileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={!papaReady}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCompanyFile(f);
            }}
            className="text-xs"
          />
          {companyRows.length > 0 && (
            <span className="text-xs text-slate-600">
              {companyRows.length.toLocaleString()} rows parsed
            </span>
          )}
        </div>

        {companyPreview && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <BucketTile
                label="✓ KEEP — import direct"
                value={companyPreview.byBucket.KEEP}
                tone="emerald"
              />
              <BucketTile
                label="◔ REVIEW — pending review"
                value={companyPreview.byBucket.REVIEW}
                tone="amber"
              />
              <BucketTile
                label="✗ EXCLUDE — dropped"
                value={companyPreview.byBucket.EXCLUDE}
                tone="red"
              />
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900">
                Why each bucket? See sample rows + reason breakdown
              </summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <SampleList
                  title="KEEP samples"
                  tone="emerald"
                  items={companyPreview.keepSamples}
                />
                <SampleList
                  title="REVIEW samples"
                  tone="amber"
                  items={companyPreview.reviewSamples}
                />
                <SampleList
                  title="EXCLUDE samples"
                  tone="red"
                  items={companyPreview.excludedSamples}
                />
              </div>
              <div className="mt-3">
                <p className="font-semibold text-slate-700 mb-1">
                  Reason breakdown
                </p>
                <ul className="bg-slate-50 border border-slate-200 rounded p-2 max-h-48 overflow-auto">
                  {Object.entries(companyPreview.byReason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between">
                        <span className="font-mono text-slate-700">{k}</span>
                        <span className="tabular-nums text-slate-600">{v}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </details>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => importCompanies(true)}
                disabled={companyProgress.running}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-semibold disabled:opacity-50"
              >
                {companyProgress.running && companyProgress.dryRun
                  ? "⏳ Checking duplicates…"
                  : "🔍 Pre-flight dedupe check (no DB writes)"}
              </button>
              <button
                onClick={() => importCompanies(false)}
                disabled={
                  companyProgress.running ||
                  (companyProgress.done && !companyProgress.dryRun)
                }
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm font-bold disabled:opacity-50"
              >
                {companyProgress.running && !companyProgress.dryRun
                  ? "⏳ Importing…"
                  : companyProgress.done && !companyProgress.dryRun
                    ? "✓ Companies imported"
                    : `Import ${companyPreview.byBucket.KEEP + companyPreview.byBucket.REVIEW} rows (${companyPreview.byBucket.EXCLUDE} skipped)`}
              </button>
            </div>

            {companyProgress.totalProcessed > 0 && (
              <>
                <ProgressPanel
                  state={companyProgress}
                  totalRows={companyRows.length}
                />
                {companyProgress.dryRun && companyProgress.done && (
                  <DedupePanel state={companyProgress} entity="brand" />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Step 2 — Contacts */}
      <div className="mt-4 border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-slate-900">
          2. Contacts CSV → Contacts
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Drop your <code>all-contacts.csv</code> export. Each row
          links to its Brand via{" "}
          <code className="bg-slate-100 px-1 rounded">
            Associated Company IDs (Primary)
          </code>{" "}
          matched against the Brand.hubspotId stamped during the
          company import. Run companies first, then contacts.
          Contacts whose company was excluded or pending review get
          dropped (or kept as orphans if you check the box below).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={contactFileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={!papaReady}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onContactFile(f);
            }}
            className="text-xs"
          />
          {contactRows.length > 0 && (
            <span className="text-xs text-slate-600">
              {contactRows.length.toLocaleString()} rows parsed
            </span>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-700 ml-auto">
            <input
              type="checkbox"
              checked={allowOrphans}
              onChange={(e) => setAllowOrphans(e.target.checked)}
            />
            Keep orphans (contacts with no associated company)
          </label>
        </div>

        {contactRows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => importContacts(true)}
              disabled={contactProgress.running}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded text-xs font-semibold disabled:opacity-50"
            >
              {contactProgress.running && contactProgress.dryRun
                ? "⏳ Checking duplicates…"
                : "🔍 Pre-flight dedupe check (no DB writes)"}
            </button>
            <button
              onClick={() => importContacts(false)}
              disabled={
                contactProgress.running ||
                (contactProgress.done && !contactProgress.dryRun)
              }
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm font-bold disabled:opacity-50"
            >
              {contactProgress.running && !contactProgress.dryRun
                ? "⏳ Importing…"
                : contactProgress.done && !contactProgress.dryRun
                  ? "✓ Contacts imported"
                  : `Import ${contactRows.length.toLocaleString()} rows`}
            </button>
          </div>
        )}

        {contactProgress.totalProcessed > 0 && (
          <>
            <ProgressPanel
              state={contactProgress}
              totalRows={contactRows.length}
              keys={
                contactProgress.dryRun
                  ? [
                      "wouldCreate",
                      "wouldUpdateById",
                      "wouldUpdateByEmail",
                      "linkedToBrand",
                      "skippedOrphan",
                      "skippedReviewBrand",
                      "skippedNoIdentity",
                      "personalEmail",
                    ]
                  : [
                      "created",
                      "updatedById",
                      "updatedByEmail",
                      "linkedToBrand",
                      "skippedOrphan",
                      "skippedReviewBrand",
                      "skippedNoIdentity",
                      "personalEmail",
                      "errors",
                    ]
              }
            />
            {contactProgress.dryRun && contactProgress.done && (
              <DedupePanel state={contactProgress} entity="contact" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BucketTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "red";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-red-50 border-red-200 text-red-800";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide font-bold opacity-80">
        {label}
      </p>
      <p className="text-2xl font-black tabular-nums mt-0.5">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function SampleList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "emerald" | "amber" | "red";
  items: Array<{ name: string; reason: string; matchedTerm?: string }>;
}) {
  const ringCls =
    tone === "emerald"
      ? "border-emerald-200"
      : tone === "amber"
        ? "border-amber-200"
        : "border-red-200";
  return (
    <div className={`bg-white border ${ringCls} rounded p-2`}>
      <p className="text-[11px] font-bold text-slate-700 mb-1">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400">No samples</p>
      ) : (
        <ul className="text-[11px] space-y-1">
          {items.map((s, i) => (
            <li key={i} className="truncate">
              <span className="font-semibold text-slate-800">{s.name}</span>
              <span className="text-slate-500">
                {" "}
                — {s.reason}
                {s.matchedTerm ? ` (${s.matchedTerm})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DedupePanel({
  state,
  entity,
}: {
  state: ImportProgress;
  entity: "brand" | "contact";
}) {
  const create = state.stats.wouldCreate || 0;
  const updateById = state.stats.wouldUpdateById || 0;
  const updateByDomain = state.stats.wouldUpdateByDomain || 0;
  const updateByName = state.stats.wouldUpdateByName || 0;
  const updateByEmail = state.stats.wouldUpdateByEmail || 0;
  const totalUpdates = updateById + updateByDomain + updateByName + updateByEmail;
  const total = create + totalUpdates;

  return (
    <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-amber-900">
          🔍 Pre-flight dedupe results
        </p>
        <p className="text-xs text-amber-800">
          {totalUpdates.toLocaleString()} of {total.toLocaleString()} rows already
          in Atlas (will UPDATE, not duplicate)
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <DedupeTile label="Net new (CREATE)" value={create} tone="cyan" />
        <DedupeTile
          label={
            entity === "brand"
              ? "Update by hubspotId"
              : "Update by hubspotId"
          }
          value={updateById}
          tone="emerald"
        />
        {entity === "brand" ? (
          <>
            <DedupeTile
              label="Update by domain"
              value={updateByDomain}
              tone="emerald"
            />
            <DedupeTile
              label="Update by name"
              value={updateByName}
              tone="emerald"
            />
          </>
        ) : (
          <DedupeTile
            label="Update by email"
            value={updateByEmail}
            tone="emerald"
          />
        )}
      </div>

      {state.updateSamples.length > 0 && (
        <div>
          <p className="text-xs font-bold text-amber-900 mb-1">
            Sample matches — these CSV rows already exist in Atlas:
          </p>
          <ul className="text-xs space-y-1 bg-white border border-amber-200 rounded p-2 max-h-48 overflow-auto">
            {state.updateSamples.map((s, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-amber-800 px-1.5 py-0.5 bg-amber-100 rounded">
                  {s.status.replace("dry_run_would_update_by_", "by ")}
                </span>
                <span className="font-semibold text-slate-800">
                  {s.csvName}
                </span>
                <span className="text-slate-500">→</span>
                <span className="text-slate-700 truncate">
                  {s.matchedAtlasName ||
                    s.matchedAtlasEmail ||
                    s.matchedAtlasId ||
                    "(matched)"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.createSamples.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-bold text-amber-900 mb-1">
            Sample net-new rows — these will create new {entity}s:
          </p>
          <ul className="text-xs space-y-1 bg-white border border-amber-200 rounded p-2 max-h-32 overflow-auto">
            {state.createSamples.map((s, i) => (
              <li key={i} className="truncate">
                <span className="font-semibold text-slate-800">
                  {s.csvName}
                </span>
                {s.csvEmail ? (
                  <span className="text-slate-500"> — {s.csvEmail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] text-amber-800">
        ✓ Importer is idempotent —{" "}
        {entity === "brand"
          ? "matches on hubspotId → website domain → name (case-insensitive)."
          : "matches on hubspotId → email (case-insensitive)."}{" "}
        Re-running won't create duplicates. If you spot a wrong match in
        the samples, stop here and tell me — we can adjust the match
        rules before committing.
      </p>
    </div>
  );
}

function DedupeTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "emerald";
}) {
  const cls =
    tone === "cyan"
      ? "bg-cyan-50 border-cyan-200 text-cyan-800"
      : "bg-emerald-50 border-emerald-200 text-emerald-800";
  return (
    <div className={`rounded border p-2 ${cls}`}>
      <p className="text-[10px] uppercase font-bold tracking-wide opacity-80 truncate">
        {label}
      </p>
      <p className="text-xl font-black tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ProgressPanel({
  state,
  totalRows,
  keys,
}: {
  state: ImportProgress;
  totalRows: number;
  keys?: string[];
}) {
  const pct = totalRows > 0 ? Math.round((state.totalProcessed / totalRows) * 100) : 0;
  const showKeys =
    keys ||
    (state.dryRun
      ? [
          "wouldCreate",
          "wouldUpdateById",
          "wouldUpdateByDomain",
          "wouldUpdateByName",
          "excludedSkipped",
          "skippedNoName",
        ]
      : [
          "keepCreated",
          "keepUpdatedById",
          "keepUpdatedByDomain",
          "keepUpdatedByName",
          "reviewCreated",
          "reviewUpdated",
          "excludedSkipped",
          "skippedNoName",
          "errors",
        ]);
  return (
    <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-700">
          {state.totalProcessed.toLocaleString()} / {totalRows.toLocaleString()}{" "}
          processed ({pct}%) — batch {state.batches}
        </p>
        {state.error && (
          <p className="text-xs text-red-700 font-semibold">{state.error}</p>
        )}
      </div>
      <div className="w-full bg-white rounded h-2 overflow-hidden border border-slate-200">
        <div
          className="bg-cyan-500 h-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
        {showKeys.map((k) => (
          <div key={k} className="bg-white rounded p-1.5 border border-slate-200">
            <p className="text-[9px] uppercase font-bold text-slate-500 truncate">
              {k}
            </p>
            <p className="text-sm font-black tabular-nums text-slate-900">
              {(state.stats[k] || 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
