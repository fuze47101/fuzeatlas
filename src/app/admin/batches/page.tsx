// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function BatchesPage() {
  const { t } = useI18n();
  const T = t.batchesAdmin;
  const { user } = useAuth();
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<any>({
    productionDate: new Date().toISOString().slice(0, 10),
    volumeProducedLiters: "",
    bottlesFilled: "",
    concentrationMgPerL: "30",
    qcPassed: true,
    qcNotes: "",
    coaDocUrl: "",
    notes: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    if (user && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/home");
      return;
    }
    load();
  }, [user]);

  async function load() {
    try {
      const res = await fetch("/api/admin/batches");
      const d = await res.json();
      if (d.ok) setBatches(d.batches);
    } finally {
      setLoading(false);
    }
  }

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if ((await res.json()).ok) {
      setShowNew(false);
      setForm({ productionDate: new Date().toISOString().slice(0, 10), volumeProducedLiters: "", bottlesFilled: "", concentrationMgPerL: "30", qcPassed: true, qcNotes: "", coaDocUrl: "", notes: "" });
      load();
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/admin/batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editForm }),
    });
    if ((await res.json()).ok) {
      setEditing(null);
      setEditForm({});
      load();
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" /></div>;
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://fuzeatlas.com";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{T.title}</h1>
          <p className="text-slate-600">{T.subtitle}</p>
        </div>
        <button onClick={() => setShowNew(!showNew)} className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8]">
          {T.newBatchBtn}
        </button>
      </div>

      {showNew && (
        <form onSubmit={createBatch} className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-slate-900 mb-4">{T.formTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fProductionDate}</label>
              <input type="date" value={form.productionDate} onChange={(e) => setForm({ ...form, productionDate: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fVolumeProduced}</label>
              <input type="number" step="0.1" value={form.volumeProducedLiters} onChange={(e) => setForm({ ...form, volumeProducedLiters: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fBottles19L}</label>
              <input type="number" value={form.bottlesFilled} onChange={(e) => setForm({ ...form, bottlesFilled: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fConcentration}</label>
              <input type="number" step="0.01" value={form.concentrationMgPerL} onChange={(e) => setForm({ ...form, concentrationMgPerL: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fCoaUrl}</label>
              <input type="url" value={form.coaDocUrl} onChange={(e) => setForm({ ...form, coaDocUrl: e.target.value })} placeholder={T.fCoaUrlPlaceholder} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="sm:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.qcPassed} onChange={(e) => setForm({ ...form, qcPassed: e.target.checked })} />
                {T.fQcPassed}
              </label>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">{T.fNotes}</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="px-5 py-2 bg-[#00b4c3] text-white rounded-lg font-semibold">{T.createBtn}</button>
            <button type="button" onClick={() => setShowNew(false)} className="px-5 py-2 bg-slate-100 rounded-lg font-semibold">{T.cancelBtn}</button>
          </div>
        </form>
      )}

      {batches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🏭</p>
          <h3 className="font-bold text-slate-900 text-lg">{T.emptyTitle}</h3>
          <p className="text-sm text-slate-500 mt-1">{T.emptySub}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((b) => {
            const verifyUrl = `${baseUrl}/verify/${b.batchCode}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(verifyUrl)}`;
            const isEditing = editing === b.id;
            return (
              <div key={b.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  <div className="flex-1 p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono font-black text-lg text-slate-900">{b.batchCode}</span>
                      {b.qcPassed ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full">{T.badgeQcPassed}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-full">{T.badgeQcFailed}</span>
                      )}
                      {b.coaDocUrl ? (
                        <span className="px-2 py-0.5 text-xs font-bold bg-cyan-100 text-cyan-800 rounded-full">{T.badgeCoaAttached}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full">{T.badgeCoaPending}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                      <div><p className="text-slate-500 text-xs">{T.colProduced}</p><p className="font-bold">{new Date(b.productionDate).toLocaleDateString()}</p></div>
                      <div><p className="text-slate-500 text-xs">{T.colVolume}</p><p className="font-bold">{b.volumeProducedLiters.toLocaleString()}L</p></div>
                      <div><p className="text-slate-500 text-xs">{T.colBottles}</p><p className="font-bold">{b.bottlesFilled || "—"}</p></div>
                      <div><p className="text-slate-500 text-xs">{T.colConc}</p><p className="font-bold">{b.concentrationMgPerL} mg/L</p></div>
                      <div><p className="text-slate-500 text-xs">{T.colOrdersFilled}</p><p className="font-bold">{b._count?.orders || 0}</p></div>
                      <div><p className="text-slate-500 text-xs">{T.colTotalScans}</p><p className="font-bold">{b._count?.scans || 0}</p></div>
                    </div>
                    {b.notes && <p className="text-sm text-slate-600 italic">{b.notes}</p>}

                    {isEditing ? (
                      <div className="mt-3 space-y-2 p-3 bg-slate-50 rounded-lg">
                        <input
                          type="url"
                          placeholder={T.coaUrlPlaceholder}
                          value={editForm.coaDocUrl ?? b.coaDocUrl ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, coaDocUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={editForm.qcPassed ?? b.qcPassed} onChange={(e) => setEditForm({ ...editForm, qcPassed: e.target.checked })} />
                          {T.fQcPassed}
                        </label>
                        <textarea placeholder={T.qcNotesPlaceholder} value={editForm.qcNotes ?? b.qcNotes ?? ""} onChange={(e) => setEditForm({ ...editForm, qcNotes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(b.id)} className="px-4 py-2 bg-[#00b4c3] text-white text-sm font-semibold rounded-lg">{T.saveBtn}</button>
                          <button onClick={() => { setEditing(null); setEditForm({}); }} className="px-4 py-2 bg-slate-100 text-sm rounded-lg">{T.cancelBtn}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => { setEditing(b.id); setEditForm({}); }} className="text-xs font-semibold text-[#00b4c3] hover:underline">{T.editOrUpload}</button>
                      </div>
                    )}
                  </div>

                  {/* QR side panel */}
                  <div className="lg:w-64 p-5 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50 text-center">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">{T.stickerQrLabel}</p>
                    <img src={qrUrl} alt={T.qrAltTpl.replace("{code}", b.batchCode)} className="mx-auto border-2 border-white rounded-lg p-1 bg-white shadow-sm" />
                    <a
                      href={qrUrl}
                      download={`qr-${b.batchCode}.png`}
                      className="mt-2 inline-block w-full px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
                    >
                      {T.downloadPng}
                    </a>
                    <p className="text-[10px] text-slate-400 mt-2 break-all">/verify/{b.batchCode}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
