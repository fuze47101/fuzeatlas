"use client";

/**
 * /lab-portal/lab-tests — Phase 10B per-lab catalog manager.
 *
 * Edits LabTest rows (the new model). Distinct from
 * /lab-portal/catalog (legacy LabService). Each row carries
 * publishedPriceUsd (lab editable) and fuzeCostUsd (FUZE-internal
 * only). Markup % surfaces as a calculated column when both are
 * present and the viewer is internal.
 */
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";

interface Row {
  id: string;
  testType: string;
  protocolName: string;
  fuzeCostUsd: number | null;
  publishedPriceUsd: number | null;
  slaDays: number | null;
  notes: string | null;
  active: boolean;
}

const TEST_TYPES = [
  "ICP_MS",
  "AATCC_100",
  "ASTM_E2149",
  "AATCC_30",
  "ISO_18184",
  "ISO_20743",
  "OTHER",
];

export default function LabTestsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.labPortal.labTestsPage;
  const [rows, setRows] = useState<Row[]>([]);
  const [canEditFuzeCost, setCanEditFuzeCost] = useState(false);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/lab-portal/lab-tests");
      const j = await res.json();
      if (j.ok) {
        setRows(j.rows);
        setCanEditFuzeCost(!!j.canEditFuzeCost);
      } else setError(j.error || "Failed to load");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!draft.testType || !draft.protocolName) {
      setError("Test type and protocol name required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/lab-portal/lab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Save failed");
      } else {
        setDraft({});
        setError(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, patch: Partial<Row>) {
    await fetch("/api/lab-portal/lab-tests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Deactivate this catalog row?")) return;
    await fetch(`/api/lab-portal/lab-tests?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-protocol pricing + SLA. Published price is what FUZE charges
          customers; FUZE cost is what FUZE pays you (FUZE-internal only).
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-3 py-2">Protocol</th>
              <th className="text-right px-3 py-2">Published</th>
              {canEditFuzeCost && (
                <>
                  <th className="text-right px-3 py-2">FUZE cost</th>
                  <th className="text-right px-3 py-2">Markup</th>
                </>
              )}
              <th className="text-right px-3 py-2">SLA d</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-bold text-slate-900">{r.testType}</td>
                <td className="px-3 py-2 text-slate-700">{r.protocolName}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <input
                    type="number"
                    defaultValue={r.publishedPriceUsd ?? ""}
                    onBlur={(e) =>
                      patch(r.id, {
                        publishedPriceUsd: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-20 px-2 py-1 border border-slate-200 rounded text-right"
                  />
                </td>
                {canEditFuzeCost && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <input
                        type="number"
                        defaultValue={r.fuzeCostUsd ?? ""}
                        onBlur={(e) =>
                          patch(r.id, {
                            fuzeCostUsd: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-20 px-2 py-1 border border-slate-200 rounded text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.fuzeCostUsd && r.publishedPriceUsd
                        ? `${(((r.publishedPriceUsd - r.fuzeCostUsd) / r.fuzeCostUsd) * 100).toFixed(0)}%`
                        : "—"}
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right tabular-nums">
                  <input
                    type="number"
                    defaultValue={r.slaDays ?? ""}
                    onBlur={(e) =>
                      patch(r.id, { slaDays: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="w-14 px-2 py-1 border border-slate-200 rounded text-right"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Drop
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50/50">
              <td className="px-4 py-2">
                <select
                  value={draft.testType || ""}
                  onChange={(e) => setDraft({ ...draft, testType: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                >
                  <option value="">— pick —</option>
                  {TEST_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  placeholder="protocol name"
                  value={draft.protocolName || ""}
                  onChange={(e) => setDraft({ ...draft, protocolName: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-200 rounded text-sm"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  placeholder="$"
                  value={draft.publishedPriceUsd ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, publishedPriceUsd: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-20 px-2 py-1 border border-slate-200 rounded text-right"
                />
              </td>
              {canEditFuzeCost && (
                <>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      placeholder="$"
                      value={draft.fuzeCostUsd ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, fuzeCostUsd: e.target.value === "" ? null : Number(e.target.value) })
                      }
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">—</td>
                </>
              )}
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  placeholder="d"
                  value={draft.slaDays ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, slaDays: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="w-14 px-2 py-1 border border-slate-200 rounded text-right"
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-1 bg-[#00b4c3] text-white rounded text-xs font-bold hover:bg-[#009aa8] disabled:opacity-50"
                >
                  {saving ? "…" : "Add"}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Soft-delete only — "Drop" sets active=false; the row stays in the
        history. Re-adding the same {`(testType, protocolName)`} pair will
        reactivate it.
      </p>
    </div>
  );
}
