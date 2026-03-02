"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function FabricsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/fabrics").then(r => r.json()).then(j => {
      if (j.ok) { setFabrics(j.fabrics); setTotal(j.total); }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{t.fabrics.loadingFabrics}</div>;

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
          <h1 className="text-2xl font-black text-slate-900">{t.fabrics.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{total.toLocaleString()} {t.fabrics.fabricsInLibrary}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder={t.fabrics.searchPlaceholder} value={search} onChange={e => setSearch(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => router.push("/fabrics/new")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ {t.fabrics.addNew}</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">{t.fabrics.fuzeNumber}</th>
              <th className="px-4 py-3">{t.fabrics.construction}</th>
              <th className="px-4 py-3">{t.fabrics.color}</th>
              <th className="px-4 py-3">{t.fabrics.gsm}</th>
              <th className="px-4 py-3">{t.fabrics.yarn}</th>
              <th className="px-4 py-3">{t.fabrics.brand}</th>
              <th className="px-4 py-3">{t.fabrics.factory}</th>
              <th className="px-4 py-3">{t.fabrics.content}</th>
              <th className="px-4 py-3 text-center">{t.fabrics.submissions}</th>
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
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">{t.fabrics.noFabrics}</div>}
        {filtered.length > 200 && <div className="text-center py-3 text-xs text-slate-400">{t.fabrics.showingFirst.replace('{first}', '200').replace('{total}', String(filtered.length))}</div>}
      </div>
    </div>
  );
}
