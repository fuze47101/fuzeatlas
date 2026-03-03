"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { COMPETITORS, type Competitor } from "@/lib/competitors";

type Override = {
  id?: string;
  competitorId: string;
  chemicalPricePerKg: number | null;
  chemicalPriceSource: string | null;
  chemicalPriceDate: string | null;
  binderPricePerKg: number | null;
  estimatedCostPerMeterLow: number | null;
  estimatedCostPerMeterHigh: number | null;
  estimatedCostPerMeterTypical: number | null;
  retreatmentCostMultiplier: number | null;
  notes: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
};

type EditingRow = {
  competitorId: string;
  chemicalPricePerKg: string;
  chemicalPriceSource: string;
  chemicalPriceDate: string;
  binderPricePerKg: string;
  estimatedCostPerMeterLow: string;
  estimatedCostPerMeterHigh: string;
  estimatedCostPerMeterTypical: string;
  retreatmentCostMultiplier: string;
  notes: string;
};

function emptyRow(competitorId: string): EditingRow {
  return {
    competitorId,
    chemicalPricePerKg: "",
    chemicalPriceSource: "",
    chemicalPriceDate: "",
    binderPricePerKg: "",
    estimatedCostPerMeterLow: "",
    estimatedCostPerMeterHigh: "",
    estimatedCostPerMeterTypical: "",
    retreatmentCostMultiplier: "",
    notes: "",
  };
}

function overrideToRow(o: Override): EditingRow {
  return {
    competitorId: o.competitorId,
    chemicalPricePerKg: o.chemicalPricePerKg?.toString() ?? "",
    chemicalPriceSource: o.chemicalPriceSource ?? "",
    chemicalPriceDate: o.chemicalPriceDate ? o.chemicalPriceDate.slice(0, 10) : "",
    binderPricePerKg: o.binderPricePerKg?.toString() ?? "",
    estimatedCostPerMeterLow: o.estimatedCostPerMeterLow?.toString() ?? "",
    estimatedCostPerMeterHigh: o.estimatedCostPerMeterHigh?.toString() ?? "",
    estimatedCostPerMeterTypical: o.estimatedCostPerMeterTypical?.toString() ?? "",
    retreatmentCostMultiplier: o.retreatmentCostMultiplier?.toString() ?? "",
    notes: o.notes ?? "",
  };
}

