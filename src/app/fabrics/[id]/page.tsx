// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import FuzePickupCalculator from "@/components/FuzePickupCalculator";

/* ── Helper: render a JSON object as labeled fields ── */
function JsonSection({ title, data, fields }: { title: string; data: any; fields: [string, string][] }) {
  if (!data) return null;
  const hasValues = fields.some(([_, key]) => data[key]);
  if (!hasValues) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map(([label, key]) => (
          data[key] ? (
            <div key={key}>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">{label}</label>
              <div className="text-sm text-slate-900">{String(data[key])}</div>
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase">{label}</label>
      <div className="text-sm text-slate-900">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</div>
    </div>
  );
}

export default function FabricDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const [fabric, setFabric] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testSuccess, setTestSuccess] = useState("");

  const isFactory = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER";
  const isExternal = user?.role === "BRAND_USER" || user?.role === "LAB_USER";
  const canEdit = !isExternal; // Internal users + factory users can edit
  const backUrl = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER"
    ? "/factory-portal/fabrics"
    : user?.role === "BRAND_USER"
    ? "/brand-portal/fabrics"
    : "/fabrics";

  useEffect(() => {
    fetch(`/api/fabrics/${id}`).then(r => r.json()).then(j => {
      if (j.ok) setFabric(j.fabric);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading fabric...</div>;
  if (!fabric) return <div className="flex items-center justify-center h-64 text-red-400">Fabric not found</div>;

  // Parse JSON fields safely
  const pretreatment = fabric.pretreatment || {};
  const dyeDetails = fabric.dyeDetails || {};
  const softener = fabric.finishSoftener || {};
  const repellent = fabric.finishRepellent || {};
  const wicking = fabric.finishWicking || {};
  const wrinkleFree = fabric.finishWrinkleFree || {};
  const otherFinish = fabric.finishOther || {};

  const hasPretreatment = Object.values(pretreatment).some(v => v);
  const hasDyeData = fabric.dyeApplied !== null || fabric.dyeStage || fabric.dyeClass || Object.values(dyeDetails).some(v => v);
  const hasFinishes = [softener, repellent, wicking, wrinkleFree, otherFinish].some(obj => Object.values(obj).some(v => v));

  return (
    <div className="max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(backUrl)} className="text-sm text-[#00b4c3] hover:underline mb-1 block">&larr; Back to Fabrics</button>
          <h1 className="text-2xl font-black text-slate-900">FUZE {fabric.fuzeNumber || "—"}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
            {fabric.contents?.length > 0 && (
              <span>{fabric.contents.map((c: any) => `${c.percent || ""}% ${c.material}`).join(" / ")}</span>
            )}
            {fabric.factory && <span>· {fabric.factory.name}</span>}
            {fabric.brand && <span>· {fabric.brand.name}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTestModal(true)}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] shadow-lg shadow-[#00b4c3]/30"
          >
            🧪 Request Testing
          </button>
          {canEdit && (
            <button onClick={() => router.push(`/fabrics/${id}/edit`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Edit</button>
          )}
        </div>
      </div>

      {testSuccess && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{testSuccess}</div>}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 1: Basic Properties */}
      {/* ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Fabric Properties</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FieldRow label="FUZE #" value={fabric.fuzeNumber} />
            <FieldRow label="Customer Code" value={fabric.customerCode} />
            <FieldRow label="Factory Code" value={fabric.factoryCode} />
            <FieldRow label="Batch / Lot Number" value={fabric.batchLotNumber} />
            <FieldRow label="Construction" value={fabric.construction} />
            <FieldRow label="Color" value={fabric.color} />
            <FieldRow label="Weight (GSM)" value={fabric.weightGsm} />
            <FieldRow label="Width (inches)" value={fabric.widthInches} />
            <FieldRow label="Thickness (mm)" value={fabric.thickness} />
            <FieldRow label="Fabric Category" value={fabric.fabricCategory} />
            <FieldRow label="End Use" value={fabric.endUse} />
            <FieldRow label="Target FUZE Tier" value={fabric.targetFuzeTier} />
            <FieldRow label="Yarn Type" value={fabric.yarnType} />
            <FieldRow label="Finish Note" value={fabric.finishNote} />
            <FieldRow label="Annual Volume" value={fabric.annualVolume} />
            <FieldRow label="Quantity" value={fabric.quantityType ? `${fabric.quantityType} ${fabric.quantityUnit || ""}` : null} />
          </div>
          {fabric.note && (
            <div className="mt-4 pt-4 border-t">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Notes</label>
              <div className="text-sm text-slate-700">{fabric.note}</div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Fabric Content */}
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Fabric Content</h3>
            {!fabric.contents || fabric.contents.length === 0 ? (
              <p className="text-xs text-slate-400">No content defined</p>
            ) : (
              <div className="space-y-1.5">
                {fabric.contents.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700">{c.material}</span>
                    <span className="font-bold text-slate-900">{c.percent ? `${c.percent}%` : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brand */}
          {fabric.brand && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Brand</h3>
              <div className="text-sm text-slate-700">{fabric.brand.name}</div>
            </div>
          )}

          {/* Factory */}
          {fabric.factory && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Factory</h3>
              <div className="text-sm text-slate-700">{fabric.factory.name}</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 2: Yarn & Construction Details */}
      {/* ═══════════════════════════════════════════ */}
      {(fabric.weavePattern || fabric.knitStitchType || fabric.gauge || fabric.threadCountWarp || fabric.shrinkageLength) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Construction Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FieldRow label="Weave Pattern" value={fabric.weavePattern} />
            <FieldRow label="Knit Stitch Type" value={fabric.knitStitchType} />
            <FieldRow label="Gauge" value={fabric.gauge} />
            <FieldRow label="Thread Count (Warp)" value={fabric.threadCountWarp} />
            <FieldRow label="Thread Count (Weft)" value={fabric.threadCountWeft} />
            <FieldRow label="Shrinkage - Length (%)" value={fabric.shrinkageLength} />
            <FieldRow label="Shrinkage - Width (%)" value={fabric.shrinkageWidth} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 3: Pretreatment */}
      {/* ═══════════════════════════════════════════ */}
      {(hasPretreatment || fabric.fabricPh) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Pretreatment</h2>
          {fabric.fabricPh && (
            <div className="mb-4">
              <FieldRow label="Fabric pH" value={fabric.fabricPh} />
            </div>
          )}
          <JsonSection title="Singeing" data={pretreatment} fields={[["Applied", "singeing"], ["Type", "singeType"]]} />
          <JsonSection title="Desizing" data={pretreatment} fields={[["Applied", "desizing"], ["Method", "desizeMethod"], ["Enzymes", "desizeEnzymes"]]} />
          <JsonSection title="Scouring" data={pretreatment} fields={[["Applied", "scouring"], ["NaOH Conc.", "scourNaoh"], ["Temperature", "scourTemp"], ["Time", "scourTime"]]} />
          <JsonSection title="Bleaching" data={pretreatment} fields={[["Applied", "bleaching"], ["Type", "bleachType"], ["Concentration", "bleachConc"], ["Temperature", "bleachTemp"]]} />
          <JsonSection title="Mercerization" data={pretreatment} fields={[["Applied", "mercerization"], ["NaOH Conc.", "mercNaoh"], ["Tension", "mercTension"]]} />
          <JsonSection title="Heat Setting" data={pretreatment} fields={[["Applied", "heatSetting"], ["Temperature", "heatTemp"], ["Time", "heatTime"]]} />
          <JsonSection title="Other" data={pretreatment} fields={[["Residual Chemicals", "residualChemicals"], ["Wetting Agents", "wettingAgents"]]} />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 4: Dyeing */}
      {/* ═══════════════════════════════════════════ */}
      {hasDyeData && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Dyeing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <FieldRow label="Dye Applied" value={fabric.dyeApplied} />
            <FieldRow label="Dye Stage" value={fabric.dyeStage} />
            <FieldRow label="Dye Class" value={fabric.dyeClass} />
          </div>
          <JsonSection title="Dye Chemistry" data={dyeDetails} fields={[
            ["Dye Class (Other)", "dyeClassOther"],
            ["Reactive Type", "reactiveType"], ["Reactive Fix Temp", "reactiveFixTemp"], ["Reactive Alkali", "reactiveAlkali"], ["Reactive Conc.", "reactiveConc"],
            ["Disperse Energy", "disperseEnergy"], ["Disperse Carrier", "disperseCarrier"], ["Disperse Temp", "disperseTemp"],
            ["Acid Type", "acidType"], ["Reduction Agent", "reductionAgent"], ["Oxidation Agent", "oxidationAgent"],
            ["Bath Method", "dyeBathMethod"], ["Bath Temp", "bathTemp"], ["Bath pH", "bathPh"],
            ["Salt Concentration", "saltConc"], ["Dye Concentration", "dyeConc"],
            ["Leveling Agents", "levelingAgents"], ["Dispersing Agents", "dispersingAgents"], ["Sequestering Agents", "sequesteringAgents"],
            ["Post-Dye Treatments", "postDyeTreatments"], ["Post-Dye pH", "postDyePh"], ["Drying Temp", "dryingTemp"],
          ]} />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 5: Chemical Finishes */}
      {/* ═══════════════════════════════════════════ */}
      {hasFinishes && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Chemical Finishes</h2>
          <JsonSection title="Softener" data={softener} fields={[
            ["Type", "type"], ["Ionic Charge", "ionicCharge"], ["Concentration", "concentration"], ["Brand", "brand"],
          ]} />
          <JsonSection title="Water Repellent" data={repellent} fields={[
            ["Type", "type"], ["Concentration", "concentration"], ["PFAS Free", "pfasFree"], ["Durability", "durability"],
          ]} />
          <JsonSection title="Moisture Wicking" data={wicking} fields={[
            ["Type", "type"], ["Concentration", "concentration"],
          ]} />
          <JsonSection title="Wrinkle Free / Easy Care" data={wrinkleFree} fields={[
            ["Type", "type"], ["Concentration", "concentration"],
          ]} />
          <JsonSection title="Other Finishes" data={otherFinish} fields={[
            ["Anti-Pilling", "antiPilling"], ["Flame Retardant", "flameRetardant"], ["UV Protection", "uvProtection"],
            ["Stain Release", "stainRelease"], ["Anti-Static", "antiStatic"],
            ["Existing Antibacterial", "existingAntibacterial"], ["Hand Feel Modifier", "handFeelModifier"],
            ["Other Details", "otherFinishDetails"],
          ]} />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 6: Submissions & Test History */}
      {/* ═══════════════════════════════════════════ */}
      {fabric.submissions && fabric.submissions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-sm font-bold text-[#00b4c3] uppercase tracking-wider mb-4">Test Submissions ({fabric.submissions.length})</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b">
              <th className="pb-2">Fabric #</th><th className="pb-2">Status</th><th className="pb-2">Test Status</th><th className="pb-2">Tests</th><th className="pb-2">Date</th>
            </tr></thead>
            <tbody>
              {fabric.submissions.map((s: any) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="py-2 font-bold text-[#00b4c3]">FUZE {s.fuzeFabricNumber || "—"}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === "Complete" ? "bg-green-100 text-green-700"
                        : s.status === "Testing" ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>{s.status || "Pending"}</span>
                  </td>
                  <td className="py-2">{s.testStatus || "—"}</td>
                  <td className="py-2">{s.testRuns?.length || 0} Tests</td>
                  <td className="py-2 text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state — no extended data */}
      {!hasPretreatment && !hasDyeData && !hasFinishes && !fabric.weavePattern && !fabric.knitStitchType && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 text-center">
          <div className="text-2xl mb-2">📋</div>
          <p className="text-sm text-amber-800 font-semibold">Extended fabric data not yet provided</p>
          <p className="text-xs text-amber-600 mt-1">
            Use the full Fabric Intake Form to add pretreatment, dyeing, and chemical finish details for this fabric.
          </p>
          <button
            onClick={() => router.push(`/fabrics/${id}/edit`)}
            className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700"
          >
            Complete Fabric Data
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* FUZE Pickup & Application Calculator */}
      {/* ═══════════════════════════════════════════ */}
      {fabric.weightGsm && fabric.widthInches && (
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <FuzePickupCalculator
            defaultGsm={fabric.weightGsm}
            defaultWidth={fabric.widthInches}
            onSaveResults={async (results: any) => {
              try {
                await fetch(`/api/fabrics/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    raw: { ...(fabric.raw || {}), pickupCalculation: results },
                  }),
                });
                alert("Calculator results saved to fabric record");
              } catch { alert("Failed to save"); }
            }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Test Request Modal */}
      {/* ═══════════════════════════════════════════ */}
      {showTestModal && fabric && <TestRequestModalInline fabric={fabric} onClose={() => setShowTestModal(false)} onSuccess={(result: any) => {
        setShowTestModal(false);
        setTestSuccess(`Test request ${result.poNumber} submitted to ${result.labName}! Estimated cost: $${result.estimatedCost}. Pending review.`);
        setTimeout(() => setTestSuccess(""), 8000);
      }} />}
    </div>
  );
}

/* ── Inline Test Request Modal ── */
function TestRequestModalInline({ fabric, onClose, onSuccess }: { fabric: any; onClose: () => void; onSuccess: (r: any) => void }) {
  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLab, setSelectedLab] = useState("");
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [rushTests, setRushTests] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/brand-portal/test-request").then(r => r.json()).then(j => { if (j.ok) setLabs(j.labs); }).finally(() => setLoading(false));
  }, []);

  const currentLab = labs.find(l => l.id === selectedLab);
  const services = currentLab?.services || [];
  const toggle = (m: string) => setSelectedTests(p => ({ ...p, [m]: !p[m] }));
  const toggleR = (m: string) => setRushTests(p => ({ ...p, [m]: !p[m] }));
  const sel = services.filter((s: any) => selectedTests[s.testMethod]);
  const total = sel.reduce((s: number, v: any) => s + (v.priceUSD || 0) + (rushTests[v.testMethod] ? (v.rushPriceUSD || 0) : 0), 0);

  const submit = async () => {
    if (!selectedLab) return setError("Select a laboratory");
    if (sel.length === 0) return setError("Select at least one test");
    setSubmitting(true); setError("");
    try {
      const r = await fetch("/api/brand-portal/test-request", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fabricId: fabric.id, labId: selectedLab, priority, specialInstructions: instructions || null,
          services: sel.map((s: any) => ({ testType: s.testType, testMethod: s.testMethod, quantity: 1, rush: rushTests[s.testMethod] || false })) }) });
      const j = await r.json();
      if (j.ok) onSuccess(j.testRequest); else setError(j.error || "Failed");
    } catch (e: any) { setError(e.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#00b4c3] to-emerald-500 p-6 rounded-t-2xl text-white">
          <h2 className="text-xl font-black">Request Testing</h2>
          <p className="text-white/80 text-sm mt-1">FUZE {fabric.fuzeNumber} — {fabric.customerCode || fabric.construction || "Fabric"}</p>
        </div>
        <div className="p-6">
          {loading ? <div className="text-center py-8 text-slate-400">Loading...</div> : (<>
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Laboratory</label>
              <select value={selectedLab} onChange={e => { setSelectedLab(e.target.value); setSelectedTests({}); setRushTests({}); }}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold bg-white focus:border-[#00b4c3] focus:outline-none">
                <option value="">— Choose a laboratory —</option>
                {labs.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name} — {[l.city, l.country].filter(Boolean).join(", ")}{l.services.length > 0 ? ` (${l.services.length} tests)` : " — Contact for pricing"}</option>
                ))}
              </select>
            </div>
            {currentLab && services.length > 0 && (
              <div className="mb-6 space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Tests</label>
                {services.map((s: any) => (
                  <div key={s.testMethod} className={`rounded-xl border-2 ${selectedTests[s.testMethod] ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200"}`}>
                    <button onClick={() => toggle(s.testMethod)} className="w-full p-4 text-left">
                      <div className="flex justify-between"><div>
                        <span className="font-mono text-xs font-bold text-[#00b4c3] bg-[#00b4c3]/10 px-2 py-0.5 rounded mr-2">{s.testMethod}</span>
                        <span className="font-bold text-sm text-slate-900">{s.testType.replace(/_/g, " ")}</span>
                        {s.preferred && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">★ {s.preferredNote}</span>}
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                      </div><div className="text-right ml-4 shrink-0"><div className="text-sm font-black">${s.priceUSD}</div><div className="text-[10px] text-slate-500">{s.turnaroundDays}d</div></div></div>
                    </button>
                    {selectedTests[s.testMethod] && s.rushPriceUSD && (
                      <div className="px-4 pb-3"><button onClick={() => toggleR(s.testMethod)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${rushTests[s.testMethod] ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        ⚡ Rush (+${s.rushPriceUSD}, {s.rushDays}d)</button></div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {sel.length > 0 && (
              <div className="bg-gradient-to-r from-slate-50 to-[#00b4c3]/5 rounded-xl border p-4 mb-4">
                <div className="font-black text-lg text-slate-900">${total}</div>
                <div className="text-[10px] text-slate-500">{sel.length} test{sel.length !== 1 ? "s" : ""}</div>
              </div>
            )}
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            <div className="flex gap-3">
              {sel.length > 0 && <button onClick={submit} disabled={submitting}
                className="flex-1 px-6 py-3 bg-[#00b4c3] text-white rounded-xl text-sm font-black hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30">
                {submitting ? "Submitting..." : `Submit Request · $${total}`}</button>}
              <button onClick={onClose} className="px-4 py-3 text-sm text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">Cancel</button>
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
