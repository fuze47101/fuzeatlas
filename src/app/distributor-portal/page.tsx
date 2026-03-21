"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  totalInvoices: number;
  unpaidInvoices: number;
  outstandingAmount: number;
  totalDocuments: number;
  activeFactories: number;
}

export default function DistributorPortalPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalInvoices: 0, unpaidInvoices: 0, outstandingAmount: 0, totalDocuments: 0, activeFactories: 0,
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
        <p className="text-slate-600">Manage your FUZE distribution documents, invoices, and logistics</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Active Factories</p>
              <p className="text-3xl font-black text-slate-900">{stats.activeFactories}</p>
            </div>
            <span className="text-2xl">🏭</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total Invoices</p>
              <p className="text-3xl font-black text-slate-900">{stats.totalInvoices}</p>
            </div>
            <span className="text-2xl">📄</span>
          </div>
        </div>
        <div className={`bg-white border rounded-xl p-6 ${stats.unpaidInvoices > 0 ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Outstanding</p>
              <p className={`text-2xl font-black ${stats.unpaidInvoices > 0 ? "text-amber-700" : "text-slate-900"}`}>
                {formatCurrency(stats.outstandingAmount)}
              </p>
              {stats.unpaidInvoices > 0 && (
                <p className="text-xs text-amber-600 mt-1">{stats.unpaidInvoices} unpaid</p>
              )}
            </div>
            <span className="text-2xl">💰</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Documents</p>
              <p className="text-3xl font-black text-slate-900">{stats.totalDocuments}</p>
            </div>
            <span className="text-2xl">📋</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/distributor-portal/documents"
          className="bg-gradient-to-br from-[#00b4c3] to-[#009ba8] rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg mb-1">Document Library</h3>
              <p className="text-sm text-white/80">C of A, BOL, customs, import/export docs</p>
            </div>
            <span className="text-3xl">📂</span>
          </div>
          <div className="text-sm text-white/80">Browse all documents &rarr;</div>
        </Link>
        <Link href="/distributor-portal/invoices"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">Invoices</h3>
              <p className="text-sm text-slate-600">View and track payment status</p>
            </div>
            <span className="text-3xl">📄</span>
          </div>
          <div className="text-sm text-[#00b4c3] font-medium">View invoices &rarr;</div>
        </Link>
        <Link href="/fabric-library"
          className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#00b4c3] hover:shadow-lg transition-all">
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
