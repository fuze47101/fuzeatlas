"use client";

/**
 * Shared library view for the four portal /library pages
 * (Phase 6B). Each portal wrapper passes its crumb context;
 * everything else (data fetch, filtering, table render) is here.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Doc {
  id: string;
  docType: string;
  title: string;
  description: string | null;
  fileUrl: string;
  version: string | null;
  effectiveDate: string | null;
  category: string;
  audience: string[];
  productLine: string | null;
  uploadedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LibraryViewProps {
  /** Top-level breadcrumb anchor — e.g. "Brand Portal" with href="/brand-portal". */
  crumbLabel: string;
  crumbHref: string;
}

const CATEGORY_LABELS: Record<string, keyof ReturnType<typeof useI18n>["t"]["library"]> = {
  tds_sds: "catTdsSds",
  toxicology: "catToxicology",
  pricing: "catPricing",
  sustainability: "catSustainability",
  education: "catEducation",
  claims_compliance: "catClaimsCompliance",
  application_guide: "catApplicationGuide",
  case_study: "catCaseStudy",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function LibraryView({ crumbLabel, crumbHref }: LibraryViewProps) {
  const { t } = useI18n();
  const tx = t.library;

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string>("all");

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setDocs(j.docs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  // Compute available categories for the tab strip — only show
  // categories that actually have docs in the result set.
  const presentCategories = Array.from(new Set(docs.map((d) => d.category)));
  const filtered = activeCat === "all" ? docs : docs.filter((d) => d.category === activeCat);

  return (
    <div className="max-w-[1200px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href={crumbHref} className="hover:text-[#00b4c3]">
            {crumbLabel}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {presentCategories.length > 0 ? (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveCat("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
              activeCat === "all"
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tx.catAll} ({docs.length})
          </button>
          {presentCategories.map((c) => {
            const labelKey = CATEGORY_LABELS[c] || "catAll";
            const count = docs.filter((d) => d.category === c).length;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap ${
                  activeCat === c
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {(tx as any)[labelKey] || c} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">{tx.noDocs}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colTitle}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colCategory}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colVersion}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colEffective}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colDownload}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => {
                  const labelKey = CATEGORY_LABELS[d.category] || "catAll";
                  const catLabel = (tx as any)[labelKey] || d.category;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{d.title}</div>
                        {d.description ? (
                          <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>
                        ) : null}
                        {d.productLine ? (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            FUZE {d.productLine}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{catLabel}</td>
                      <td className="px-4 py-3 text-slate-600">{d.version || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(d.effectiveDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-[#00b4c3] hover:underline"
                        >
                          {tx.download}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
