// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

interface UploadResult {
  documentId: string;
  filename: string;
  sizeBytes: number;
  parsed?: any;
  itsReport?: any;
  aiReview?: any;
  parseError?: string;
  duplicateWarning?: string;
}

interface PendingTest {
  id: string;
  poNumber?: string;
  status: string;
  expectedReadyDate?: string;
  testTypes: string[];
  fabricInfo?: string;
  brandName?: string;
  factoryName?: string;
  createdAt: string;
  reportUploaded: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  RESULTS_RECEIVED: "bg-purple-100 text-purple-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
};

export default function LabUploadPage() {
  const { user } = useAuth();
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

  // Fetch pending tests
  useEffect(() => {
    fetch("/api/lab-portal/pending-tests")
      .then(r => r.json())
      .then(j => { if (j.ok) setPendingTests(j.tests || []); })
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
      setUploadHistory(prev => [json, ...prev]);
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
          <Link href="/lab-portal" className="hover:text-[#00b4c3]">Lab Portal</Link>
          <span>/</span>
          <span>Test Reports</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">📄 Test Report Upload</h1>
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
          ⏳ Pending Tests ({pendingTests.filter(t => t.status !== "COMPLETE").length})
        </button>
      </div>

      {tab === "upload" && (
        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragOver ? "border-[#00b4c3] bg-cyan-50" : "border-slate-300 bg-white hover:border-slate-400"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                    onClick={() => { setFile(null); setResult(null); setError(""); }}
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
                    onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
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
                  <div className="text-sm font-semibold text-[#00b4c3] uppercase">Parsed Report Data</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {result.itsReport.header?.reportNumber && (
                      <div><span className="text-slate-500">Report #:</span> <strong>{result.itsReport.header.reportNumber}</strong></div>
                    )}
                    {result.itsReport.header?.labName && (
                      <div><span className="text-slate-500">Lab:</span> <strong>{result.itsReport.header.labName}</strong></div>
                    )}
                    {result.itsReport.header?.testDate && (
                      <div><span className="text-slate-500">Date:</span> <strong>{result.itsReport.header.testDate}</strong></div>
                    )}
                    {result.itsReport.header?.testStandard && (
                      <div><span className="text-slate-500">Standard:</span> <strong>{result.itsReport.header.testStandard}</strong></div>
                    )}
                  </div>
                  {result.itsReport.tests?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-slate-700 mb-2">Tests Found: {result.itsReport.tests.length}</div>
                      <div className="space-y-2">
                        {result.itsReport.tests.map((t: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${t.methodPass ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {t.methodPass ? "PASS" : "FAIL"}
                            </span>
                            <span>{t.organism || t.testType || "Test"}</span>
                            {t.percentReduction && <span className="text-slate-500">{t.percentReduction}% reduction</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Legacy parsed results */}
              {result.parsed && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-[#00b4c3] uppercase">Parsed Report Data</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {result.parsed.testType && <div><span className="text-slate-500">Type:</span> <strong>{result.parsed.testType}</strong></div>}
                    {result.parsed.testReportNumber && <div><span className="text-slate-500">Report #:</span> <strong>{result.parsed.testReportNumber}</strong></div>}
                    {result.parsed.labName && <div><span className="text-slate-500">Lab:</span> <strong>{result.parsed.labName}</strong></div>}
                    {result.parsed.testDate && <div><span className="text-slate-500">Date:</span> <strong>{result.parsed.testDate}</strong></div>}
                    {result.parsed.testMethodStd && <div><span className="text-slate-500">Method:</span> <strong>{result.parsed.testMethodStd}</strong></div>}
                    {result.parsed.washCount !== null && <div><span className="text-slate-500">Washes:</span> <strong>{result.parsed.washCount}</strong></div>}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="text-slate-500">Parse confidence:</span>{" "}
                    <strong className={result.parsed.confidence >= 70 ? "text-emerald-600" : result.parsed.confidence >= 50 ? "text-amber-600" : "text-red-600"}>
                      {result.parsed.confidence}%
                    </strong>
                  </div>
                </div>
              )}

              {/* AI Review */}
              {result.aiReview && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <div className="text-sm font-semibold text-indigo-700 mb-2">🤖 AI Analysis</div>
                  <div className="text-sm text-indigo-900">{result.aiReview.summary || JSON.stringify(result.aiReview).substring(0, 200)}</div>
                </div>
              )}

              <div className="mt-4 text-sm text-slate-500">
                Document ID: {result.documentId} • {formatSize(result.sizeBytes)}
              </div>
            </div>
          )}

          {/* Upload History */}
          {uploadHistory.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-bold text-slate-900 mb-3">Upload History (This Session)</h3>
              <div className="space-y-2">
                {uploadHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Pending & Active Tests</h3>
            <span className="text-sm text-slate-500">{pendingTests.length} total</span>
          </div>

          {loadingPending ? (
            <div className="p-12 text-center text-slate-400">Loading...</div>
          ) : pendingTests.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-4xl mb-2">✅</div>
              <div>No pending tests</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">PO / Request</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tests</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Brand</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Expected Ready</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Report</th>
                </tr>
              </thead>
              <tbody>
                {pendingTests.map(test => (
                  <tr key={test.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{test.poNumber || test.id.substring(0, 8)}</div>
                      <div className="text-xs text-slate-500">{test.factoryName}</div>
                    </td>
                    <td className="px-4 py-3">{test.testTypes?.join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{test.brandName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${STATUS_COLORS[test.status] || "bg-slate-100 text-slate-600"}`}>
                        {test.status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {test.expectedReadyDate ? new Date(test.expectedReadyDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {test.reportUploaded ? (
                        <span className="text-emerald-600 font-bold text-xs">✅ Uploaded</span>
                      ) : (
                        <button
                          onClick={() => setTab("upload")}
                          className="px-3 py-1 bg-[#00b4c3] text-white rounded text-xs font-semibold hover:bg-[#009aa8]"
                        >
                          Upload
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
