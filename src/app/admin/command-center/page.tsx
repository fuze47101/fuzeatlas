"use client";

/**
 * /admin/command-center — Phase 8C.
 *
 * FUZE-Ops at-a-glance page. Calls /api/admin/command-center on
 * mount and every 30 seconds. Six metric tiles, brand × factory
 * health matrix, recent activity feed, distributor low-stock
 * alerts, and brand-pending approval queues.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface CommandCenter {
  metrics: {
    activeBrands: number;
    shippingFactories: number;
    testingLabs: number;
    lowStockDistributors: number;
    pendingApprovals: number;
    overdueCadences: number;
  };
  brandFactoryMatrix: Array<{
    brandId: string;
    brandName: string;
    factoryId: string;
    factoryName: string;
    lastSubmissionAt: string | null;
    lastIcpAt: string | null;
    cadenceOverdue: boolean;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    message: string | null;
    link: string | null;
    createdAt: string;
  }>;
  distributorAlerts: Array<{
    distributorId: string;
    name: string;
    country: string | null;
    onHandLiters: number;
    reorderPointLiters: number;
  }>;
  approvalQueues: Array<{ brandId: string; brandName: string; pending: number }>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "—";
  }
}

export default function CommandCenterPage() {
  const { t } = useI18n();
  const tx = t.admin.commandCenter;
  const [data, setData] = useState<CommandCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const j = await fetch("/api/admin/command-center").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setData(j as CommandCenter);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const handle = setInterval(load, 30_000);
    return () => clearInterval(handle);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">{error}</div>
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Tile n={data.metrics.activeBrands} label={tx.mActiveBrands} accent="text-[#00b4c3]" />
        <Tile n={data.metrics.shippingFactories} label={tx.mShippingFactories} accent="text-emerald-600" />
        <Tile n={data.metrics.testingLabs} label={tx.mTestingLabs} accent="text-blue-600" />
        <Tile
          n={data.metrics.lowStockDistributors}
          label={tx.mLowStock}
          accent={data.metrics.lowStockDistributors > 0 ? "text-red-600" : "text-slate-400"}
        />
        <Tile
          n={data.metrics.pendingApprovals}
          label={tx.mPendingApprovals}
          accent={data.metrics.pendingApprovals > 0 ? "text-amber-600" : "text-slate-400"}
        />
        <Tile
          n={data.metrics.overdueCadences}
          label={tx.mOverdueCadences}
          accent={data.metrics.overdueCadences > 0 ? "text-red-600" : "text-slate-400"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Brand × Factory matrix */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b bg-slate-50">
            <h2 className="font-bold text-slate-900 text-sm">{tx.matrixHeader}</h2>
            <p className="text-xs text-slate-500">{tx.matrixHint}</p>
          </div>
          {data.brandFactoryMatrix.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-10">{tx.noOverdue}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white text-xs uppercase tracking-wider text-slate-500 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-bold">{tx.colBrand}</th>
                    <th className="text-left px-4 py-2 font-bold">{tx.colFactory}</th>
                    <th className="text-left px-4 py-2 font-bold">{tx.colLastSubmission}</th>
                    <th className="text-left px-4 py-2 font-bold">{tx.colLastIcp}</th>
                    <th className="text-left px-4 py-2 font-bold">{tx.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.brandFactoryMatrix.map((m) => (
                    <tr
                      key={`${m.brandId}|${m.factoryId}`}
                      className={m.cadenceOverdue ? "bg-red-50/50" : "hover:bg-slate-50"}
                    >
                      <td className="px-4 py-2 font-semibold text-slate-900">{m.brandName}</td>
                      <td className="px-4 py-2 text-slate-700">{m.factoryName}</td>
                      <td className="px-4 py-2 text-slate-600">{formatDate(m.lastSubmissionAt)}</td>
                      <td className="px-4 py-2 text-slate-600">{formatDate(m.lastIcpAt)}</td>
                      <td className="px-4 py-2">
                        {m.cadenceOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700">
                            {tx.matrixOverdue}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                            {tx.matrixOk}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar — activity + alerts + approvals */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="font-bold text-slate-900 text-sm">{tx.activityHeader}</h2>
            </div>
            {data.recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">{tx.noActivity}</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {data.recentActivity.slice(0, 12).map((a) => (
                  <li key={a.id} className="px-5 py-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">{a.title}</p>
                    <p className="text-[11px] text-slate-400">{formatDate(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="font-bold text-slate-900 text-sm">{tx.distributorsHeader}</h2>
            </div>
            {data.distributorAlerts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">{tx.noLowStock}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.distributorAlerts.map((d) => (
                  <li key={d.distributorId} className="px-5 py-2">
                    <p className="text-xs font-bold text-slate-900">{d.name}</p>
                    <p className="text-[11px] text-red-700">
                      {d.onHandLiters} L on hand · reorder at {d.reorderPointLiters} L
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h2 className="font-bold text-slate-900 text-sm">{tx.approvalsHeader}</h2>
            </div>
            {data.approvalQueues.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">{tx.noPendingApprovals}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.approvalQueues.map((q) => (
                  <li key={q.brandId} className="px-5 py-2 flex items-center justify-between">
                    <Link
                      href={`/admin/brands/${q.brandId}/approvals`}
                      className="text-xs font-bold text-slate-900 hover:text-[#00b4c3]"
                    >
                      {q.brandName}
                    </Link>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                      {q.pending}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ n, label, accent }: { n: number; label: string; accent: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <div className={`text-2xl font-black ${accent}`}>{n}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
