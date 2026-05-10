"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface BrandSpec {
  id: string;
  name: string;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  protocolDocUrl: string | null;
  brandSpecUpdatedAt: string | null;
}

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

export default function LabSpecsPage() {
  const { t } = useI18n();
  const tx = t.labPortal.specs;
  const [brands, setBrands] = useState<BrandSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lab-portal/specs")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setBrands(j.brands || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/lab-portal" className="hover:text-[#00b4c3]">
            {t.labPortal.crumb}
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

      {brands.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">{tx.noBrands}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {brands.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-bold text-slate-900">{b.name}</h2>
                  {b.brandSpecUpdatedAt ? (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tx.lastUpdated.replace("{date}", formatDate(b.brandSpecUpdatedAt))}
                    </p>
                  ) : null}
                </div>
                {b.protocolDocUrl ? (
                  <a
                    href={b.protocolDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-indigo-50 px-2.5 py-1 ring-1 ring-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs"
                  >
                    {tx.protocolDoc}
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {b.requiredFuzeTier ? (
                  <span className="rounded-md bg-cyan-50 ring-1 ring-cyan-200 text-cyan-800 px-2.5 py-1 font-semibold">
                    {tx.tierLabel} {b.requiredFuzeTier}
                  </span>
                ) : (
                  <span className="rounded-md bg-slate-50 ring-1 ring-slate-200 text-slate-500 px-2.5 py-1">
                    {tx.tierNone}
                  </span>
                )}
                <div className="rounded-md bg-slate-50 ring-1 ring-slate-200 px-2.5 py-1">
                  <span className="font-semibold text-slate-700">{tx.cadenceHeader}:</span>{" "}
                  {b.icpCadenceEveryNBatches || b.icpCadenceEveryLitersConsumed ? (
                    <span className="text-slate-700">
                      {b.icpCadenceEveryNBatches
                        ? tx.cadenceEveryOrders.replace(
                            "{n}",
                            String(b.icpCadenceEveryNBatches),
                          )
                        : ""}
                      {b.icpCadenceEveryNBatches && b.icpCadenceEveryLitersConsumed ? " · " : ""}
                      {b.icpCadenceEveryLitersConsumed
                        ? tx.cadenceEveryLiters.replace(
                            "{n}",
                            String(b.icpCadenceEveryLitersConsumed),
                          )
                        : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400">{tx.cadenceNone}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
