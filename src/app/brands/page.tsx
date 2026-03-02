"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

const STAGES = [
  "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
  "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
];
const STAGE_COLORS: Record<string,string> = {
  LEAD:"#94a3b8", PRESENTATION:"#60a5fa", BRAND_TESTING:"#a78bfa",
  FACTORY_ONBOARDING:"#f59e0b", FACTORY_TESTING:"#fb923c",
  PRODUCTION:"#34d399", BRAND_EXPANSION:"#2dd4bf", ARCHIVE:"#6b7280", CUSTOMER_WON:"#22c55e",
};

type Brand = { id: string; name: string; pipelineStage: string; salesRep: string | null; customerType: string | null; fabricCount: number; submissionCount: number; factoryCount: number; contactCount: number; };

export default function BrandsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [grouped, setGrouped] = useState<Record<string, Brand[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState("");

  // Build stage labels from translations
  const STAGE_LABELS: Record<string, string> = {
    LEAD: t.stages.LEAD,
    PRESENTATION: t.stages.PRESENTATION,
    BRAND_TESTING: t.stages.BRAND_TESTING,
    FACTORY_ONBOARDING: t.stages.FACTORY_ONBOARDING,
    FACTORY_TESTING: t.stages.FACTORY_TESTING,
    PRODUCTION: t.stages.PRODUCTION,
    BRAND_EXPANSION: t.stages.BRAND_EXPANSION,
    ARCHIVE: t.stages.ARCHIVE,
    CUSTOMER_WON: t.stages.CUSTOMER_WON,
  };

  const loadBrands = () => {
    fetch("/api/brands").then(r => r.json()).then(j => {
      if (j.ok) { setGrouped(j.grouped); setTotal(j.total); }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadBrands(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/brands/${deleteTarget.id}?code=${encodeURIComponent(adminCode)}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        setDeleteTarget(null);
        // Remove from local state immediately
        setGrouped(prev => {
          const next = { ...prev };
          for (const stage of Object.keys(next)) {
            next[stage] = next[stage].filter(b => b.id !== deleteTarget.id);
          }
          return next;
        });
        setTotal(prev => prev - 1);
      } else {
        setDeleteError(j.error || "Delete failed");
      }
    } catch (e: any) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-lg">{t.brands.loading}</div>;

  const q = search.toLowerCase();

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{t.brands.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.brands.brandsAcrossStages(total, STAGES.length)}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder={t.brands.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button onClick={() => router.push("/brands/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">{t.brands.addNew}</button>
        </div>
      </div>

      {/* Pipeline summary strip */}
      <div className="flex gap-1 mb-6 rounded-xl overflow-hidden h-10">
        {STAGES.map(s => {
          const count = (grouped[s] || []).length;
          if (count === 0) return null;
          return (
            <div key={s} className="flex items-center justify-center text-white text-[11px] font-bold transition-all hover:opacity-80"
              style={{ flex: count, background: STAGE_COLORS[s] }} title={`${STAGE_LABELS[s]}: ${count}`}>
              {count > 5 ? `${STAGE_LABELS[s]} (${count})` : count}
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {STAGES.map(stage => {
          const brands = (grouped[stage] || []).filter(b =>
            !q || b.name.toLowerCase().includes(q) || (b.salesRep && b.salesRep.toLowerCase().includes(q))
          );
          return (
            <div key={stage} className="flex-shrink-0 w-64">
              <div className="rounded-t-lg px-3 py-2 flex items-center justify-between" style={{ background: STAGE_COLORS[stage] }}>
                <span className="text-white text-xs font-bold">{STAGE_LABELS[stage]}</span>
                <span className="bg-white/30 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{brands.length}</span>
              </div>
              <div className="bg-slate-100 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[70vh] overflow-y-auto">
                {brands.map(b => (
                  <div key={b.id} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative">
                    <div onClick={() => router.push(`/brands/${b.id}`)}>
                      <div className="font-bold text-sm text-slate-900 truncate pr-6">{b.name}</div>
                      {b.salesRep && <div className="text-[11px] text-slate-500 mt-1 truncate">{b.salesRep}</div>}
                      <div className="flex gap-3 mt-2 text-[11px] text-slate-500">
                        {b.fabricCount > 0 && <span title={t.brands.fabrics}>🧵 {b.fabricCount}</span>}
                        {b.submissionCount > 0 && <span title={t.brands.submissions}>📋 {b.submissionCount}</span>}
                        {b.factoryCount > 0 && <span title={t.brands.factories}>🏭 {b.factoryCount}</span>}
                      </div>
                    </div>
                    {/* Quick delete button — always visible */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); setDeleteError(null); setAdminCode(""); }}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
                      title={t.brands.deleteBrand}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {brands.length === 0 && <div className="text-xs text-slate-400 text-center py-8">{t.brands.noBrands}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t.brands.deleteBrand}</h3>
            <p className="text-sm text-slate-600 mb-1">
              {t.brands.deleteConfirm} <strong className="text-slate-900">{deleteTarget.name}</strong>?
            </p>
            {(deleteTarget.fabricCount > 0 || deleteTarget.submissionCount > 0 || deleteTarget.factoryCount > 0) ? (
              <p className="text-xs text-amber-600 mb-4">
                {t.brands.hasLinkedRecords} {[
                  deleteTarget.fabricCount > 0 && `${deleteTarget.fabricCount} ${t.brands.fabrics.toLowerCase()}`,
                  deleteTarget.submissionCount > 0 && `${deleteTarget.submissionCount} ${t.brands.submissions.toLowerCase()}`,
                  deleteTarget.factoryCount > 0 && `${deleteTarget.factoryCount} ${t.brands.factories.toLowerCase()}`,
                ].filter(Boolean).join(", ")}. {t.brands.deleteMayFail}
              </p>
            ) : (
              <p className="text-xs text-slate-500 mb-4">{t.brands.noLinkedRecords}</p>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t.brands.adminCode}</label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && adminCode) handleDelete(); }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder={t.brands.adminCodePlaceholder}
                autoFocus
              />
            </div>
            {deleteError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{deleteError}</div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !adminCode}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t.common.deleting : t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
