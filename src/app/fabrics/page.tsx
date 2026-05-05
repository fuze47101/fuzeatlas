"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function FabricsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);

  // Server-side search keeps /fabrics behavior aligned with the global search
  // header (which hits /api/fabrics?q=… directly). Kaylee reported that
  // searching "Toray" in /fabrics returned fewer fabrics than the global
  // search — root cause was the page loading all rows once and then filtering
  // client-side on a narrow set of fields, so any match on customerCode,
  // factoryCode, color, yarnType, or the linked submission's codes got dropped.
  const loadFabrics = (q: string = "") => {
    setLoading(true);
    const url = new URL("/api/fabrics", window.location.origin);
    if (q.trim()) url.searchParams.set("q", q.trim());
    fetch(url.toString()).then(r => r.json()).then(j => {
      if (j.ok) { setFabrics(j.fabrics); setTotal(j.total ?? j.fabrics.length); }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadFabrics(""); }, []);

  // Debounced server-side search as the user types.
  useEffect(() => {
    const id = setTimeout(() => loadFabrics(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  const handleDelete = (e: React.MouseEvent, id: string, fuzeNum: number | null) => {
    e.stopPropagation();
    const label = fuzeNum ? `FUZE ${fuzeNum}` : "this fabric";
    setDeleteTarget({ id, label });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/fabrics/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (j.ok) {
        setFabrics(prev => prev.filter(f => f.id !== id));
        setTotal(prev => prev - 1);
        toast.success("Fabric deleted");
      } else {
        toast.error(j.error || "Failed to delete");
      }
    } finally {
      setDeleting(null);
    }
  };

  if (loading && fabrics.length === 0) return <div className="flex items-center justify-center h-64 text-slate-400">{t.fabrics.loadingFabrics}</div>;

  // Server now does the filtering — render whatever the API returned.
  const filtered = fabrics;

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
          <button onClick={() => router.push("/fabrics/intake")} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">+ {t.fabrics.addNew}</button>
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
              <th className="px-4 py-3 w-10"></th>
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
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => handleDelete(e, f.id, f.fuzeNumber)}
                    disabled={deleting === f.id}
                    className="text-slate-300 hover:text-red-500 transition-colors text-xs disabled:opacity-50"
                    title="Delete fabric"
                  >
                    {deleting === f.id ? "..." : "✕"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-slate-400">{t.fabrics.noFabrics}</div>}
        {filtered.length > 200 && <div className="text-center py-3 text-xs text-slate-400">{t.fabrics.showingFirst.replace('{first}', '200').replace('{total}', String(filtered.length))}</div>}
      </div>

      {/* Delete Confirmation (F-023) */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.label || "fabric"}?`}
        message="This fabric and all its associated data will be permanently deleted. This cannot be undone."
        confirmLabel="Delete Fabric"
        variant="danger"
        loading={!!deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
