// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface UploadResult {
  documentId: string;
  filename: string;
  sizeBytes: number;
  parsed?: any;
  itsReport?: any;
  aiReview?: any;
  parseError?: string;
  duplicateWarning?: string;
  confirmed?: boolean;
  testRunId?: string;
}

interface PendingTest {
  id: string;
  poNumber?: string;
  status: string;
  expectedReadyDate?: string;
  requestedCompletionDate?: string;
  estimatedCompletionDate?: string;
  testingStartedAt?: string;
  actualCompletionDate?: string;
  testTypes: string[];
  fabricInfo?: string;
  brandName?: string;
  factoryName?: string;
  labName?: string;
  priority?: number;
  specialInstructions?: string;
  lineCount: number;
  completedLines: number;
  createdAt: string;
  reportUploaded: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  RESULTS_RECEIVED: "bg-purple-100 text-purple-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
};

export default function LabUploadPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.labPortal.uploadPage;
  const [tab, setTab] = useState<"upload" | "pending">("upload");

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [uploadHistory, setUploadHistory] = useState<UploadResult[]>([]);

  // Pending tests state
  const [pendingTests, setPendingTests] = useState<PendingTest[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);

  // Drag and drop
  const [dragOver, setDragOver] = useState(false);

  // Review & Confirm state (appears after upload success, links Document → TestRun)
  const [confirmFields, setConfirmFields] = useState<Record<string, any>>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // When result arrives, pre-fill confirm fields from parsed data
  useEffect(() => {
    if (!result) return;
    const its = result.itsReport;
    const p = result.parsed;
    const firstTest = its?.tests?.[0];
    const defaults: Record<string, any> = {
      testType: firstTest?.testType || p?.testType || (its ? "ANTIBACTERIAL" : ""),
      testReportNumber: its?.header?.reportNumber || p?.testReportNumber || "",
      labName: its?.header?.labName || p?.labName || "",
      testDate: its?.header?.testDate || p?.testDate || "",
      testMethodStd: firstTest?.methodStd || p?.testMethodStd || "",
      washCount: firstTest?.washCount ?? p?.washCount ?? "",
      organism: firstTest?.organism || "",
      percentReduction: firstTest?.percentReduction ?? "",
      methodPass: firstTest?.methodPass ?? null,
      testNumberInReport: firstTest?.testNumber ?? "",
    };
    setConfirmFields(defaults);
    setConfirmMsg(null);
  }, [result?.documentId]);

  const handleConfirm = async () => {
    if (!result?.documentId) return;
    if (!confirmFields.testType) {
      setConfirmMsg({ ok: false, text: "Test type is required" });
      return;
    }
    setConfirming(true);
    setConfirmMsg(null);
    try {
      const payload: any = {
        documentId: result.documentId,
        ...confirmFields,
      };
      // Coerce empty strings to null for the API
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });
      const res = await fetch("/api/tests/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (j.ok) {
        setConfirmMsg({
          ok: true,
          text: `Saved. Test run ${String(j.testRunId).slice(0, 8)} is now linked to this report.`,
        });
        setResult((prev) => (prev ? { ...prev, confirmed: true, testRunId: j.testRunId } : prev));
      } else {
        setConfirmMsg({ ok: false, text: j.error || "Failed to save" });
      }
    } catch (err: any) {
      setConfirmMsg({ ok: false, text: err.message });
    } finally {
      setConfirming(false);
    }
  };

  // Fetch pending tests
  useEffect(() => {
    fetch("/api/lab-portal/pending-tests")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPendingTests(j.tests || []);
      })
      .catch(() => {})
      .finally(() => setLoadingPending(false));
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tests/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error || "Upload failed");
        return;
      }

      setResult(json);
      setUploadHistory((prev) => [json, ...prev]);
      setFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
    } else {
      setError("Only PDF files are accepted");
    }
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/lab-portal" className="hover:text-[#00b4c3]">
            {t.labPortal.crumb}
          </Link>
          <span>/</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">📄 {tx.pageTitle}</h1>
        <p className="text-slate-500 mt-1">Upload completed test reports and track pending tests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("upload")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "upload" ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
        >
          📤 Upload Report
        </button>
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === "pending" ? "bg-slate-900 text-white" : "bg-white border text-slate-600 hover:bg-slate-50"}`}
        >
          ⏳ Pending Tests ({pendingTests.filter((t) => t.status !== "COMPLETE").length})
        </button>
        <Link
          href="/lab-portal/uploads"
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border text-slate-600 hover:bg-slate-50"
        >
          📋 Upload History
        </Link>
      </div>

      {tab === "upload" && (
        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragOver
                ? "border-[#00b4c3] bg-cyan-50"
                : "border-slate-300 bg-white hover:border-slate-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <div>
                <div className="text-4xl mb-3">📄</div>
                <div className="font-bold text-slate-900">{file.name}</div>
                <div className="text-sm text-slate-500 mt-1">{formatSize(file.size)}</div>
                <div className="flex gap-3 justify-center mt-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-6 py-2 bg-[#00b4c3] text-white rounded-lg font-semibold text-sm hover:bg-[#009aa8] disabled:opacity-50"
                  >
                    {uploading ? "⏳ Uploading & Parsing..." : "🚀 Upload & Parse Report"}
                  </button>
                  <button
                    onClick={() => {
                      setFile(null);
                      setResult(null);
                      setError("");
                    }}
                    className="px-4 py-2 bg-white border text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">📤</div>
                <div className="font-bold text-slate-700">Drop a PDF test report here</div>
                <div className="text-sm text-slate-500 mt-2">or</div>
                <label className="inline-block mt-3 px-6 py-2 bg-[#00b4c3] text-white rounded-lg font-semibold text-sm cursor-pointer hover:bg-[#009aa8]">
                  Browse Files
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                    }}
                  />
                </label>
                <div className="text-xs text-slate-400 mt-3">Accepted: PDF files up to 25MB</div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              ❌ {error}
            </div>
          )}

          {/* Upload Result */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">✅</span>
                <h3 className="font-bold text-slate-900">Report Uploaded Successfully</h3>
              </div>

              {result.duplicateWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-4">
                  ⚠️ {result.duplicateWarning}
                </div>
              )}

              {result.parseError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-4">
                  ⚠️ {result.parseError}
                </div>
              )}

              {/* ITS Report Results */}
              {result.itsReport && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[#00b4c3] uppercase">
                    Parsed Report Data
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {result.itsReport.header?.reportNumber && (
                      <div>
                        <span className="text-slate-500">Report #:</span>{" "}
                        <strong>{result.itsReport.header.reportNumber}</strong>
                      </div>
                    )}
                    {result.itsReport.header?.labName && (
                      <div>
                        <span className="text-slate-500">Lab:</span>{" "}
                        <strong>{result.itsReport.header.labName}</strong>
                      </div>
                    )}
                    {result.itsReport.header?.testDate && (
                      <div>
                        <span className="text-slate-500">Date:</span>{" "}
                        <strong>{result.itsReport.header.testDate}</strong>
                      </div>
                    )}
                    {result.itsReport.header?.testStandard && (
                      <div>
                        <span className="text-slate-500">Standard:</span>{" "}
                        <strong>{result.itsReport.header.testStandard}</strong>
                      </div>
                    )}
                  </div>
                  {result.itsReport.tests?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-slate-700 mb-2">
                        Tests Found: {result.itsReport.tests.length}
                      </div>
                      <div className="space-y-2">
                        {result.itsReport.tests.map((t: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg text-sm"
                          >
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${t.methodPass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                            >
                              {t.methodPass ? "PASS" : "FAIL"}
                            </span>
                            <span>{t.organism || t.testType || "Test"}</span>
                            {t.percentReduction && (
                              <span className="text-slate-500">
                                {t.percentReduction}% reduction
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Parsed results with verification */}
              {result.parsed && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[#00b4c3] uppercase">
                    Parsed Report Data
                  </div>

                  {/* Confidence indicator */}
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      result.parsed.confidence >= 70
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                        : result.parsed.confidence >= 50
                          ? "bg-amber-50 border border-amber-200 text-amber-800"
                          : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <span>
                        {result.parsed.confidence >= 70
                          ? "✅"
                          : result.parsed.confidence >= 50
                            ? "⚠️"
                            : "❗"}
                      </span>
                      Parse confidence: {result.parsed.confidence}%
                    </div>
                    {result.parsed.confidence < 50 && (
                      <p className="text-xs mt-1">
                        Low confidence — the parser could not extract all fields from this report
                        format. The file was uploaded successfully, but please verify the details
                        below are correct.
                      </p>
                    )}
                  </div>

                  {/* Extracted fields table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-4 py-2 text-slate-600 font-medium w-1/3">
                            Field
                          </th>
                          <th className="text-left px-4 py-2 text-slate-600 font-medium">
                            Extracted Value
                          </th>
                          <th className="text-center px-4 py-2 text-slate-600 font-medium w-16">
                            OK?
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Test Type</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.testType || (
                              <span className="text-slate-300 italic">Not detected</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.testType ? "✅" : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Report #</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.testReportNumber || (
                              <span className="text-slate-300 italic">Not detected</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.testReportNumber ? "✅" : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Lab</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.labName || (
                              <span className="text-slate-300 italic">Not detected</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.labName ? "✅" : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Test Date</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.testDate || (
                              <span className="text-slate-300 italic">Not detected</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.testDate ? "✅" : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Test Method</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.testMethodStd || (
                              <span className="text-slate-300 italic">Not detected</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.testMethodStd ? "✅" : "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-500">Wash Count</td>
                          <td className="px-4 py-2 font-medium">
                            {result.parsed.washCount !== null &&
                            result.parsed.washCount !== undefined ? (
                              result.parsed.washCount
                            ) : (
                              <span className="text-slate-300 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {result.parsed.washCount !== null &&
                            result.parsed.washCount !== undefined
                              ? "✅"
                              : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Status summary */}
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                    {(() => {
                      const fields = [
                        result.parsed.testType,
                        result.parsed.testReportNumber,
                        result.parsed.labName,
                        result.parsed.testDate,
                        result.parsed.testMethodStd,
                      ];
                      const detected = fields.filter(Boolean).length;
                      return (
                        <span>
                          <strong>{detected}</strong> of <strong>5</strong> key fields detected.
                          {detected <= 2
                            ? " The report was stored successfully — an admin can manually review and fill in the missing details."
                            : detected <= 4
                              ? " Most fields extracted. Please verify the data above is accurate."
                              : " All key fields extracted successfully."}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* No parsed data at all */}
              {!result.parsed && !result.itsReport && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  ⚠️ The report was uploaded and stored, but automatic parsing is not available for
                  this report format. An admin will review the file manually.
                </div>
              )}

              {/* AI Review */}
              {result.aiReview && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="text-sm font-semibold text-indigo-700 mb-2">🤖 AI Analysis</div>
                  <div className="text-sm text-indigo-900">
                    {result.aiReview.summary || JSON.stringify(result.aiReview).substring(0, 200)}
                  </div>
                </div>
              )}

              {/* ── Review & Confirm — links Document → TestRun ─────────────── */}
              {!result.confirmed && (
                <div className="mt-6 p-5 bg-amber-50 border-2 border-amber-300 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl">📝</span>
                    <div>
                      <h4 className="font-bold text-amber-900">Review & Save to Test Run</h4>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Until you confirm below, this report is stored as an orphan file. Confirm to
                        create a linked test run so it shows up in your customer&apos;s reports.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">Test Type *</span>
                      <select
                        value={confirmFields.testType || ""}
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, testType: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs bg-white"
                      >
                        <option value="">— Select —</option>
                        <option value="ANTIBACTERIAL">Antibacterial</option>
                        <option value="ICP">ICP (Silver / Gold)</option>
                        <option value="FUNGAL">Antifungal</option>
                        <option value="ODOR">Odor</option>
                        <option value="UV">UV / UPF</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>

                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">Report Number</span>
                      <input
                        type="text"
                        value={confirmFields.testReportNumber || ""}
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, testReportNumber: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">Lab Name</span>
                      <input
                        type="text"
                        value={confirmFields.labName || ""}
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, labName: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">Test Date</span>
                      <input
                        type="text"
                        value={confirmFields.testDate || ""}
                        placeholder="YYYY-MM-DD or as shown on report"
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, testDate: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">
                        Method / Standard
                      </span>
                      <input
                        type="text"
                        value={confirmFields.testMethodStd || ""}
                        placeholder="e.g. AATCC 100, ISO 20743"
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, testMethodStd: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </label>

                    <label className="text-xs">
                      <span className="block font-semibold text-slate-700 mb-1">Wash Count</span>
                      <input
                        type="number"
                        value={confirmFields.washCount ?? ""}
                        onChange={(e) =>
                          setConfirmFields((p) => ({ ...p, washCount: e.target.value }))
                        }
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                      />
                    </label>

                    {confirmFields.testType === "ANTIBACTERIAL" && (
                      <>
                        <label className="text-xs">
                          <span className="block font-semibold text-slate-700 mb-1">Organism</span>
                          <input
                            type="text"
                            value={confirmFields.organism || ""}
                            placeholder="e.g. S. aureus"
                            onChange={(e) =>
                              setConfirmFields((p) => ({ ...p, organism: e.target.value }))
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </label>
                        <label className="text-xs">
                          <span className="block font-semibold text-slate-700 mb-1">
                            % Reduction
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={confirmFields.percentReduction ?? ""}
                            onChange={(e) =>
                              setConfirmFields((p) => ({ ...p, percentReduction: e.target.value }))
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </label>
                      </>
                    )}
                  </div>

                  {/* Pass/Fail */}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="font-semibold text-slate-700">Result:</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="methodPass"
                        checked={confirmFields.methodPass === true}
                        onChange={() => setConfirmFields((p) => ({ ...p, methodPass: true }))}
                      />
                      <span className="text-emerald-700 font-semibold">PASS</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="methodPass"
                        checked={confirmFields.methodPass === false}
                        onChange={() => setConfirmFields((p) => ({ ...p, methodPass: false }))}
                      />
                      <span className="text-red-700 font-semibold">FAIL</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="methodPass"
                        checked={
                          confirmFields.methodPass === null ||
                          confirmFields.methodPass === undefined
                        }
                        onChange={() => setConfirmFields((p) => ({ ...p, methodPass: null }))}
                      />
                      <span className="text-slate-600">N/A</span>
                    </label>
                  </div>

                  {confirmMsg && (
                    <div
                      className={`mt-3 p-2 rounded-lg text-xs font-semibold ${
                        confirmMsg.ok
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-red-100 text-red-800 border border-red-300"
                      }`}
                    >
                      {confirmMsg.ok ? "✅" : "❌"} {confirmMsg.text}
                    </div>
                  )}

                  {confirmFields.testRequestId && (
                    <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      Linking to Test Request <code className="font-mono">{String(confirmFields.testRequestId).slice(-8)}</code> —
                      on save, this request will flip to <strong>COMPLETE</strong> and notify the brand + factory.
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={handleConfirm}
                      disabled={confirming || !confirmFields.testType}
                      className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50"
                    >
                      {confirming ? "Saving..." : "💾 Save to Test Run"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="text-sm text-emerald-700">
                  {result.confirmed ? "✅" : "📎"} Report stored. Document ID: {result.documentId} (
                  {formatSize(result.sizeBytes)})
                  {result.confirmed && result.testRunId && (
                    <span className="ml-2 text-emerald-800 font-bold">
                      — linked to test run {String(result.testRunId).slice(0, 8)}
                    </span>
                  )}
                </div>
                <Link
                  href="/lab-portal/uploads"
                  className="text-sm font-bold text-emerald-700 hover:text-emerald-800 whitespace-nowrap ml-4"
                >
                  View in Upload History →
                </Link>
              </div>
            </div>
          )}

          {/* Upload History */}
          {uploadHistory.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-bold text-slate-900 mb-3">Upload History (This Session)</h3>
              <div className="space-y-2">
                {uploadHistory.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm"
                  >
                    <span className="font-medium">{h.filename}</span>
                    <span className="text-slate-500">{formatSize(h.sizeBytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "pending" && (
        <PendingTestsPanel
          pendingTests={pendingTests}
          loading={loadingPending}
          onRefresh={() => {
            setLoadingPending(true);
            fetch("/api/lab-portal/pending-tests")
              .then((r) => r.json())
              .then((j) => {
                if (j.ok) setPendingTests(j.tests || []);
              })
              .catch(() => {})
              .finally(() => setLoadingPending(false));
          }}
          onSwitchToUpload={(testRequestId?: string) => {
            if (testRequestId) {
              setConfirmFields((p) => ({ ...p, testRequestId }));
            }
            setTab("upload");
          }}
        />
      )}
    </div>
  );
}

/* ─── Pending Tests Panel with Lab Actions ─── */
function PendingTestsPanel({
  pendingTests,
  loading,
  onRefresh,
  onSwitchToUpload,
}: {
  pendingTests: PendingTest[];
  loading: boolean;
  onRefresh: () => void;
  onSwitchToUpload: (testRequestId?: string) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [readyDate, setReadyDate] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const doAction = async (
    action: string,
    testRequestId: string,
    extra: Record<string, any> = {},
  ) => {
    setActionLoading(`${testRequestId}-${action}`);
    setActionMsg(null);
    try {
      const res = await fetch("/api/lab-portal/test-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, testRequestId, ...extra }),
      });
      const j = await res.json();
      if (j.ok) {
        setActionMsg({
          id: testRequestId,
          msg: `${action.replace(/_/g, " ")} completed`,
          ok: true,
        });
        onRefresh();
      } else {
        setActionMsg({ id: testRequestId, msg: j.error || "Action failed", ok: false });
      }
    } catch (e: any) {
      setActionMsg({ id: testRequestId, msg: e.message, ok: false });
    } finally {
      setActionLoading(null);
    }
  };

  const canAccept = (status: string) =>
    ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"].includes(status);
  const canLinkReport = (status: string) => ["IN_PROGRESS", "RESULTS_RECEIVED"].includes(status);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading...</div>;
  }

  if (pendingTests.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
        <div className="text-4xl mb-2">✅</div>
        <div>No pending tests</div>
      </div>
    );
  }

  // Group by status
  const awaitingAccept = pendingTests.filter((t) => canAccept(t.status));
  const inProgress = pendingTests.filter((t) => t.status === "IN_PROGRESS");
  const resultsReceived = pendingTests.filter((t) => t.status === "RESULTS_RECEIVED");
  const other = pendingTests.filter(
    (t) => !canAccept(t.status) && t.status !== "IN_PROGRESS" && t.status !== "RESULTS_RECEIVED",
  );

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
          <p className="text-lg font-black text-amber-700">{awaitingAccept.length}</p>
          <p className="text-[10px] font-semibold text-amber-600 uppercase">Awaiting Accept</p>
        </div>
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
          <p className="text-lg font-black text-cyan-700">{inProgress.length}</p>
          <p className="text-[10px] font-semibold text-cyan-600 uppercase">In Progress</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
          <p className="text-lg font-black text-purple-700">{resultsReceived.length}</p>
          <p className="text-[10px] font-semibold text-purple-600 uppercase">Results Ready</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
          <p className="text-lg font-black text-slate-600">{pendingTests.length}</p>
          <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Active</p>
        </div>
      </div>

      {/* Awaiting Accept section */}
      {awaitingAccept.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
            ⏳ Awaiting Lab Acceptance ({awaitingAccept.length})
          </h3>
          <div className="space-y-2">
            {awaitingAccept.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                expanded={expandedTest === test.id}
                onToggle={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                actionLoading={actionLoading}
                actionMsg={actionMsg}
                readyDate={readyDate}
                setReadyDate={setReadyDate}
                noteText={noteText}
                setNoteText={setNoteText}
                doAction={doAction}
                onSwitchToUpload={onSwitchToUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* In Progress section */}
      {inProgress.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-cyan-700 mb-2 flex items-center gap-2">
            🔬 In Progress ({inProgress.length})
          </h3>
          <div className="space-y-2">
            {inProgress.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                expanded={expandedTest === test.id}
                onToggle={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                actionLoading={actionLoading}
                actionMsg={actionMsg}
                readyDate={readyDate}
                setReadyDate={setReadyDate}
                noteText={noteText}
                setNoteText={setNoteText}
                doAction={doAction}
                onSwitchToUpload={onSwitchToUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results Received */}
      {resultsReceived.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
            📋 Results Received ({resultsReceived.length})
          </h3>
          <div className="space-y-2">
            {resultsReceived.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                expanded={expandedTest === test.id}
                onToggle={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                actionLoading={actionLoading}
                actionMsg={actionMsg}
                readyDate={readyDate}
                setReadyDate={setReadyDate}
                noteText={noteText}
                setNoteText={setNoteText}
                doAction={doAction}
                onSwitchToUpload={onSwitchToUpload}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other */}
      {other.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-600 mb-2">Other ({other.length})</h3>
          <div className="space-y-2">
            {other.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                expanded={expandedTest === test.id}
                onToggle={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                actionLoading={actionLoading}
                actionMsg={actionMsg}
                readyDate={readyDate}
                setReadyDate={setReadyDate}
                noteText={noteText}
                setNoteText={setNoteText}
                doAction={doAction}
                onSwitchToUpload={onSwitchToUpload}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Single Test Card ─── */
function TestCard({
  test,
  expanded,
  onToggle,
  actionLoading,
  actionMsg,
  readyDate,
  setReadyDate,
  noteText,
  setNoteText,
  doAction,
  onSwitchToUpload,
}: {
  test: PendingTest;
  expanded: boolean;
  onToggle: () => void;
  actionLoading: string | null;
  actionMsg: { id: string; msg: string; ok: boolean } | null;
  readyDate: Record<string, string>;
  setReadyDate: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  noteText: Record<string, string>;
  setNoteText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  doAction: (action: string, id: string, extra?: Record<string, any>) => Promise<void>;
  onSwitchToUpload: (testRequestId?: string) => void;
}) {
  const canAccept = ["SUBMITTED", "PENDING_APPROVAL", "APPROVED"].includes(test.status);
  const isInProgress = test.status === "IN_PROGRESS";
  const progress =
    test.lineCount > 0 ? Math.round((test.completedLines / test.lineCount) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-800">
              {test.poNumber || test.id.substring(0, 8)}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_COLORS[test.status] || "bg-slate-100 text-slate-600"}`}
            >
              {test.status?.replace(/_/g, " ")}
            </span>
            {test.priority && test.priority <= 2 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                PRIORITY
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            <span>{test.brandName || "—"}</span>
            <span className="text-slate-300">|</span>
            <span>{test.factoryName || "—"}</span>
            {test.fabricInfo && (
              <>
                <span className="text-slate-300">|</span>
                <span className="truncate max-w-[200px]">{test.fabricInfo}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-4 text-center">
          <div>
            <p className="text-xs font-bold text-slate-600">{test.testTypes?.join(", ") || "—"}</p>
            <p className="text-[9px] text-slate-400">Tests</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">
              {test.completedLines}/{test.lineCount}
            </p>
            <p className="text-[9px] text-slate-400">Lines Done</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">
              {test.estimatedCompletionDate
                ? new Date(test.estimatedCompletionDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
            <p className="text-[9px] text-slate-400">ETA</p>
          </div>
        </div>

        {/* Report status */}
        <div className="text-center">
          {test.reportUploaded ? (
            <span className="text-emerald-600 text-xs font-bold">✅</span>
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </div>

        <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 bg-slate-50 space-y-4">
          {/* Mobile info */}
          <div className="sm:hidden text-xs text-slate-500 space-y-1">
            <p>Tests: {test.testTypes?.join(", ") || "—"}</p>
            <p>
              Lines: {test.completedLines}/{test.lineCount} complete
            </p>
          </div>

          {/* Progress bar */}
          {test.lineCount > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>
                  Progress: {test.completedLines}/{test.lineCount} lines
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00b4c3] rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Timeline dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white border rounded-lg p-2">
              <p className="text-slate-400">Submitted</p>
              <p className="font-semibold text-slate-700">
                {new Date(test.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <p className="text-slate-400">Testing Started</p>
              <p className="font-semibold text-slate-700">
                {test.testingStartedAt
                  ? new Date(test.testingStartedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <p className="text-slate-400">Expected Ready</p>
              <p className="font-semibold text-slate-700">
                {test.estimatedCompletionDate
                  ? new Date(test.estimatedCompletionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : test.requestedCompletionDate
                    ? new Date(test.requestedCompletionDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
              </p>
            </div>
            <div className="bg-white border rounded-lg p-2">
              <p className="text-slate-400">Completed</p>
              <p className="font-semibold text-slate-700">
                {test.actualCompletionDate
                  ? new Date(test.actualCompletionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Special instructions */}
          {test.specialInstructions && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-bold text-amber-700 mb-1">Notes / Instructions</p>
              <p className="whitespace-pre-wrap">{test.specialInstructions}</p>
            </div>
          )}

          {/* Action message */}
          {actionMsg && actionMsg.id === test.id && (
            <div
              className={`p-2 rounded-lg text-xs font-semibold ${actionMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}
            >
              {actionMsg.ok ? "✅" : "❌"} {actionMsg.msg}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {/* Accept & Start Testing */}
            {canAccept && (
              <div className="flex items-center gap-2 bg-white border rounded-lg p-2">
                <input
                  type="date"
                  value={readyDate[test.id] || ""}
                  onChange={(e) => setReadyDate((prev) => ({ ...prev, [test.id]: e.target.value }))}
                  className="px-2 py-1 border border-slate-300 rounded text-xs"
                  placeholder="Expected ready date"
                />
                <button
                  onClick={() =>
                    doAction("accept", test.id, {
                      expectedReadyDate: readyDate[test.id] || undefined,
                    })
                  }
                  disabled={actionLoading === `${test.id}-accept`}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {actionLoading === `${test.id}-accept` ? "..." : "✅ Accept & Start Testing"}
                </button>
              </div>
            )}

            {/* Set / Update expected ready date */}
            {isInProgress && (
              <div className="flex items-center gap-2 bg-white border rounded-lg p-2">
                <input
                  type="date"
                  value={readyDate[test.id] || ""}
                  onChange={(e) => setReadyDate((prev) => ({ ...prev, [test.id]: e.target.value }))}
                  className="px-2 py-1 border border-slate-300 rounded text-xs"
                />
                <button
                  onClick={() => {
                    if (!readyDate[test.id]) return;
                    doAction("set_ready_date", test.id, { expectedReadyDate: readyDate[test.id] });
                  }}
                  disabled={!readyDate[test.id] || actionLoading === `${test.id}-set_ready_date`}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {actionLoading === `${test.id}-set_ready_date` ? "..." : "📅 Update ETA"}
                </button>
              </div>
            )}

            {/* Upload / Link Report — passes the TestRequest id so
                the confirm payload can flip its status. Kaylee Pace
                ticket cmpyq564c0001l404naf8m4hj. */}
            {!test.reportUploaded && (
              <button
                onClick={() => onSwitchToUpload(test.id)}
                className="px-4 py-1.5 bg-[#00b4c3] text-white rounded-lg text-xs font-bold hover:bg-[#009aa8]"
              >
                📤 Upload Report
              </button>
            )}

            {test.reportUploaded && (
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                ✅ Report Uploaded
              </span>
            )}
          </div>

          {/* Add note */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={noteText[test.id] || ""}
              onChange={(e) => setNoteText((prev) => ({ ...prev, [test.id]: e.target.value }))}
              placeholder="Add a note..."
              className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && noteText[test.id]?.trim()) {
                  doAction("add_note", test.id, { notes: noteText[test.id].trim() });
                  setNoteText((prev) => ({ ...prev, [test.id]: "" }));
                }
              }}
            />
            <button
              onClick={() => {
                if (!noteText[test.id]?.trim()) return;
                doAction("add_note", test.id, { notes: noteText[test.id].trim() });
                setNoteText((prev) => ({ ...prev, [test.id]: "" }));
              }}
              disabled={!noteText[test.id]?.trim() || actionLoading === `${test.id}-add_note`}
              className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-bold hover:bg-slate-700 disabled:opacity-50"
            >
              {actionLoading === `${test.id}-add_note` ? "..." : "💬 Add Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
