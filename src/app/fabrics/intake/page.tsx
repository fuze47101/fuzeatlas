// @ts-nocheck
"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import { useToast } from "@/components/Toast";

interface ParsedFabricData {
  brandCompanyName?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  fabricName?: string;
  customerCode?: string;
  factoryCode?: string;
  batchLotNumber?: string;
  dateSubmitted?: string;
  quantity?: string;
  quantityType?: string;
  quantityUnit?: string;
  endUse?: string;
  targetFuzeTier?: string;
  annualVolume?: string;
  fiberComposition?: any[];
  fabricCategory?: string;
  weavePattern?: string;
  knitStitchType?: string;
  weightGsm?: number;
  widthInches?: number;
  thickness?: number;
  color?: string;
  shrinkageLength?: number;
  shrinkageWidth?: number;
  fabricPh?: number;
  dyeApplied?: boolean;
  dyeStage?: string;
  confidence?: number;
}

type IntakeMode = "upload" | "form";

export default function FabricIntakePage() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab / mode state
  const [mode, setMode] = useState<IntakeMode>("upload");

  // ─── PDF Upload state ───
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFabricData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState<string>("");

  // ─── Common form fields (used by both upload-review and manual form) ───
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

  // ─── Manual-form-only fields ───
  const [construction, setConstruction] = useState("");
  const [yarnType, setYarnType] = useState("");
  const [finishNote, setFinishNote] = useState("");
  const [note, setNote] = useState("");
  const [brandId, setBrandId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [contents, setContents] = useState([{ material: "", percent: "" }]);

  // ─── Extended form fields (Sections 2-7 from PDF) ───
  const [ext, setExt] = useState({
    // Section 2: Yarn & Fiber (up to 4 entries handled by contents[])
    recycledContent: "", recycledPct: "", recycledType: "", recycledCert: "",
    yarnTwistDirection: "",
    // Section 3: Fabric Construction
    weavePattern: "", weaveOther: "", threadCountWarp: "", threadCountWeft: "",
    knitStitchType: "", knitOther: "", gauge: "",
    shrinkageLength: "", shrinkageWidth: "", airPermeability: "", compactness: "",
    // Section 4: Pretreatment
    singeing: "", singeType: "",
    desizing: "", desizeMethod: "", desizeEnzymes: "",
    scouring: "", scourNaoh: "", scourTemp: "", scourTime: "",
    bleaching: "", bleachType: "", bleachConc: "", bleachTemp: "",
    mercerization: "", mercNaoh: "", mercTension: "",
    heatSetting: "", heatTemp: "", heatTime: "",
    fabricPh: "",
    residualChemicals: "", wettingAgents: "",
    // Section 5: Dyeing
    dyeApplied: "", dyeStage: "", dyeClass: "", dyeClassOther: "",
    reactiveType: "", reactiveFixTemp: "", reactiveAlkali: "", reactiveConc: "",
    disperseEnergy: "", disperseCarrier: "", disperseCarrierType: "", disperseTemp: "",
    acidType: "", reductionAgent: "", oxidationAgent: "",
    dyeBathMethod: "", dyeBathOther: "", bathTemp: "", bathPh: "",
    saltConc: "", dyeConc: "", levelingAgents: "", dispersingAgents: "", sequesteringAgents: "",
    postDyeTreatments: "", postDyePh: "", dryingTemp: "",
    // Section 6: Chemical Finishes
    silSoftener: "", silSoftenerType: "", silSoftenerCharge: "", silSoftenerConc: "", silSoftenerBrand: "",
    nonSilSoftener: "", nonSilSoftenerType: "", nonSilSoftenerConc: "",
    waxSoftener: "", waxType: "", waxConc: "",
    waterRepellent: "", wrType: "", wrConc: "", wrPfasFree: "", wrDurability: "",
    wickingApplied: "", wickingType: "", wickingConc: "",
    wrinkleFreeApplied: "", wrinkleFreeType: "", wrinkleFreeConc: "",
    antiPilling: "", flameRetardant: "", uvProtection: "", stainRelease: "",
    antiStatic: "", existingAntibacterial: "", handFeelModifier: "",
    otherFinishDetails: "",
    // Section 7: Additional Notes
    specialRequirements: "", chemIncompatibilities: "",
    prevAntimicrobial: "", prevAntimicrobialDesc: "",
    sampleCondition: "", washCount: "",
  });
  const setField = (k: string, v: string) => setExt(p => ({ ...p, [k]: v }));

  // ─── Save state ───
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Load brands & factories for the manual form
  useEffect(() => {
    fetch("/api/brands").then(r => r.json()).then(j => {
      if (j.ok) {
        const all: any[] = [];
        Object.values(j.grouped).forEach((arr: any) => arr.forEach((b: any) => all.push(b)));
        setBrands(all.sort((a, b) => a.name.localeCompare(b.name)));
      }
    }).catch(() => {});
    fetch("/api/factories").then(r => r.json()).then(j => { if (j.ok) setFactories(j.factories); }).catch(() => {});
  }, []);

  // ─── PDF Upload handling ───
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setParseError(null);
    setParsed(null);
    setDocumentId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/fabrics/parse-intake", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      setDocumentId(data.documentId);
      setFilename(data.filename);
      setRawText(data.rawText || "");
      setConfidence(data.confidence || 0);

      if (data.parseError) setParseError(data.parseError);

      if (data.parsed) {
        const p = data.parsed;
        setParsed(p);
        if (p.fabricName) setFabricName(p.fabricName);
        if (p.customerCode) setCustomerCode(p.customerCode);
        if (p.factoryCode) setFactoryCode(p.factoryCode);
        if (p.batchLotNumber) setBatchLotNumber(p.batchLotNumber);
        if (p.color) setColor(p.color);
        if (p.endUse) setEndUse(p.endUse);
        if (p.targetFuzeTier) setTargetFuzeTier(p.targetFuzeTier);
        if (p.weightGsm) setWeightGsm(String(p.weightGsm));
        if (p.widthInches) setWidthInches(String(p.widthInches));
        if (p.thickness) setThickness(String(p.thickness));
        if (p.fabricCategory) setFabricCategory(p.fabricCategory);
        if (p.quantityType) setQuantityType(p.quantityType);
        if (p.quantityUnit) setQuantityUnit(p.quantityUnit || "meters");
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDownloadForm = () => {
    const link = document.createElement("a");
    link.href = "/FUZE_Fabric_Intake_Form.pdf";
    link.download = "FUZE_Fabric_Intake_Form.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Save fabric (shared by both modes) ───
  const handleConfirm = async () => {
    if (!fabricName) {
      setConfirmError("Please enter a fabric name");
      return;
    }
    setConfirming(true);
    setConfirmError(null);

    try {
      const payload: any = {
        fabricName: fabricName || null,
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
      };

      // PDF-upload-specific fields
      if (mode === "upload" && documentId) {
        payload.intakeFormId = documentId;
        payload.intakeParsedAt = new Date().toISOString();
        payload.raw = parsed || null;
      }

      // Manual-form-specific fields
      if (mode === "form") {
        payload.yarnType = yarnType || null;
        payload.finishNote = finishNote || null;
        payload.note = note || null;
        payload.brandId = brandId || null;
        payload.factoryId = factoryId || null;
        payload.contents = contents.filter(c => c.material);
        // Extended fields stored as JSON
        payload.pretreatment = {
          singeing: ext.singeing, singeType: ext.singeType,
          desizing: ext.desizing, desizeMethod: ext.desizeMethod, desizeEnzymes: ext.desizeEnzymes,
          scouring: ext.scouring, scourNaoh: ext.scourNaoh, scourTemp: ext.scourTemp, scourTime: ext.scourTime,
          bleaching: ext.bleaching, bleachType: ext.bleachType, bleachConc: ext.bleachConc, bleachTemp: ext.bleachTemp,
          mercerization: ext.mercerization, mercNaoh: ext.mercNaoh, mercTension: ext.mercTension,
          heatSetting: ext.heatSetting, heatTemp: ext.heatTemp, heatTime: ext.heatTime,
          residualChemicals: ext.residualChemicals, wettingAgents: ext.wettingAgents,
        };
        payload.fabricPh = ext.fabricPh ? parseFloat(ext.fabricPh) : null;
        payload.dyeApplied = ext.dyeApplied === "yes" ? true : ext.dyeApplied === "no" ? false : null;
        payload.dyeStage = ext.dyeStage || null;
        payload.dyeClass = ext.dyeClass || null;
        payload.dyeDetails = {
          dyeClassOther: ext.dyeClassOther,
          reactiveType: ext.reactiveType, reactiveFixTemp: ext.reactiveFixTemp, reactiveAlkali: ext.reactiveAlkali, reactiveConc: ext.reactiveConc,
          disperseEnergy: ext.disperseEnergy, disperseCarrier: ext.disperseCarrier, disperseCarrierType: ext.disperseCarrierType, disperseTemp: ext.disperseTemp,
          acidType: ext.acidType, reductionAgent: ext.reductionAgent, oxidationAgent: ext.oxidationAgent,
          dyeBathMethod: ext.dyeBathMethod, dyeBathOther: ext.dyeBathOther, bathTemp: ext.bathTemp, bathPh: ext.bathPh,
          saltConc: ext.saltConc, dyeConc: ext.dyeConc, levelingAgents: ext.levelingAgents,
          dispersingAgents: ext.dispersingAgents, sequesteringAgents: ext.sequesteringAgents,
          postDyeTreatments: ext.postDyeTreatments, postDyePh: ext.postDyePh, dryingTemp: ext.dryingTemp,
        };
        payload.finishSoftener = {
          silSoftener: ext.silSoftener, silSoftenerType: ext.silSoftenerType, silSoftenerCharge: ext.silSoftenerCharge,
          silSoftenerConc: ext.silSoftenerConc, silSoftenerBrand: ext.silSoftenerBrand,
          nonSilSoftener: ext.nonSilSoftener, nonSilSoftenerType: ext.nonSilSoftenerType, nonSilSoftenerConc: ext.nonSilSoftenerConc,
          waxSoftener: ext.waxSoftener, waxType: ext.waxType, waxConc: ext.waxConc,
        };
        payload.finishRepellent = {
          waterRepellent: ext.waterRepellent, wrType: ext.wrType, wrConc: ext.wrConc,
          wrPfasFree: ext.wrPfasFree, wrDurability: ext.wrDurability,
        };
        payload.finishWicking = { applied: ext.wickingApplied, type: ext.wickingType, conc: ext.wickingConc };
        payload.finishWrinkleFree = { applied: ext.wrinkleFreeApplied, type: ext.wrinkleFreeType, conc: ext.wrinkleFreeConc };
        payload.finishOther = {
          antiPilling: ext.antiPilling, flameRetardant: ext.flameRetardant, uvProtection: ext.uvProtection,
          stainRelease: ext.stainRelease, antiStatic: ext.antiStatic,
          existingAntibacterial: ext.existingAntibacterial, handFeelModifier: ext.handFeelModifier,
          details: ext.otherFinishDetails,
        };
        payload.weavePattern = ext.weavePattern || ext.weaveOther || null;
        payload.knitStitchType = ext.knitStitchType || ext.knitOther || null;
        payload.gauge = ext.gauge || null;
        payload.threadCountWarp = ext.threadCountWarp ? parseInt(ext.threadCountWarp) : null;
        payload.threadCountWeft = ext.threadCountWeft ? parseInt(ext.threadCountWeft) : null;
        payload.shrinkageLength = ext.shrinkageLength ? parseFloat(ext.shrinkageLength) : null;
        payload.shrinkageWidth = ext.shrinkageWidth ? parseFloat(ext.shrinkageWidth) : null;
      }

      const res = await fetch("/api/fabrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.ok) {
        setConfirmError(data.error || "Failed to save fabric");
        return;
      }

      toast.success("Fabric created successfully");
      router.push(`/fabrics/${data.fabric.id}?saved=true`);
    } catch (err: any) {
      setConfirmError(err.message || "Failed to save");
    } finally {
      setConfirming(false);
    }
  };

  // Submit handler for manual form
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConfirm();
  };

  // Confidence badge
  const confidenceBadge = (score: number) => {
    if (score >= 75) return { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "High Confidence" };
    if (score >= 50) return { bg: "bg-amber-100 text-amber-800 border-amber-300", label: "Medium Confidence" };
    return { bg: "bg-red-100 text-red-800 border-red-300", label: "Low Confidence" };
  };

  const inputClass = "w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 text-sm";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fabric Intake</h1>
          <p className="text-slate-500 mt-1">Add a new fabric by uploading the intake form or entering details manually</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadForm}
            className="px-4 py-2 text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 text-sm font-medium"
          >
            ↓ Download Blank Form (PDF)
          </button>
          <button
            onClick={() => router.push("/fabrics")}
            className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            ← Back to Fabrics
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-200 mb-8">
        <button
          onClick={() => setMode("upload")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            mode === "upload"
              ? "border-cyan-600 text-cyan-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          📄 Upload PDF Form
        </button>
        <button
          onClick={() => setMode("form")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            mode === "form"
              ? "border-cyan-600 text-cyan-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          }`}
        >
          ✏️ Complete Form Online
        </button>
      </div>

      {/* ════════════════════════════════════════ */}
      {/* MODE: Upload PDF                        */}
      {/* ════════════════════════════════════════ */}
      {mode === "upload" && (
        <>
          {/* Step 1: Upload Zone */}
          {!documentId && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
                ${dragOver ? "border-cyan-500 bg-cyan-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"}
                ${uploading ? "opacity-60 pointer-events-none" : ""}
              `}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={onFileSelect} className="hidden" />

              {uploading ? (
                <div className="space-y-4">
                  <div className="w-12 h-12 mx-auto border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-lg font-medium text-slate-700">Uploading & parsing PDF...</p>
                  <p className="text-sm text-slate-500">Extracting fabric data with AI</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-slate-700">Drop your completed FUZE Fabric Intake Form here</p>
                    <p className="text-sm text-slate-500 mt-1">or click to browse — PDF up to 25MB</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Need the blank form? Click "Download Blank Form" above, fill it out, then upload it here.
                  </p>
                </div>
              )}
            </div>
          )}

          {uploadError && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{uploadError}</div>}

          {/* Step 2: Review & Confirm */}
          {documentId && (
            <div className="space-y-6">
              {/* Upload success banner */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 3.5L18.5 8H14V3.5zM6 20V4h7v5a1 1 0 001 1h5v10H6z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{filename}</p>
                  <p className="text-sm text-slate-500">PDF uploaded and parsed</p>
                </div>
                {confidence > 0 && (
                  <div className={`px-3 py-1.5 border rounded-full text-xs font-medium ${confidenceBadge(confidence).bg}`}>
                    {confidenceBadge(confidence).label} ({confidence}%)
                  </div>
                )}
                <button
                  onClick={() => {
                    setDocumentId(null); setFilename(null); setParsed(null);
                    setParseError(null); setRawText(""); setConfidence(0);
                  }}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg"
                >
                  Upload Different
                </button>
              </div>

              {parseError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="font-medium text-amber-800">Parse Error</p>
                  <p className="text-sm text-amber-600 mt-1">{parseError}</p>
                  <p className="text-sm text-slate-600 mt-2">You can still fill in the fabric details manually below.</p>
                </div>
              )}

              {/* Review Form */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Review & Verify Fabric Data</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {parsed ? "Auto-parsed fields are pre-filled. Please verify accuracy before confirming." : "Fill in the fabric details manually."}
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Basic info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Fabric Name <span className="text-red-500">*</span></label>
                      <input type="text" value={fabricName} onChange={(e) => setFabricName(e.target.value)} placeholder="e.g. Cotton Jersey" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Customer Code</label>
                      <input type="text" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} placeholder="e.g. CC-2025-001" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Factory Code</label>
                      <input type="text" value={factoryCode} onChange={(e) => setFactoryCode(e.target.value)} placeholder="e.g. FC-123" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Batch/Lot Number</label>
                      <input type="text" value={batchLotNumber} onChange={(e) => setBatchLotNumber(e.target.value)} placeholder="e.g. BATCH-2025-001" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Color</label>
                      <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Navy" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>End Use</label>
                      <input type="text" value={endUse} onChange={(e) => setEndUse(e.target.value)} placeholder="e.g. T-shirt, Athletic" className={inputClass} />
                    </div>
                  </div>

                  {/* Physical properties */}
                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Physical Properties</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className={labelClass}>Weight (GSM)</label>
                        <input type="number" step="0.1" value={weightGsm} onChange={(e) => setWeightGsm(e.target.value)} placeholder="e.g. 180" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Width (inches)</label>
                        <input type="number" step="0.1" value={widthInches} onChange={(e) => setWidthInches(e.target.value)} placeholder="e.g. 58" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Thickness (mm)</label>
                        <input type="number" step="0.1" value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="e.g. 0.5" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Fabric Category</label>
                        <select value={fabricCategory} onChange={(e) => setFabricCategory(e.target.value)} className={inputClass + " bg-white"}>
                          <option value="">Select...</option>
                          <option value="woven">Woven</option>
                          <option value="knit">Knit</option>
                          <option value="nonwoven">Nonwoven</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Type & FUZE Tier */}
                  <div className="border-t border-slate-200 pt-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Quantity & Classification</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={labelClass}>Quantity Type <span className="text-red-500">*</span></label>
                        <select value={quantityType} onChange={(e) => setQuantityType(e.target.value)} className={inputClass + " bg-white"}>
                          <option value="">Select type...</option>
                          <option value="ACTUAL">Actual (confirmed order)</option>
                          <option value="FORECAST">Forecast (projected)</option>
                          <option value="DEVELOPMENT">Development (sample/trial)</option>
                          <option value="RD">R&D (research)</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Unit</label>
                        <select value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} className={inputClass + " bg-white"}>
                          <option value="meters">Meters</option>
                          <option value="yards">Yards</option>
                          <option value="kg">KG</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Target FUZE Tier</label>
                      <select value={targetFuzeTier} onChange={(e) => setTargetFuzeTier(e.target.value)} className={inputClass + " bg-white"}>
                        <option value="">Select tier...</option>
                        <option value="F1">F1 - Full Spectrum</option>
                        <option value="F2">F2 - Advanced Performance</option>
                        <option value="F3">F3 - Core Performance</option>
                        <option value="F4">F4 - Essential Protection</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-500 italic">A FUZE Fabric Number will be automatically assigned when this fabric is saved.</p>
                  </div>

                  {/* Raw text */}
                  {rawText && (
                    <div className="border-t border-slate-200 pt-6">
                      <button onClick={() => setShowRawText(!showRawText)} className="text-sm text-slate-500 hover:text-slate-700 underline">
                        {showRawText ? "Hide" : "Show"} extracted PDF text
                      </button>
                      {showRawText && (
                        <pre className="mt-2 p-4 bg-slate-900 text-slate-300 rounded-xl text-xs max-h-64 overflow-auto font-mono whitespace-pre-wrap">{rawText}</pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Confirm bar */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {parsed ? "Fields were auto-filled from your PDF. Please review before saving." : "Fill in the fabric details and save."}
                  </div>
                  <div className="flex items-center gap-3">
                    {confirmError && <span className="text-sm text-red-600">{confirmError}</span>}
                    <button onClick={() => router.push("/fabrics")} className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white">
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={confirming || !fabricName}
                      className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {confirming ? "Saving..." : "Confirm & Create Fabric"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════ */}
      {/* MODE: Complete Form Online              */}
      {/* ════════════════════════════════════════ */}
      {mode === "form" && (
        <form onSubmit={handleManualSubmit} className="bg-white rounded-xl shadow-sm border">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">New Fabric — Manual Entry</h2>
            <p className="text-sm text-slate-500 mt-1">Fill in fabric details below. Fields marked with * are required.</p>
          </div>

          <div className="p-6 space-y-6">
            {confirmError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{confirmError}</div>}

            {/* Identification */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Identification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Fabric Name <span className="text-red-500">*</span></label>
                  <input type="text" value={fabricName} onChange={(e) => setFabricName(e.target.value)} placeholder="e.g. Cotton Jersey" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.customerCode || "Customer Code"}</label>
                  <input type="text" value={customerCode} onChange={(e) => setCustomerCode(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.factoryCode || "Factory Code"}</label>
                  <input type="text" value={factoryCode} onChange={(e) => setFactoryCode(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Batch / Lot Number</label>
                  <input type="text" value={batchLotNumber} onChange={(e) => setBatchLotNumber(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.brand || "Brand"}</label>
                  <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">{t.fabrics.selectBrand || "Select brand..."}</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.factory || "Factory"}</label>
                  <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">{t.fabrics.selectFactory || "Select factory..."}</option>
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
                <div>
                  <label className={labelClass}>{t.fabrics.color || "Color"}</label>
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.weightGsm || "Weight (GSM)"}</label>
                  <input type="number" step="0.1" value={weightGsm} onChange={(e) => setWeightGsm(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t.fabrics.widthInches || "Width (inches)"}</label>
                  <input type="number" step="0.1" value={widthInches} onChange={(e) => setWidthInches(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Thickness (mm)</label>
                  <input type="number" step="0.1" value={thickness} onChange={(e) => setThickness(e.target.value)} placeholder="e.g. 0.5" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Quantity & Classification */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Quantity & Classification</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Quantity Type</label>
                  <select value={quantityType} onChange={(e) => setQuantityType(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select type...</option>
                    <option value="ACTUAL">Actual (confirmed order)</option>
                    <option value="FORECAST">Forecast (projected)</option>
                    <option value="DEVELOPMENT">Development (sample/trial)</option>
                    <option value="RD">R&D (research)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Unit</label>
                  <select value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="meters">Meters</option>
                    <option value="yards">Yards</option>
                    <option value="kg">KG</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Target FUZE Tier</label>
                  <select value={targetFuzeTier} onChange={(e) => setTargetFuzeTier(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select tier...</option>
                    <option value="F1">F1 - Full Spectrum</option>
                    <option value="F2">F2 - Advanced Performance</option>
                    <option value="F3">F3 - Core Performance</option>
                    <option value="F4">F4 - Essential Protection</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ═══ Section 2: Yarn & Fiber Composition ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-1">Yarn & Fiber Composition</h3>
              <p className="text-xs text-slate-500 mb-4">Total percentage must equal 100%. Common types: Cotton, Polyester, Nylon, Wool, Silk, Spandex, Viscose, Modal, Tencel, Linen</p>
              {contents.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <span className="text-xs text-slate-400 self-center w-4">{i + 1}.</span>
                  <input type="text" placeholder={t.fabrics.materialPlaceholder || "Fiber type"} value={c.material}
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
                <div>
                  <label className={labelClass}>Recycled Content</label>
                  <select value={ext.recycledContent} onChange={e => setField("recycledContent", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </div>
                {ext.recycledContent === "yes" && <>
                  <div><label className={labelClass}>Recycled %</label><input type="number" value={ext.recycledPct} onChange={e => setField("recycledPct", e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Recycled Type</label><input type="text" value={ext.recycledType} onChange={e => setField("recycledType", e.target.value)} placeholder="e.g. Post-consumer" className={inputClass} /></div>
                  <div><label className={labelClass}>Certification</label><input type="text" value={ext.recycledCert} onChange={e => setField("recycledCert", e.target.value)} placeholder="e.g. GRS, OEKO-TEX" className={inputClass} /></div>
                </>}
              </div>
              <div className="mt-4">
                <label className={labelClass}>Yarn Twist Direction</label>
                <select value={ext.yarnTwistDirection} onChange={e => setField("yarnTwistDirection", e.target.value)} className={inputClass + " bg-white max-w-xs"}>
                  <option value="">Select...</option><option value="S-twist">S-twist</option><option value="Z-twist">Z-twist</option><option value="Unknown">Unknown</option>
                </select>
              </div>
            </div>

            {/* ═══ Section 3: Fabric Construction ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Fabric Construction</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Category <span className="text-red-500">*</span></label>
                  <select value={fabricCategory} onChange={(e) => setFabricCategory(e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="woven">Woven</option><option value="knit">Knit</option><option value="nonwoven">Nonwoven</option>
                  </select>
                </div>
              </div>
              {fabricCategory === "woven" && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Woven Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelClass}>Weave Pattern</label>
                      <select value={ext.weavePattern} onChange={e => setField("weavePattern", e.target.value)} className={inputClass + " bg-white"}>
                        <option value="">Select...</option><option value="Plain">Plain</option><option value="Twill">Twill (2/1, 2/2, 3/1)</option>
                        <option value="Satin">Satin</option><option value="Jacquard">Jacquard</option><option value="Dobby">Dobby</option><option value="Other">Other</option>
                      </select>
                    </div>
                    {ext.weavePattern === "Other" && <div><label className={labelClass}>Other Pattern</label><input type="text" value={ext.weaveOther} onChange={e => setField("weaveOther", e.target.value)} className={inputClass} /></div>}
                    <div><label className={labelClass}>Warp/cm</label><input type="number" value={ext.threadCountWarp} onChange={e => setField("threadCountWarp", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Weft/cm</label><input type="number" value={ext.threadCountWeft} onChange={e => setField("threadCountWeft", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              )}
              {fabricCategory === "knit" && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Knit Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelClass}>Stitch Type</label>
                      <select value={ext.knitStitchType} onChange={e => setField("knitStitchType", e.target.value)} className={inputClass + " bg-white"}>
                        <option value="">Select...</option><option value="Jersey">Jersey</option><option value="Rib">Rib</option><option value="Interlock">Interlock</option>
                        <option value="Pique">Pique</option><option value="Fleece">Fleece</option><option value="Jacquard">Jacquard</option><option value="Cable">Cable</option><option value="Other">Other</option>
                      </select>
                    </div>
                    {ext.knitStitchType === "Other" && <div><label className={labelClass}>Other Stitch</label><input type="text" value={ext.knitOther} onChange={e => setField("knitOther", e.target.value)} className={inputClass} /></div>}
                    <div><label className={labelClass}>Gauge (needles/inch)</label><input type="text" value={ext.gauge} onChange={e => setField("gauge", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className={labelClass}>Shrinkage % Length</label><input type="number" step="0.1" value={ext.shrinkageLength} onChange={e => setField("shrinkageLength", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Shrinkage % Width</label><input type="number" step="0.1" value={ext.shrinkageWidth} onChange={e => setField("shrinkageWidth", e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Air Permeability (CFM)</label><input type="number" step="0.1" value={ext.airPermeability} onChange={e => setField("airPermeability", e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Compactness</label>
                  <select value={ext.compactness} onChange={e => setField("compactness", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="Very loose">Very loose</option><option value="Loose">Loose</option>
                    <option value="Normal">Normal</option><option value="Compact">Compact</option><option value="Very compact">Very compact</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ═══ Section 4: Pretreatment History ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-1">Pretreatment History</h3>
              <p className="text-xs text-slate-500 mb-4">Pretreatment residues directly affect antimicrobial treatment bonding. Complete as much as possible.</p>
              {[
                { label: "Singeing", key: "singeing", extras: [{ label: "Type", key: "singeType", placeholder: "Flame / Hot plate / Infrared" }] },
                { label: "Desizing", key: "desizing", extras: [{ label: "Method", key: "desizeMethod", placeholder: "Enzymatic / Acid / Oxidative" }, { label: "Enzymes", key: "desizeEnzymes", placeholder: "Enzyme types used" }] },
              ].map(({ label: lbl, key, extras }) => (
                <div key={key} className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-slate-700 w-24">{lbl}:</span>
                  <select value={(ext as any)[key]} onChange={e => setField(key, e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                    <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                  </select>
                  {(ext as any)[key] === "yes" && extras.map(ex => (
                    <input key={ex.key} type="text" value={(ext as any)[ex.key]} onChange={e => setField(ex.key, e.target.value)}
                      placeholder={ex.placeholder} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm flex-1 min-w-[140px]" />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-sm font-medium text-slate-700 w-24">Scouring <span className="text-red-500">*</span>:</span>
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
                  <select value={ext.bleachType} onChange={e => setField("bleachType", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-24">
                    <option value="">Type</option><option value="H2O2">H2O2</option><option value="NaOCl">NaOCl</option><option value="NaClO2">NaClO2</option>
                  </select>
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
                  <select value={ext.mercTension} onChange={e => setField("mercTension", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-32">
                    <option value="">Tension?</option><option value="yes">Under tension</option><option value="no">No tension</option>
                  </select>
                </>}
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-sm font-medium text-slate-700 w-24">Heat Setting:</span>
                <select value={ext.heatSetting} onChange={e => setField("heatSetting", e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm bg-white w-28">
                  <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                </select>
                {ext.heatSetting === "yes" && <>
                  <input type="text" value={ext.heatTemp} onChange={e => setField("heatTemp", e.target.value)} placeholder="Temp °C" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-20" />
                  <input type="text" value={ext.heatTime} onChange={e => setField("heatTime", e.target.value)} placeholder="Time sec/min" className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-28" />
                </>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                <div><label className={labelClass}>Fabric pH After Pretreatment <span className="text-red-500">*</span></label><input type="number" step="0.1" value={ext.fabricPh} onChange={e => setField("fabricPh", e.target.value)} placeholder="Ideal: 6.0–7.5" className={inputClass} /></div>
                <div><label className={labelClass}>Residual Chemicals</label><input type="text" value={ext.residualChemicals} onChange={e => setField("residualChemicals", e.target.value)} placeholder="None / Trace alkali / Trace acid" className={inputClass} /></div>
                <div><label className={labelClass}>Wetting Agents Used</label><input type="text" value={ext.wettingAgents} onChange={e => setField("wettingAgents", e.target.value)} className={inputClass} /></div>
              </div>
            </div>

            {/* ═══ Section 5: Dyeing Details ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Dyeing Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Fabric Dyed? <span className="text-red-500">*</span></label>
                  <select value={ext.dyeApplied} onChange={e => setField("dyeApplied", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="yes">Yes</option><option value="no">No (greige)</option>
                  </select>
                </div>
                {ext.dyeApplied === "yes" && <>
                  <div>
                    <label className={labelClass}>Dyeing Stage <span className="text-red-500">*</span></label>
                    <select value={ext.dyeStage} onChange={e => setField("dyeStage", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Yarn-dyed">Yarn-dyed</option><option value="Piece-dyed">Piece-dyed</option>
                      <option value="Garment-dyed">Garment-dyed</option><option value="Printed">Printed</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Dye Class <span className="text-red-500">*</span></label>
                    <select value={ext.dyeClass} onChange={e => setField("dyeClass", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Reactive">Reactive</option><option value="Disperse">Disperse</option>
                      <option value="Acid">Acid</option><option value="Vat">Vat</option><option value="Sulfur">Sulfur</option>
                      <option value="Pigment">Pigment</option><option value="Direct">Direct</option><option value="Natural">Natural</option><option value="Other">Other</option>
                    </select>
                  </div>
                </>}
              </div>
              {ext.dyeClass === "Reactive" && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Reactive Dye Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className={labelClass}>Type</label><select value={ext.reactiveType} onChange={e => setField("reactiveType", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Vinyl sulfone">Vinyl sulfone (hot)</option><option value="MCT">MCT (cold)</option><option value="DCT">DCT (warm)</option>
                    </select></div>
                    <div><label className={labelClass}>Fixation Temp (°C)</label><input type="text" value={ext.reactiveFixTemp} onChange={e => setField("reactiveFixTemp", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Alkali Used</label><select value={ext.reactiveAlkali} onChange={e => setField("reactiveAlkali", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Na2CO3">Na2CO3</option><option value="NaOH">NaOH</option>
                    </select></div>
                    <div><label className={labelClass}>Conc (g/L)</label><input type="text" value={ext.reactiveConc} onChange={e => setField("reactiveConc", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              )}
              {ext.dyeClass === "Disperse" && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Disperse Dye Details</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className={labelClass}>Energy Level</label><select value={ext.disperseEnergy} onChange={e => setField("disperseEnergy", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                    </select></div>
                    <div><label className={labelClass}>Carrier Used?</label><select value={ext.disperseCarrier} onChange={e => setField("disperseCarrier", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option>
                    </select></div>
                    {ext.disperseCarrier === "yes" && <div><label className={labelClass}>Carrier Type</label><input type="text" value={ext.disperseCarrierType} onChange={e => setField("disperseCarrierType", e.target.value)} className={inputClass} /></div>}
                    <div><label className={labelClass}>Dyeing Temp (°C)</label><input type="text" value={ext.disperseTemp} onChange={e => setField("disperseTemp", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              )}
              {(ext.dyeClass === "Acid" || ext.dyeClass === "Vat" || ext.dyeClass === "Sulfur") && (
                <div className="p-4 bg-slate-50 rounded-lg mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">{ext.dyeClass} Dye Details</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className={labelClass}>Acid/Dye Type</label><input type="text" value={ext.acidType} onChange={e => setField("acidType", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Reduction Agent</label><input type="text" value={ext.reductionAgent} onChange={e => setField("reductionAgent", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Oxidation Agent</label><input type="text" value={ext.oxidationAgent} onChange={e => setField("oxidationAgent", e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              )}
              {ext.dyeApplied === "yes" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div><label className={labelClass}>Dye Bath Method</label><select value={ext.dyeBathMethod} onChange={e => setField("dyeBathMethod", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Pad">Pad</option><option value="Exhaust">Exhaust (batch)</option><option value="Jet">Jet</option>
                      <option value="Package">Package</option><option value="Continuous">Continuous</option><option value="Other">Other</option>
                    </select></div>
                    <div><label className={labelClass}>Bath Temp (°C)</label><input type="text" value={ext.bathTemp} onChange={e => setField("bathTemp", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Bath pH</label><input type="text" value={ext.bathPh} onChange={e => setField("bathPh", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Salt Conc (g/L)</label><input type="text" value={ext.saltConc} onChange={e => setField("saltConc", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div><label className={labelClass}>Dye Conc (% owf)</label><input type="text" value={ext.dyeConc} onChange={e => setField("dyeConc", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Leveling Agents</label><input type="text" value={ext.levelingAgents} onChange={e => setField("levelingAgents", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Dispersing Agents</label><input type="text" value={ext.dispersingAgents} onChange={e => setField("dispersingAgents", e.target.value)} className={inputClass} /></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className={labelClass}>Post-Dye Treatments</label><input type="text" value={ext.postDyeTreatments} onChange={e => setField("postDyeTreatments", e.target.value)} placeholder="Soaping, hot rinse, cold rinse..." className={inputClass} /></div>
                    <div><label className={labelClass}>Post-Dye pH <span className="text-red-500">*</span></label><input type="text" value={ext.postDyePh} onChange={e => setField("postDyePh", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Drying Temp (°C)</label><input type="text" value={ext.dryingTemp} onChange={e => setField("dryingTemp", e.target.value)} className={inputClass} /></div>
                  </div>
                </>
              )}
            </div>

            {/* ═══ Section 6: Chemical Finishes ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-1">Chemical Finishes</h3>
              <p className="text-xs text-red-600 font-medium mb-1">CRITICAL: Chemical finishes directly impact silver nanoparticle bonding and antimicrobial efficacy.</p>
              <p className="text-xs text-slate-500 mb-4">Incomplete finish data is the #1 cause of unexpected test anomalies.</p>

              {/* Softeners */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-800 mb-3">Softeners <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                  <div><label className={labelClass}>Silicone Softener?</label><select value={ext.silSoftener} onChange={e => setField("silSoftener", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                  </select></div>
                  {ext.silSoftener === "yes" && <>
                    <div><label className={labelClass}>Type</label><select value={ext.silSoftenerType} onChange={e => setField("silSoftenerType", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Amino silicone">Amino silicone</option><option value="Macro-emulsion">Macro-emulsion</option>
                      <option value="Micro-emulsion">Micro-emulsion</option><option value="Hydrophilic">Hydrophilic silicone</option><option value="Polyether-modified">Polyether-modified</option>
                    </select></div>
                    <div><label className={labelClass}>Ionic Charge</label><select value={ext.silSoftenerCharge} onChange={e => setField("silSoftenerCharge", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="Cationic">Cationic (+)</option><option value="Anionic">Anionic (-)</option><option value="Nonionic">Nonionic</option>
                    </select></div>
                    <div><label className={labelClass}>Conc (% owf)</label><input type="text" value={ext.silSoftenerConc} onChange={e => setField("silSoftenerConc", e.target.value)} className={inputClass} /></div>
                  </>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div><label className={labelClass}>Non-Silicone Softener?</label><select value={ext.nonSilSoftener} onChange={e => setField("nonSilSoftener", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option>
                  </select></div>
                  {ext.nonSilSoftener === "yes" && <>
                    <div><label className={labelClass}>Type</label><input type="text" value={ext.nonSilSoftenerType} onChange={e => setField("nonSilSoftenerType", e.target.value)} placeholder="QAC, Imidazoline, Amine oxide..." className={inputClass} /></div>
                    <div><label className={labelClass}>Conc (% owf)</label><input type="text" value={ext.nonSilSoftenerConc} onChange={e => setField("nonSilSoftenerConc", e.target.value)} className={inputClass} /></div>
                  </>}
                </div>
              </div>

              {/* Water Repellent */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-800 mb-3">Water Repellent <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className={labelClass}>Applied?</label><select value={ext.waterRepellent} onChange={e => setField("waterRepellent", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                  </select></div>
                  {ext.waterRepellent === "yes" && <>
                    <div><label className={labelClass}>Type</label><select value={ext.wrType} onChange={e => setField("wrType", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="C6 Fluorocarbon">C6 Fluorocarbon</option><option value="Non-fluoro">Non-fluoro</option>
                      <option value="Silicone-based">Silicone-based</option><option value="Wax-based">Wax-based</option>
                    </select></div>
                    <div><label className={labelClass}>Conc (% owf)</label><input type="text" value={ext.wrConc} onChange={e => setField("wrConc", e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>PFOA/PFOS Free?</label><select value={ext.wrPfasFree} onChange={e => setField("wrPfasFree", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">Select...</option><option value="yes">Yes</option><option value="no">No</option>
                    </select></div>
                  </>}
                </div>
              </div>

              {/* Wicking & Wrinkle-Free */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-3">Wicking / Moisture Management <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelClass}>Applied?</label><select value={ext.wickingApplied} onChange={e => setField("wickingApplied", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                    </select></div>
                    {ext.wickingApplied === "yes" && <>
                      <div><label className={labelClass}>Type</label><input type="text" value={ext.wickingType} onChange={e => setField("wickingType", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Conc</label><input type="text" value={ext.wickingConc} onChange={e => setField("wickingConc", e.target.value)} placeholder="% owf" className={inputClass} /></div>
                    </>}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-3">Wrinkle-Free / Easy Care <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={labelClass}>Applied?</label><select value={ext.wrinkleFreeApplied} onChange={e => setField("wrinkleFreeApplied", e.target.value)} className={inputClass + " bg-white"}>
                      <option value="">—</option><option value="yes">Yes</option><option value="no">No</option><option value="unknown">Unknown</option>
                    </select></div>
                    {ext.wrinkleFreeApplied === "yes" && <>
                      <div><label className={labelClass}>Type</label><input type="text" value={ext.wrinkleFreeType} onChange={e => setField("wrinkleFreeType", e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Conc</label><input type="text" value={ext.wrinkleFreeConc} onChange={e => setField("wrinkleFreeConc", e.target.value)} placeholder="% owf" className={inputClass} /></div>
                    </>}
                  </div>
                </div>
              </div>

              {/* Other Finishes */}
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-3">Other Finishes</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Anti-pilling", key: "antiPilling" }, { label: "Flame Retardant", key: "flameRetardant" },
                    { label: "UV Protection", key: "uvProtection" }, { label: "Stain Release", key: "stainRelease" },
                    { label: "Anti-static", key: "antiStatic" }, { label: "Existing Antibacterial", key: "existingAntibacterial" },
                    { label: "Hand-feel Modifier", key: "handFeelModifier" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={labelClass}>{f.label}</label>
                      <select value={(ext as any)[f.key]} onChange={e => setField(f.key, e.target.value)} className={inputClass + " bg-white"}>
                        <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
                      </select>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <label className={labelClass}>Other Finish Details</label>
                  <input type="text" value={ext.otherFinishDetails} onChange={e => setField("otherFinishDetails", e.target.value)} placeholder="Types, concentrations, brands..." className={inputClass} />
                </div>
              </div>
            </div>

            {/* ═══ Section 7: Additional Notes & Submission ═══ */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Additional Notes & Submission</h3>
              <div className="space-y-4">
                <div><label className={labelClass}>Special Requirements or Concerns</label><textarea value={ext.specialRequirements} onChange={e => setField("specialRequirements", e.target.value)} rows={2} className={inputClass} /></div>
                <div><label className={labelClass}>Known Chemical Incompatibilities</label><textarea value={ext.chemIncompatibilities} onChange={e => setField("chemIncompatibilities", e.target.value)} rows={2} className={inputClass} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>Previous Antimicrobial Treatment</label><select value={ext.prevAntimicrobial} onChange={e => setField("prevAntimicrobial", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="none">None</option><option value="yes">Yes</option>
                  </select></div>
                  {ext.prevAntimicrobial === "yes" && <div><label className={labelClass}>Describe</label><input type="text" value={ext.prevAntimicrobialDesc} onChange={e => setField("prevAntimicrobialDesc", e.target.value)} className={inputClass} /></div>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div><label className={labelClass}>Sample Condition</label><select value={ext.sampleCondition} onChange={e => setField("sampleCondition", e.target.value)} className={inputClass + " bg-white"}>
                    <option value="">Select...</option><option value="New/Unused">New/Unused</option><option value="Washed">Washed</option><option value="Worn/Used">Worn/Used</option>
                  </select></div>
                  {ext.sampleCondition === "Washed" && <div><label className={labelClass}># of Washes</label><input type="number" value={ext.washCount} onChange={e => setField("washCount", e.target.value)} className={inputClass} /></div>}
                </div>
                <div><label className={labelClass}>General Notes</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Any additional notes..." className={inputClass} /></div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-500 italic">A FUZE Fabric Number will be automatically assigned when this fabric is saved.</p>
            </div>
          </div>

          {/* Action bar */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.push("/fabrics")} className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white">
              {t.common.cancel || "Cancel"}
            </button>
            <button
              type="submit"
              disabled={confirming || !fabricName}
              className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {confirming ? "Saving..." : "Create Fabric"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
