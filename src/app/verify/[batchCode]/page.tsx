// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";

/**
 * Batch QR destination — auth-gated.
 * Factory floor, distributor warehouse, brand QA — any Atlas user
 * can scan and verify. Scans are logged for traceability.
 */

const DOC_META: Record<string, { label: string; icon: string; desc: string }> = {
  TDS: { label: "Technical Data Sheet", icon: "📘", desc: "Product specifications, properties, application guidance" },
  SDS: { label: "Safety Data Sheet", icon: "📕", desc: "Chemical safety, handling, storage, emergency info" },
  PRODUCT_SPEC: { label: "Product Specification", icon: "📗", desc: "Detailed product profile" },
};

export default function VerifyBatchPage() {
  const { batchCode } = useParams<{ batchCode: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const T = t.verifyBatch;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authNeeded, setAuthNeeded] = useState(false);

  useEffect(() => {
    fetch(`/api/verify/batch/${batchCode}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok && d.needsAuth) {
          setAuthNeeded(true);
        } else if (d.ok) {
          setData(d);
        }
      })
      .finally(() => setLoading(false));
  }, [batchCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authNeeded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#00b4c3]/10 flex items-center justify-center text-3xl mb-4">🔒</div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">{T.authRequired}</h1>
          <p className="text-slate-600 mb-6">
            {T.authBatchPrefix} <span className="font-mono font-bold text-slate-900">{batchCode}</span> {T.authBlurb}
          </p>
          <Link
            href={`/login?redirect=/verify/${batchCode}`}
            className="inline-block w-full px-5 py-3 bg-[#00b4c3] text-white font-bold rounded-lg hover:bg-[#009aa8]"
          >
            {T.loginCta}
          </Link>
          <p className="text-xs text-slate-500 mt-4">
            {T.noAccountQuestion} <a href="mailto:andrew@fuze47.com" className="text-[#00b4c3]">andrew@fuze47.com</a>
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">{T.notFoundTitle}</h1>
          <p className="text-slate-600 mt-2">{T.notFoundBlurb} {batchCode}.</p>
          <Link href="/home" className="text-[#00b4c3] font-semibold mt-4 inline-block">{T.returnHome}</Link>
        </div>
      </div>
    );
  }

  const { batch, productDocs } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0f172a] to-[#1e3a5f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#00b4c3] flex items-center justify-center text-xl font-black">F</div>
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">{T.productionLocation}</p>
              <p className="text-sm text-white/80">{T.batchVerification}</p>
            </div>
          </div>
          <h1 className="text-3xl font-black mt-4 font-mono">{batch.batchCode}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {batch.qcPassed ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-100 border border-emerald-400/30">
                {T.qcPassed}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-100 border border-red-400/30">
                {T.qcFailed}
              </span>
            )}
            <span className="text-white/70 text-sm">
              {T.produced} {new Date(batch.productionDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Batch Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg text-slate-900 mb-4">{T.batchDetails}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">{T.volumeProduced}</p>
              <p className="font-bold text-slate-900 text-lg">{batch.volumeProducedLiters.toLocaleString()}L</p>
            </div>
            {batch.bottlesFilled && (
              <div>
                <p className="text-slate-500">{T.bottlesFilled}</p>
                <p className="font-bold text-slate-900 text-lg">{batch.bottlesFilled} × 19L</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">{T.concentration}</p>
              <p className="font-bold text-slate-900">{batch.concentrationMgPerL} {T.fuzeMetamaterial}</p>
            </div>
            <div>
              <p className="text-slate-500">{T.productionDate}</p>
              <p className="font-bold text-slate-900">
                {new Date(batch.productionDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
          {batch.notes && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">{T.batchNotes}</p>
              <p className="text-sm text-slate-700">{batch.notes}</p>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-lg text-slate-900 mb-4">{T.documents}</h2>
          <div className="space-y-3">
            {/* Batch-specific COA */}
            {batch.coaDocUrl ? (
              <a
                href={batch.coaDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#00b4c3] bg-cyan-50/30 hover:bg-cyan-50 transition-colors"
              >
                <span className="text-3xl">📜</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{T.coaTitle}</p>
                  <p className="text-xs text-slate-600">{T.coaDescPrefix} {batch.coaUploadedAt && new Date(batch.coaUploadedAt).toLocaleDateString()}</p>
                </div>
                <span className="text-[#00b4c3] font-bold">{T.view}</span>
              </a>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-3xl opacity-50">📜</span>
                <div className="flex-1">
                  <p className="font-bold text-amber-900">{T.coaPending}</p>
                  <p className="text-xs text-amber-700">{T.coaPendingBlurb}</p>
                </div>
              </div>
            )}

            {/* Product-wide docs */}
            {productDocs.map((doc: any) => {
              const meta = DOC_META[doc.docType] || { label: doc.title, icon: "📄", desc: "" };
              return (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-[#00b4c3] hover:bg-slate-50 transition-colors"
                >
                  <span className="text-3xl">{meta.icon}</span>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">{meta.label}{doc.version && <span className="text-xs text-slate-500 ml-2">{doc.version}</span>}</p>
                    <p className="text-xs text-slate-600">{meta.desc}</p>
                  </div>
                  <span className="text-slate-400">→</span>
                </a>
              );
            })}

            {productDocs.length === 0 && (
              <p className="text-sm text-slate-500 italic">{T.docsEmpty}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          <p>{T.footerAddress}</p>
          <p className="mt-1">
            {T.footerQuestions} <a href="mailto:andrew@fuze47.com" className="text-[#00b4c3]">andrew@fuze47.com</a>
            {" · "}
            <Link href="/home" className="text-[#00b4c3]">{T.footerReturnAtlas}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
