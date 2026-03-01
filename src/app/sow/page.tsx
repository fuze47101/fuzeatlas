"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string,string> = {
  DRAFT: "bg-slate-200 text-slate-700", SENT: "bg-blue-100 text-blue-700",
  SIGNED: "bg-purple-100 text-purple-700", ACTIVE: "bg-green-100 text-green-700",
  COMPLETE: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700",
};

export default function SOWListPage() {
  const router = useRouter();
  const [sows, setSows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/sow").then(r => r.json()).then(j => { if (j.ok) setSows(j.sows); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading SOWs...</div>;

  const q = search.toLowerCase();
  const filtered = sows.filter(s => !q || (s.title && s.title.toLowerCase().includes(q)) || (s.brand?.name && s.brand.name.toLowerCase().includes(q)));
  const byStatus: Record<string, number> = {};
  for (const s of sows) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Statements of Work</h1>
          <p className="text-sm text-slate-500 mt-1">{sows.length} SOWs — Commercialization governance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search SOWs..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push("/sow/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ New SOW</button>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className={`rounded-lg px-4 py-2 text-center ${STATUS_COLORS[status] || "bg-slate-100"}`}>
            <div className="text-xl font-black">{count}</div>
            <div className="text-[11px] font-semibold">{status}</div>
          </div>
        ))}
      </div>

      {/* SOW list */}
      <div className="space-y-3">
        {filtered.map(s => {
          const completedMilestones = s.milestones?.filter((m: any) => m.completedAt).length || 0;
          const totalMilestones = s.milestones?.length || 0;
          let costData: any = {};
          try { costData = JSON.parse(s.costControls || "{}"); } catch {}
          let pricingData: any = {};
          try { pricingData = JSON.parse(s.pricingTerms || "{}"); } catch {}

          return (
            <div key={s.id} onClick={() => router.push(`/sow/${s.id}`)}
              className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md hover:border-blue-300 cursor-pointer transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-900">{s.title || "Untitled SOW"}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    {s.brand?.name || "No brand"} · Created {new Date(s.createdAt).toLocaleDateString()}
                    {costData.targetLaunchSeason && ` · Launch: ${costData.targetLaunchSeason}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700">Stage {completedMilestones}/{totalMilestones}</div>
                  {pricingData.projectedAnnualRevenue && (
                    <div className="text-xs text-green-600 font-semibold">
                      ${Number(pricingData.projectedAnnualRevenue).toLocaleString()} proj. revenue
                    </div>
                  )}
                </div>
              </div>
              {/* Stage progress bar */}
              {totalMilestones > 0 && (
                <div className="flex gap-1 mt-3">
                  {s.milestones.map((m: any, i: number) => (
                    <div key={m.id} className={`h-2 flex-1 rounded-full ${m.completedAt ? "bg-green-500" : "bg-slate-200"}`}
                      title={`${m.title}${m.completedAt ? " ✓" : ""}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">No SOWs found. Create one to start the commercialization process.</div>}
      </div>
    </div>
  );
}
