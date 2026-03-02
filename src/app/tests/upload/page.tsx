"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import CreateInlineForm from "@/components/CreateInlineForm";

// ── Types ─────────────────────────────────────────────────

interface ParsedData {
  testType: string | null;
  testReportNumber: string | null;
  labName: string | null;
  testDate: string | null;
  testMethodStd: string | null;
  fabricInfo: string | null;
  washCount: number | null;
  organisms: { name: string; result: string; reduction: number | null }[];
  icpResults: { metal: string; value: number | null; unit: string }[];
  fungalResult: { result: string; pass: boolean | null } | null;
  odorResult: { result: string; pass: boolean | null } | null;
  overallPass: boolean | null;
  confidence: number;
  rawText: string;
  warnings: string[];
}

interface ITSHeader {
  reportNumber: string | null;
  isRevision: boolean;
  supersedesReport: string | null;
  dateIssued: string | null;
  applicant: string | null;
  itemName: string | null;
  material: string | null;
  color: string | null;
  quantity: string | null;
  dateSampleReceived: string | null;
  dateTestStarted: string | null;
  labName: string;
}

interface ITSTest {
  testIndex: number;
  testMethod: string | null;
  testTitle: string | null;
  organism: string | null;
  strainNumber: string | null;
  sterilization: string | null;
  brothMedia: string | null;
  surfactant: string | null;
  contactTime: string | null;
  incubationTemp: string | null;
  incubationPeriod: string | null;
  agarMedium: string | null;
  inoculumCFU: number | null;
  inoculumRaw: string | null;
  controlCFU: number | null;
  controlRaw: string | null;
  treatedCFU: number | null;
  treatedRaw: string | null;
  percentReduction: number | null;
  growthValue: number | null;
  activityValue: number | null;
  aatccD: number | null;
  aatccBprime: number | null;
  aatccB: number | null;
  aatccC: number | null;
  aatccA: number | null;
  jisC0: number | null;
  jisCt: number | null;
  jisT0: number | null;
  jisTt: number | null;
  jisC0Log: number | null;
  jisCtLog: number | null;
  jisT0Log: number | null;
  jisTtLog: number | null;
  astmInitialCount: number | null;
  astmControlFlask: number | null;
  astmTreatedFlask: number | null;
  methodPass: boolean | null;
  methodPassReason: string | null;
  confidence: number;
  warnings: string[];
}

interface ITSReport {
  header: ITSHeader;
  tests: ITSTest[];
}

interface AIAnomaly {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  field: string;
  testIndex?: number;
}

interface AIReview {
  anomalies: AIAnomaly[];
  passAssessment: {
    standard: string;
    threshold: string;
    actual: string;
    passes: boolean;
    rating: string;
    note: string;
  } | null;
  mathChecks: { formula: string; calculated: number; reported: number; matches: boolean; testIndex: number }[];
  confidence: string;
  notes: string;
  _sources: string[];
}

