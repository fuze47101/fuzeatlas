"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  paidDate?: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  factory?: { id: string; name: string; country?: string };
  brand?: { id: string; name: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function DistributorInvoicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (user?.role !== "DISTRIBUTOR_USER") {
      router.push("/dashboard");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/distributor-portal/invoices?${params.toString()}`);
        const data = await res.json();
        if (data.ok) setInvoices(data.invoices);
        else setError(data.error);
      } catch {
        setError("Failed to load invoices");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, router, statusFilter]);

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  const totalOutstanding = invoices
    .filter(i => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/distributor-portal" className="hover:text-[#00b4c3]">Distributor Portal</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Invoices</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
            {totalOutstanding > 0 && (
              <> &middot; <span className="text-amber-600 font-semibold">{formatCurrency(totalOutstanding, "USD")} outstanding</span></>
            )}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[160px] focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
        >
          <option value="">All Statuses</option>
          <option value="SENT">Sent (Unpaid)</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PAID">Paid</option>
          <option value="DRAFT">Draft</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">{statusFilter ? "No invoices match this filter" : "No invoices yet"}</p>
          {statusFilter && (
            <button onClick={() => setStatusFilter("")}
              className="text-[#00b4c3] hover:underline font-medium text-sm mt-2">
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Factory</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-slate-800">{inv.invoiceNumber}</span>
                    {inv.description && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{inv.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(inv.invoiceDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                    {inv.factory?.name || "—"}
                    {inv.factory?.country && <span className="text-xs text-slate-400 ml-1">({inv.factory.country})</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(inv.amount, inv.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[inv.status] || "bg-slate-100 text-slate-600"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                    {inv.paidDate
                      ? <span className="text-emerald-600">Paid {new Date(inv.paidDate).toLocaleDateString()}</span>
                      : inv.dueDate
                        ? <span className={new Date(inv.dueDate) < new Date() ? "text-red-600 font-semibold" : ""}>
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                        : "—"
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
