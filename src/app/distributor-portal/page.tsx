"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import PortalActivityFeed from "@/components/PortalActivityFeed";

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
  const [stats, setStats] = useState<Stats>({
    stockLiters: 0,
    stockBottles: 0,
    reorderPointLiters: 0,
    lowStock: false,
    lastShipmentDate: null,
    lastShipmentLiters: null,
    lastShipmentOrderNumber: null,
    last90DaysOutbound: 0,
    dailyBurn: 0,
    daysOfStockLeft: null,
    inventoryUpdatedAt: null,
    activeFactories: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    outstandingAmount: 0,
    totalDocuments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "DISTRIBUTOR_USER") {
      router.push("/dashboard");
      return;
    }

    const loadStats = async () => {
      try {
        const res = await fetch("/api/distributor-portal/stats");
        const data = await res.json();
        if (data.ok) setStats(data.stats);
      } catch (e) {
        console.error("Failed to load stats:", e);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <span>Distributor Portal</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-1">Welcome Back</h1>
        <p className="text-slate-600">
          Manage your FUZE distribution documents, invoices, and logistics
        </p>
      </div>

      {/* ─── Inventory at a glance ────────────────────────────────────
          Tina's #P1 review: what a distributor actually opens the
          portal to see is "what's in the warehouse and when do I run
          out". The old CFO/invoices tile row dropped below into a
          secondary section. */}
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
                FUZE Stock On Hand
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
                {stats.stockBottles.toLocaleString()} carboys
                {stats.reorderPointLiters > 0 && (
                  <> · reorder at {stats.reorderPointLiters.toLocaleString()}L</>
                )}
              </p>
              {stats.lowStock && (
                <p className="text-xs text-red-700 font-semibold mt-1">
                  ⚠ Below reorder point
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
                Days of Stock Left
              </p>
              <p className="text-3xl font-black text-slate-900">
                {stats.daysOfStockLeft != null
                  ? `${stats.daysOfStockLeft}`
                  : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {stats.dailyBurn > 0
                  ? `${stats.dailyBurn} L/day × 90-day avg`
                  : "no recent shipments"}
              </p>
            </div>
            <span className="text-2xl">⏳</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                Last Shipment In
              </p>
              {stats.lastShipmentDate ? (
                <>
                  <p className="text-2xl font-black text-slate-900">
                    {stats.lastShipmentLiters?.toLocaleString()}L
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(stats.lastShipmentDate).toLocaleDateString()}
                    {stats.lastShipmentOrderNumber && (
                      <> · {stats.lastShipmentOrderNumber}</>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-400">none yet</p>
                  <Link
                    href="/distributor-portal/restock"
                    className="text-xs text-[#00b4c3] font-semibold hover:underline mt-1 inline-block"
                  >
                    Place a restock order →
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
                Out the Door (90d)
              </p>
              <p className="text-3xl font-black text-slate-900">
                {stats.last90DaysOutbound.toLocaleString()}L
              </p>
              <p className="text-xs text-slate-500 mt-1">
                shipped to factories
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
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">Learn FUZE</div>
            <h3 className="text-base font-bold text-slate-900">FUZE Basics — for your sales conversations</h3>
            <p className="text-xs text-slate-600 mt-1">Dosage scale, ion-release vs contact-kill mechanism, the five tests, and how to position FUZE against silver-ion / zinc / QAC competitors in any factory or brand meeting.</p>
          </div>
          <span className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold">Read →</span>
        </div>
      </a>

      {/* ─── Secondary: factories + invoices + docs (CFO view) ───── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500">
            Active Factories
          </p>
          <p className="text-xl font-black text-slate-900">
            {stats.activeFactories}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500">
            Invoices
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
          <p className="text-[10px] uppercase font-bold text-slate-500">
            Outstanding
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
              {stats.unpaidInvoices} unpaid
            </p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-slate-500">
            Documents
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
              <h3 className="font-bold text-lg mb-1">Restock from FUZE</h3>
              <p className="text-sm text-white/80">
                Order carboys, gaylords, or containers direct from FUZE HQ
              </p>
            </div>
            <span className="text-3xl">💧</span>
          </div>
          <div className="text-sm text-white/90 font-semibold">Place new order &rarr;</div>
        </Link>
        <Link
          href="/distributor-portal/inventory"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Inventory & Pricing</h3>
              <p className="text-sm text-slate-600">Stock levels and factory pricing tiers</p>
            </div>
            <span className="text-3xl">📦</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">Manage inventory &rarr;</div>
        </Link>
        <Link
          href="/distributor-portal/documents"
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Document Library</h3>
              <p className="text-sm text-white/80">C of A, BOL, customs, import/export docs</p>
            </div>
            <span className="text-3xl">📂</span>
          </div>
          <div className="text-sm text-white/80">Browse all documents &rarr;</div>
        </Link>
        <Link
          href="/distributor-portal/invoices"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Invoices</h3>
              <p className="text-sm text-slate-600">View and track payment status</p>
            </div>
            <span className="text-3xl">📄</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">View invoices &rarr;</div>
        </Link>
        <Link
          href="/distributor-portal/test-request"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Apply for Test</h3>
              <p className="text-sm text-slate-600">
                Submit ICP / AM / other tests for your customers
              </p>
            </div>
            <span className="text-3xl">🧪</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">Start a request &rarr;</div>
        </Link>
        <Link
          href="/distributor-portal/test-reports"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Test Reports</h3>
              <p className="text-sm text-slate-600">
                Lab reports for the brands &amp; factories you serve
              </p>
            </div>
            <span className="text-3xl">🔬</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">View reports &rarr;</div>
        </Link>
        <Link
          href="/fabric-library"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">FUZE Fabric Library</h3>
              <p className="text-sm text-slate-600">Browse all tested fabrics</p>
            </div>
            <span className="text-3xl">📚</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">Explore fabrics &rarr;</div>
        </Link>
      </div>
    </div>
  );
}