export default function TestUploadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Parsed data state
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [itsReport, setItsReport] = useState<ITSReport | null>(null);
  const [aiReview, setAiReview] = useState<AIReview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [activeTestTab, setActiveTestTab] = useState(0);
  const [showAiDetails, setShowAiDetails] = useState(false);

  // Editable form fields (for legacy parser)
  const [testType, setTestType] = useState("");
  const [testReportNumber, setTestReportNumber] = useState("");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testMethodStd, setTestMethodStd] = useState("");
  const [washCount, setWashCount] = useState("");
  const [overallPass, setOverallPass] = useState<string>("");

  // Antibacterial fields (legacy)
  const [organism1, setOrganism1] = useState("");
  const [organism2, setOrganism2] = useState("");
  const [result1, setResult1] = useState("");
  const [result2, setResult2] = useState("");

  // ICP fields
  const [agValue, setAgValue] = useState("");
  const [auValue, setAuValue] = useState("");
  const [agUnit, setAgUnit] = useState("ppm");

  // Fungal fields
  const [fungalWrittenResult, setFungalWrittenResult] = useState("");
  const [fungalPass, setFungalPass] = useState<string>("");

  // Odor fields
  const [testedOdor, setTestedOdor] = useState("");
  const [odorResultVal, setOdorResultVal] = useState("");
  const [odorPass, setOdorPass] = useState<string>("");

  // AI review notes (editable per test)
  const [aiNotes, setAiNotes] = useState<Record<number, string>>({});

  // Assignment state
  const [brands, setBrands] = useState<SelectOption[]>([]);
  const [factories, setFactories] = useState<SelectOption[]>([]);
  const [fabrics, setFabrics] = useState<SelectOption[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<string | null>(null);
  const [factoryName, setFactoryName] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [fabricName, setFabricName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [creating, setCreating] = useState<"brand" | "factory" | "fabric" | null>(null);
  const [createPrefill, setCreatePrefill] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);

  // Confirm state
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [existingTestIds, setExistingTestIds] = useState<string[]>([]);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  // Load dropdowns
  useEffect(() => {
    Promise.all([
      fetch("/api/brands").then((r) => r.json()),
      fetch("/api/factories").then((r) => r.json()),
      fetch("/api/fabrics").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([bData, fData, faData, pData]) => {
      if (bData.ok && bData.grouped) {
        const all: SelectOption[] = [];
        for (const stage of Object.values(bData.grouped) as any[]) {
          for (const b of stage) {
            all.push({ id: b.id, name: b.name, detail: b.pipelineStage });
          }
        }
        all.sort((a, b) => a.name.localeCompare(b.name));
        setBrands(all);
      }
      if (fData.ok && fData.factories) {
        setFactories(fData.factories.map((f: any) => ({ id: f.id, name: f.name, detail: f.country || undefined })));
      }
      if (faData.ok && faData.fabrics) {
        setFabrics(faData.fabrics.map((f: any) => ({
          id: f.id,
          name: String(f.customerCode || f.fuzeNumber || f.factoryCode || f.id),
          detail: f.construction || undefined,
        })));
      }
      if (pData.ok && pData.projects) {
        setProjects(pData.projects.map((p: any) => ({ id: p.id, name: p.name, detail: p.brandName ? `Brand: ${p.brandName}` : undefined })));
      }
    }).catch(() => {});
  }, []);

  /* ── Upload handler ─────────────────────────────────────── */
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setParseError(null);
    setParsed(null);
    setItsReport(null);
    setAiReview(null);
    setDocumentId(null);
    setActiveTestTab(0);
    setAiNotes({});

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tests/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!data.ok) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      setDocumentId(data.documentId);
      setFilename(data.filename);

      if (data.parseError) setParseError(data.parseError);

      // Duplicate detection from upload
      if (data.duplicateWarning) {
        setDuplicateWarning(data.duplicateWarning);
        setExistingTestIds(data.existingTestIds || []);
      }

      if (data.itsReport) {
        // ── ITS Taiwan rich parse
        setItsReport(data.itsReport);
        if (data.aiReview) {
          setAiReview(data.aiReview);
          // Pre-fill AI notes
          if (data.aiReview.notes) {
            const notes: Record<number, string> = {};
            for (const test of data.itsReport.tests) {
              notes[test.testIndex] = data.aiReview.notes;
            }
            setAiNotes(notes);
          }
        }
        // Set common fields from header
        const h = data.itsReport.header;
        setTestType("ANTIBACTERIAL");
        if (h.reportNumber) setTestReportNumber(h.reportNumber);
        setLabName(h.labName || "Intertek");
        if (h.dateIssued) setTestDate(h.dateIssued);
      } else if (data.parsed) {
        // ── Legacy flat parse
        const p = data.parsed as ParsedData;
        setParsed(p);
        if (p.testType) setTestType(p.testType);
        if (p.testReportNumber) setTestReportNumber(p.testReportNumber);
        if (p.labName) setLabName(p.labName);
        if (p.testDate) setTestDate(p.testDate);
        if (p.testMethodStd) setTestMethodStd(p.testMethodStd);
        if (p.washCount != null) setWashCount(String(p.washCount));
        if (p.overallPass != null) setOverallPass(p.overallPass ? "true" : "false");
        if (p.organisms.length > 0) {
          setOrganism1(p.organisms[0]?.name || "");
          setResult1(p.organisms[0]?.reduction != null ? String(p.organisms[0].reduction) : "");
        }
        if (p.organisms.length > 1) {
          setOrganism2(p.organisms[1]?.name || "");
          setResult2(p.organisms[1]?.reduction != null ? String(p.organisms[1].reduction) : "");
        }
        if (p.icpResults.length > 0) {
          const ag = p.icpResults.find((r) => r.metal === "Ag");
          const au = p.icpResults.find((r) => r.metal === "Au");
          if (ag) { setAgValue(String(ag.value || "")); setAgUnit(ag.unit); }
          if (au) setAuValue(String(au.value || ""));
        }
        if (p.fungalResult) {
          setFungalWrittenResult(p.fungalResult.result || "");
          if (p.fungalResult.pass != null) setFungalPass(p.fungalResult.pass ? "true" : "false");
        }
        if (p.odorResult) {
          setOdorResultVal(p.odorResult.result || "");
          if (p.odorResult.pass != null) setOdorPass(p.odorResult.pass ? "true" : "false");
        }
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  /* ── Drag/drop ──────────────────────────────────────────── */
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleUpload(file); }, [handleUpload]);
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleUpload(file); };

  /* ── Confirm handler (ITS batch) ─────────────────────────── */
  const handleConfirmITS = async () => {
    if (!itsReport) return;
    setConfirming(true);
    setConfirmError(null);

    try {
      const results = [];
      for (const test of itsReport.tests) {
        const payload: Record<string, any> = {
          documentId,
          testType: "ANTIBACTERIAL",
          testReportNumber: itsReport.header.reportNumber,
          labName: itsReport.header.labName || "Intertek",
          testDate: itsReport.header.dateIssued,
          testMethodStd: test.testMethod,
          brandId: brandId || null,
          factoryId: factoryId || null,
          fabricId: fabricId || null,
          forceDuplicate: forceDuplicate,
          projectId: projectId || null,
          // Rich antibacterial fields
          testNumberInReport: test.testIndex,
          organism: test.organism,
          strainNumber: test.strainNumber,
          brothMedia: test.brothMedia,
          surfactant: test.surfactant,
          sterilization: test.sterilization,
          contactTime: test.contactTime,
          incubationTemp: test.incubationTemp,
          agarMedium: test.agarMedium,
          inoculumCFU: test.inoculumCFU,
          controlCFU: test.controlCFU,
          treatedCFU: test.treatedCFU,
          percentReduction: test.percentReduction,
          growthValue: test.growthValue,
          activityValue: test.activityValue,
          methodPass: test.methodPass,
          methodPassReason: test.methodPassReason,
          rawExtracted: test,
          // AI review
          aiReviewData: aiReview,
          aiReviewNotes: aiNotes[test.testIndex] || null,
          // Legacy fields for backward compat
          organism1: test.organism,
          result1: test.percentReduction,
          abPass: test.methodPass,
          overallPass: test.methodPass,
        };

        const res = await fetch("/api/tests/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) {
          setConfirmError(`Test ${test.testIndex} failed: ${data.error}`);
          return;
        }
        results.push(data);
      }

      router.push("/tests?saved=true");
    } catch (err: any) {
      setConfirmError(err.message || "Failed to save");
    } finally {
      setConfirming(false);
    }
  };

  /* ── Confirm handler (legacy) ────────────────────────────── */
  const handleConfirmLegacy = async () => {
    if (!testType) { setConfirmError("Please select a test type"); return; }
    setConfirming(true);
    setConfirmError(null);

    try {
      const payload: Record<string, any> = {
        documentId, testType,
        testReportNumber: testReportNumber || null,
        labName: labName || null,
        testDate: testDate || null,
        testMethodStd: testMethodStd || null,
        washCount: washCount ? parseInt(washCount, 10) : null,
        overallPass: overallPass === "true" ? true : overallPass === "false" ? false : null,
        brandId: brandId || null, factoryId: factoryId || null,
        fabricId: fabricId || null, projectId: projectId || null,
        forceDuplicate: forceDuplicate,
      };

      if (testType === "ANTIBACTERIAL") {
        payload.organism1 = organism1 || null;
        payload.organism2 = organism2 || null;
        payload.result1 = result1 ? parseFloat(result1) : null;
        payload.result2 = result2 ? parseFloat(result2) : null;
        payload.abPass = overallPass === "true" ? true : overallPass === "false" ? false : null;
      }
      if (testType === "ICP") { payload.agValue = agValue ? parseFloat(agValue) : null; payload.auValue = auValue ? parseFloat(auValue) : null; payload.agUnit = agUnit; }
      if (testType === "FUNGAL") { payload.fungalWrittenResult = fungalWrittenResult || null; payload.fungalPass = fungalPass === "true" ? true : fungalPass === "false" ? false : null; }
      if (testType === "ODOR") { payload.testedOdor = testedOdor || null; payload.odorResult = odorResultVal || null; payload.odorPass = odorPass === "true" ? true : odorPass === "false" ? false : null; }

      const res = await fetch("/api/tests/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.ok) { setConfirmError(data.error || "Failed to save test"); return; }
      router.push("/tests?saved=true");
    } catch (err: any) {
      setConfirmError(err.message || "Failed to save");
    } finally {
      setConfirming(false);
    }
  };

  const handleConfirm = itsReport ? handleConfirmITS : handleConfirmLegacy;

  // Entity creation handler
  const handleEntityCreated = (type: "brand" | "factory" | "fabric", entity: { id: string; name: string }) => {
    if (type === "brand") { setBrandId(entity.id); setBrandName(entity.name); setBrands((prev) => [...prev, { id: entity.id, name: entity.name }]); }
    else if (type === "factory") { setFactoryId(entity.id); setFactoryName(entity.name); setFactories((prev) => [...prev, { id: entity.id, name: entity.name }]); }
    else { setFabricId(entity.id); setFabricName(entity.name); setFabrics((prev) => [...prev, { id: entity.id, name: entity.name }]); }
    setCreating(null);
  };

  /* ── Helpers ────────────────────────────────────────────── */
  const confidenceBadge = (score: number) => {
    if (score >= 75) return { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "High" };
    if (score >= 50) return { bg: "bg-amber-100 text-amber-800 border-amber-300", label: "Medium" };
    return { bg: "bg-red-100 text-red-800 border-red-300", label: "Low" };
  };

  const severityBadge = (sev: string) => {
    if (sev === "high") return "bg-red-100 text-red-800 border-red-300";
    if (sev === "medium") return "bg-amber-100 text-amber-800 border-amber-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const formatCFU = (val: number | null) => {
    if (val === null) return "N/A";
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} × 10⁶`;
    if (val >= 1e5) return `${(val / 1e5).toFixed(1)} × 10⁵`;
    if (val >= 1e4) return `${(val / 1e4).toFixed(1)} × 10⁴`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)} × 10³`;
    return val.toFixed(0);
  };

  const TEST_TYPES = [
    { value: "ICP", label: `${t.tests.icp} (${t.tests.metalAnalysis})` },
    { value: "ANTIBACTERIAL", label: t.tests.antibacterial },
    { value: "FUNGAL", label: t.tests.fungal },
    { value: "ODOR", label: t.tests.odor },
    { value: "UV", label: t.tests.uv },
    { value: "MICROFIBER", label: t.tests.microfiber },
    { value: "OTHER", label: t.tests.other },
  ];

  const activeTest = itsReport?.tests[activeTestTab] || null;

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.upload.title}</h1>
          <p className="text-slate-500 mt-1">{t.upload.dragDrop} — we&apos;ll parse it automatically for your review</p>
        </div>
        <button onClick={() => router.push("/tests")} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          ← {t.common.back} to {t.nav.testResults}
        </button>
      </div>

      {/* ── Step 1: Upload Zone ───────────────────────────── */}
      {!documentId && (
        <div
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragOver ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"} ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={onFileSelect} className="hidden" />
          {uploading ? (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-700">Uploading & parsing PDF...</p>
              <p className="text-sm text-slate-500">Extracting text, running AI review</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700">{t.upload.dragDrop}</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse — PDF up to 25MB</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {["SGS", "Intertek", "Bureau Veritas", "Hohenstein", "Nelson Labs"].map((lab) => (
                  <span key={lab} className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">{lab}</span>
                ))}
                <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">+ more</span>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadError && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{uploadError}</div>}

      {/* ── Step 2: Parse Results ──────────────────────────── */}
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
              <p className="text-sm text-slate-500">
                {itsReport
                  ? `ITS Taiwan — ${itsReport.tests.length} test${itsReport.tests.length > 1 ? "s" : ""} detected`
                  : "PDF uploaded and stored"}
              </p>
            </div>
            {itsReport && aiReview && (
              <div className={`px-3 py-1.5 border rounded-full text-xs font-medium ${aiReview.anomalies?.length > 0 ? (aiReview.anomalies.some(a => a.severity === "high") ? "bg-red-100 text-red-800 border-red-300" : "bg-amber-100 text-amber-800 border-amber-300") : "bg-emerald-100 text-emerald-800 border-emerald-300"}`}>
                {aiReview.anomalies?.length > 0
                  ? `${aiReview.anomalies.length} flag${aiReview.anomalies.length > 1 ? "s" : ""}`
                  : "No anomalies"}
              </div>
            )}
            {parsed && (
              <div className={`px-3 py-1.5 border rounded-full text-xs font-medium ${confidenceBadge(parsed.confidence).bg}`}>
                {confidenceBadge(parsed.confidence).label} ({parsed.confidence}%)
              </div>
            )}
            <button
              onClick={() => {
                setDocumentId(null); setFilename(null); setParsed(null); setItsReport(null);
                setAiReview(null); setParseError(null); setTestType(""); setTestReportNumber("");
                setLabName(""); setTestDate(""); setTestMethodStd(""); setWashCount(""); setOverallPass("");
              }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg"
            >
              Upload Different
            </button>
          </div>

          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="font-medium text-red-800">Parse Error</p>
              <p className="text-sm text-red-600 mt-1">{parseError}</p>
              <p className="text-sm text-slate-600 mt-2">You can still fill in the test details manually below.</p>
            </div>
          )}

          {/* ═══ ITS REPORT VIEW ═══════════════════════════════ */}
          {itsReport && (
            <div className="space-y-6">
              {/* Report Header Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Report {itsReport.header.reportNumber || "Unknown"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {itsReport.header.labName} — Issued {itsReport.header.dateIssued || "Unknown date"}
                    </p>
                  </div>
                  {itsReport.header.isRevision && (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium rounded-full">
                      Revised (supersedes {itsReport.header.supersedesReport})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  {itsReport.header.itemName && <div><span className="text-slate-500">Item:</span> <span className="font-medium text-slate-800">{itsReport.header.itemName}</span></div>}
                  {itsReport.header.color && <div><span className="text-slate-500">Color:</span> <span className="font-medium text-slate-800">{itsReport.header.color}</span></div>}
                  {itsReport.header.material && <div><span className="text-slate-500">Material:</span> <span className="font-medium text-slate-800">{itsReport.header.material}</span></div>}
                  {itsReport.header.dateSampleReceived && <div><span className="text-slate-500">Received:</span> <span className="font-medium text-slate-800">{itsReport.header.dateSampleReceived}</span></div>}
                </div>
              </div>

              {/* AI Review Panel */}
              {aiReview && (
                <div className={`border rounded-xl overflow-hidden ${aiReview.anomalies?.some(a => a.severity === "high") ? "border-red-300 bg-red-50" : aiReview.anomalies?.length > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                  <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowAiDetails(!showAiDetails)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${aiReview.anomalies?.some(a => a.severity === "high") ? "bg-red-200" : aiReview.anomalies?.length > 0 ? "bg-amber-200" : "bg-emerald-200"}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">AI Review</h3>
                        <p className="text-sm text-slate-600">
                          {aiReview.anomalies?.length > 0
                            ? `${aiReview.anomalies.length} finding${aiReview.anomalies.length > 1 ? "s" : ""} detected`
                            : "No anomalies found"}
                          {aiReview._sources && ` — via ${aiReview._sources.join(" + ")}`}
                        </p>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${showAiDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>

                  {showAiDetails && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Anomalies */}
                      {aiReview.anomalies?.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${severityBadge(a.severity)}`}>
                            {a.severity.toUpperCase()}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{a.description}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Type: {a.type}{a.field ? ` • Field: ${a.field}` : ""}{a.testIndex ? ` • Test ${a.testIndex}` : ""}</p>
                          </div>
                        </div>
                      ))}

                      {/* Pass Assessment */}
                      {aiReview.passAssessment && (
                        <div className={`p-3 rounded-lg border ${aiReview.passAssessment.passes ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${aiReview.passAssessment.passes ? "text-emerald-700" : "text-red-700"}`}>
                              {aiReview.passAssessment.passes ? "PASS" : "FAIL"}
                            </span>
                            <span className="text-sm text-slate-600">
                              {aiReview.passAssessment.standard} — {aiReview.passAssessment.threshold}, actual: {aiReview.passAssessment.actual}
                            </span>
                          </div>
                          {aiReview.passAssessment.note && <p className="text-xs text-slate-500 mt-1">{aiReview.passAssessment.note}</p>}
                        </div>
                      )}

                      {/* Math Checks */}
                      {aiReview.mathChecks?.length > 0 && (
                        <div className="text-xs text-slate-600 space-y-1">
                          <p className="font-medium text-slate-700">Math Verification:</p>
                          {aiReview.mathChecks.map((mc, i) => (
                            <p key={i} className="flex items-center gap-2">
                              <span className={mc.matches ? "text-emerald-600" : "text-red-600"}>
                                {mc.matches ? "✓" : "✗"}
                              </span>
                              {mc.formula}: calc={mc.calculated}, reported={mc.reported}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {aiReview.notes && (
                        <p className="text-sm text-slate-600 italic">{aiReview.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Test Tabs */}
              {itsReport.tests.length > 1 && (
                <div className="flex gap-2">
                  {itsReport.tests.map((test, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveTestTab(i)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTestTab === i ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"}`}
                    >
                      Test {test.testIndex}: {test.organism || test.testMethod || "Unknown"}
                      {test.methodPass !== null && (
                        <span className={`ml-2 inline-block w-2 h-2 rounded-full ${test.methodPass ? "bg-emerald-400" : "bg-red-400"}`} />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Test Detail Card */}
              {activeTest && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-5 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {activeTest.testTitle || activeTest.testMethod || "Antibacterial Test"}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {activeTest.organism} {activeTest.strainNumber ? `(${activeTest.strainNumber})` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1.5 border rounded-full text-xs font-medium ${confidenceBadge(activeTest.confidence).bg}`}>
                          Parse: {confidenceBadge(activeTest.confidence).label} ({activeTest.confidence}%)
                        </div>
                        {activeTest.methodPass !== null && (
                          <div className={`px-3 py-1.5 border rounded-full text-xs font-bold ${activeTest.methodPass ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}>
                            {activeTest.methodPass ? "PASS" : "FAIL"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Test Conditions */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Test Conditions</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {activeTest.testMethod && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Method</span><span className="font-medium text-slate-800">{activeTest.testMethod}</span></div>}
                        {activeTest.sterilization && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Sterilization</span><span className="font-medium text-slate-800">{activeTest.sterilization}</span></div>}
                        {activeTest.brothMedia && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Broth Media</span><span className="font-medium text-slate-800">{activeTest.brothMedia}</span></div>}
                        {activeTest.surfactant && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Surfactant</span><span className="font-medium text-slate-800">{activeTest.surfactant}</span></div>}
                        {activeTest.contactTime && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Contact Time</span><span className="font-medium text-slate-800">{activeTest.contactTime}</span></div>}
                        {activeTest.incubationTemp && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Incubation Temp</span><span className="font-medium text-slate-800">{activeTest.incubationTemp}</span></div>}
                        {activeTest.agarMedium && <div className="p-2.5 bg-slate-50 rounded-lg"><span className="text-slate-500 block text-xs">Agar Medium</span><span className="font-medium text-slate-800">{activeTest.agarMedium}</span></div>}
                      </div>
                    </div>

                    {/* Results — Method-specific */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Results</h4>

                      {/* AATCC TM100 */}
                      {activeTest.testMethod?.includes("AATCC") && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-5 gap-2 text-sm">
                            {[
                              { label: "D (viability 0hr)", val: activeTest.aatccD },
                              { label: "B' (viability 24hr)", val: activeTest.aatccBprime },
                              { label: "B (control 24hr)", val: activeTest.aatccB },
                              { label: "C (treated 0hr)", val: activeTest.aatccC },
                              { label: "A (treated 24hr)", val: activeTest.aatccA },
                            ].map((item, i) => (
                              <div key={i} className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-center">
                                <span className="text-purple-600 block text-xs">{item.label}</span>
                                <span className="font-semibold text-purple-900">{formatCFU(item.val)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-purple-100 border border-purple-300 rounded-lg text-center">
                              <span className="text-purple-700 block text-xs font-medium">Growth Value (F)</span>
                              <span className="text-xl font-bold text-purple-900">{activeTest.growthValue ?? "N/A"}</span>
                            </div>
                            <div className={`p-3 border rounded-lg text-center ${activeTest.percentReduction !== null && activeTest.percentReduction >= 90 ? "bg-emerald-100 border-emerald-300" : "bg-amber-100 border-amber-300"}`}>
                              <span className="block text-xs font-medium">Percent Reduction (R)</span>
                              <span className="text-xl font-bold">{activeTest.percentReduction !== null ? `${activeTest.percentReduction}%` : "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ASTM E2149 */}
                      {activeTest.testMethod?.includes("ASTM") && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                              <span className="text-blue-600 block text-xs">Initial Count</span>
                              <span className="font-semibold text-blue-900">{formatCFU(activeTest.astmInitialCount)}</span>
                            </div>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                              <span className="text-blue-600 block text-xs">Control Flask (b)</span>
                              <span className="font-semibold text-blue-900">{formatCFU(activeTest.astmControlFlask)}</span>
                            </div>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                              <span className="text-blue-600 block text-xs">Treated Flask (a)</span>
                              <span className="font-semibold text-blue-900">{formatCFU(activeTest.astmTreatedFlask)}</span>
                            </div>
                          </div>
                          <div className={`p-3 border rounded-lg text-center ${activeTest.percentReduction !== null && activeTest.percentReduction >= 80 ? "bg-emerald-100 border-emerald-300" : "bg-amber-100 border-amber-300"}`}>
                            <span className="block text-xs font-medium">Percent Reduction</span>
                            <span className="text-xl font-bold">{activeTest.percentReduction !== null ? `${activeTest.percentReduction}%` : "N/A"}</span>
                          </div>
                        </div>
                      )}

                      {/* JIS L 1902 */}
                      {activeTest.testMethod?.includes("JIS") && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            {[
                              { label: "C₀ (std 0hr)", val: activeTest.jisC0, log: activeTest.jisC0Log },
                              { label: "Ct (std 18-24hr)", val: activeTest.jisCt, log: activeTest.jisCtLog },
                              { label: "T₀ (treated 0hr)", val: activeTest.jisT0, log: activeTest.jisT0Log },
                              { label: "Tt (treated 18-24hr)", val: activeTest.jisTt, log: activeTest.jisTtLog },
                            ].map((item, i) => (
                              <div key={i} className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-center">
                                <span className="text-indigo-600 block text-xs">{item.label}</span>
                                <span className="font-semibold text-indigo-900">{formatCFU(item.val)}</span>
                                {item.log !== null && <span className="text-indigo-500 block text-xs">Log: {item.log}</span>}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-indigo-100 border border-indigo-300 rounded-lg text-center">
                              <span className="text-indigo-700 block text-xs font-medium">Growth Value (F)</span>
                              <span className="text-xl font-bold text-indigo-900">{activeTest.growthValue ?? "N/A"}</span>
                            </div>
                            <div className={`p-3 border rounded-lg text-center ${activeTest.activityValue !== null && activeTest.activityValue >= 2.0 ? "bg-emerald-100 border-emerald-300" : "bg-red-100 border-red-300"}`}>
                              <span className="block text-xs font-medium">Activity Value (A)</span>
                              <span className="text-xl font-bold">{activeTest.activityValue ?? "N/A"}</span>
                            </div>
                            {activeTest.percentReduction !== null && (
                              <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-center">
                                <span className="block text-xs font-medium">Reduction Rate</span>
                                <span className="text-xl font-bold">{activeTest.percentReduction}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Method pass/fail reason */}
                      {activeTest.methodPassReason && (
                        <p className="text-sm text-slate-600 mt-2 italic">{activeTest.methodPassReason}</p>
                      )}
                    </div>

                    {/* Parser Warnings */}
                    {activeTest.warnings?.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-medium text-amber-800 mb-1">Parser Warnings</p>
                        {activeTest.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
                      </div>
                    )}

                    {/* AI Notes (editable) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                      <textarea
                        value={aiNotes[activeTest.testIndex] || ""}
                        onChange={(e) => setAiNotes(prev => ({ ...prev, [activeTest.testIndex]: e.target.value }))}
                        rows={3}
                        placeholder="Add notes about this test result..."
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Assignment Section */}
              <div className="p-5 bg-green-50 border border-green-200 rounded-xl space-y-4">
                <div>
                  <h3 className="font-semibold text-green-900">Assign to {t.tests.project}, {t.tests.brand}, {t.tests.factory} & {t.tests.fabric}</h3>
                  <p className="text-sm text-green-700 mt-0.5">Link this test to its source. Optional — you can also assign after saving.</p>
                </div>

                {/* Project */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <SearchableSelect
                    label={t.tests.project} options={projects} value={projectId} displayValue={projectName}
                    onChange={(id, name) => { setProjectId(id); setProjectName(name); }}
                    onCreateNew={(text) => { setCreatingProject(true); setNewProjectName(text); }}
                    placeholder={`${t.common.search} ${t.tests.project}...`} createLabel={t.tests.project}
                  />
                  {creatingProject && (
                    <div className="flex items-end gap-2 mt-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">New {t.tests.project} Name</label>
                        <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!newProjectName.trim() || projectSaving) return;
                              setProjectSaving(true);
                              fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newProjectName.trim(), brandId: brandId || null }) })
                                .then(r => r.json())
                                .then(d => { if (d.ok && d.project) { setProjectId(d.project.id); setProjectName(d.project.name); setProjects(prev => [...prev, { id: d.project.id, name: d.project.name }]); setCreatingProject(false); setNewProjectName(""); } })
                                .finally(() => setProjectSaving(false));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Nike Dri-FIT 2026" autoFocus
                        />
                      </div>
                      <button onClick={() => {
                        if (!newProjectName.trim() || projectSaving) return;
                        setProjectSaving(true);
                        fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newProjectName.trim(), brandId: brandId || null }) })
                          .then(r => r.json())
                          .then(d => { if (d.ok && d.project) { setProjectId(d.project.id); setProjectName(d.project.name); setProjects(prev => [...prev, { id: d.project.id, name: d.project.name }]); setCreatingProject(false); setNewProjectName(""); } })
                          .finally(() => setProjectSaving(false));
                      }} disabled={projectSaving || !newProjectName.trim()} className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                        {projectSaving ? `${t.common.saving}` : t.common.create}
                      </button>
                      <button onClick={() => { setCreatingProject(false); setNewProjectName(""); }} className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">{t.common.cancel}</button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <SearchableSelect label={t.tests.brand} options={brands} value={brandId} displayValue={brandName}
                      onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
                      onCreateNew={(text) => { setCreating("brand"); setCreatePrefill(text); }}
                      placeholder={`${t.common.search} ${t.tests.brand}...`} createLabel={t.tests.brand} />
                  </div>
                  <div>
                    <SearchableSelect label={t.tests.factory} options={factories} value={factoryId} displayValue={factoryName}
                      onChange={(id, name) => { setFactoryId(id); setFactoryName(name); }}
                      onCreateNew={(text) => { setCreating("factory"); setCreatePrefill(text); }}
                      placeholder={`${t.common.search} ${t.tests.factory}...`} createLabel={t.tests.factory} />
                  </div>
                  <div>
                    <SearchableSelect label={t.tests.fabric} options={fabrics} value={fabricId} displayValue={fabricName}
                      onChange={(id, name) => { setFabricId(id); setFabricName(name); }}
                      onCreateNew={(text) => { setCreating("fabric"); setCreatePrefill(text); }}
                      placeholder={`${t.common.search} ${t.tests.fabric}...`} createLabel={t.tests.fabric} />
                  </div>
                </div>

                {creating && (
                  <CreateInlineForm entityType={creating} prefillName={createPrefill}
                    onCreated={(entity) => handleEntityCreated(creating, entity)} onCancel={() => setCreating(null)} />
                )}
              </div>

              {/* Duplicate Warning Banner */}
              {duplicateWarning && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-800 mb-1">Possible Duplicate Detected</h4>
                      <p className="text-sm text-amber-700">{duplicateWarning}</p>
                      {existingTestIds.length > 0 && (
                        <div className="mt-2 flex gap-2">
                          {existingTestIds.map((tid) => (
                            <a key={tid} href={`/tests/${tid}`} target="_blank" className="text-xs text-amber-800 underline hover:text-amber-900">View existing test →</a>
                          ))}
                        </div>
                      )}
                      <label className="mt-3 flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={forceDuplicate} onChange={(e) => setForceDuplicate(e.target.checked)}
                          className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                        <span className="text-sm font-semibold text-amber-800">I confirm this is NOT a duplicate — save anyway</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {itsReport.tests.length} test{itsReport.tests.length > 1 ? "s" : ""} will be saved from this report
                  {aiReview && aiReview.anomalies?.length > 0 && (
                    <span className="text-amber-600 font-medium"> — {aiReview.anomalies.length} AI flag{aiReview.anomalies.length > 1 ? "s" : ""} to review</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {confirmError && <span className="text-sm text-red-600">{confirmError}</span>}
                  <button onClick={() => router.push("/tests")} className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white">{t.common.cancel}</button>
                  <button onClick={handleConfirm} disabled={confirming || (!!duplicateWarning && !forceDuplicate)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                    {confirming ? `${t.common.saving}` : `${t.common.confirm} & ${t.common.save} All Tests`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LEGACY FORM VIEW ══════════════════════════════ */}
          {!itsReport && (
            <div className="space-y-6">
              {/* Parse warnings */}
              {parsed?.warnings && parsed.warnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="font-medium text-amber-800 mb-2">Parser Notes</p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">Review & Verify Test Data</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {parsed ? "Auto-parsed fields are pre-filled. Please verify accuracy before confirming." : "Fill in the test details manually."}
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Core fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.tests.testType} <span className="text-red-500">*</span></label>
                      <select value={testType} onChange={(e) => setTestType(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">{t.common.selectOption}</option>
                        {TEST_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.upload.testReport}</label>
                      <input type="text" value={testReportNumber} onChange={(e) => setTestReportNumber(e.target.value)} placeholder="e.g. RPT-2025-001" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.upload.labName}</label>
                      <input type="text" value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. SGS, Intertek" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.upload.testDate}</label>
                      <input type="text" value={testDate} onChange={(e) => setTestDate(e.target.value)} placeholder="e.g. 2025-03-15" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.upload.testMethodStd}</label>
                      <input type="text" value={testMethodStd} onChange={(e) => setTestMethodStd(e.target.value)} placeholder="e.g. AATCC 100, ISO 20743" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">{t.upload.washCount}</label>
                      <input type="number" value={washCount} onChange={(e) => setWashCount(e.target.value)} placeholder="e.g. 50" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Assignment */}
                  <div className="p-5 bg-green-50 border border-green-200 rounded-xl space-y-4">
                    <div>
                      <h3 className="font-semibold text-green-900">Assign to {t.tests.project}, {t.tests.brand}, {t.tests.factory} & {t.tests.fabric}</h3>
                      <p className="text-sm text-green-700 mt-0.5">Link this test to its source. Optional.</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <SearchableSelect label={t.tests.project} options={projects} value={projectId} displayValue={projectName}
                        onChange={(id, name) => { setProjectId(id); setProjectName(name); }}
                        onCreateNew={(text) => { setCreatingProject(true); setNewProjectName(text); }}
                        placeholder={`${t.common.search} ${t.tests.project}...`} createLabel={t.tests.project} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <SearchableSelect label={t.tests.brand} options={brands} value={brandId} displayValue={brandName}
                        onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
                        onCreateNew={(text) => { setCreating("brand"); setCreatePrefill(text); }}
                        placeholder={`${t.common.search} ${t.tests.brand}...`} createLabel={t.tests.brand} />
                      <SearchableSelect label={t.tests.factory} options={factories} value={factoryId} displayValue={factoryName}
                        onChange={(id, name) => { setFactoryId(id); setFactoryName(name); }}
                        onCreateNew={(text) => { setCreating("factory"); setCreatePrefill(text); }}
                        placeholder={`${t.common.search} ${t.tests.factory}...`} createLabel={t.tests.factory} />
                      <SearchableSelect label={t.tests.fabric} options={fabrics} value={fabricId} displayValue={fabricName}
                        onChange={(id, name) => { setFabricId(id); setFabricName(name); }}
                        onCreateNew={(text) => { setCreating("fabric"); setCreatePrefill(text); }}
                        placeholder={`${t.common.search} ${t.tests.fabric}...`} createLabel={t.tests.fabric} />
                    </div>
                    {creating && <CreateInlineForm entityType={creating} prefillName={createPrefill} onCreated={(entity) => handleEntityCreated(creating, entity)} onCancel={() => setCreating(null)} />}
                  </div>

                  {/* Type-specific fields */}
                  {testType === "ANTIBACTERIAL" && (
                    <div className="p-5 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
                      <h3 className="font-semibold text-purple-900">{t.tests.antibacterial} Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1.5">{t.tests.organism} 1</label>
                          <input type="text" value={organism1} onChange={(e) => setOrganism1(e.target.value)} placeholder="e.g. S. aureus" className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1.5">{t.tests.result} 1 (% reduction)</label>
                          <input type="number" step="0.01" value={result1} onChange={(e) => setResult1(e.target.value)} placeholder="e.g. 99.99" className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1.5">{t.tests.organism} 2</label>
                          <input type="text" value={organism2} onChange={(e) => setOrganism2(e.target.value)} placeholder="e.g. K. pneumoniae" className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-800 mb-1.5">{t.tests.result} 2 (% reduction)</label>
                          <input type="number" step="0.01" value={result2} onChange={(e) => setResult2(e.target.value)} placeholder="e.g. 99.97" className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500" />
                        </div>
                      </div>
                    </div>
                  )}

                  {testType === "ICP" && (
                    <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                      <h3 className="font-semibold text-blue-900">{t.tests.icp} {t.tests.metalAnalysis}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1.5">Silver (Ag)</label>
                          <input type="number" step="0.001" value={agValue} onChange={(e) => setAgValue(e.target.value)} placeholder="e.g. 150.5" className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1.5">Gold (Au)</label>
                          <input type="number" step="0.001" value={auValue} onChange={(e) => setAuValue(e.target.value)} placeholder="e.g. 0.5" className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-800 mb-1.5">Unit</label>
                          <select value={agUnit} onChange={(e) => setAgUnit(e.target.value)} className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500">
                            <option value="ppm">ppm</option>
                            <option value="mg/kg">mg/kg</option>
                            <option value="ppb">ppb</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {testType === "FUNGAL" && (
                    <div className="p-5 bg-orange-50 border border-orange-200 rounded-xl space-y-4">
                      <h3 className="font-semibold text-orange-900">{t.tests.fungal} {t.tests.result}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-orange-800 mb-1.5">Written {t.tests.result}</label>
                          <input type="text" value={fungalWrittenResult} onChange={(e) => setFungalWrittenResult(e.target.value)} placeholder="e.g. No growth observed" className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-orange-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-orange-800 mb-1.5">Pass/Fail</label>
                          <select value={fungalPass} onChange={(e) => setFungalPass(e.target.value)} className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-orange-500">
                            <option value="">{t.common.selectOption}</option>
                            <option value="true">Pass</option>
                            <option value="false">Fail</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {testType === "ODOR" && (
                    <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-4">
                      <h3 className="font-semibold text-rose-900">{t.tests.odor} {t.tests.result}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-rose-800 mb-1.5">Tested {t.tests.odor}</label>
                          <input type="text" value={testedOdor} onChange={(e) => setTestedOdor(e.target.value)} placeholder="e.g. Body odor" className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-rose-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-rose-800 mb-1.5">{t.tests.result}</label>
                          <input type="text" value={odorResultVal} onChange={(e) => setOdorResultVal(e.target.value)} placeholder="e.g. Significant reduction" className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-rose-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-rose-800 mb-1.5">Pass/Fail</label>
                          <select value={odorPass} onChange={(e) => setOdorPass(e.target.value)} className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-rose-500">
                            <option value="">{t.common.selectOption}</option>
                            <option value="true">Pass</option>
                            <option value="false">Fail</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Overall pass/fail */}
                  <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl">
                    <label className="text-sm font-medium text-slate-700">{t.tests.overallPass}:</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="overallPass" value="true" checked={overallPass === "true"} onChange={(e) => setOverallPass(e.target.value)} className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">Pass</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="overallPass" value="false" checked={overallPass === "false"} onChange={(e) => setOverallPass(e.target.value)} className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium text-red-700">Fail</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="overallPass" value="" checked={overallPass === ""} onChange={(e) => setOverallPass(e.target.value)} className="w-4 h-4 text-slate-600" />
                      <span className="text-sm text-slate-500">Not specified</span>
                    </label>
                  </div>

                  {/* Raw text */}
                  {parsed?.rawText && (
                    <div>
                      <button onClick={() => setShowRawText(!showRawText)} className="text-sm text-slate-500 hover:text-slate-700 underline">
                        {showRawText ? "Hide" : "Show"} extracted PDF text
                      </button>
                      {showRawText && (
                        <pre className="mt-2 p-4 bg-slate-900 text-slate-300 rounded-xl text-xs max-h-64 overflow-auto font-mono whitespace-pre-wrap">{parsed.rawText}</pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Duplicate Warning Banner (Legacy) */}
                {duplicateWarning && (
                  <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">⚠️</span>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-amber-800 mb-1">Possible Duplicate Detected</h4>
                        <p className="text-sm text-amber-700">{duplicateWarning}</p>
                        {existingTestIds.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {existingTestIds.map((tid) => (
                              <a key={tid} href={`/tests/${tid}`} target="_blank" className="text-xs text-amber-800 underline hover:text-amber-900">View existing test →</a>
                            ))}
                          </div>
                        )}
                        <label className="mt-3 flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={forceDuplicate} onChange={(e) => setForceDuplicate(e.target.checked)}
                            className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                          <span className="text-sm font-semibold text-amber-800">I confirm this is NOT a duplicate — save anyway</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirm bar */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    {parsed ? "Fields were auto-filled from your PDF. Please review before saving." : "Fill in the test details and save."}
                  </div>
                  <div className="flex items-center gap-3">
                    {confirmError && <span className="text-sm text-red-600">{confirmError}</span>}
                    <button onClick={() => router.push("/tests")} className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white">{t.common.cancel}</button>
                    <button onClick={handleConfirm} disabled={confirming || !testType || (!!duplicateWarning && !forceDuplicate)}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                      {confirming ? `${t.common.saving}` : `${t.common.confirm} & ${t.common.save} ${t.tests.saveTest}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
