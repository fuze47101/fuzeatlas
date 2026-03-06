"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function FabricIntakePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed data state
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFabricData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [showRawText, setShowRawText] = useState(false);
  const [rawText, setRawText] = useState<string>("");

  // Form state (editable)
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

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Handle upload
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

      if (data.parseError) {
        setParseError(data.parseError);
      }

      if (data.parsed) {
        const p = data.parsed;
        setParsed(p);

        // Populate form fields
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
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  // Drag/drop handlers
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  // Download blank form
  const handleDownloadForm = () => {
    const link = document.createElement("a");
    link.href = "/FUZE_Fabric_Intake_Form.pdf";
    link.download = "FUZE_Fabric_Intake_Form.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm and save
  const handleConfirm = async () => {
    if (!fabricName) {
      setConfirmError("Please enter a fabric name");
      return;
    }
    setConfirming(true);
    setConfirmError(null);

    try {
      const payload = {
        // Basic fields
        fabricName: fabricName || null,
        customerCode: customerCode || null,
        factoryCode: factoryCode || null,
        construction: fabricCategory || null,
        color: color || null,
        batchLotNumber: batchLotNumber || null,

        // Intake fields
        endUse: endUse || null,
        targetFuzeTier: targetFuzeTier || null,
        weightGsm: weightGsm ? parseFloat(weightGsm) : null,
        widthInches: widthInches ? parseFloat(widthInches) : null,
        thickness: thickness ? parseFloat(thickness) : null,
        fabricCategory: fabricCategory || null,
        intakeFormId: documentId || null,
        intakeParsedAt: new Date().toISOString(),

        // Include full parsed data for reference
        raw: parsed || null,
      };

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

      router.push(`/fabrics/${data.fabric.id}?saved=true`);
    } catch (err: any) {
      setConfirmError(err.message || "Failed to save");
    } finally {
      setConfirming(false);
    }
  };

  // Confidence badge
  const confidenceBadge = (score: number) => {
    if (score >= 75) return { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "High Confidence" };
    if (score >= 50) return { bg: "bg-amber-100 text-amber-800 border-amber-300", label: "Medium Confidence" };
    return { bg: "bg-red-100 text-red-800 border-red-300", label: "Low Confidence" };
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fabric Intake Form</h1>
          <p className="text-slate-500 mt-1">Upload a completed FUZE Fabric Intake Form PDF — we'll parse it automatically</p>
        </div>
        <button
          onClick={() => router.push("/fabrics")}
          className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          ← Back to Fabrics
        </button>
      </div>

      {/* Step 1: Upload Zone */}
      {!documentId && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
            ${
              dragOver
                ? "border-cyan-500 bg-cyan-50 scale-[1.01]"
                : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
            }
            ${uploading ? "opacity-60 pointer-events-none" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={onFileSelect}
            className="hidden"
          />

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
                <p className="text-lg font-medium text-slate-700">Drop your FUZE Fabric Intake Form here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse — PDF up to 25MB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadForm();
                }}
                className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium"
              >
                Download Blank Form
              </button>
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
                setDocumentId(null);
                setFilename(null);
                setParsed(null);
                setParseError(null);
                setRawText("");
                setConfidence(0);
              }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg"
            >
              Upload Different
            </button>
          </div>

          {/* Parse error */}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Fabric Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fabricName}
                    onChange={(e) => setFabricName(e.target.value)}
                    placeholder="e.g. Cotton Jersey"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Code</label>
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    placeholder="e.g. CC-2025-001"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Factory Code</label>
                  <input
                    type="text"
                    value={factoryCode}
                    onChange={(e) => setFactoryCode(e.target.value)}
                    placeholder="e.g. FC-123"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch/Lot Number</label>
                  <input
                    type="text"
                    value={batchLotNumber}
                    onChange={(e) => setBatchLotNumber(e.target.value)}
                    placeholder="e.g. BATCH-2025-001"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Navy"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Use</label>
                  <input
                    type="text"
                    value={endUse}
                    onChange={(e) => setEndUse(e.target.value)}
                    placeholder="e.g. T-shirt, Athletic"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Physical properties */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-4">Physical Properties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Weight (GSM)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightGsm}
                      onChange={(e) => setWeightGsm(e.target.value)}
                      placeholder="e.g. 180"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Width (inches)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={widthInches}
                      onChange={(e) => setWidthInches(e.target.value)}
                      placeholder="e.g. 58"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Thickness (mm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={thickness}
                      onChange={(e) => setThickness(e.target.value)}
                      placeholder="e.g. 0.5"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Fabric Category</label>
                    <select
                      value={fabricCategory}
                      onChange={(e) => setFabricCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">Select...</option>
                      <option value="woven">Woven</option>
                      <option value="knit">Knit</option>
                      <option value="nonwoven">Nonwoven</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* FUZE Tier */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-semibold text-slate-900 mb-4">FUZE Tier</h3>
                <select
                  value={targetFuzeTier}
                  onChange={(e) => setTargetFuzeTier(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select tier...</option>
                  <option value="F1">F1 - Entry Level</option>
                  <option value="F2">F2 - Standard</option>
                  <option value="F3">F3 - Advanced</option>
                  <option value="F4">F4 - Premium</option>
                </select>
              </div>

              {/* Raw text */}
              {rawText && (
                <div className="border-t border-slate-200 pt-6">
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-sm text-slate-500 hover:text-slate-700 underline"
                  >
                    {showRawText ? "Hide" : "Show"} extracted PDF text
                  </button>
                  {showRawText && (
                    <pre className="mt-2 p-4 bg-slate-900 text-slate-300 rounded-xl text-xs max-h-64 overflow-auto font-mono whitespace-pre-wrap">
                      {rawText}
                    </pre>
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
                <button
                  onClick={() => router.push("/fabrics")}
                  className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white"
                >
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
    </div>
  );
}
