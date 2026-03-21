"use client";
import { useEffect, useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESULTS_RECEIVED: "bg-purple-100 text-purple-700",
  COMPLETE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function LabRequestsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/lab-portal")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading requests...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">Unable to load</div>;

  const requests = data.testRequests || [];
  const filtered = filter === "all" ? requests : requests.filter((r: any) => r.status === filter);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Test Requests</h1>
        <p className="text-sm text-slate-500 mt-1">{data.lab.name} — Incoming test orders from FUZE customers</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {["all", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "COMPLETE"].map((s) => {
          const count = s === "all" ? requests.length : requests.filter((r: any) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                filter === s ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "All" : s.replace(/_/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">No {filter === "all" ? "" : filter.replace(/_/g, " ").toLowerCase() + " "}requests</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider bg-slate-50 border-b">
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3">Fabric</th>
                <th className="px-5 py-3">Tests</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Est. Cost</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-blue-50">
                  <td className="px-5 py-3 font-mono font-bold text-[#00b4c3] text-xs">{r.poNumber}</td>
                  <td className="px-5 py-3 text-slate-700">{r.brand?.name || "—"}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {r.fabric ? `FUZE ${r.fabric.fuzeNumber}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {r.lines?.map((l: any) => l.testType?.replace(/_/g, " ")).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.priority === "URGENT" ? "bg-red-100 text-red-700" : r.priority === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                    }`}>{r.priority}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[r.status] || "bg-slate-100 text-slate-600"}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">{r.estimatedCost ? `$${r.estimatedCost}` : "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