export default function CompetitorPricingAdmin() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditingRow | null>(null);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const fetchOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/competitor-pricing");
      const data = await res.json();
      if (data.ok) setOverrides(data.overrides);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverrides(); }, [fetchOverrides]);

  // Clear flash after 3s
  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(t);
    }
  }, [flash]);

  function getOverride(competitorId: string): Override | undefined {
    return overrides.find((o) => o.competitorId === competitorId);
  }

  function startEdit(competitor: Competitor) {
    const existing = getOverride(competitor.id);
    setEditingId(competitor.id);
    setEditRow(existing ? overrideToRow(existing) : emptyRow(competitor.id));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRow(null);
  }

  async function saveRow() {
    if (!editRow) return;
    setSaving(editRow.competitorId);

    try {
      const body: Record<string, unknown> = {
        competitorId: editRow.competitorId,
        chemicalPricePerKg: editRow.chemicalPricePerKg ? Number(editRow.chemicalPricePerKg) : null,
        chemicalPriceSource: editRow.chemicalPriceSource || null,
        chemicalPriceDate: editRow.chemicalPriceDate || null,
        binderPricePerKg: editRow.binderPricePerKg ? Number(editRow.binderPricePerKg) : null,
        estimatedCostPerMeterLow: editRow.estimatedCostPerMeterLow ? Number(editRow.estimatedCostPerMeterLow) : null,
        estimatedCostPerMeterHigh: editRow.estimatedCostPerMeterHigh ? Number(editRow.estimatedCostPerMeterHigh) : null,
        estimatedCostPerMeterTypical: editRow.estimatedCostPerMeterTypical ? Number(editRow.estimatedCostPerMeterTypical) : null,
        retreatmentCostMultiplier: editRow.retreatmentCostMultiplier ? Number(editRow.retreatmentCostMultiplier) : null,
        notes: editRow.notes || null,
      };

      const res = await fetch("/api/admin/competitor-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setFlash({ type: "ok", msg: `Saved pricing for ${editRow.competitorId}` });
        await fetchOverrides();
        cancelEdit();
      } else {
        setFlash({ type: "err", msg: data.error || "Failed to save" });
      }
    } catch (err: any) {
      setFlash({ type: "err", msg: err.message });
    } finally {
      setSaving(null);
    }
  }

  async function deleteOverride(competitorId: string) {
    if (!confirm(`Remove custom pricing for ${competitorId}? It will revert to estimates.`)) return;
    try {
      const res = await fetch(`/api/admin/competitor-pricing?competitorId=${competitorId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setFlash({ type: "ok", msg: `Reverted ${competitorId} to estimates` });
        await fetchOverrides();
      }
    } catch {
      // silent
    }
  }

  function field(label: string, key: keyof EditingRow, type: "text" | "number" | "date" = "text", placeholder?: string) {
    if (!editRow) return null;
    return (
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
        <input
          type={type}
          value={editRow[key]}
          onChange={(e) => setEditRow({ ...editRow, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00b4c3] focus:ring-1 focus:ring-[#00b4c3] outline-none"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/pricing" className="text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-white">Competitor Pricing Intelligence</h1>
          </div>
          <p className="text-sm text-slate-400">
            Override guesstimate prices with real distributor quotes. Overrides flow into the Pricing & Environment comparison tool.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-medium">
            ADMIN ONLY — CONFIDENTIAL
          </span>
        </div>
      </div>

      {/* Flash message */}
      {flash && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          flash.type === "ok" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            : "bg-red-500/10 border border-red-500/30 text-red-400"
        }`}>
          {flash.msg}
        </div>
      )}

      {/* Legend */}
      <div className="mb-6 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Real data (admin override)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Guesstimate (research)
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {COMPETITORS.map((comp) => {
            const ov = getOverride(comp.id);
            const hasOverride = !!ov;
            const isEditing = editingId === comp.id;

            return (
              <div key={comp.id} className={`rounded-xl border transition-colors ${
                hasOverride
                  ? "bg-slate-800/80 border-emerald-500/30"
                  : "bg-slate-800/40 border-slate-700/50"
              }`}>
                {/* Competitor header row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${hasOverride ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold text-sm">{comp.product}</h3>
                      <p className="text-slate-400 text-xs">
                        {comp.company} — {comp.chemistryLabel}
                        {comp.epaRegNumber && (
                          <span className="ml-2 text-slate-500">
                            EPA: {comp.epaRegNumber}
                            {comp.epaRegYear && <span className="text-amber-500/70"> ({comp.epaRegYear})</span>}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    {/* Current prices */}
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Chemical $/kg</span>
                      <span className={`font-mono font-bold ${hasOverride ? "text-emerald-400" : "text-amber-400"}`}>
                        ${(ov?.chemicalPricePerKg ?? comp.chemicalPricePerKg).toFixed(0)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Binder $/kg</span>
                      <span className={`font-mono font-bold ${hasOverride && ov?.binderPricePerKg ? "text-emerald-400" : "text-amber-400"}`}>
                        ${(ov?.binderPricePerKg ?? comp.binderPricePerKg).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block">Typical $/m</span>
                      <span className={`font-mono font-bold ${hasOverride && ov?.estimatedCostPerMeterTypical ? "text-emerald-400" : "text-amber-400"}`}>
                        ${(ov?.estimatedCostPerMeterTypical ?? comp.estimatedCostPerMeterTypical).toFixed(3)}
                      </span>
                    </div>

                    {hasOverride && ov?.updatedAt && (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Updated</span>
                        <span className="text-xs text-slate-300">
                          {new Date(ov.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(comp)}
                          className="px-3 py-1.5 bg-[#00b4c3] text-white text-xs font-medium rounded-lg hover:bg-[#00a0b0] transition-colors"
                        >
                          {hasOverride ? "Edit" : "Add Intel"}
                        </button>
                      )}
                      {hasOverride && !isEditing && (
                        <button
                          onClick={() => deleteOverride(comp.id)}
                          className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/20 border border-red-500/30 transition-colors"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Source line */}
                <div className="px-5 pb-3 -mt-1">
                  <p className="text-xs text-slate-500 italic truncate">
                    Source: {ov?.chemicalPriceSource ?? comp.chemicalPriceSource}
                  </p>
                </div>

                {/* Editing panel */}
                {isEditing && editRow && (
                  <div className="border-t border-slate-700/50 px-5 py-5 space-y-5">
                    <div className="text-xs font-medium text-[#00b4c3] uppercase tracking-wider mb-3">
                      Enter Distributor Intelligence
                    </div>

                    {/* Core pricing */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {field("Chemical Price ($/kg)", "chemicalPricePerKg", "number", comp.chemicalPricePerKg.toString())}
                      {field("Source / Contact", "chemicalPriceSource", "text", "China distributor, agent name...")}
                      {field("Price Date", "chemicalPriceDate", "date")}
                      {field("Binder Price ($/kg)", "binderPricePerKg", "number", comp.binderPricePerKg.toString())}
                    </div>

                    {/* Application costs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {field("Cost/m Low ($)", "estimatedCostPerMeterLow", "number", comp.estimatedCostPerMeterLow.toString())}
                      {field("Cost/m High ($)", "estimatedCostPerMeterHigh", "number", comp.estimatedCostPerMeterHigh.toString())}
                      {field("Cost/m Typical ($)", "estimatedCostPerMeterTypical", "number", comp.estimatedCostPerMeterTypical.toString())}
                      {field("Re-treatment Multiplier", "retreatmentCostMultiplier", "number", comp.retreatmentCostMultiplier.toString())}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                      <textarea
                        value={editRow.notes}
                        onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })}
                        placeholder="Confidence level, distributor details, market conditions..."
                        rows={2}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00b4c3] focus:ring-1 focus:ring-[#00b4c3] outline-none resize-none"
                      />
                    </div>

                    {/* Guesstimate reference */}
                    <div className="p-3 bg-slate-700/30 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1 font-medium">Current Guesstimates (for reference):</p>
                      <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                        <span>Chemical: ${comp.chemicalPricePerKg}/kg</span>
                        <span>Binder: ${comp.binderPricePerKg}/kg</span>
                        <span>Typical: ${comp.estimatedCostPerMeterTypical}/m</span>
                        <span>Re-treat: {comp.retreatmentCostMultiplier}x</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={saveRow}
                        disabled={saving === editRow.competitorId}
                        className="px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        {saving === editRow.competitorId ? "Saving..." : "Save Intelligence"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-5 py-2 text-slate-400 text-sm hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 text-center">
          <p className="text-2xl font-bold text-emerald-400">{overrides.length}</p>
          <p className="text-xs text-slate-400 mt-1">Real Intel Entries</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 text-center">
          <p className="text-2xl font-bold text-amber-400">{COMPETITORS.length - overrides.length}</p>
          <p className="text-xs text-slate-400 mt-1">Still Guesstimates</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 text-center">
          <p className="text-2xl font-bold text-white">{COMPETITORS.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total Competitors</p>
        </div>
      </div>
    </div>
  );
}
