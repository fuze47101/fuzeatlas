// @ts-nocheck
"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";
import { useI18n } from "@/i18n";

interface UploadDoc {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  testRun?: {
    id: string;
    testType: string;
    reportNumber: string;
    testDate: string;
    washCount?: number;
    result?: string;
    status: string;
    lab?: { name: string };
    brand?: { name: string };
    factory?: { name: string };
    fabric?: { fuzeNumber?: number; customerCode?: string };
  };
}

interface Stats {
  totalUploads: number;
  linkedToTests: number;
  testTypes: Record<string, number>;
  brands: Record<string, number>;
}

export default function LabUploadsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.labPortal.uploadsPage;
  const [documents, setDocuments] = useState<UploadDoc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  // Silent-zero sweep — explicit retry banner instead of zeros.
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/lab-portal/uploads?limit=200");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false) {
        setLoadError(
          (data && (data.error || data.message)) ||
            `Couldn't load upload history (HTTP ${res.status}).`,
        );
        return;
      }
      setDocuments(data.documents || []);
      setStats(data.stats || null);
    } catch (e: any) {
      setLoadError(e?.message || "Network error while loading uploads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/lab-portal" className="hover:text-[#00b4c3]">
              {t.labPortal.crumb}
            </Link>
            <span>/</span>
            <span>{tx.crumbCurrent}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{tx.pageTitle}</h1>
          <p className="text-slate-500 text-sm mt-1">
            View all reports uploaded and verify their status
          </p>
        </div>
        <Link
          href="/lab-portal/upload"
          className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#009ba8] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Report
        </Link>
      </div>

      {loadError && (
        <div className="mb-4">
          <ErrorPanel context="Load lab uploads" error={loadError} onRetry={load} />
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-black text-slate-900">{stats.totalUploads}</p>
            <p className="text-xs text-slate-500 font-medium">Total Uploads</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-black text-emerald-600">{stats.linkedToTests}</p>
            <p className="text-xs text-slate-500 font-medium">Linked to Tests</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-black text-blue-600">
              {Object.keys(stats.testTypes).length}
            </p>
            <p className="text-xs text-slate-500 font-medium">Test Types</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-black text-purple-600">
              {Object.keys(stats.brands).length}
            </p>
            <p className="text-xs text-slate-500 font-medium">Brands Served</p>
          </div>
        </div>
      )}

      {/* Business breakdown */}
      {stats && Object.keys(stats.brands).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Reports by Brand</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.brands)
              .sort(([, a], [, b]) => b - a)
              .map(([brand, count]) => (
                <span
                  key={brand}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full"
                >
                  {brand}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Banner for orphan (unlinked) reports */}
      {documents.filter((d) => !d.testRun).length > 0 && (
        <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="font-bold text-amber-900 text-sm">
              {documents.filter((d) => !d.testRun).length} report
              {documents.filter((d) => !d.testRun).length === 1 ? "" : "s"} need
              {documents.filter((d) => !d.testRun).length === 1 ? "s" : ""} review
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              These reports were uploaded but haven&apos;t been saved to a test run yet. Click any
              row marked &ldquo;Pending Review&rdquo; below, or re-upload through the upload page to
              complete the link.
            </p>
          </div>
          <Link
            href="/lab-portal/upload"
            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 whitespace-nowrap"
          >
            Upload Page →
          </Link>
        </div>
      )}

      {/* Upload List */}
      {documents.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 text-lg mb-2">No uploads found</p>
          <p className="text-slate-400 text-sm mb-4">
            Upload your first test report to start tracking
          </p>
          <Link
            href="/lab-portal/upload"
            className="inline-block px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#009ba8]"
          >
            Upload Report
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  File
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Report #
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Test Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Brand / Factory
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Fabric
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Date Uploaded
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const linked = !!doc.testRun;
                const sizeKB = Math.round((doc.sizeBytes || 0) / 1024);

                return (
                  <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900 text-xs truncate max-w-[200px]">
                          {doc.filename}
                        </p>
                        <p className="text-[10px] text-slate-400">{sizeKB} KB</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-700">
                        {doc.testRun?.reportNumber || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {doc.testRun?.testType ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                          {doc.testRun.testType}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        {doc.testRun?.brand?.name && (
                          <p className="text-slate-900">{doc.testRun.brand.name}</p>
                        )}
                        {doc.testRun?.factory?.name && (
                          <p className="text-slate-500">{doc.testRun.factory.name}</p>
                        )}
                        {!doc.testRun?.brand?.name && !doc.testRun?.factory?.name && (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {doc.testRun?.fabric ? (
                        <span className="text-xs text-slate-700">
                          FUZE-{doc.testRun.fabric.fuzeNumber || "—"}
                          {doc.testRun.fabric.customerCode
                            ? ` (${doc.testRun.fabric.customerCode})`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {new Date(doc.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {linked ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Linked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete "${doc.filename}"?\n\n` +
                                (linked
                                  ? "This is linked to a test run — server will refuse and explain why.\n\n"
                                  : "Cannot be undone. ") +
                                "Use this for duplicate uploads of the same report.",
                            )
                          )
                            return;
                          try {
                            const res = await fetch(`/api/documents/${doc.id}`, {
                              method: "DELETE",
                            });
                            const j = await res.json();
                            if (!res.ok || !j.ok) {
                              alert(`Delete failed: ${j.error || res.status}`);
                              return;
                            }
                            // Optimistic remove
                            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                          } catch (e: any) {
                            alert(`Delete failed: ${e?.message || "network error"}`);
                          }
                        }}
                        className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded font-bold border border-red-200"
                        title={
                          linked
                            ? "Linked to test run — admin must delete the test first"
                            : "Delete this duplicate upload"
                        }
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
