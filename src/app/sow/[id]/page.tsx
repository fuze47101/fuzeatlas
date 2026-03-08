"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

const STATUS_COLORS: Record<string,string> = {
  DRAFT: "bg-slate-200 text-slate-700", SENT: "bg-blue-100 text-blue-700",
  SIGNED: "bg-purple-100 text-purple-700", ACTIVE: "bg-green-100 text-green-700",
  COMPLETE: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700",
};
const STATUSES = ["DRAFT","SENT","SIGNED","ACTIVE","COMPLETE","CANCELLED"];

export default function SOWDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [sow, setSow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");

  useEffect(() => {
    fetch(`/api/sow/${id}`).then(r => r.json()).then(j => { if (j.ok) setSow(j.sow); }).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    // Require confirmation for destructive statuses
    if (status === "CANCELLED") {
      setPendingStatus(status);
      setConfirmCancel(true);
      return;
    }
    await doStatusUpdate(status);
  };

  const doStatusUpdate = async (status: string) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/sow/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const j = await res.json();
      if (j.ok) { setSow({ ...sow, status }); toast.success(`Status updated to ${status}`); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const startEdit = () => {
    setEditForm({
      title: sow.title || "",
      signatory: sow.signatory || "",
      signatoryTitle: sow.signatoryTitle || "",
      signatoryEmail: sow.signatoryEmail || "",
      expectations: sow.expectations || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/sow/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const j = await res.json();
      if (j.ok) {
        setSow({ ...sow, ...editForm });
        setEditing(false);
        toast.success("SOW updated successfully");
      } else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">{t.common.loading}</div>;
  if (!sow) return <div className="flex items-center justify-center h-64 text-red-400">SOW not found</div>;

  let costData: any = {};
  try { costData = JSON.parse(sow.costControls || "{}"); } catch {}
  let perfData: any = {};
  try { perfData = JSON.parse(sow.performanceCriteria || "{}"); } catch {}
  let pricingData: any = {};
  try { pricingData = JSON.parse(sow.pricingTerms || "{}"); } catch {}

  const DRIFT_TRIGGERS = [
    { label: "No executive sponsor", check: !!costData.executiveSponsor },
    { label: "No defined product/SKU or launch season", check: !!((costData.garmentSku || sow.products?.length > 0) && costData.targetLaunchSeason) },
    { label: "No volume forecast", check: !!(costData.projectedAnnualUnits || costData.calculatedAnnualLiters) },
  ];

  return (
    <div className="max-w-[1200px] mx-auto">
      <button onClick={() => router.push("/sow")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; {t.sow.backToSow}</button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{sow.title || t.sow.untitled}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[sow.status]}`}>{sow.status}</span>
            {sow.brand && <span className="text-sm text-slate-500 cursor-pointer hover:text-blue-600" onClick={() => router.push(`/brands/${sow.brand.id}`)}>{sow.brand.name}</span>}
            <span className="text-xs text-slate-400">Created {new Date(sow.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={startEdit}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00b4c3] text-white hover:bg-[#009aa8] flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <a href={`/api/sow/${id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-600 text-white hover:bg-slate-700 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Download PDF
          </a>
          <button onClick={() => window.open(`/sow/${id}/print`, "_blank")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900">
            {t.sow.printPdf}
          </button>
          {sow.signatoryEmail && (
            <button onClick={() => {
              const subject = encodeURIComponent(`SOW for Signature: ${sow.title || "FUZE Technologies"}`);
              const body = encodeURIComponent(
                `Hi ${sow.signatory || ""},\n\nPlease find attached the Scope of Work for your review and signature.\n\nSOW: ${sow.title || "Untitled"}\nBrand: ${sow.brand?.name || ""}\nStatus: ${sow.status}\n\nPlease review and sign at your earliest convenience.\n\nBest regards,\nFUZE Technologies`
              );
              window.open(`mailto:${sow.signatoryEmail}?subject=${subject}&body=${body}`, "_blank");
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700">
              {t.sow.emailForSignature}
            </button>
          )}
          {STATUSES.filter(s => s !== sow.status).map(s => (
            <button key={s} onClick={() => updateStatus(s)} disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${STATUS_COLORS[s]} hover:opacity-80 disabled:opacity-50`}>
              → {s}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Stage-Gate Progress */}
      <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">{t.sow.stageGate}</h2>
        <div className="space-y-3">
          {sow.milestones?.map((m: any, i: number) => (
            <div key={m.id} className={`flex items-center gap-4 p-3 rounded-lg border ${m.completedAt ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${m.completedAt ? "bg-green-500 text-white" : "bg-slate-300 text-white"}`}>
                {m.completedAt ? "✓" : i}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-slate-900">{m.title}</div>
                <div className="text-xs text-slate-500">{m.description}</div>
              </div>
              {m.completedAt && <span className="text-xs text-green-600">{new Date(m.completedAt).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Commercial Ownership */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">🏢 {t.sow.commercialOwnership}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t.sow.selectBrand} value={sow.brand?.name} />
            <Row label={t.sow.executiveSponsor} value={costData.executiveSponsor} />
            <Row label={t.sow.salesRepName} value={costData.salesRepName} />
          </dl>
        </div>

        {/* End Use */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">👕 {t.sow.endUseDefinition}</h3>
          {sow.products?.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-slate-500">Products / SKUs</span>
              <div className="mt-1 space-y-1">
                {sow.products.map((sp: any) => (
                  <div key={sp.id} className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{sp.product.productType || "Product"}</span>
                    <span className="font-semibold text-slate-900">{sp.product.name}</span>
                    {sp.product.sku && <span className="text-xs text-slate-400 font-mono">{sp.product.sku}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <dl className="space-y-2 text-sm">
            <Row label={t.sow.garmentSku} value={costData.garmentSku} />
            <Row label={t.sow.fabricType} value={costData.fabricType} />
            <Row label={t.sow.gsm} value={costData.gsm} />
            <Row label={t.sow.applicationLevel} value={costData.applicationLevel ? `${costData.applicationLevel} mg/kg` : null} />
            <Row label={t.sow.targetLaunchSeason} value={costData.targetLaunchSeason} />
            <Row label={t.sow.retailChannel} value={costData.retailChannel} />
          </dl>
        </div>

        {/* Volume */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">📊 {t.sow.volumeForecast}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t.sow.projectedAnnualUnits} value={costData.projectedAnnualUnits ? Number(costData.projectedAnnualUnits).toLocaleString() : null} />
            <Row label={t.sow.garmentWeight} value={costData.garmentWeight ? `${costData.garmentWeight} kg` : null} />
            <Row label={t.sow.calculatedLiters} value={costData.calculatedAnnualLiters ? `${Number(costData.calculatedAnnualLiters).toLocaleString()} L` : null} />
            <Row label={t.sow.projectedRevenue} value={pricingData.projectedAnnualRevenue ? `$${Number(pricingData.projectedAnnualRevenue).toLocaleString()}` : null} />
            <Row label={t.sow.targetCommDate} value={costData.targetCommercializationDate} />
          </dl>
        </div>

        {/* Success Criteria */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">🎯 {t.sow.successCriteria}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t.sow.icpTarget} value={perfData.icpTarget} />
            <Row label={t.sow.antimicrobialStandard} value={perfData.antimicrobialStandard} />
            <Row label={t.sow.requiredLogReduction} value={perfData.requiredLogReduction} />
            <Row label={t.sow.washDurability} value={perfData.washDurability} />
            <Row label={t.sow.approvedTestingLab} value={perfData.approvedTestingLab} />
          </dl>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">💰 {t.sow.financialTerms}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t.sow.financialParticipation} value={pricingData.financialParticipation?.replace(/_/g, " ")} />
            {pricingData.developmentRetainer && <Row label={t.sow.developmentRetainer} value={`$${Number(pricingData.developmentRetainer).toLocaleString()}`} />}
            <Row label={t.sow.commitmentVolume} value={pricingData.commitmentVolumeLiters ? `${Number(pricingData.commitmentVolumeLiters).toLocaleString()} L` : null} />
          </dl>
        </div>

        {/* Drift Kill Triggers */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">⚠️ Drift Kill Triggers</h3>
          <div className="space-y-2">
            {DRIFT_TRIGGERS.map((t, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm ${t.check ? "text-green-600" : "text-red-500"}`}>
                {t.check ? "✓ Clear" : "✗ TRIGGERED"} — {t.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signatory */}
      {(sow.signatory || sow.signatoryTitle || sow.signatoryEmail) && (
        <div className="bg-white rounded-xl p-5 shadow-sm border mt-6">
          <h3 className="font-bold text-slate-900 mb-3">✍️ {t.sow.commitmentSignature}</h3>
          <div className="text-sm text-slate-700">
            {sow.signatory && <div className="font-semibold">{sow.signatory}</div>}
            {sow.signatoryTitle && <div className="text-slate-500">{sow.signatoryTitle}</div>}
            {sow.signatoryEmail && <div className="text-blue-600">{sow.signatoryEmail}</div>}
          </div>
        </div>
      )}

      {/* Edit Modal (F-001) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit SOW</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Signatory Name</label>
                <input value={editForm.signatory} onChange={e => setEditForm({...editForm, signatory: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Signatory Title</label>
                <input value={editForm.signatoryTitle} onChange={e => setEditForm({...editForm, signatoryTitle: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Signatory Email</label>
                <input type="email" value={editForm.signatoryEmail} onChange={e => setEditForm({...editForm, signatoryEmail: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expectations / Notes</label>
                <textarea rows={4} value={editForm.expectations} onChange={e => setEditForm({...editForm, expectations: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-700 border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#00b4c3] rounded-lg hover:bg-[#009aa8] disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancel Dialog (F-024) */}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this SOW?"
        message="This will mark the Statement of Work as CANCELLED. This action can be reversed by changing the status back, but any associated workflows may be affected."
        confirmLabel="Yes, Cancel SOW"
        variant="danger"
        loading={saving}
        onConfirm={async () => {
          setConfirmCancel(false);
          await doStatusUpdate(pendingStatus);
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value || "—"}</dd>
    </div>
  );
}
