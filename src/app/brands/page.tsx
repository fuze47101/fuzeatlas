"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "LEAD","PRESENTATION","BRAND_TESTING","FACTORY_ONBOARDING",
  "FACTORY_TESTING","PRODUCTION","BRAND_EXPANSION","ARCHIVE","CUSTOMER_WON",
];
const STAGE_LABELS: Record<string,string> = {
  LEAD:"Lead", PRESENTATION:"Presentation", BRAND_TESTING:"Brand Testing",
  FACTORY_ONBOARDING:"Factory Onboard", FACTORY_TESTING:"Factory Testing",
  PRODUCTION:"Production", BRAND_EXPANSION:"Expansion", ARCHIVE:"Archive",
  CUSTOMER_WON:"Won",
};
const STAGE_COLORS: Record<string,string> = {
  LEAD:"#94a3b8", PRESENTATION:"#60a5fa", BRAND_TESTING:"#a78bfa",
  FACTORY_ONBOARDING:"#f59e0b", FACTORY_TESTING:"#fb923c",
  PRODUCTION:"#34d399", BRAND_EXPANSION:"#2dd4bf", ARCHIVE:"#6b7280", CUSTOMER_WON:"#22c55e",
};

type Brand = { id: string; name: string; pipelineStage: string; salesRep: string | null; customerType: string | null; fabricCount: number; submissionCount: number; factoryCount: number; contactCount: number; };

export default function BrandsPage() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<Record<string, Brand[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/brands").then(r => r.json()).then(j => { if (j.ok) { setGrouped(j.grouped); setTotal(j.total); } }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400 text-lg">Loading brand pipeline...</div>;

  const q = search.toLowerCase();

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Brand Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} brands across {STAGES.length} stages</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search brands..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <button onClick={() => router.push("/brands/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ New Brand</button>
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
                  <div key={b.id} onClick={() => router.push(`/brands/${b.id}`)}
                    className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                    <div className="font-bold text-sm text-slate-900 truncate">{b.name}</div>
                    {b.salesRep && <div className="text-[11px] text-slate-500 mt-1 truncate">{b.salesRep}</div>}
                    <div className="flex gap-3 mt-2 text-[11px] text-slate-500">
                      {b.fabricCount > 0 && <span title="Fabrics">🧵 {b.fabricCount}</span>}
                      {b.submissionCount > 0 && <span title="Submissions">📋 {b.submissionCount}</span>}
                      {b.factoryCount > 0 && <span title="Factories">🏭 {b.factoryCount}</span>}
                    </div>
                  </div>
                ))}
                {brands.length === 0 && <div className="text-xs text-slate-400 text-center py-8">No brands</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
