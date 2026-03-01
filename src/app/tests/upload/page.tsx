"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchableSelect, { type SelectOption } from "@/components/SearchableSelect";
import CreateInlineForm from "@/components/CreateInlineForm";

const TEST_TYPES = [
  { value: "ICP", label: "ICP (Metals Analysis)" },
  { value: "ANTIBACTERIAL", label: "Antibacterial" },
  { value: "FUNGAL", label: "Fungal" },
  { value: "ODOR", label: "Odor" },
  { value: "UV", label: "UV" },
  { value: "MICROFIBER", label: "Microfiber" },
  { value: "OTHER", label: "Other" },
];

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

export default function TestUploadPage() {
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);

  // Editable form fields (populated from parse, user can override)
  const [testType, setTestType] = useState("");
  const [testReportNumber, setTestReportNumber] = useState("");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testMethodStd, setTestMethodStd] = useState("");
  const [washCount, setWashCount] = useState("");
  const [overallPass, setOverallPass] = useState<string>("");

  // Antibacterial fields
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

  // Load brands, factories, fabrics for assignment dropdowns
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
        setFactories(
          fData.factories.map((f: any) => ({
            id: f.id,
            name: f.name,
            detail: f.country || undefined,
          }))
        );
      }
      if (faData.ok && faData.fabrics) {
        setFabrics(
          faData.fabrics.map((f: any) => ({
            id: f.id,
            name: f.customerCode || f.fuzeNumber || f.factoryCode || f.id,
            detail: f.construction || undefined,
          }))
        );
      }
      if (pData.ok && pData.projects) {
        setProjects(
          pData.projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            detail: p.brandName ? `Brand: ${p.brandName}` : undefined,
          }))
        );
      }
    }).catch(() => {});
  }, []);

  /* ── Upload handler ─────────────────────────────────────── */
  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setParseError(null);
    setParsed(null);
    setDocumentId(null);

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

      if (data.parseError) {
        setParseError(data.parseError);
      }

      if (data.parsed) {
        const p = data.parsed as ParsedData;
        setParsed(p);

        // Populate form fields from parsed data
        if (p.testType) setTestType(p.testType);
        if (p.testReportNumber) setTestReportNumber(p.testReportNumber);
        if (p.labName) setLabName(p.labName);
        if (p.testDate) setTestDate(p.testDate);
        if (p.testMethodStd) setTestMethodStd(p.testMethodStd);
        if (p.washCount != null) setWashCount(String(p.washCount));
        if (p.overallPass != null) setOverallPass(p.overallPass ? "true" : "false");

        // Antibacterial
        if (p.organisms.length > 0) {
          setOrganism1(p.organisms[0]?.name || "");
          setResult1(p.organisms[0]?.reduction != null ? String(p.organisms[0].reduction) : "");
        }
        if (p.organisms.length > 1) {
          setOrganism2(p.organisms[1]?.name || "");
          setResult2(p.organisms[1]?.reduction != null ? String(p.organisms[1].reduction) : "");
        }

        // ICP
        if (p.icpResults.length > 0) {
          const ag = p.icpResults.find((r) => r.metal === "Ag");
          const au = p.icpResults.find((r) => r.metal === "Au");
          if (ag) { setAgValue(String(ag.value || "")); setAgUnit(ag.unit); }
          if (au) setAuValue(String(au.value || ""));
        }

        // Fungal
        if (p.fungalResult) {
          setFungalWrittenResult(p.fungalResult.result || "");
          if (p.fungalResult.pass != null) setFungalPass(p.fungalResult.pass ? "true" : "false");
        }

        // Odor
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

  /* ── Drag/drop handlers ─────────────────────────────────── */
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  /* ── Confirm handler ────────────────────────────────────── */
  const handleConfirm = async () => {
    if (!testType) {
      setConfirmError("Please select a test type");
      return;
    }
    setConfirming(true);
    setConfirmError(null);

    try {
      const payload: Record<string, any> = {
        documentId,
        testType,
        testReportNumber: testReportNumber || null,
        labName: labName || null,
        testDate: testDate || null,
        testMethodStd: testMethodStd || null,
        washCount: washCount ? parseInt(washCount, 10) : null,
        overallPass: overallPass === "true" ? true : overallPass === "false" ? false : null,
        // Assignment fields
        brandId: brandId || null,
        factoryId: factoryId || null,
        fabricId: fabricId || null,
        projectId: projectId || null,
      };

      if (testType === "ANTIBACTERIAL") {
        payload.organism1 = organism1 || null;
        payload.organism2 = organism2 || null;
        payload.result1 = result1 ? parseFloat(result1) : null;
        payload.result2 = result2 ? parseFloat(result2) : null;
        payload.abPass = overallPass === "true" ? true : overallPass === "false" ? false : null;
      }

      if (testType === "ICP") {
        payload.agValue = agValue ? parseFloat(agValue) : null;
        payload.auValue = auValue ? parseFloat(auValue) : null;
        payload.agUnit = agUnit;
      }

      if (testType === "FUNGAL") {
        payload.fungalWrittenResult = fungalWrittenResult || null;
        payload.fungalPass = fungalPass === "true" ? true : fungalPass === "false" ? false : null;
      }

      if (testType === "ODOR") {
        payload.testedOdor = testedOdor || null;
        payload.odorResult = odorResultVal || null;
        payload.odorPass = odorPass === "true" ? true : odorPass === "false" ? false : null;
      }

      const res = await fetch("/api/tests/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.ok) {
        setConfirmError(data.error || "Failed to save test");
        return;
      }

      router.push("/tests?saved=true");
    } catch (err: any) {
      setConfirmError(err.message || "Failed to save");
    } finally {
      setConfirming(false);
    }
  };

  // Handle inline entity creation
  const handleEntityCreated = (type: "brand" | "factory" | "fabric", entity: { id: string; name: string }) => {
    if (type === "brand") {
      setBrandId(entity.id);
      setBrandName(entity.name);
      setBrands((prev) => [...prev, { id: entity.id, name: entity.name }]);
    } else if (type === "factory") {
      setFactoryId(entity.id);
      setFactoryName(entity.name);
      setFactories((prev) => [...prev, { id: entity.id, name: entity.name }]);
    } else {
      setFabricId(entity.id);
      setFabricName(entity.name);
      setFabrics((prev) => [...prev, { id: entity.id, name: entity.name }]);
    }
    setCreating(null);
  };

  /* ── Confidence badge ───────────────────────────────────── */
  const confidenceBadge = (score: number) => {
    if (score >= 75) return { bg: "bg-emerald-100 text-emerald-800 border-emerald-300", label: "High Confidence" };
    if (score >= 50) return { bg: "bg-amber-100 text-amber-800 border-amber-300", label: "Medium Confidence" };
    return { bg: "bg-red-100 text-red-800 border-red-300", label: "Low Confidence" };
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Test Report</h1>
          <p className="text-slate-500 mt-1">
            Drag & drop a lab test PDF — we&apos;ll parse it automatically for your review
          </p>
        </div>
        <button
          onClick={() => router.push("/tests")}
          className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          ← Back to Tests
        </button>
      </div>

      {/* ── Step 1: Upload Zone ───────────────────────────── */}
      {!documentId && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
            ${dragOver
              ? "border-blue-500 bg-blue-50 scale-[1.01]"
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
              <div className="w-12 h-12 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-700">Uploading & parsing PDF...</p>
              <p className="text-sm text-slate-500">Extracting text and identifying test data</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700">Drop your test report PDF here</p>
                <p className="text-sm text-slate-500 mt-1">or click to browse — PDF up to 25MB</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {["SGS", "Intertek", "Bureau Veritas", "Hohenstein", "Nelson Labs"].map((lab) => (
                  <span key={lab} className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">
                    {lab}
                  </span>
                ))}
                <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">+ more</span>
              </div>
            </div>
          )}
        </div>
      )}

      {uploadError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{uploadError}</div>
      )}

      {/* ── Step 2: Parse Results + Review Form ───────────── */}
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
              <p className="text-sm text-slate-500">PDF uploaded and stored</p>
            </div>
            {parsed && (
              <div className={`px-3 py-1.5 border rounded-full text-xs font-medium ${confidenceBadge(parsed.confidence).bg}`}>
                {confidenceBadge(parsed.confidence).label} ({parsed.confidence}%)
              </div>
            )}
            <button
              onClick={() => {
                setDocumentId(null);
                setFilename(null);
                setParsed(null);
                setParseError(null);
                setTestType("");
                setTestReportNumber("");
                setLabName("");
                setTestDate("");
                setTestMethodStd("");
                setWashCount("");
                setOverallPass("");
              }}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg"
            >
              Upload Different
            </button>
          </div>

          {/* Parse warnings */}
          {parsed?.warnings && parsed.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="font-medium text-amber-800 mb-2">Parser Notes</p>
              <ul className="text-sm text-amber-700 space-y-1">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {parseError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="font-medium text-red-800">Parse Error</p>
              <p className="text-sm text-red-600 mt-1">{parseError}</p>
              <p className="text-sm text-slate-600 mt-2">You can still fill in the test details manually below.</p>
            </div>
          )}

          {/* ── Review Form ─────────────────────────────── */}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Test Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select type...</option>
                    {TEST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Report Number</label>
                  <input
                    type="text"
                    value={testReportNumber}
                    onChange={(e) => setTestReportNumber(e.target.value)}
                    placeholder="e.g. RPT-2025-001"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Lab Name</label>
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="e.g. SGS, Intertek"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Test Date</label>
                  <input
                    type="text"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    placeholder="e.g. 2025-03-15 or March 15, 2025"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Test Method/Standard</label>
                  <input
                    type="text"
                    value={testMethodStd}
                    onChange={(e) => setTestMethodStd(e.target.value)}
                    placeholder="e.g. AATCC 100, ISO 20743"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Wash Count</label>
                  <input
                    type="number"
                    value={washCount}
                    onChange={(e) => setWashCount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* ── Assignment Section ─────────────────────── */}
              <div className="p-5 bg-green-50 border border-green-200 rounded-xl space-y-4">
                <div>
                  <h3 className="font-semibold text-green-900">Assign to Project, Brand, Factory & Fabric</h3>
                  <p className="text-sm text-green-700 mt-0.5">
                    Link this test to its source. Optional — you can also assign after saving.
                  </p>
                </div>

                {/* Project */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <SearchableSelect
                    label="Project"
                    options={projects}
                    value={projectId}
                    displayValue={projectName}
                    onChange={(id, name) => { setProjectId(id); setProjectName(name); }}
                    onCreateNew={(text) => { setCreatingProject(true); setNewProjectName(text); }}
                    placeholder="Search projects..."
                    createLabel="Project"
                  />
                  {creatingProject && (
                    <div className="flex items-end gap-2 mt-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Project Name</label>
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (!newProjectName.trim() || projectSaving) return;
                              setProjectSaving(true);
                              fetch("/api/projects", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: newProjectName.trim(), brandId: brandId || null }),
                              })
                                .then(r => r.json())
                                .then(d => {
                                  if (d.ok && d.project) {
                                    setProjectId(d.project.id);
                                    setProjectName(d.project.name);
                                    setProjects(prev => [...prev, { id: d.project.id, name: d.project.name }]);
                                    setCreatingProject(false);
                                    setNewProjectName("");
                                  }
                                })
                                .finally(() => setProjectSaving(false));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="e.g. Nike Dri-FIT 2026"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!newProjectName.trim() || projectSaving) return;
                          setProjectSaving(true);
                          fetch("/api/projects", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newProjectName.trim(), brandId: brandId || null }),
                          })
                            .then(r => r.json())
                            .then(d => {
                              if (d.ok && d.project) {
                                setProjectId(d.project.id);
                                setProjectName(d.project.name);
                                setProjects(prev => [...prev, { id: d.project.id, name: d.project.name }]);
                                setCreatingProject(false);
                                setNewProjectName("");
                              }
                            })
                            .finally(() => setProjectSaving(false));
                        }}
                        disabled={projectSaving || !newProjectName.trim()}
                        className="px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      >
                        {projectSaving ? "..." : "Create"}
                      </button>
                      <button
                        onClick={() => { setCreatingProject(false); setNewProjectName(""); }}
                        className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <SearchableSelect
                      label="Brand"
                      options={brands}
                      value={brandId}
                      displayValue={brandName}
                      onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
                      onCreateNew={(text) => { setCreating("brand"); setCreatePrefill(text); }}
                      placeholder="Search brands..."
                      createLabel="Brand"
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      label="Factory"
                      options={factories}
                      value={factoryId}
                      displayValue={factoryName}
                      onChange={(id, name) => { setFactoryId(id); setFactoryName(name); }}
                      onCreateNew={(text) => { setCreating("factory"); setCreatePrefill(text); }}
                      placeholder="Search factories..."
                      createLabel="Factory"
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      label="Fabric"
                      options={fabrics}
                      value={fabricId}
                      displayValue={fabricName}
                      onChange={(id, name) => { setFabricId(id); setFabricName(name); }}
                      onCreateNew={(text) => { setCreating("fabric"); setCreatePrefill(text); }}
                      placeholder="Search fabrics..."
                      createLabel="Fabric"
                    />
                  </div>
                </div>

                {/* Inline create forms */}
                {creating && (
                  <CreateInlineForm
                    entityType={creating}
                    prefillName={createPrefill}
                    onCreated={(entity) => handleEntityCreated(creating, entity)}
                    onCancel={() => setCreating(null)}
                  />
                )}
              </div>

              {/* ── Type-specific fields ──────────────────── */}
              {testType === "ANTIBACTERIAL" && (
                <div className="p-5 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
                  <h3 className="font-semibold text-purple-900">Antibacterial Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1.5">Organism 1</label>
                      <input
                        type="text"
                        value={organism1}
                        onChange={(e) => setOrganism1(e.target.value)}
                        placeholder="e.g. S. aureus"
                        className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1.5">Result 1 (% reduction)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={result1}
                        onChange={(e) => setResult1(e.target.value)}
                        placeholder="e.g. 99.99"
                        className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1.5">Organism 2</label>
                      <input
                        type="text"
                        value={organism2}
                        onChange={(e) => setOrganism2(e.target.value)}
                        placeholder="e.g. K. pneumoniae"
                        className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1.5">Result 2 (% reduction)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={result2}
                        onChange={(e) => setResult2(e.target.value)}
                        placeholder="e.g. 99.97"
                        className="w-full px-3 py-2.5 border border-purple-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {testType === "ICP" && (
                <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
                  <h3 className="font-semibold text-blue-900">ICP Metals Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1.5">Silver (Ag)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={agValue}
                        onChange={(e) => setAgValue(e.target.value)}
                        placeholder="e.g. 150.5"
                        className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1.5">Gold (Au)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={auValue}
                        onChange={(e) => setAuValue(e.target.value)}
                        placeholder="e.g. 0.5"
                        className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1.5">Unit</label>
                      <select
                        value={agUnit}
                        onChange={(e) => setAgUnit(e.target.value)}
                        className="w-full px-3 py-2.5 border border-blue-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                      >
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
                  <h3 className="font-semibold text-orange-900">Fungal Test Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-1.5">Written Result</label>
                      <input
                        type="text"
                        value={fungalWrittenResult}
                        onChange={(e) => setFungalWrittenResult(e.target.value)}
                        placeholder="e.g. No growth observed"
                        className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-1.5">Pass/Fail</label>
                      <select
                        value={fungalPass}
                        onChange={(e) => setFungalPass(e.target.value)}
                        className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select...</option>
                        <option value="true">Pass</option>
                        <option value="false">Fail</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {testType === "ODOR" && (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-4">
                  <h3 className="font-semibold text-rose-900">Odor Test Results</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-rose-800 mb-1.5">Tested Odor</label>
                      <input
                        type="text"
                        value={testedOdor}
                        onChange={(e) => setTestedOdor(e.target.value)}
                        placeholder="e.g. Body odor"
                        className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-rose-800 mb-1.5">Result</label>
                      <input
                        type="text"
                        value={odorResultVal}
                        onChange={(e) => setOdorResultVal(e.target.value)}
                        placeholder="e.g. Significant reduction"
                        className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-rose-800 mb-1.5">Pass/Fail</label>
                      <select
                        value={odorPass}
                        onChange={(e) => setOdorPass(e.target.value)}
                        className="w-full px-3 py-2.5 border border-rose-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">Select...</option>
                        <option value="true">Pass</option>
                        <option value="false">Fail</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Overall pass/fail */}
              <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl">
                <label className="text-sm font-medium text-slate-700">Overall Result:</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overallPass"
                    value="true"
                    checked={overallPass === "true"}
                    onChange={(e) => setOverallPass(e.target.value)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium text-emerald-700">Pass</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overallPass"
                    value="false"
                    checked={overallPass === "false"}
                    onChange={(e) => setOverallPass(e.target.value)}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm font-medium text-red-700">Fail</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="overallPass"
                    value=""
                    checked={overallPass === ""}
                    onChange={(e) => setOverallPass(e.target.value)}
                    className="w-4 h-4 text-slate-600"
                  />
                  <span className="text-sm text-slate-500">Not specified</span>
                </label>
              </div>

              {/* Raw text toggle */}
              {parsed?.rawText && (
                <div>
                  <button
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-sm text-slate-500 hover:text-slate-700 underline"
                  >
                    {showRawText ? "Hide" : "Show"} extracted PDF text
                  </button>
                  {showRawText && (
                    <pre className="mt-2 p-4 bg-slate-900 text-slate-300 rounded-xl text-xs max-h-64 overflow-auto font-mono whitespace-pre-wrap">
                      {parsed.rawText}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Confirm bar */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {parsed
                  ? "Fields were auto-filled from your PDF. Please review before saving."
                  : "Fill in the test details and save."}
              </div>
              <div className="flex items-center gap-3">
                {confirmError && (
                  <span className="text-sm text-red-600">{confirmError}</span>
                )}
                <button
                  onClick={() => router.push("/tests")}
                  className="px-4 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming || !testType}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {confirming ? "Saving..." : "Confirm & Save Test"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
