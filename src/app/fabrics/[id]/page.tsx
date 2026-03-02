"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function FabricDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [fabric, setFabric] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetch(`/api/fabrics/${id}`).then(r => r.json()).then(j => {
      if (j.ok) {
        setFabric(j.fabric);
        const f = j.fabric;
        setForm({
          fuzeNumber: f.fuzeNumber || "", customerCode: f.customerCode || "",
          factoryCode: f.factoryCode || "", construction: f.construction || "",
          color: f.color || "", weightGsm: f.weightGsm || "", widthInches: f.widthInches || "",
          yarnType: f.yarnType || "", finishNote: f.finishNote || "", note: f.note || "",
        });
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/fabrics/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (j.ok) { setFabric({ ...fabric, ...j.fabric }); setEditing(false); setSuccess("Fabric updated"); setTimeout(() => setSuccess(""), 3000); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{t.fabrics.loadingFabric}</div>;
  if (!fabric) return <div className="flex items-center justify-center h-64 text-red-400">{t.fabrics.fabricNotFound}</div>;

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.push("/fabrics")} className="text-sm text-blue-600 hover:underline">&larr; {t.fabrics.title}</button>
            {fabric.brand && (
              <>
                <span className="text-slate-300">|</span>
                <button onClick={() => router.push(`/brands/${fabric.brand.id}`)} className="text-sm text-blue-600 hover:underline">&larr; {fabric.brand.name}</button>
              </>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-900">FUZE {fabric.fuzeNumber || "—"}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {fabric.construction && <span>{fabric.construction}</span>}
            {fabric.brand && <span>· {fabric.brand.name}</span>}
            {fabric.factory && <span>· {fabric.factory.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">{t.common.edit}</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold">{t.common.cancel}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{saving ? t.common.saving : t.common.save}</button>
            </>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Properties */}
        <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t.fabrics.fabricProperties}</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              [t.fabrics.fuzeNumber,"fuzeNumber"],[t.fabrics.customerCode,"customerCode"],[t.fabrics.factoryCode,"factoryCode"],
              [t.fabrics.construction,"construction"],[t.fabrics.color,"color"],[t.fabrics.weightGsm,"weightGsm"],
              [t.fabrics.widthInches,"widthInches"],[t.fabrics.yarnType,"yarnType"],[t.fabrics.finishNote,"finishNote"],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
                {editing ? (
                  <input type={field === "weightGsm" || field === "widthInches" || field === "fuzeNumber" ? "number" : "text"}
                    value={form[field] || ""} onChange={e => setForm({ ...form, [field]: e.target.value })} step="0.1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                ) : (
                  <div className="text-sm text-slate-900">{fabric[field] || "—"}</div>
                )}
              </div>
            ))}
          </div>
          {(editing || fabric.note) && (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.fabrics.notes}</label>
              {editing ? (
                <textarea value={form.note || ""} onChange={e => setForm({ ...form, note: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              ) : (
                <div className="text-sm text-slate-700">{fabric.note || "—"}</div>
              )}
            </div>
          )}
        </div>

        {/* Right: Content & relations */}
        <div className="space-y-4">
          {/* Content */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <h3 className="text-sm font-bold text-slate-900 mb-3">{t.fabrics.fabricContent}</h3>
            {fabric.contents.length === 0 ? <p className="text-xs text-slate-400">{t.fabrics.noContentDefined}</p> : (
              <div className="space-y-2">
                {fabric.contents.map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center">
                    <span className="text-sm text-slate-700">{c.material}</span>
                    <span className="text-sm font-bold text-slate-900">{c.percent ? `${c.percent}%` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brand */}
          {fabric.brand && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t.fabrics.brand}</h3>
              <div onClick={() => router.push(`/brands/${fabric.brand.id}`)} className="text-blue-600 hover:underline text-sm cursor-pointer">{fabric.brand.name}</div>
            </div>
          )}

          {/* Factory */}
          {fabric.factory && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{t.fabrics.factory}</h3>
              <div onClick={() => router.push(`/factories/${fabric.factory.id}`)} className="text-blue-600 hover:underline text-sm cursor-pointer">{fabric.factory.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* Submissions */}
      {fabric.submissions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mt-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t.fabrics.testSubmissions.replace('{count}', String(fabric.submissions.length))}</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b">
              <th className="pb-2">{t.fabrics.fabricNumber}</th><th className="pb-2">{t.common.status}</th><th className="pb-2">{t.fabrics.testStatus}</th><th className="pb-2">{t.fabrics.tests}</th><th className="pb-2">{t.common.date}</th>
            </tr></thead>
            <tbody>
              {fabric.submissions.map((s: any) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 font-bold">FUZE {s.fuzeFabricNumber}</td>
                  <td className="py-2">{s.status || "—"}</td>
                  <td className="py-2">{s.testStatus || "—"}</td>
                  <td className="py-2">{s.testRuns.length} {t.fabrics.tests}</td>
                  <td className="py-2 text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
