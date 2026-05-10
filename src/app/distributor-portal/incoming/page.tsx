"use client";

/**
 * /distributor-portal/incoming — Phase 4F.
 *
 * Pending factory orders pointed at the caller's distributor with
 * application-validation flags surfaced inline. Distributor can
 * scan the row, see why it was flagged, and decide whether to
 * fulfill.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  volumeLiters: number | null;
  bottles: number | null;
  fuzeTier: string | null;
  fabricMassKg: number | null;
  createdAt: string;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string; country: string | null } | null;
  validation: {
    severity: "info" | "warn" | "error";
    messages: string[];
    expectedLiters: number | null;
    actualLiters: number | null;
  } | null;
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

export default function DistributorIncomingPage() {
  const { t } = useI18n();
  const tx = t.distributorPortal.incoming;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/distributor-portal/incoming")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Failed to load");
        setOrders(j.orders || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  const flaggedCount = orders.filter((o) => o.validation && o.validation.severity !== "info").length;

  return (
    <div className="max-w-[1300px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            {t.distributorPortal.crumb}
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

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-slate-900">{orders.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statTotal}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{flaggedCount}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statFlagged}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">{tx.noOrders}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colOrder}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFactory}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colBrand}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colVolume}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colTier}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colStatus}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFlag}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colCreated}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const sev = o.validation?.severity;
                  const pillStyle =
                    sev === "error"
                      ? "bg-red-100 text-red-700"
                      : sev === "warn"
                        ? "bg-amber-100 text-amber-700"
                        : sev === "info"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700";
                  const pillLabel =
                    sev === "error"
                      ? tx.validationError
                      : sev === "warn"
                        ? tx.validationWarn
                        : sev === "info"
                          ? tx.validationInfo
                          : tx.validationOk;
                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-slate-50 ${
                        sev === "error" ? "bg-red-50/40" : sev === "warn" ? "bg-amber-50/40" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[#00b4c3]">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {o.factory?.name || "—"}
                        {o.factory?.country ? (
                          <span className="ml-1 text-xs text-slate-400">{o.factory.country}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{o.brand?.name || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {o.volumeLiters !== null ? `${o.volumeLiters}L` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{o.fuzeTier || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${pillStyle}`}>
                            {pillLabel}
                          </span>
                          {o.validation && o.validation.expectedLiters !== null ? (
                            <p className="text-[11px] text-slate-500 mt-1">
                              {tx.flagDetail
                                .replace(
                                  "{expected}",
                                  o.validation.expectedLiters.toFixed(1),
                                )
                                .replace(
                                  "{actual}",
                                  (o.validation.actualLiters ?? 0).toFixed(1),
                                )}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(o.createdAt)}</td>
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
