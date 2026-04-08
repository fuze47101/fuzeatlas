// @ts-nocheck
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Distributor {
  id: string;
  name: string;
  chineseName?: string;
  specialty?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: string;
  active: boolean;
  coverageCountries: string[];
  localCurrency?: string;
  notes?: string;
  stockLiters: number;
  stockKg: number;
  stockBottles: number;
  reorderThresholdLiters: number;
  lowStock: boolean;
  factoryCount: number;
  orderCount: number;
  invoiceCount: number;
  documentCount: number;
  totalLitersShipped: number;
  totalRevenue: number;
  factories: { id: string; name: string; country: string }[];
  contacts: { id: string; name: string; email?: string; phone?: string; title?: string }[];
  users: { id: string; name: string; email: string; role: string; active: boolean }[];
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  total: number;
  active: number;
  inactive: number;
  lowStock: number;
  totalStockLiters: number;
  totalRevenue: number;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  ONBOARDING: "bg-amber-100 text-amber-700",
};

export default function DistributorManagementPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/distributors")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setDistributors(j.distributors || []);
          setSummary(j.summary || null);
        } else {
          setError(j.error || "Failed to load");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = distributors.filter((d) => {
    const matchesSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.country || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.region || "").toLowerCase().includes(search.toLowerCase()) ||
      d.coverageCountries.some((c) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === "ALL" || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Distributor Network</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your global distribution partners, inventory, and coverage
          </p>
        </div>
        <Link
          href="/admin/worldwide-inventory"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
        >
          🌍 Worldwide Inventory
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard label="Total" value={summary.total} color="text-slate-700" />
          <SummaryCard label="Active" value={summary.active} color="text-emerald-600" />
          <SummaryCard label="Inactive" value={summary.inactive} color="text-slate-400" />
          <SummaryCard label="Low Stock" value={summary.lowStock} color="text-red-600" />
          <SummaryCard label="Total Stock (L)" value={summary.totalStockLiters.toLocaleString()} color="text-blue-600" />
          <SummaryCard label="Total Revenue" value={`$${(summary.totalRevenue / 1000).toFixed(1)}k`} color="text-purple-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, country, region, or coverage..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ONBOARDING">Onboarding</option>
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Showing {filtered.length} of {distributors.length} distributors
      </p>

      {/* Distributor List */}
      <div className="space-y-3">
        {filtered.map((d) => (
          <DistributorCard
            key={d.id}
            d={d}
            expanded={expanded === d.id}
            onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            No distributors match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function DistributorCard({
  d,
  expanded,
  onToggle,
}: {
  d: Distributor;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition"
      >
        {/* Name & region */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800 truncate">{d.name}</h3>
            {d.chineseName && <span className="text-xs text-slate-400">{d.chineseName}</span>}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[d.status] || "bg-slate-100 text-slate-500"}`}>
              {d.status}
            </span>
            {d.lowStock && d.active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                LOW STOCK
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
            {d.country && <span>📍 {d.city ? `${d.city}, ` : ""}{d.country}</span>}
            {d.region && <span className="text-slate-400">({d.region})</span>}
            {d.coverageCountries.length > 0 && (
              <span className="text-slate-400">
                Covers: {d.coverageCountries.slice(0, 4).join(", ")}
                {d.coverageCountries.length > 4 && ` +${d.coverageCountries.length - 4} more`}
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-6 text-center">
          <div>
            <p className="text-sm font-bold text-blue-600">{d.stockLiters.toLocaleString()}L</p>
            <p className="text-[9px] text-slate-400 uppercase">Stock</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-600">{d.factoryCount}</p>
            <p className="text-[9px] text-slate-400 uppercase">Factories</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-600">{d.orderCount}</p>
            <p className="text-[9px] text-slate-400 uppercase">Orders</p>
          </div>
          <div>
            <p className="text-sm font-bold text-purple-600">
              ${d.totalRevenue > 1000 ? `${(d.totalRevenue / 1000).toFixed(1)}k` : d.totalRevenue.toFixed(0)}
            </p>
            <p className="text-[9px] text-slate-400 uppercase">Revenue</p>
          </div>
        </div>

        {/* Expand arrow */}
        <span className="text-slate-400 text-lg">{expanded ? "▾" : "▸"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
          {/* Mobile stats */}
          <div className="sm:hidden grid grid-cols-4 gap-3 mb-4">
            <div className="text-center">
              <p className="text-sm font-bold text-blue-600">{d.stockLiters.toLocaleString()}L</p>
              <p className="text-[9px] text-slate-400">Stock</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600">{d.factoryCount}</p>
              <p className="text-[9px] text-slate-400">Factories</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-600">{d.orderCount}</p>
              <p className="text-[9px] text-slate-400">Orders</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-purple-600">${d.totalRevenue.toFixed(0)}</p>
              <p className="text-[9px] text-slate-400">Revenue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Contact & details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Contact Info</h4>
              {d.email && <p className="text-xs text-slate-600">✉️ {d.email}</p>}
              {d.phone && <p className="text-xs text-slate-600">📞 {d.phone}</p>}
              {d.website && (
                <p className="text-xs">
                  🌐{" "}
                  <a href={d.website.startsWith("http") ? d.website : `https://${d.website}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                    {d.website}
                  </a>
                </p>
              )}
              {d.address && <p className="text-xs text-slate-500">{d.address}</p>}
              {d.localCurrency && <p className="text-xs text-slate-500">Currency: {d.localCurrency}</p>}
              {d.specialty && <p className="text-xs text-slate-500">Specialty: {d.specialty}</p>}
            </div>

            {/* Inventory details */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Inventory</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2 border">
                  <p className="font-bold text-blue-600">{d.stockLiters.toLocaleString()} L</p>
                  <p className="text-slate-400">Liters</p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="font-bold text-slate-600">{d.stockKg.toFixed(2)} kg</p>
                  <p className="text-slate-400">Weight</p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className="font-bold text-slate-600">{d.stockBottles}</p>
                  <p className="text-slate-400">Bottles (19L)</p>
                </div>
                <div className="bg-white rounded-lg p-2 border">
                  <p className={`font-bold ${d.lowStock ? "text-red-600" : "text-emerald-600"}`}>
                    {d.reorderThresholdLiters} L
                  </p>
                  <p className="text-slate-400">Reorder At</p>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Shipped all-time: <span className="font-semibold">{d.totalLitersShipped.toLocaleString()} L</span>
              </div>
            </div>

            {/* Coverage & factories */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                Coverage ({d.coverageCountries.length} countries)
              </h4>
              {d.coverageCountries.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {d.coverageCountries.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No coverage countries set</p>
              )}

              {d.factories.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Factories ({d.factoryCount})
                  </h4>
                  <div className="space-y-1">
                    {d.factories.map((f) => (
                      <p key={f.id} className="text-xs text-slate-600">
                        {f.name} <span className="text-slate-400">({f.country || "—"})</span>
                      </p>
                    ))}
                    {d.factoryCount > 10 && (
                      <p className="text-xs text-slate-400">+{d.factoryCount - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contacts & Users */}
          {(d.contacts.length > 0 || d.users.length > 0) && (
            <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              {d.contacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Contacts</h4>
                  <div className="space-y-1">
                    {d.contacts.map((c) => (
                      <p key={c.id} className="text-xs text-slate-600">
                        {c.name}{c.title ? ` (${c.title})` : ""}{c.email ? ` — ${c.email}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {d.users.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Portal Users</h4>
                  <div className="space-y-1">
                    {d.users.map((u) => (
                      <p key={u.id} className="text-xs text-slate-600">
                        {u.name} — {u.email}{" "}
                        <span className={u.active ? "text-emerald-500" : "text-slate-400"}>
                          ({u.active ? "Active" : "Inactive"})
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {d.notes && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Notes</h4>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{d.notes}</p>
            </div>
          )}

          {/* Quick links */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-2">
            <Link
              href="/admin/worldwide-inventory"
              className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition"
            >
              View Inventory Details
            </Link>
            <Link
              href="/admin/orders"
              className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
            >
              View Orders
            </Link>
            <Link
              href={`/admin/distributor-docs`}
              className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
            >
              Documents
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
