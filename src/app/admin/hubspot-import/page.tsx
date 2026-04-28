// @ts-nocheck
"use client";

/**
 * /admin/hubspot-import
 *
 * Day 1 of the HubSpot → Atlas migration. Two phases driven from the
 * UI, no terminal required:
 *
 *   1. Pull Companies — runs first, becomes Brand rows. Match strategy:
 *        hubspotId → website domain → name (case-insensitive) → create.
 *   2. Pull Contacts — runs after companies so the Brand FK can resolve
 *        from each contact's HubSpot company association.
 *
 * Each click processes up to 50 records (Vercel function timeout safe)
 * and returns the next cursor. UI loops automatically while the user
 * watches progress accumulate. Re-runnable — the importer is idempotent
 * on hubspotId, so kicking it off again after partial progress just
 * picks up where it left off.
 *
 * Day 2 will add Notes + Engagements (calls, emails, meetings) below.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import HubSpotCSVImport from "@/components/HubSpotCSVImport";
import HubSpotDuplicateAudit from "@/components/HubSpotDuplicateAudit";
import BrandDuplicateAudit from "@/components/BrandDuplicateAudit";

interface BatchResult {
  ok: boolean;
  pulled: number;
  created: number;
  updatedById?: number;
  updatedByDomain?: number;
  updatedByName?: number;
  updatedByEmail?: number;
  linkedToBrand?: number;
  unlinked?: number;
  skipped?: number;
  skippedNoName?: number;
  nextCursor: string | null;
  done: boolean;
  error?: string;
}

interface PhaseState {
  running: boolean;
  cursor: string | null;
  done: boolean;
  totalPulled: number;
  totalCreated: number;
  totalUpdated: number;
  totalLinkedToBrand: number;
  totalUnlinked: number;
  batches: number;
  error: string | null;
}

const initialPhase: PhaseState = {
  running: false,
  cursor: null,
  done: false,
  totalPulled: 0,
  totalCreated: 0,
  totalUpdated: 0,
  totalLinkedToBrand: 0,
  totalUnlinked: 0,
  batches: 0,
  error: null,
};

export default function HubSpotImportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [auth, setAuth] = useState<{ ok: boolean; error?: string } | null>(
    null,
  );
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [companies, setCompanies] = useState<PhaseState>({ ...initialPhase });
  const [contacts, setContacts] = useState<PhaseState>({ ...initialPhase });

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/hubspot-import/preview");
      const json = await res.json();
      setPreview(json);
    } catch (e: any) {
      setPreview({ ok: false, error: e?.message });
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (!["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/home");
      return;
    }
    fetch("/api/admin/hubspot-import/test")
      .then((r) => r.json())
      .then((j) => {
        setAuth(j);
        // Auto-load the preview if auth succeeded so the admin sees
        // counts + samples immediately on page load.
        if (j?.ok) loadPreview();
      })
      .catch((e: any) => setAuth({ ok: false, error: e.message }));
  }, [user, router]);

  async function runOneBatch(
    phase: "companies" | "contacts",
    state: PhaseState,
    setState: (s: PhaseState) => void,
  ) {
    setState({ ...state, running: true, error: null });
    try {
      const res = await fetch(`/api/admin/hubspot-import/${phase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: 50,
          after: state.cursor || undefined,
        }),
      });
      const data: BatchResult = await res.json();
      if (!res.ok || !data.ok) {
        setState({
          ...state,
          running: false,
          error: data.error || `HTTP ${res.status}`,
        });
        return;
      }
      setState({
        running: false,
        cursor: data.nextCursor,
        done: !!data.done,
        totalPulled: state.totalPulled + (data.pulled || 0),
        totalCreated: state.totalCreated + (data.created || 0),
        totalUpdated:
          state.totalUpdated +
          (data.updatedById || 0) +
          (data.updatedByDomain || 0) +
          (data.updatedByName || 0) +
          (data.updatedByEmail || 0),
        totalLinkedToBrand:
          state.totalLinkedToBrand + (data.linkedToBrand || 0),
        totalUnlinked: state.totalUnlinked + (data.unlinked || 0),
        batches: state.batches + 1,
        error: null,
      });
    } catch (e: any) {
      setState({
        ...state,
        running: false,
        error: e?.message || "Network error",
      });
    }
  }

  async function runUntilDone(
    phase: "companies" | "contacts",
    initial: PhaseState,
    setState: (s: PhaseState) => void,
  ) {
    let s = { ...initial, running: true };
    setState(s);
    while (!s.done) {
      const res = await fetch(`/api/admin/hubspot-import/${phase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, after: s.cursor || undefined }),
      });
      const data: BatchResult = await res.json();
      if (!res.ok || !data.ok) {
        s = { ...s, running: false, error: data.error || `HTTP ${res.status}` };
        setState(s);
        return;
      }
      s = {
        running: !data.done,
        cursor: data.nextCursor,
        done: !!data.done,
        totalPulled: s.totalPulled + (data.pulled || 0),
        totalCreated: s.totalCreated + (data.created || 0),
        totalUpdated:
          s.totalUpdated +
          (data.updatedById || 0) +
          (data.updatedByDomain || 0) +
          (data.updatedByName || 0) +
          (data.updatedByEmail || 0),
        totalLinkedToBrand:
          s.totalLinkedToBrand + (data.linkedToBrand || 0),
        totalUnlinked: s.totalUnlinked + (data.unlinked || 0),
        batches: s.batches + 1,
        error: null,
      };
      setState(s);
      if (!data.nextCursor) break;
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin" className="hover:text-[#00b4c3]">
            Admin
          </Link>
          <span>/</span>
          <span>HubSpot Import</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">HubSpot → Atlas Migration</h1>
        <p className="text-slate-600 mt-1 max-w-2xl">
          Day 1 — pull every Company and Contact from your HubSpot account
          into Atlas. Idempotent: re-running picks up where it left off and
          updates existing rows instead of duplicating. Day 2 will add
          Notes + Engagements.
        </p>
      </div>

      {/* Auth status banner */}
      <div className="mb-6">
        {auth == null ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            Checking HubSpot connection…
          </div>
        ) : auth.ok ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
            ✓ HubSpot key works. Ready to import.
          </div>
        ) : (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <p className="font-bold">HubSpot connection failed:</p>
            <p className="mt-1">{auth.error}</p>
            <p className="mt-2 text-xs text-red-700">
              Set <code className="bg-white px-1 rounded">HUBSPOT_API_KEY</code> in
              Vercel Settings → Environment Variables (Production scope).
              The token is a Private App access token (Settings →
              Integrations → Private Apps in HubSpot). After adding,
              redeploy or hard-refresh.
            </p>
          </div>
        )}
      </div>

      {/* Live preview — counts + samples from HubSpot. Lets the admin
          sanity-check what's in the source before kicking off a full
          pull. Auto-loads after the auth check lights green. */}
      {auth?.ok && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Source preview</h2>
            <button
              onClick={loadPreview}
              disabled={previewLoading}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded font-semibold disabled:opacity-50"
            >
              {previewLoading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>

          {!preview ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !preview.ok ? (
            <div className="text-sm text-red-700">
              {preview.error || "Preview failed"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contacts */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide font-bold text-slate-600">
                    Contacts in HubSpot
                  </p>
                  <p className="text-2xl font-black text-cyan-700">
                    {preview.contacts.total.toLocaleString()}
                  </p>
                </div>
                {preview.contacts.error ? (
                  <p className="text-xs text-red-700">
                    {preview.contacts.error}
                  </p>
                ) : preview.contacts.sample.length === 0 ? (
                  <p className="text-xs text-slate-400">No contacts</p>
                ) : (
                  <ul className="text-xs space-y-1 bg-slate-50 rounded p-2 border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                      Most-recent 5
                    </p>
                    {preview.contacts.sample.map((c: any) => (
                      <li
                        key={c.id}
                        className="flex justify-between gap-2 truncate"
                      >
                        <span className="truncate">
                          <strong>{c.name || "(no name)"}</strong>
                          {c.email && (
                            <span className="text-slate-500"> · {c.email}</span>
                          )}
                          {c.jobTitle && (
                            <span className="text-slate-400">
                              {" "}
                              · {c.jobTitle}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Companies */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide font-bold text-slate-600">
                    Companies in HubSpot
                  </p>
                  <p className="text-2xl font-black text-cyan-700">
                    {preview.companies.total.toLocaleString()}
                  </p>
                </div>
                {preview.companies.error ? (
                  <p className="text-xs text-red-700">
                    {preview.companies.error}
                  </p>
                ) : preview.companies.sample.length === 0 ? (
                  <p className="text-xs text-slate-400">No companies</p>
                ) : (
                  <ul className="text-xs space-y-1 bg-slate-50 rounded p-2 border border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                      Most-recent 5
                    </p>
                    {preview.companies.sample.map((c: any) => (
                      <li
                        key={c.id}
                        className="flex justify-between gap-2 truncate"
                      >
                        <span className="truncate">
                          <strong>{c.name || "(no name)"}</strong>
                          {c.domain && (
                            <span className="text-slate-500">
                              {" "}
                              · {c.domain}
                            </span>
                          )}
                          {c.country && (
                            <span className="text-slate-400">
                              {" "}
                              · {c.country}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            These are the totals you should expect to land in Atlas after
            running both phases below. Sample rows are the 5 most-recently
            modified — useful to spot field drift (missing emails, junk
            domains, stale form-submission contacts).
          </p>
        </div>
      )}

      {/* CSV import — works without HubSpot API auth. Use this when
          the API token has expired or the HubSpot account doesn't
          support Private Apps (developer accounts). Drops in CSV
          exports from HubSpot UI, classifies industry-by-industry to
          filter out medical/pharma/finance/etc., and chunks the
          import. Lives ABOVE the API path so it's the obvious entry
          point. */}
      <div className="mb-6">
        <HubSpotCSVImport />
      </div>

      {/* Cross-table duplicate audit — for cleaning up after an
          import that ran without (or before) the cross-table check.
          Andrew can scan, click "Merge → factory: Hone-Strong"
          per duplicate, contacts ride along. */}
      <div className="mb-6">
        <HubSpotDuplicateAudit />
      </div>

      {/* Brand-to-brand duplicate audit — finds Atlas brand rows
          that collide with OTHER atlas brand rows (HubSpot variant
          name vs original Atlas name, etc.). Bulk-merge for safe
          pairs, manual review for fuzzy / cluster-of-3+ cases. */}
      <div className="mb-6">
        <BrandDuplicateAudit />
      </div>

      <div className="mb-3 mt-8 pt-6 border-t border-slate-200">
        <p className="text-xs uppercase tracking-wide font-bold text-slate-500">
          API path (legacy — needs working HubSpot token)
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          Use this if you have a Private App access token in
          HUBSPOT_API_KEY. Falls through to CSV path above if auth
          fails.
        </p>
      </div>

      {/* Step 1: Companies */}
      <PhaseCard
        title="1. Pull Companies → Brands"
        description="Runs first. HubSpot Companies become Atlas Brand rows in LEAD stage. Matched by hubspotId → website domain → name. Subsequent contacts will link to brands via this match."
        state={companies}
        onRunBatch={() => runOneBatch("companies", companies, setCompanies)}
        onRunAll={() => runUntilDone("companies", companies, setCompanies)}
        primaryLabel="Pull next 50"
        autoLabel="Pull until done"
        disabled={!auth?.ok}
        terminologyMap={{ totalCreated: "Brands created", totalUpdated: "Brands updated" }}
      />

      {/* Step 2: Contacts */}
      <PhaseCard
        title="2. Pull Contacts"
        description="Runs after companies so each contact can link to its Brand via the HubSpot company association. Matched by hubspotId → email. Contacts whose company hasn't been imported will land unlinked — re-run companies then contacts to fix."
        state={contacts}
        onRunBatch={() => runOneBatch("contacts", contacts, setContacts)}
        onRunAll={() => runUntilDone("contacts", contacts, setContacts)}
        primaryLabel="Pull next 50"
        autoLabel="Pull until done"
        disabled={!auth?.ok || (!companies.done && companies.totalPulled === 0)}
        disabledReason={
          !companies.done && companies.totalPulled === 0
            ? "Pull companies first so contacts can link to their brand."
            : undefined
        }
        terminologyMap={{
          totalCreated: "Contacts created",
          totalUpdated: "Contacts updated",
          totalLinkedToBrand: "Linked to brand",
          totalUnlinked: "Unlinked (no company match)",
        }}
      />

      {/* Day 2 placeholder */}
      <div className="mt-6 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
        <p className="text-sm text-slate-700">
          <strong>Day 2 (next ship):</strong> Notes + Engagements (calls,
          emails, meetings) → become Atlas Note rows on the right brandId
          with original author + timestamp preserved.
        </p>
      </div>
    </div>
  );
}

function PhaseCard({
  title,
  description,
  state,
  onRunBatch,
  onRunAll,
  primaryLabel,
  autoLabel,
  disabled,
  disabledReason,
  terminologyMap,
}: {
  title: string;
  description: string;
  state: PhaseState;
  onRunBatch: () => void;
  onRunAll: () => void;
  primaryLabel: string;
  autoLabel: string;
  disabled?: boolean;
  disabledReason?: string;
  terminologyMap: Record<string, string>;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 mt-1 max-w-2xl">{description}</p>

      {/* Stats */}
      {state.totalPulled > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat
            label="Pulled"
            value={state.totalPulled}
          />
          {Object.entries(terminologyMap).map(([key, label]) => (
            <Stat key={key} label={label} value={(state as any)[key] || 0} />
          ))}
          <Stat label="Batches" value={state.batches} />
        </div>
      )}

      {state.error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {state.error}
        </div>
      )}

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={onRunBatch}
          disabled={disabled || state.running || state.done}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 disabled:opacity-50"
        >
          {state.running
            ? "⏳ Pulling…"
            : state.done
              ? "✓ Complete"
              : primaryLabel}
        </button>
        <button
          onClick={onRunAll}
          disabled={disabled || state.running || state.done}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-700 disabled:opacity-50"
        >
          {state.running ? "⏳ Auto-pulling…" : autoLabel}
        </button>
        {state.done && (
          <span className="text-sm text-emerald-700 font-semibold">
            ✓ All HubSpot rows pulled
          </span>
        )}
        {state.cursor && !state.done && !state.running && (
          <span className="text-xs text-slate-500">
            Resume cursor saved — next click continues from where you left off.
          </span>
        )}
      </div>

      {disabled && disabledReason && (
        <p className="mt-2 text-xs text-amber-600">{disabledReason}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-slate-600 font-bold">
        {label}
      </p>
      <p className="text-lg font-black text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
