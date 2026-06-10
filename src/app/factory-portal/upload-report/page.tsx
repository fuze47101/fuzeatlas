// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { uploadTestReport } from "@/lib/upload-client";

/**
 * Factory Portal — Upload Test Report
 *
 * Mirrors /distributor-portal/upload-report. Closes the gap
 * Tina flagged in May 2026: factories had no upload UI at all
 * and were emailing PDFs to admin@fuze47.com.
 *
 * The upload itself goes through the shared /api/tests/upload
 * endpoint (same parser, same S3 plumbing). The "Your uploads"
 * table reads from /api/factory-portal/test-reports which scopes
 * to the calling user's factoryId.
 */
export default function FactoryUploadReportPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.factoryPortal.uploadReport;
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);

  const isFactory = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER";
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    if (!user) return;
    if (!isFactory && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    loadUploads();
  }, [user, router, isFactory, isAdmin]);

  async function loadUploads() {
    try {
      const res = await fetch("/api/factory-portal/test-reports");
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
      // Presigned-S3 flow (handles >4.5 MB without hitting Vercel's
      // body-size limit). See src/lib/upload-client.ts.
      const result = await uploadTestReport(file);
      if (!result.ok) {
        setError(result.error || tx.uploadFailed);
      } else {
        setResult(result.data);
        setFile(null);
        loadUploads();
      }
    } catch (err: any) {
      setError(err?.message || tx.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            {tx.crumbHome}
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {/* Upload Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <div
          className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#00b4c3] transition-colors cursor-pointer"
          onClick={() => document.getElementById("report-file")?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("border-[#00b4c3]", "bg-[#00b4c3]/5");
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-[#00b4c3]", "bg-[#00b4c3]/5");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-[#00b4c3]", "bg-[#00b4c3]/5");
            const f = e.dataTransfer.files[0];
            if (f && f.type === "application/pdf") setFile(f);
          }}
        >
          <svg
            className="w-10 h-10 mx-auto mb-3 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm font-medium text-slate-600">{file ? file.name : tx.dropHint}</p>
          <p className="text-xs text-slate-400 mt-1">{tx.pdfSizeHint}</p>
        </div>
        <input
          id="report-file"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {file && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-700 font-medium">{file.name}</span>
              <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFile(null)}
                className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
              >
                {tx.remove}
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-5 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50"
              >
                {uploading ? tx.uploadingButton : tx.uploadButton}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Parse Result */}
        {result && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5">
            {/* Always-on confirmation that the file was saved, regardless
                of parser confidence — same UX fix Tina pushed for on
                the distributor side. */}
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
              <strong>{tx.savedBanner}</strong> · {result.filename || "—"}
              {result.documentId && (
                <span className="ml-2 font-mono text-[11px] text-emerald-700">
                  doc:{result.documentId.slice(0, 12)}…
                </span>
              )}
              <p className="text-xs text-emerald-700 mt-1">{tx.savedBlurb}</p>
            </div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-bold text-slate-900">{tx.parsedReport}</h3>
              <div className="flex items-center gap-2">
                {result.aiVision?.usedAsPrimary && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                    {tx.aiVisionBadge}
                  </span>
                )}
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    (result.confidence || 0) >= 70
                      ? "bg-emerald-100 text-emerald-700"
                      : (result.confidence || 0) >= 50
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                  }`}
                >
                  {tx.confidence.replace("{count}", String(result.confidence || 0))}
                </span>
              </div>
            </div>
            {result.aiVision?.usedAsPrimary && (
              <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs text-purple-900">
                {tx.aiVisionBlurb}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-xs text-slate-500">{tx.fieldTestType}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.testType || result.testType || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{tx.fieldReportNumber}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.testReportNumber || result.reportNumber || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{tx.fieldLab}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.labName || result.labName || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{tx.fieldTestDate}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.testDate || result.testDate || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{tx.fieldMethod}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.testMethodStd || result.testMethodStd || "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">{tx.fieldWashCount}</span>
                <p className="font-medium text-slate-800">
                  {result.parsed?.washCount ?? result.washCount ?? "—"}
                </p>
              </div>
            </div>
            {(result.parsed?.confidence ?? result.confidence ?? 0) < 50 && (
              <p className="mt-3 text-xs text-amber-600">{tx.lowConfidence}</p>
            )}
          </div>
        )}
      </div>

      {/* Upload History — scoped to the caller's factory */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">{tx.yourUploads}</h2>
        {loadingUploads ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-400">{tx.noUploads}</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colStatus}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colFile}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colTest}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colBrand}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colFuzeRef}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colLab}
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs">
                    {tx.colAction}
                  </th>
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
                            title={tx.statusPendingTitle}
                          >
                            {tx.statusPending}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wide">
                            {tx.statusConfirmed}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-[260px]">
                        <p className="truncate font-medium">{u.filename || "—"}</p>
                        {u.reportNumber && (
                          <p className="text-xs font-mono text-slate-500">#{u.reportNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <p className="font-semibold">{u.testType || "—"}</p>
                        {u.washCount != null && (
                          <p className="text-slate-400">
                            {tx.washes.replace("{count}", String(u.washCount))}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {u.brand?.name ? (
                          <span className="font-semibold text-slate-700">{u.brand.name}</span>
                        ) : (
                          <span className="text-amber-600">{tx.unlinked}</span>
                        )}
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
                          <p className="text-slate-500">{u.customerFabricCode}</p>
                        )}
                        {u.factoryFabricCode && (
                          <p className="text-slate-400 text-[11px]">
                            {tx.factoryLabel.replace("{code}", u.factoryFabricCode)}
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
                            {tx.download}
                          </a>
                        ) : !linked ? (
                          <span className="text-amber-600">{tx.awaitingReview}</span>
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
          {tx.footerNote.split("{email}").map((part, i, arr) => (
            <span key={i}>
              {part}
              {i < arr.length - 1 && (
                <a href="mailto:andrew@fuze47.com" className="text-blue-600 underline">
                  andrew@fuze47.com
                </a>
              )}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
