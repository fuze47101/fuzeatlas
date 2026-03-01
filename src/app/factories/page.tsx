"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function FactoriesPage() {
  const router = useRouter();
  const [factories, setFactories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [byCountry, setByCountry] = useState<Record<string,number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/factories").then(r => r.json()).then(j => {
      if (j.ok) { setFactories(j.factories); setTotal(j.total); setByCountry(j.byCountry || {}); }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading factories...</div>;

  const q = search.toLowerCase();
  const filtered = factories.filter(f => !q || f.name.toLowerCase().includes(q) || (f.country && f.country.toLowerCase().includes(q)) || (f.specialty && f.specialty.toLowerCase().includes(q)));
  const topCountries = Object.entries(byCountry).sort((a,b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Factories</h1>
          <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} factories across {Object.keys(byCountry).length} countries</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Search factories..." value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push("/factories/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ New Factory</button>
        </div>
      </div>

      {/* Country distribution */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {topCountries.map(([country, count]) => (
          <div key={country} className="bg-white rounded-lg px-3 py-2 shadow-sm border text-center min-w-[100px]">
            <div className="text-lg font-black text-slate-900">{count}</div>
            <div className="text-[11px] text-slate-500 truncate">{country}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Factory Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Specialty</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3 text-center">Brands</th>
              <th className="px-4 py-3 text-center">Fabrics</th>
              <th className="px-4 py-3 text-center">Submissions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} onClick={() => router.push(`/factories/${f.id}`)} className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900">{f.name}</div>
                  {f.chineseName && <div className="text-xs text-slate-400">{f.chineseName}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">{f.millType || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{f.specialty || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{f.country || "—"}</td>
                <td className="px-4 py-3 text-center font-bold">{f.brandCount || 0}</td>
                <td className="px-4 py-3 text-center font-bold">{f.fabricCount || 0}</td>
                <td className="px-4 py-3 text-center font-bold">{f.submissionCount || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">No factories match your search</div>}
      </div>
    </div>
  );
}
