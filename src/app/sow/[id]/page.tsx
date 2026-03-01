"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const STATUS_COLORS: Record<string,string> = {
  DRAFT: "bg-slate-200 text-slate-700", SENT: "bg-blue-100 text-blue-700",
  SIGNED: "bg-purple-100 text-purple-700", ACTIVE: "bg-green-100 text-green-700",
  COMPLETE: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-700",
};
const STATUSES = ["DRAFT","SENT","SIGNED","ACTIVE","COMPLETE","CANCELLED"];

export default function SOWDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [sow, setSow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch(`/api/sow/${id}`).then(r => r.json()).then(j => { if (j.ok) setSow(j.sow); }).finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/sow/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const j = await res.json();
      if (j.ok) { setSow({ ...sow, status }); setSuccess("Status updated"); setTimeout(() => setSuccess(""), 3000); }
      else setError(j.error);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading SOW...</div>;
  if (!sow) return <div className="flex items-center justify-center h-64 text-red-400">SOW not found</div>;

  let costData: any = {};
  try { costData = JSON.parse(sow.costControls || "{}"); } catch {}
  let perfData: any = {};
  try { perfData = JSON.parse(sow.performanceCriteria || "{}"); } catch {}
  let pricingData: any = {};
  try { pricingData = JSON.parse(sow.pricingTerms || "{}"); } catch {}

  const DRIFT_TRIGGERS = [
    { label: "No executive sponsor", check: !!costData.executiveSponsor },
    { label: "No defined SKU or launch season", check: !!(costData.garmentSku && costData.targetLaunchSeason) },
    { label: "No volume forecast", check: !!(costData.projectedAnnualUnits || costData.calculatedAnnualLiters) },
  ];

  return (
    <div className="max-w-[1200px] mx-auto">
      <button onClick={() => router.push("/sow")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to SOWs</button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{sow.title || "Untitled SOW"}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[sow.status]}`}>{sow.status}</span>
            {sow.brand && <span className="text-sm text-slate-500 cursor-pointer hover:text-blue-600" onClick={() => router.push(`/brands/${sow.brand.id}`)}>{sow.brand.name}</span>}
            <span className="text-xs text-slate-400">Created {new Date(sow.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
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
        <h2 className="text-lg font-bold text-slate-900 mb-4">Stage-Gate Progress</h2>
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
          <h3 className="font-bold text-slate-900 mb-3">🏢 Commercial Ownership</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Brand" value={sow.brand?.name} />
            <Row label="Executive Sponsor" value={costData.executiveSponsor} />
            <Row label="Sales Rep" value={costData.salesRepName} />
          </dl>
        </div>

        {/* End Use */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">👕 End Use Definition</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Garment SKU" value={costData.garmentSku} />
            <Row label="Fabric Type" value={costData.fabricType} />
            <Row label="GSM" value={costData.gsm} />
            <Row label="Application Level" value={costData.applicationLevel ? `${costData.applicationLevel} mg/kg` : null} />
            <Row label="Launch Season" value={costData.targetLaunchSeason} />
            <Row label="Retail Channel" value={costData.retailChannel} />
          </dl>
        </div>

        {/* Volume */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">📊 Volume Forecast</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Annual Units" value={costData.projectedAnnualUnits ? Number(costData.projectedAnnualUnits).toLocaleString() : null} />
            <Row label="Garment Weight" value={costData.garmentWeight ? `${costData.garmentWeight} kg` : null} />
            <Row label="Annual Liters" value={costData.calculatedAnnualLiters ? `${Number(costData.calculatedAnnualLiters).toLocaleString()} L` : null} />
            <Row label="Projected Revenue" value={pricingData.projectedAnnualRevenue ? `$${Number(pricingData.projectedAnnualRevenue).toLocaleString()}` : null} />
            <Row label="Commercialization Date" value={costData.targetCommercializationDate} />
          </dl>
        </div>

        {/* Success Criteria */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">🎯 Success Criteria</h3>
          <dl className="space-y-2 text-sm">
            <Row label="ICP Target" value={perfData.icpTarget} />
            <Row label="Standard" value={perfData.antimicrobialStandard} />
            <Row label="Log Reduction" value={perfData.requiredLogReduction} />
            <Row label="Wash Durability" value={perfData.washDurability} />
            <Row label="Testing Lab" value={perfData.approvedTestingLab} />
          </dl>
        </div>

        {/* Financial */}
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900 mb-3">💰 Financial Participation</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Type" value={pricingData.financialParticipation?.replace(/_/g, " ")} />
            {pricingData.developmentRetainer && <Row label="Retainer" value={`$${Number(pricingData.developmentRetainer).toLocaleString()}`} />}
            <Row label="Commitment Volume" value={pricingData.commitmentVolumeLiters ? `${Number(pricingData.commitmentVolumeLiters).toLocaleString()} L` : null} />
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
          <h3 className="font-bold text-slate-900 mb-3">✍️ Authorized Signatory</h3>
          <div className="text-sm text-slate-700">
            {sow.signatory && <div className="font-semibold">{sow.signatory}</div>}
            {sow.signatoryTitle && <div className="text-slate-500">{sow.signatoryTitle}</div>}
            {sow.signatoryEmail && <div className="text-blue-600">{sow.signatoryEmail}</div>}
          </div>
        </div>
      )}
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
