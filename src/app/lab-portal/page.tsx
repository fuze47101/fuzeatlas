"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

export default function LabPortalDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const tx = t.labPortal.landing;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lab-portal")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  if (!data)
    return (
      <div className="flex items-center justify-center h-64 text-red-400">{tx.unableToLoad}</div>
    );

  const { lab, stats, testRequests } = data;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tx.pageSubtitle.replace("{lab}", lab.name)}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-[#00b4c3]">{stats.totalServices}</div>
          <div className="text-xs text-slate-500">{tx.statTotalServices}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-amber-500">{stats.pendingRequests}</div>
          <div className="text-xs text-slate-500">{tx.statPendingRequests}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-blue-600">{stats.activeRequests}</div>
          <div className="text-xs text-slate-500">{tx.statActiveRequests}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.completedRequests}</div>
          <div className="text-xs text-slate-500">{tx.statCompletedRequests}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border text-center">
          <div className="text-2xl font-black text-slate-700">{stats.totalTestRuns}</div>
          <div className="text-xs text-slate-500">{tx.statTotalTestRuns}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          {
            href: "/lab-portal/upload",
            icon: "📤",
            label: tx.quickUploadLabel,
            desc: tx.quickUploadDesc,
          },
          {
            href: "/lab-portal/uploads",
            icon: "📋",
            label: tx.quickUploadsLabel,
            desc: tx.quickUploadsDesc,
          },
          {
            href: "/lab-portal/catalog",
            icon: "🧪",
            label: tx.quickCatalogLabel,
            desc: tx.quickCatalogDesc,
          },
          {
            href: "/lab-portal/requests",
            icon: "📬",
            label: tx.quickRequestsLabel,
            desc: tx.quickRequestsDescPending.replace("{count}", String(stats.pendingRequests)),
          },
          {
            href: "/lab-portal/forms",
            icon: "📄",
            label: tx.quickFormsLabel,
            desc: tx.quickFormsDesc,
          },
          {
            href: "/lab-portal/profile",
            icon: "🏢",
            label: tx.quickProfileLabel,
            desc: tx.quickProfileDesc,
          },
        ].map((card) => (
          <button
            key={card.href}
            onClick={() => router.push(card.href)}
            className="bg-white rounded-xl border border-slate-200 hover:border-[#00b4c3] hover:shadow-md transition-all p-5 text-left"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <div className="font-bold text-slate-900 text-sm">{card.label}</div>
            <div className="text-xs text-slate-500 mt-1">{card.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900">{tx.recentRequestsHeader}</h2>
        </div>
        {testRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">{tx.noRequests}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b">
                <th className="px-5 py-3">{tx.colPoNumber}</th>
                <th className="px-5 py-3">{tx.colBrand}</th>
                <th className="px-5 py-3">{tx.colFabric}</th>
                <th className="px-5 py-3">{tx.colTests}</th>
                <th className="px-5 py-3">{tx.colStatus}</th>
                <th className="px-5 py-3 text-right">{tx.colEstCost}</th>
              </tr>
            </thead>
            <tbody>
              {testRequests.slice(0, 10).map((r: any) => {
                const count = r.lines?.length || 0;
                return (
                  <tr
                    key={r.id}
                    className="border-t border-slate-100 hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono font-bold text-[#00b4c3] text-xs">
                      {r.poNumber}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{r.brand?.name || "—"}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {r.fabric ? `FUZE ${r.fabric.fuzeNumber}` : "—"}
                      {r.fabric?.construction && (
                        <span className="text-slate-400 ml-1">({r.fabric.construction})</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {(count === 1 ? tx.testsCountSingular : tx.testsCountPlural).replace(
                        "{count}",
                        String(count),
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "COMPLETE"
                            ? "bg-green-100 text-green-700"
                            : r.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-700"
                              : r.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {r.estimatedCost ? `$${r.estimatedCost}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
