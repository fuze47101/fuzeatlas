// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function DistributorUploadReportPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.distributorPortal.uploadReportPage;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);

  const isDistributor = user?.role === "DISTRIBUTOR_USER";
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    if (!isDistributor && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    loadUploads();
  }, [user, router]);

  async function loadUploads() {
    try {
      const res = await fetch("/api/distributor-portal/test-reports");
      const data = await res.json();
      if (data.ok) setUploads(data.reports || []);
    } catch {
      // quiet fail
    } finally {
      setLoadingUploads(false);
    }
  }

  async function handleUpload() {
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
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        setFile(null);
        loadUploads();
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">{t.distributorPortal.crumb}</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload lab test reports (PDF) for parsing and linking to fabrics
        </p>
      </div>

      {/* Upload Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <div
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#00b4c3] transition-colors cursor-pointer"
          onClick={() => document.getElementById("report-file")?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#00b4c3]", "bg-[#00b4c3]/5"); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#00b4c3]", "bg-[#00b4c3]/5"); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-[#00b4c3]", "bg-[#00b4c3]/5");
            const f = e.dataTransfer.files[0];
            if (f && f.type === "application/pdf") setFile(f);
          }}
        >
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-slate-600">
            {file ? file.name : "Drop PDF report here or click to browse"}
          </p>
          <p className="text-xs text-slate-400 mt-1">PDF files up to 25MB</p>
        </div>
        <input id="report-file" type="file" accept=".pdf" className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)} />

        {file && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 font-medium">{file.name}</span>
              <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setFile(null)}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700">
                Remove
              </button>
              <button onClick={handleUpload} disabled={uploading}
                className="px-5 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50">
                {uploading ? "Uploading & Parsing..." : "Upload Report"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Parse Result */}
        {result && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
            {/* Always-on confirmation that the file was saved, regardless
                of parser confidence. Tina was getting 0% confidence on
                VL Lab reports and assumed nothing saved — this banner
                makes it impossible to miss that the upload itself
                succeeded. */}
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
              <strong>✓ File uploaded and saved</strong> · {result.filename || "—"}
              {result.documentId && (
                <span className="ml-2 font-mono text-[11px] text-emerald-700">
                  doc:{result.documentId.slice(0, 12)}…
                </span>
              )}
              <p className="text-xs text-emerald-700 mt-1">
                Your file is in the system. The parser confidence below is
                only about how much test data we could auto-extract — even
                at 0%, the PDF is stored and an admin will review it.
                You'll see it in the table at the bottom of this page tagged
                ⏳ "Pending review".
              </p>
            </div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-slate-900">Parsed Report</h3>
              <div className="flex items-center gap-2">
                {result.aiVision?.usedAsPrimary && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                    🧠 AI vision
                  </span>
                )}
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (result.confidence || 0) >= 70 ? "bg-emerald-100 text-emerald-700" :
                  (result.confidence || 0) >= 50 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {result.confidence || 0}% confidence
                </span>
              </div>
            </div>
            {result.aiVision?.usedAsPrimary && (
              <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900">
                The PDF had little or no text layer (image-based scan).
                Claude AI vision read the document directly and extracted
                the fields below. Review carefully — AI extraction can miss
                or misread numbers in poor scans.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500">Test Type</span>
                <p className="font-medium text-slate-800">{result.testType || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Report #</span>
                <p className="font-medium text-slate-800">{result.reportNumber || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Lab</span>
                <p className="font-medium text-slate-800">{result.labName || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Test Date</span>
                <p className="font-medium text-slate-800">{result.testDate || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Method</span>
                <p className="font-medium text-slate-800">{result.testMethodStd || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Wash Count</span>
                <p className="font-medium text-slate-800">{result.washCount ?? "—"}</p>
              </div>
            </div>
            {result.confidence < 50 && (
              <p className="mt-3 text-xs text-amber-600">
                Low confidence parse. The report may use a format our parser doesn't recognize yet. An admin will review the uploaded file.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Upload History — KJ Tang #cmo9f469v: surfaces uploaded reports
          with brand + customer + FUZE# columns so the distributor can
          see attribution, plus a download link per row. */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Your Uploads</h2>
        {loadingUploads ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-400">No reports uploaded yet</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">File · Report #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Test</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Brand</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Factory</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">FUZE / Customer ref</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Lab · Date</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploads.map((u: any) => {
                  const linked = !!(u.brand || u.factory || u.fuzeNumber);
                  const isPending = u.status === "pending_review";
                  return (
                    <tr
                      key={u.testRunId || u.documentId || u.id}
                      className={`hover:bg-slate-50 ${isPending ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-xs">
                        {isPending ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wide"
                            title="Saved successfully but parser couldn't auto-extract test data. An admin will review and link it."
                          >
                            ⏳ Pending review
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wide">
                            ✓ Confirmed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[260px]">
                        <p className="truncate font-medium">
                          {u.filename || "—"}
                        </p>
                        {u.reportNumber && (
                          <p className="text-xs font-mono text-slate-500">
                            #{u.reportNumber}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <p className="font-semibold">{u.testType || "—"}</p>
                        {u.washCount != null && (
                          <p className="text-slate-400">
                            {u.washCount} washes
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {u.brand?.name ? (
                          <Link
                            href={`/brands/${u.brand.id}`}
                            className="font-semibold text-blue-600 hover:underline"
                          >
                            {u.brand.name}
                          </Link>
                        ) : (
                          <span className="text-amber-600">unlinked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {u.factory?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {u.fuzeNumber && (
                          <Link
                            href={`/fabrics/${u.fuzeNumber}`}
                            className="font-mono font-semibold text-blue-600 hover:underline"
                          >
                            FUZE-{u.fuzeNumber}
                          </Link>
                        )}
                        {u.customerFabricCode && (
                          <p className="text-slate-500">
                            {u.customerFabricCode}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <p>{u.labName || "—"}</p>
                        <p className="text-slate-400">
                          {u.testDate
                            ? new Date(u.testDate).toLocaleDateString()
                            : new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {u.downloadUrl ? (
                          <a
                            href={u.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            ↓ Download
                          </a>
                        ) : !linked ? (
                          <span className="text-amber-600">
                            Awaiting admin review
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Reports show as &quot;unlinked&quot; until our parser auto-links
          them to a brand or fabric. If a report has been pending review
          for more than 24h, message <a href="mailto:andrew@fuze47.com" className="text-blue-600 underline">andrew@fuze47.com</a>{" "}
          and we&apos;ll attach it manually.
        </p>
      </div>
    </div>
  );
}
