"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import PortalActivityFeed from "@/components/PortalActivityFeed";
import { useI18n } from "@/i18n";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ONBOARDING_CHECKLISTS } from "@/lib/onboarding-checklists";
import ErrorPanel from "@/components/ErrorPanel";

interface Stats {
  // Inventory (the operations view Tina #P1 asked for — what's
  // actually in the warehouse and when it ran out last).
  stockLiters: number;
  stockBottles: number;
  reorderPointLiters: number;
  lowStock: boolean;
  lastShipmentDate: string | null;
  lastShipmentLiters: number | null;
  lastShipmentOrderNumber: string | null;
  last90DaysOutbound: number;
  dailyBurn: number;
  daysOfStockLeft: number | null;
  inventoryUpdatedAt: string | null;
  activeFactories: number;
  // Legacy CFO view kept for the bottom tile row.
  totalInvoices: number;
  unpaidInvoices: number;
  outstandingAmount: number;
  totalDocuments: number;
}

export default function DistributorPortalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const tx = t.distributorPortal.landing;
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  // Phase 15 silent-zero sweep — never render 0L / 0 factories when
  // the API call actually failed. Show an explicit retry banner.
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/distributor-portal/stats");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.ok === false || !data.stats) {
        setError(
          (data && (data.error || data.message)) ||
            `Couldn't load distributor stats (HTTP ${res.status}).`,
        );
        return;
      }
      setStats(data.stats);
    } catch (e: any) {
      setError(e?.message || "Network error while loading stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "DISTRIBUTOR_USER") {
      router.push("/dashboard");
      return;
    }
    loadStats();
  }, [user, router, loadStats]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  // Silent-zero sweep — if the stats fetch failed, render the header
  // and an explicit ErrorPanel with a retry button. Do NOT fall
  // through to the StatCards (they'd read from `stats!` and crash, or
  // worse, show zeros that mislead the user).
  if (error || !stats) {
    return (
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
            <span>{tx.crumb}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">{tx.heading}</h1>
          <p className="text-slate-600">{tx.subheading}</p>
        </div>
        <ErrorPanel
          context="Load distributor stats"
          error={error || "No stats payload returned."}
          onRetry={loadStats}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <OnboardingChecklist
        surface="distributor-portal"
        items={ONBOARDING_CHECKLISTS["distributor-portal"]}
      />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <span>{tx.crumb}</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-1">{tx.heading}</h1>
        <p className="text-slate-600">{tx.subheading}</p>
      </div>

      {/* ─── Inventory at a glance ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div
          className={`rounded-xl p-6 ${
            stats.lowStock
              ? "bg-red-50 border-2 border-red-300"
              : "bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className={`text-xs font-semibold mb-1 ${
                  stats.lowStock ? "text-red-700" : "text-white/80"
                }`}
              >
                {tx.stockOnHand}
              </p>
              <p
                className={`text-3xl font-black ${
                  stats.lowStock ? "text-red-700" : "text-white"
                }`}
              >
                {stats.stockLiters.toLocaleString()}L
              </p>
              <p
                className={`text-xs mt-1 ${
                  stats.lowStock ? "text-red-600" : "text-white/80"
                }`}
              >
                {stats.stockBottles.toLocaleString()} {tx.carboysSuffix}
                {stats.reorderPointLiters > 0 && (
                  <> · {tx.reorderAt} {stats.reorderPointLiters.toLocaleString()}L</>
                )}
              </p>
              {stats.lowStock && (
                <p className="text-xs text-red-700 font-semibold mt-1">
                  {tx.belowReorder}
                </p>
              )}
            </div>
            <span className="text-2xl">🧴</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                {tx.daysOfStockLeft}
              </p>
              <p className="text-3xl font-black text-slate-900">
                {stats.daysOfStockLeft != null
                  ? `${stats.daysOfStockLeft}`
                  : "—"}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {stats.dailyBurn > 0
                  ? tx.dailyBurnFmt.replace("{burn}", String(stats.dailyBurn))
                  : tx.noRecentShipments}
              </p>
            </div>
            <span className="text-2xl">⏳</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                {tx.lastShipmentIn}
              </p>
              {stats.lastShipmentDate ? (
                <>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.lastShipmentLiters?.toLocaleString()}L
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {new Date(stats.lastShipmentDate).toLocaleDateString()}
                    {stats.lastShipmentOrderNumber && (
                      <> · {stats.lastShipmentOrderNumber}</>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-400">{tx.noneYet}</p>
                  <Link
                    href="/distributor-portal/restock"
                    className="text-xs text-[#00b4c3] font-semibold hover:underline mt-1 inline-block"
                  >
                    {tx.placeRestockOrder}
                  </Link>
                </>
              )}
            </div>
            <span className="text-2xl">📦</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                {tx.outTheDoor}
              </p>
              <p className="text-3xl font-black text-slate-900">
                {stats.last90DaysOutbound.toLocaleString()}L
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {tx.shippedToFactories}
              </p>
            </div>
            <span className="text-2xl">🚚</span>
          </div>
        </div>
      </div>

      {/* Learn FUZE — quick link to the technology basics page */}
      <a
        href="/education"
        className="block mb-6 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-5 hover:border-indigo-400 hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">{tx.learnFuzeKicker}</div>
            <h3 className="text-base font-bold text-slate-900">{tx.learnFuzeTitle}</h3>
            <p className="text-xs text-slate-600 mt-1">{tx.learnFuzeBody}</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">{tx.learnFuzeCta}</span>
        </div>
      </a>

      {/* ─── Secondary: factories + invoices + docs (CFO view) ───── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-600">
            {tx.activeFactories}
          </p>
          <p className="text-xl font-black text-slate-900">
            {stats.activeFactories}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-600">
            {tx.invoices}
          </p>
          <p className="text-xl font-black text-slate-900">
            {stats.totalInvoices}
          </p>
        </div>
        <div
          className={`rounded-lg p-3 border ${
            stats.unpaidInvoices > 0
              ? "border-amber-300 bg-amber-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <p className="text-[10px] uppercase font-bold text-slate-600">
            {tx.outstanding}
          </p>
          <p
            className={`text-base font-black ${
              stats.unpaidInvoices > 0 ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {formatCurrency(stats.outstandingAmount)}
          </p>
          {stats.unpaidInvoices > 0 && (
            <p className="text-[10px] text-amber-600">
              {stats.unpaidInvoices} {tx.unpaidSuffix}
            </p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-600">
            {tx.documents}
          </p>
          <p className="text-xl font-black text-slate-900">
            {stats.totalDocuments}
          </p>
        </div>
      </div>

      {/* Phase 8A — universal activity feed before quick links. */}
      <PortalActivityFeed />

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/distributor-portal/restock"
          className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">{tx.restockTitle}</h3>
              <p className="text-sm text-white/80">{tx.restockBody}</p>
            </div>
            <span className="text-3xl">💧</span>
          </div>
          <div className="text-sm text-white/90 font-semibold">{tx.restockCta}</div>
        </Link>
        <Link
          href="/distributor-portal/inventory"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{tx.inventoryTitle}</h3>
              <p className="text-sm text-slate-600">{tx.inventoryBody}</p>
            </div>
            <span className="text-3xl">📦</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{tx.inventoryCta}</div>
        </Link>
        <Link
          href="/distributor-portal/documents"
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">{tx.docLibTitle}</h3>
              <p className="text-sm text-white/80">{tx.docLibBody}</p>
            </div>
            <span className="text-3xl">📂</span>
          </div>
          <div className="text-sm text-white/80">{tx.docLibCta}</div>
        </Link>
        <Link
          href="/distributor-portal/invoices"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{tx.invoicesTitle}</h3>
              <p className="text-sm text-slate-600">{tx.invoicesBody}</p>
            </div>
            <span className="text-3xl">📄</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{tx.invoicesCta}</div>
        </Link>
        <Link
          href="/distributor-portal/test-request"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{tx.testRequestTitle}</h3>
              <p className="text-sm text-slate-600">{tx.testRequestBody}</p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{tx.testRequestCta}</div>
        </Link>
        <Link
          href="/distributor-portal/test-reports"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{tx.testReportsTitle}</h3>
              <p className="text-sm text-slate-600">{tx.testReportsBody}</p>
            </div>
            <span className="text-3xl">🔬</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{tx.testReportsCta}</div>
        </Link>
        <Link
          href="/fabric-library"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{tx.fabricLibTitle}</h3>
              <p className="text-sm text-slate-600">{tx.fabricLibBody}</p>
            </div>
            <span className="text-3xl">📚</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">{tx.fabricLibCta}</div>
        </Link>
      </div>
    </div>
  );
}
