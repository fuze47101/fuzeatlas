// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/AuthContext";

export default function FabricEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState("");
  const [fabric, setFabric] = useState<any>(null);

  // ─── Core fields ───
  const [fabricName, setFabricName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [factoryCode, setFactoryCode] = useState("");
  const [batchLotNumber, setBatchLotNumber] = useState("");
  const [color, setColor] = useState("");
  const [endUse, setEndUse] = useState("");
  const [targetFuzeTier, setTargetFuzeTier] = useState("");
  const [weightGsm, setWeightGsm] = useState("");
  const [widthInches, setWidthInches] = useState("");
  const [thickness, setThickness] = useState("");
  const [fabricCategory, setFabricCategory] = useState("");
  const [quantityType, setQuantityType] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("meters");
  const [construction, setConstruction] = useState("");
  const [yarnType, setYarnType] = useState("");
  const [finishNote, setFinishNote] = useState("");
  const [note, setNote] = useState("");
  const [brandId, setBrandId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [contents, setContents] = useState([{ material: "", percent: "" }]);

  // ─── Extended fields (Sections 2-7) ───
  const [ext, setExt] = useState({
    recycledContent: "", recycledPct: "", recycledType: "", recycledCert: "",
    yarnTwistDirection: "",
    weavePattern: "", weaveOther: "", threadCountWarp: "", threadCountWeft: "",
    knitStitchType: "", knitOther: "", gauge: "",
    shrinkageLength: "", shrinkageWidth: "", airPermeability: "", compactness: "",
    singeing: "", singeType: "",
    desizing: "", desizeMethod: "", desizeEnzymes: "",
    scouring: "", scourNaoh: "", scourTemp: "", scourTime: "",
    bleaching: "", bleachType: "", bleachConc: "", bleachTemp: "",
    mercerization: "", mercNaoh: "", mercTension: "",
    heatSetting: "", heatTemp: "", heatTime: "",
    fabricPh: "",
    residualChemicals: "", wettingAgents: "",
    dyeApplied: "", dyeStage: "", dyeClass: "", dyeClassOther: "",
    reactiveType: "", reactiveFixTemp: "", reactiveAlkali: "", reactiveConc: "",
    disperseEnergy: "", disperseCarrier: "", disperseCarrierType: "", disperseTemp: "",
    acidType: "", reductionAgent: "", oxidationAgent: "",
    dyeBathMethod: "", dyeBathOther: "", bathTemp: "", bathPh: "",
    saltConc: "", dyeConc: "", levelingAgents: "", dispersingAgents: "", sequesteringAgents: "",
    postDyeTreatments: "", postDyePh: "", dryingTemp: "",
    silSoftener: "", silSoftenerType: "", silSoftenerCharge: "", silSoftenerConc: "", silSoftenerBrand: "",
    nonSilSoftener: "", nonSilSoftenerType: "", nonSilSoftenerConc: "",
    waxSoftener: "", waxType: "", waxConc: "",
    waterRepellent: "", wrType: "", wrConc: "", wrPfasFree: "", wrDurability: "",
    wickingApplied: "", wickingType: "", wickingConc: "",
    wrinkleFreeApplied: "", wrinkleFreeType: "", wrinkleFreeConc: "",
    antiPilling: "", flameRetardant: "", uvProtection: "", stainRelease: "",
    antiStatic: "", existingAntibacterial: "", handFeelModifier: "",
    otherFinishDetails: "",
    specialRequirements: "", chemIncompatibilities: "",
    prevAntimicrobial: "", prevAntimicrobialDesc: "",
    sampleCondition: "", washCount: "",
  });
  const setField = (k: string, v: string) => setExt(p => ({ ...p, [k]: v }));

  // ─── Load fabric + brands/factories ───
  useEffect(() => {
    Promise.all([
      fetch(`/api/fabrics/${id}`).then(r => r.json()),
      fetch("/api/brands").then(r => r.json()).catch(() => ({ ok: false })),
      fetch("/api/factories").then(r => r.json()).catch(() => ({ ok: false })),
    ]).then(([fj, bj, factj]) => {
      if (!fj.ok) { setError("Fabric not found"); setLoading(false); return; }
      const f = fj.fabric;
      setFabric(f);

      // Populate core fields
      setFabricName(f.note?.replace("Intake: ", "").split(" | ")[0] || "");
      setCustomerCode(f.customerCode || "");
      setFactoryCode(f.factoryCode || "");
      setBatchLotNumber(f.batchLotNumber || "");
      setColor(f.color || "");
      setEndUse(f.endUse || "");
      setTargetFuzeTier(f.targetFuzeTier || "");
      setWeightGsm(f.weightGsm ? String(f.weightGsm) : "");
      setWidthInches(f.widthInches ? String(f.widthInches) : "");
      setThickness(f.thickness ? String(f.thickness) : "");
      setFabricCategory(f.fabricCategory || "");
      setQuantityType(f.quantityType || "");
      setQuantityUnit(f.quantityUnit || "meters");
      setConstruction(f.construction || "");
      setYarnType(f.yarnType || "");
      setFinishNote(f.finishNote || "");
      setNote(f.note || "");
      setBrandId(f.brandId || "");
      setFactoryId(f.factoryId || "");

      // Contents
      if (f.contents?.length > 0) {
        setContents(f.contents.map((c: any) => ({ material: c.material || "", percent: c.percent ? String(c.percent) : "" })));
      }

      // Populate extended fields from scalar columns
      const extUpdate: any = {};
      if (f.weavePattern) extUpdate.weavePattern = f.weavePattern;
      if (f.knitStitchType) extUpdate.knitStitchType = f.knitStitchType;
      if (f.gauge) extUpdate.gauge = f.gauge;
      if (f.threadCountWarp) extUpdate.threadCountWarp = String(f.threadCountWarp);
      if (f.threadCountWeft) extUpdate.threadCountWeft = String(f.threadCountWeft);
      if (f.shrinkageLength) extUpdate.shrinkageLength = String(f.shrinkageLength);
      if (f.shrinkageWidth) extUpdate.shrinkageWidth = String(f.shrinkageWidth);
      if (f.fabricPh) extUpdate.fabricPh = String(f.fabricPh);
      if (f.dyeApplied !== null && f.dyeApplied !== undefined) extUpdate.dyeApplied = f.dyeApplied ? "yes" : "no";
      if (f.dyeStage) extUpdate.dyeStage = f.dyeStage;
      if (f.dyeClass) extUpdate.dyeClass = f.dyeClass;

      // Populate from JSON fields
      const jsonMap = [
        ["pretreatment", ["singeing","singeType","desizing","desizeMethod","desizeEnzymes","scouring","scourNaoh","scourTemp","scourTime","bleaching","bleachType","bleachConc","bleachTemp","mercerization","mercNaoh","mercTension","heatSetting","heatTemp","heatTime","residualChemicals","wettingAgents"]],
        ["dyeDetails", ["dyeClassOther","reactiveType","reactiveFixTemp","reactiveAlkali","reactiveConc","disperseEnergy","disperseCarrier","disperseCarrierType","disperseTemp","acidType","reductionAgent","oxidationAgent","dyeBathMethod","dyeBathOther","bathTemp","bathPh","saltConc","dyeConc","levelingAgents","dispersingAgents","sequesteringAgents","postDyeTreatments","postDyePh","dryingTemp"]],
        ["finishSoftener", ["silSoftener","silSoftenerType","silSoftenerCharge","silSoftenerConc","silSoftenerBrand","nonSilSoftener","nonSilSoftenerType","nonSilSoftenerConc","waxSoftener","waxType","waxConc"]],
        ["finishRepellent", ["waterRepellent","wrType","wrConc","wrPfasFree","wrDurability"]],
        ["finishOther", ["antiPilling","flameRetardant","uvProtection","stainRelease","antiStatic","existingAntibacterial","handFeelModifier"]],
      ];
      for (const [jsonField, keys] of jsonMap) {
        if (f[jsonField] && typeof f[jsonField] === "object") {
          for (const k of keys) {
            if (f[jsonField][k]) extUpdate[k] = String(f[jsonField][k]);
          }
        }
      }
      // finishWicking / finishWrinkleFree use "applied"/"type"/"conc" keys
      if (f.finishWicking && typeof f.finishWicking === "object") {
        if (f.finishWicking.applied) extUpdate.wickingApplied = f.finishWicking.applied;
        if (f.finishWicking.type) extUpdate.wickingType = f.finishWicking.type;
        if (f.finishWicking.conc) extUpdate.wickingConc = f.finishWicking.conc;
      }
      if (f.finishWrinkleFree && typeof f.finishWrinkleFree === "object") {
        if (f.finishWrinkleFree.applied) extUpdate.wrinkleFreeApplied = f.finishWrinkleFree.applied;
        if (f.finishWrinkleFree.type) extUpdate.wrinkleFreeType = f.finishWrinkleFree.type;
        if (f.finishWrinkleFree.conc) extUpdate.wrinkleFreeConc = f.finishWrinkleFree.conc;
      }
      if (f.finishOther?.details) extUpdate.otherFinishDetails = f.finishOther.details;

      setExt(prev => ({ ...prev, ...extUpdate }));

      // Brands/factories
      if (bj.ok) {
        const all: any[] = [];
        Object.values(bj.grouped || {}).forEach((arr: any) => arr.forEach((b: any) => all.push(b)));
        setBrands(all.sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (factj.ok) setFactories(factj.factories || []);
      setLoading(false);
    });
  }, [id]);

  // ─── Save ───
  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const payload: any = {
        customerCode: customerCode || null,
        factoryCode: factoryCode || null,
        construction: fabricCategory || construction || null,
        color: color || null,
        batchLotNumber: batchLotNumber || null,
        endUse: endUse || null,
        targetFuzeTier: targetFuzeTier || null,
        quantityType: quantityType || null,
        quantityUnit: quantityUnit || null,
        weightGsm: weightGsm ? parseFloat(weightGsm) : null,
        widthInches: widthInches ? parseFloat(widthInches) : null,
        thickness: thickness ? parseFloat(thickness) : null,
        fabricCategory: fabricCategory || null,
        yarnType: yarnType || null,
        finishNote: finishNote || null,
        note: note || null,
        brandId: brandId || null,
        factoryId: factoryId || null,
        contents: contents.filter(c => c.material),
        // Extended scalar fields
        weavePattern: ext.weavePattern || ext.weaveOther || null,
        knitStitchType: ext.knitStitchType || ext.knitOther || null,
        gauge: ext.gauge || null,
        threadCountWarp: ext.threadCountWarp ? parseInt(ext.threadCountWarp) : null,
        threadCountWeft: ext.threadCountWeft ? parseInt(ext.threadCountWeft) : null,
        shrinkageLength: ext.shrinkageLength ? parseFloat(ext.shrinkageLength) : null,
        shrinkageWidth: ext.shrinkageWidth ? parseFloat(ext.shrinkageWidth) : null,
        fabricPh: ext.fabricPh ? parseFloat(ext.fabricPh) : null,
        dyeApplied: ext.dyeApplied === "yes" ? true : ext.dyeApplied === "no" ? false : null,
        dyeStage: ext.dyeStage || null,
        dyeClass: ext.dyeClass || null,
        // JSON fields
        pretreatment: {
          singeing: ext.singeing, singeType: ext.singeType,
          desizing: ext.desizing, desizeMethod: ext.desizeMethod, desizeEnzymes: ext.desizeEnzymes,
          scouring: ext.scouring, scourNaoh: ext.scourNaoh, scourTemp: ext.scourTemp, scourTime: ext.scourTime,
          bleaching: ext.bleaching, bleachType: ext.bleachType, bleachConc: ext.bleachConc, bleachTemp: ext.bleachTemp,
          mercerization: ext.mercerization, mercNaoh: ext.mercNaoh, mercTension: ext.mercTension,
          heatSetting: ext.heatSetting, heatTemp: ext.heatTemp, heatTime: ext.heatTime,
          residualChemicals: ext.residualChemicals, wettingAgents: ext.wettingAgents,
        },
        dyeDetails: {
          dyeClassOther: ext.dyeClassOther,
          reactiveType: ext.reactiveType, reactiveFixTemp: ext.reactiveFixTemp, reactiveAlkali: ext.reactiveAlkali, reactiveConc: ext.reactiveConc,
          disperseEnergy: ext.disperseEnergy, disperseCarrier: ext.disperseCarrier, disperseCarrierType: ext.disperseCarrierType, disperseTemp: ext.disperseTemp,
          acidType: ext.acidType, reductionAgent: ext.reductionAgent, oxidationAgent: ext.oxidationAgent,
          dyeBathMethod: ext.dyeBathMethod, dyeBathOther: ext.dyeBathOther, bathTemp: ext.bathTemp, bathPh: ext.bathPh,
          saltConc: ext.saltConc, dyeConc: ext.dyeConc, levelingAgents: ext.levelingAgents,
          dispersingAgents: ext.dispersingAgents, sequesteringAgents: ext.sequesteringAgents,
          postDyeTreatments: ext.postDyeTreatments, postDyePh: ext.postDyePh, dryingTemp: ext.dryingTemp,
        },
        finishSoftener: {
          silSoftener: ext.silSoftener, silSoftenerType: ext.silSoftenerType, silSoftenerCharge: ext.silSoftenerCharge,
          silSoftenerConc: ext.silSoftenerConc, silSoftenerBrand: ext.silSoftenerBrand,
          nonSilSoftener: ext.nonSilSoftener, nonSilSoftenerType: ext.nonSilSoftenerType, nonSilSoftenerConc: ext.nonSilSoftenerConc,
          waxSoftener: ext.waxSoftener, waxType: ext.waxType, waxConc: ext.waxConc,
        },
        finishRepellent: {
          waterRepellent: ext.waterRepellent, wrType: ext.wrType, wrConc: ext.wrConc,
          wrPfasFree: ext.wrPfasFree, wrDurability: ext.wrDurability,
        },
        finishWicking: { applied: ext.wickingApplied, type: ext.wickingType, conc: ext.wickingConc },
        finishWrinkleFree: { applied: ext.wrinkleFreeApplied, type: ext.wrinkleFreeType, conc: ext.wrinkleFreeConc },
        finishOther: {
          antiPilling: ext.antiPilling, flameRetardant: ext.flameRetardant, uvProtection: ext.uvProtection,
          stainRelease: ext.stainRelease, antiStatic: ext.antiStatic,
          existingAntibacterial: ext.existingAntibacterial, handFeelModifier: ext.handFeelModifier,
          details: ext.otherFinishDetails,
        },
      };

      const res = await fetch(`/api/fabrics/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Failed to save"); return; }
      toast.success("Fabric updated successfully");
      router.push(`/fabrics/${id}`);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading fabric...</div>;
  if (!fabric) return <div className="flex items-center justify-center h-64 text-red-400">{error || "Fabric not found"}</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push(`/fabrics/${id}`)} className="text-sm text-cyan-600 hover:underline mb-1 block">
            &larr; Back to FUZE {fabric.fuzeNumber}
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Edit Fabric — FUZE {fabric.fuzeNumber}</h1>
          <p className="text-slate-500 mt-1 text-sm">Update all fabric properties, chemistry, and finish data</p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 space-y-6">

          {/* Identification */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Identification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Customer Code</label>
                <input type="text" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Factory Code</label>
                <input type="text" value={factoryCode} onChange={(e) => setFactoryCode(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Batch / Lot Number</label>
                <input type="text" value={batchLotNumber} onChange={(e) => setBatchLotNumber(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Brand</label>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select brand...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Factory</label>
                <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select factory...</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>End Use</label>
                <input type="text" value={endUse} onChange={(e) => setEndUse(e.target.value)} placeholder="e.g. T-shirt, Athletic" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Physical Properties */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Physical Properties</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><label className={labelClass}>Color</label><input type="text" value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Weight (GSM)</label><input type="number" step="0.1" value={weightGsm} onChange={(e) => setWeightGsm(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Width (inches)</label><input type="number" step="0.1" value={widthInches} onChange={(e) => setWidthInches(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Thickness (mm)</label><input type="number" step="0.1" value={thickness} onChange={(e) => setThickness(e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          {/* Quantity & Classification */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Quantity & Classification</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelClass}>Quantity Type</label>
                <select value={quantityType} onChange={(e) => setQuantityType(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select type...</option><option value="ACTUAL">Actual</option><option value="FORECAST">Forecast</option><option value="DEVELOPMENT">Development</option><option value="RD">R&D</option>
                </select></div>
              <div><label className={labelClass}>Unit</label>
                <select value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="meters">Meters</option><option value="yards">Yards</option><option value="kg">KG</option>
                </select></div>
              <div><label className={labelClass}>Target FUZE Tier</label>
                <select value={targetFuzeTier} onChange={(e) => setTargetFuzeTier(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select tier...</option><option value="F1">F1 - Full Spectrum</option><option value="F2">F2 - Advanced Performance</option><option value="F3">F3 - Core Performance</option><option value="F4">F4 - Essential Protection</option>
                </select></div>
            </div>
          </div>

          {/* Section 2: Yarn & Fiber */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Yarn & Fiber Composition</h3>
            <p className="text-xs text-slate-500 mb-4">Total percentage must equal 100%</p>
            {contents.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <span className="text-xs text-slate-400 self-center w-4">{i + 1}.</span>
                <input type="text" placeholder="Fiber type" value={c.material}
                  onChange={e => { const nc = [...contents]; nc[i].material = e.target.value; setContents(nc); }}
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500" />
                <input type="number" placeholder="%" value={c.percent} step="0.1"
                  onChange={e => { const nc = [...contents]; nc[i].percent = e.target.value; setContents(nc); }}
                  className="w-20 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500" />
                {contents.length > 1 && (
                  <button type="button" onClick={() => setContents(contents.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                )}
              </div>
            ))}
            {contents.length < 4 && (
              <button type="button" onClick={() => setContents([...contents, { material: "", percent: "" }])} className="text-xs text-cyan-600 hover:underline">+ Add Fiber</button>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div><label className={labelClass}>Recycled Content</label>
                <select value={ext.recycledContent} onChange={e => setField("recycledContent", e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option>
                </select></div>
              {ext.recycledContent === "yes" && <>
                <div><label className={labelClass}>Recycled %</label><input type="number" value={ext.recycledPct} onChange={e => setField("recycledPct", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Type</label><input type="text" value={ext.recycledType} onChange={e => setField("recycledType", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Certification</label><input type="text" value={ext.recycledCert} onChange={e => setField("recycledCert", e.target.value)} className={inputClass} /></div>
              </>}
            </div>
          </div>

          {/* Section 3: Fabric Construction */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Fabric Construction</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div><label className={labelClass}>Category</label>
                <select value={fabricCategory} onChange={(e) => setFabricCategory(e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select...</option><option value="woven">Woven</option><option value="knit">Knit</option><option value="nonwoven">Nonwoven</option>
                </select></div>
            </div>
            {fabricCategory === "woven" && (
              <div className="p-4 bg-slate-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Woven Details</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Weave Pattern</label>
                    <select value={ext.weavePattern} onChange={e => setField("weavePattern", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Plain">Plain</option><option value="Twill">Twill</option><option value="Satin">Satin</option><option value="Jacquard">Jacquard</option><option value="Dobby">Dobby</option><option value="Other">Other</option>
                    </select></div>
                  {ext.weavePattern === "Other" && <div><label className={labelClass}>Other</label><input type="text" value={ext.weaveOther} onChange={e => setField("weaveOther", e.target.value)} className={inputClass} /></div>}
                  <div><label className={labelClass}>Warp/cm</label><input type="number" value={ext.threadCountWarp} onChange={e => setField("threadCountWarp", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Weft/cm</label><input type="number" value={ext.threadCountWeft} onChange={e => setField("threadCountWeft", e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            )}
            {fabricCategory === "knit" && (
              <div className="p-4 bg-slate-50 rounded-lg mb-4">
                <p className="text-sm font-medium text-slate-700 mb-3">Knit Details</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Stitch Type</label>
                    <select value={ext.knitStitchType} onChange={e => setField("knitStitchType", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Jersey">Jersey</option><option value="Rib">Rib</option><option value="Interlock">Interlock</option><option value="Pique">Pique</option><option value="Fleece">Fleece</option><option value="Other">Other</option>
                    </select></div>
                  {ext.knitStitchType === "Other" && <div><label className={labelClass}>Other</label><input type="text" value={ext.knitOther} onChange={e => setField("knitOther", e.target.value)} className={inputClass} /></div>}
                  <div><label className={labelClass}>Gauge</label><input type="text" value={ext.gauge} onChange={e => setField("gauge", e.target.value)} className={inputClass} /></div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className={labelClass}>Shrinkage % Length</label><input type="number" step="0.1" value={ext.shrinkageLength} onChange={e => setField("shrinkageLength", e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Shrinkage % Width</label><input type="number" step="0.1" value={ext.shrinkageWidth} onChange={e => setField("shrinkageWidth", e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Air Permeability</label><input type="number" step="0.1" value={ext.airPermeability} onChange={e => setField("airPermeability", e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Compactness</label>
                <select value={ext.compactness} onChange={e => setField("compactness", e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select...</option><option value="Very loose">Very loose</option><option value="Loose">Loose</option><option value="Normal">Normal</option><option value="Compact">Compact</option><option value="Very compact">Very compact</option>
                </select></div>
            </div>
          </div>

          {/* Section 4: Pretreatment */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Pretreatment History</h3>
            <p className="text-xs text-slate-500 mb-4">Pretreatment residues directly affect antimicrobial bonding.</p>
            {[
              { label: "Singeing", key: "singeing", extras: [{ label: "Type", key: "singeType", placeholder: "Flame / Hot plate / Infrared" }] },
              { label: "Desizing", key: "desizing", extras: [{ label: "Method", key: "desizeMethod", placeholder: "Enzymatic / Acid / Oxidative" }, { label: "Enzymes", key: "desizeEnzymes", placeholder: "Enzyme types" }] },
            ].map(({ label: lbl, key, extras }) => (
              <div key={key} className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-sm font-medium text-slate-700 w-24">{lbl}:</span>
                <select value={(ext as any)[key]} onChange={e => setField(key, e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                  <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                </select>
                {(ext as any)[key] === "yes" && extras.map(ex => (
                  <input key={ex.key} type="text" value={(ext as any)[ex.key]} onChange={e => setField(ex.key, e.target.value)} placeholder={ex.placeholder} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm flex-1 min-w-[140px]" />
                ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm font-medium text-slate-700 w-24">Scouring:</span>
              <select value={ext.scouring} onChange={e => setField("scouring", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
              </select>
              {ext.scouring === "yes" && <>
                <input type="text" value={ext.scourNaoh} onChange={e => setField("scourNaoh", e.target.value)} placeholder="NaOH %" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                <input type="text" value={ext.scourTemp} onChange={e => setField("scourTemp", e.target.value)} placeholder="Temp °C" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                <input type="text" value={ext.scourTime} onChange={e => setField("scourTime", e.target.value)} placeholder="Time min" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
              </>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm font-medium text-slate-700 w-24">Bleaching:</span>
              <select value={ext.bleaching} onChange={e => setField("bleaching", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
              </select>
              {ext.bleaching === "yes" && <>
                <select value={ext.bleachType} onChange={e => setField("bleachType", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-24"><option value="">Type</option><option value="H2O2">H2O2</option><option value="NaOCl">NaOCl</option><option value="NaClO2">NaClO2</option></select>
                <input type="text" value={ext.bleachConc} onChange={e => setField("bleachConc", e.target.value)} placeholder="Conc %" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                <input type="text" value={ext.bleachTemp} onChange={e => setField("bleachTemp", e.target.value)} placeholder="Temp °C" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
              </>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm font-medium text-slate-700 w-24">Mercerization:</span>
              <select value={ext.mercerization} onChange={e => setField("mercerization", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
              </select>
              {ext.mercerization === "yes" && <>
                <input type="text" value={ext.mercNaoh} onChange={e => setField("mercNaoh", e.target.value)} placeholder="NaOH %" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                <select value={ext.mercTension} onChange={e => setField("mercTension", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-32"><option value="">Tension?</option><option value="yes">Under tension</option><option value="no">No tension</option></select>
              </>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="text-sm font-medium text-slate-700 w-24">Heat Setting:</span>
              <select value={ext.heatSetting} onChange={e => setField("heatSetting", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
              </select>
              {ext.heatSetting === "yes" && <>
                <input type="text" value={ext.heatTemp} onChange={e => setField("heatTemp", e.target.value)} placeholder="Temp °C" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                <input type="text" value={ext.heatTime} onChange={e => setField("heatTime", e.target.value)} placeholder="Time" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-28" />
              </>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div><label className={labelClass}>Fabric pH</label><input type="number" step="0.1" value={ext.fabricPh} onChange={e => setField("fabricPh", e.target.value)} placeholder="6.0–7.5" className={inputClass} /></div>
              <div><label className={labelClass}>Residual Chemicals</label><input type="text" value={ext.residualChemicals} onChange={e => setField("residualChemicals", e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Wetting Agents</label><input type="text" value={ext.wettingAgents} onChange={e => setField("wettingAgents", e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          {/* Section 5: Dyeing */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Dyeing Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div><label className={labelClass}>Fabric Dyed?</label>
                <select value={ext.dyeApplied} onChange={e => setField("dyeApplied", e.target.value)} className={inputClass + " bg-white"}>
                  <option value="">Select...</option><option value="yes">Yes</option><option value="no">No (greige)</option>
                </select></div>
              {ext.dyeApplied === "yes" && <>
                <div><label className={labelClass}>Dyeing Stage</label>
                  <select value={ext.dyeStage} onChange={e => setField("dyeStage", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="Yarn-dyed">Yarn-dyed</option><option value="Piece-dyed">Piece-dyed</option><option value="Garment-dyed">Garment-dyed</option><option value="Printed">Printed</option>
                  </select></div>
                <div><label className={labelClass}>Dye Class</label>
                  <select value={ext.dyeClass} onChange={e => setField("dyeClass", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="Reactive">Reactive</option><option value="Disperse">Disperse</option><option value="Acid">Acid</option><option value="Vat">Vat</option><option value="Sulfur">Sulfur</option><option value="Pigment">Pigment</option><option value="Direct">Direct</option><option value="Natural">Natural</option><option value="Other">Other</option>
                  </select></div>
              </>}
            </div>
            {ext.dyeApplied === "yes" && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>Bath Method</label><select value={ext.dyeBathMethod} onChange={e => setField("dyeBathMethod", e.target.value)} className={inputClass + " bg-white"}><option value="">Select...</option><option value="Pad">Pad</option><option value="Exhaust">Exhaust</option><option value="Jet">Jet</option><option value="Continuous">Continuous</option></select></div>
                <div><label className={labelClass}>Bath Temp (°C)</label><input type="text" value={ext.bathTemp} onChange={e => setField("bathTemp", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Bath pH</label><input type="text" value={ext.bathPh} onChange={e => setField("bathPh", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Post-Dye pH</label><input type="text" value={ext.postDyePh} onChange={e => setField("postDyePh", e.target.value)} className={inputClass} /></div>
              </div>
            )}
          </div>

          {/* Section 6: Chemical Finishes */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-1">Chemical Finishes</h3>
            <p className="text-xs text-red-600 font-medium mb-4">Chemical finishes directly impact silver nanoparticle bonding and antimicrobial efficacy.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div><label className={labelClass}>Silicone Softener?</label><select value={ext.silSoftener} onChange={e => setField("silSoftener", e.target.value)} className={inputClass + " bg-white"}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
              <div><label className={labelClass}>Water Repellent?</label><select value={ext.waterRepellent} onChange={e => setField("waterRepellent", e.target.value)} className={inputClass + " bg-white"}><option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
              <div><label className={labelClass}>Wicking?</label><select value={ext.wickingApplied} onChange={e => setField("wickingApplied", e.target.value)} className={inputClass + " bg-white"}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
              <div><label className={labelClass}>Wrinkle-Free?</label><select value={ext.wrinkleFreeApplied} onChange={e => setField("wrinkleFreeApplied", e.target.value)} className={inputClass + " bg-white"}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option></select></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Anti-pilling", key: "antiPilling" }, { label: "Flame Retardant", key: "flameRetardant" },
                { label: "UV Protection", key: "uvProtection" }, { label: "Stain Release", key: "stainRelease" },
                { label: "Anti-static", key: "antiStatic" }, { label: "Existing Antibacterial", key: "existingAntibacterial" },
                { label: "Hand-feel Modifier", key: "handFeelModifier" },
              ].map(f => (
                <div key={f.key}><label className={labelClass}>{f.label}</label>
                  <select value={(ext as any)[f.key]} onChange={e => setField(f.key, e.target.value)} className={inputClass + " bg-white"}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select>
                </div>
              ))}
            </div>
            <div className="mt-3"><label className={labelClass}>Other Finish Details</label><input type="text" value={ext.otherFinishDetails} onChange={e => setField("otherFinishDetails", e.target.value)} className={inputClass} /></div>
          </div>

          {/* Section 7: Notes */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Additional Notes</h3>
            <div className="space-y-4">
              <div><label className={labelClass}>Special Requirements</label><textarea value={ext.specialRequirements} onChange={e => setField("specialRequirements", e.target.value)} rows={2} className={inputClass} /></div>
              <div><label className={labelClass}>Known Chemical Incompatibilities</label><textarea value={ext.chemIncompatibilities} onChange={e => setField("chemIncompatibilities", e.target.value)} rows={2} className={inputClass} /></div>
              <div><label className={labelClass}>General Notes</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass} /></div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">FUZE {fabric.fuzeNumber} — editing all fabric properties</p>
            {(user?.role === "ADMIN" || user?.role === "EMPLOYEE") && !showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                Delete Fabric
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2 ml-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-xs text-red-700 font-medium">Permanently delete this fabric?</span>
                <button onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/fabrics/${id}`, { method: "DELETE" });
                    const j = await res.json();
                    if (j.ok) {
                      toast.success("Fabric deleted" + (j.unlinkedSubmissions > 0 ? ` (${j.unlinkedSubmissions} submissions preserved)` : ""));
                      router.push("/fabrics");
                    } else { setError(j.error); setShowDeleteConfirm(false); }
                  } catch (e: any) { setError(e.message); setShowDeleteConfirm(false); }
                  finally { setDeleting(false); }
                }} disabled={deleting} className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded hover:bg-white">No</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/fabrics/${id}`)} className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 font-medium">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
