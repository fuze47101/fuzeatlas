// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

/**
 * /distributor-portal/factories — Tina Distributor's "add a factory
 * to my org without an admin in the loop" surface (T5 phase 16).
 *
 * Shows two cohorts side-by-side:
 *   - Primary distributor: factories whose Factory.distributorId
 *     already points at this distributor.
 *   - Roster: factories added via DistributorFactory junction
 *     (shared factories, secondary distributor relationships).
 *
 * Admins surface a distributorId picker for support troubleshooting.
 */
export default function DistributorFactoriesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/distributor-portal/factories");
      const d = await r.json();
      if (d.ok) setRows(d.factories || []);
      else setError(d.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Debounced factory search to populate the picker.
  useEffect(() => {
    if (!showAdd) return;
    const q = search.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`/api/factories?q=${encodeURIComponent(q)}&pageSize=20`);
        const d = await r.json();
        const list = d.factories || d.items || [];
        const have = new Set(rows.map((x) => x.id));
        setCandidates(list.filter((f: any) => !have.has(f.id)));
      } catch {
        setCandidates([]);
      }
    }, 220);
    return () => clearTimeout(h);
  }, [search, showAdd, rows]);

  const addFactory = async (factoryId: string) => {
    setAdding(true);
    setError("");
    try {
      const r = await fetch("/api/distributor-portal/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId, note: note || null }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error || "Failed to add");
        return;
      }
      setShowAdd(false);
      setSearch("");
      setNote("");
      load();
    } finally {
      setAdding(false);
    }
  };

  const removeFromRoster = async (rosterId: string) => {
    if (!confirm("Remove this factory from your roster?")) return;
    try {
      const r = await fetch(`/api/distributor-portal/factories/${rosterId}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (d.ok) load();
      else setError(d.error || "Failed to remove");
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roster = rows.filter((r) => r.via === "roster");
  const primary = rows.filter((r) => r.via === "primary");

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
            Distributor Portal
          </p>
          <h1 className="text-3xl font-black text-slate-900">Factory Roster</h1>
          <p className="text-slate-600 max-w-2xl mt-1 text-sm">
            Factories you supply FUZE to. Includes primary-distributor factories
            (assigned by FUZE) plus any factories you have added directly.
            Adding a factory here does not change which distributor FUZE bills
            them through — talk to FUZE admin if you need primary reassignment.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex-shrink-0 px-4 py-2 bg-[#00b4c3] text-white text-sm font-bold rounded-lg hover:bg-[#009aa8]"
        >
          {showAdd ? "Cancel" : "+ Add Factory"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="mb-6 p-4 bg-cyan-50/50 border border-cyan-200 rounded-xl">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Search factories
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, country, city — at least 2 characters"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            autoFocus
          />
          <label className="block text-xs font-bold text-slate-700 mt-3 mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. shared with SRS-Turkey, container co-ship arrangement"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          {candidates.length > 0 && (
            <div className="mt-3 bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {candidates.map((f: any) => (
                <button
                  key={f.id}
                  disabled={adding}
                  onClick={() => addFactory(f.id)}
                  className="w-full px-4 py-3 text-left hover:bg-cyan-50 flex items-center justify-between gap-3 disabled:opacity-50"
                >
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{f.name}</div>
                    <div className="text-xs text-slate-500">
                      {[f.city, f.country].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <span className="text-xs text-[#00b4c3] font-bold">Add →</span>
                </button>
              ))}
            </div>
          )}
          {search.length >= 2 && candidates.length === 0 && (
            <p className="text-xs text-slate-500 mt-3">
              No matching factories. Ask FUZE admin to invite a new factory into Atlas.
            </p>
          )}
        </div>
      )}

      {primary.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">
            Primary distributor ({primary.length})
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            FUZE has assigned you as the primary distributor for these factories.
            They appear on your pricing tiers and FuzeOrder rollups automatically.
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {primary.map((f: any) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <Link
                  href={`/factories/${f.id}`}
                  className="flex-1 min-w-0 hover:bg-slate-50 -mx-4 px-4 -my-3 py-3"
                >
                  <div className="font-semibold text-slate-900 text-sm">{f.name}</div>
                  <div className="text-xs text-slate-500">
                    {[f.city, f.country].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Link>
                <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Primary
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2">
          Roster ({roster.length})
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Factories you have added to your own roster. Useful for shared
          factories or downstream sub-distributor relationships.
        </p>
        {roster.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl px-4 py-8 text-center text-sm text-slate-500">
            No factories added yet. Click <strong>+ Add Factory</strong> above to start.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {roster.map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <Link
                  href={`/factories/${r.id}`}
                  className="flex-1 min-w-0 hover:bg-slate-50 -mx-4 px-4 -my-3 py-3"
                >
                  <div className="font-semibold text-slate-900 text-sm">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    {[r.city, r.country].filter(Boolean).join(" · ") || "—"}
                    {r.note && <span className="text-slate-400"> · {r.note}</span>}
                  </div>
                </Link>
                <button
                  onClick={() => removeFromRoster(r.rosterId)}
                  className="text-xs text-rose-600 hover:underline font-semibold flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
