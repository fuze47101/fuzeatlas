"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function FabricsPage() {
  const router = useRouter();
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/fabrics").then(r => r.json()).then(j => {
      if (j.ok) { setFabrics(j.fabrics); setTotal(j.total); }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading fabrics...</div>;

  const q = search.toLowerCase();
  const filtered = fabrics.filter(f =>
    !q || (f.fuzeNumber && String(f.fuzeNumber).includes(q)) ||
    (f.construction && f.construction.toLowerCase().includes(q)) ||
    (f.brand && f.brand.toLowerCase().includes(q)) ||
    (f.factory && f.factory.toLowerCase().includes(q)) ||
    (f.contents && f.contents.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Fabrics</h1>
          <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} fabrics in the library</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search by FUZE #, brand, material..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push("/fabrics/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ New Fabric</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">FUZE #</th>
              <th className="px-4 py-3">Construction</th>
              <th className="px-4 py-3">Color</th>
              <th className="px-4 py-3">GSM</th>
              <th className="px-4 py-3">Yarn</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Factory</th>
              <th className="px-4 py-3">Content</th>
              <th className="px-4 py-3 text-center">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(f => (
              <tr key={f.id} onClick={() => router.push(`/fabrics/${f.id}`)} className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-bold text-blue-600">FUZE {f.fuzeNumber || "—"}</td>
                <td className="px-4 py-3">{f.construction || "—"}</td>
                <td className="px-4 py-3">{f.color || "—"}</td>
                <td className="px-4 py-3">{f.weightGsm || "—"}</td>
                <td className="px-4 py-3">{f.yarnType || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{f.brand || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{f.factory || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{f.contents || "—"}</td>
                <td className="px-4 py-3 text-center font-bold">{f.submissionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">No fabrics match your search</div>}
        {filtered.length > 200 && <div className="text-center py-3 text-xs text-slate-400">Showing first 200 of {filtered.length} results</div>}
      </div>
    </div>
  );
}
