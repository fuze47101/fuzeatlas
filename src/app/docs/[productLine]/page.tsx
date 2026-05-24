"use client";

/**
 * /docs/[productLine] — Phase 6C public docs page.
 *
 * Anonymous (no auth). Surfaces audience=PUBLIC documents filtered
 * by the product line in the URL (F1 / F2 / F3 / F4).
 *
 * Middleware exempts /docs/ + /api/docs/public so this renders
 * without a session.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";

interface Doc {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  version: string | null;
  effectiveDate: string | null;
  category: string;
  productLine: string | null;
  updatedAt: string;
}

const VALID_LINES = ["F1", "F2", "F3", "F4"];

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

export default function PublicProductLineDocsPage() {
  const params = useParams<{ productLine: string }>();
  const raw = params?.productLine || "";
  const productLine = raw.toUpperCase();
  const { t } = useI18n();
  const T = t.productLineDocs;

  const CATEGORY_LABELS: Record<string, string> = {
    tds_sds: T.catTdsSds,
    toxicology: T.catToxicology,
    pricing: T.catPricing,
    sustainability: T.catSustainability,
    education: T.catEducation,
    claims_compliance: T.catClaimsCompliance,
    application_guide: T.catApplicationGuide,
    case_study: T.catCaseStudy,
  };

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const valid = VALID_LINES.includes(productLine);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    fetch(`/api/docs/public?productLine=${encodeURIComponent(productLine)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || T.errLoadFailed);
        setDocs(j.docs || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productLine, valid, T.errLoadFailed]);

  if (!valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{T.unknownLineTitle}</h1>
          <p className="text-slate-600 mb-4">
            {T.unknownLineBody}
          </p>
          <div className="flex gap-2 justify-center">
            {VALID_LINES.map((l) => (
              <Link
                key={l}
                href={`/docs/${l}`}
                className="px-4 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8]"
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Group docs by category for the section layout.
  const grouped = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = grouped.get(d.category) || [];
    arr.push(d);
    grouped.set(d.category, arr);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-br from-slate-900 to-emerald-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-emerald-300 font-bold uppercase tracking-wider mb-3">
            <span>{T.crumbApp}</span>
            <span>›</span>
            <span>{T.crumbPublicDocs}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-2">{T.headerPrefix} {productLine}</h1>
          <p className="text-base text-slate-300 max-w-2xl">
            {T.headerLeadBefore} {productLine} {T.headerLeadAfter}
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            {VALID_LINES.map((l) => (
              <Link
                key={l}
                href={`/docs/${l}`}
                className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${
                  l === productLine
                    ? "bg-white text-emerald-900"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">{T.loading}</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <p className="text-sm text-slate-500">
              {T.emptyBefore} {productLine} {T.emptyAfter}
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8]"
            >
              {T.loginCta}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([category, list]) => (
              <section key={category}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {list.map((d) => (
                      <li
                        key={d.id}
                        className="px-5 py-4 flex items-start justify-between gap-3 hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{d.title}</div>
                          {d.description ? (
                            <p className="text-sm text-slate-600 mt-1">{d.description}</p>
                          ) : null}
                          <div className="text-xs text-slate-400 mt-1">
                            {d.version ? `${T.versionPrefix} ${d.version} · ` : ""}
                            {formatDate(d.effectiveDate)}
                          </div>
                        </div>
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-4 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8]"
                        >
                          {T.downloadBtn}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        {T.footerCompany}
      </footer>
    </div>
  );
}
