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
  // FUZE wholesale pricing for restock-from-FUZE flow. Without this set,
  // Distributor.fuzeRestockPricePerLiter is null and the restock POST
  // returns "No FUZE pricing set" — Tina's #3 blocker.
  fuzeRestockPricePerLiter?: number | null;
  fuzeRestockCurrency?: string | null;
  fuzeRestockNotes?: string | null;
  // Master / sub hierarchy
  parentDistributorId?: string | null;
  subDistributorPricePerLiter?: number | null;
  subDistributorCurrency?: string | null;
  subDistributorNotes?: string | null;
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
  // Inline create modal state — Tina's request to add distributors
  // without leaving the network page.
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    country: "",
    region: "",
    city: "",
    coverageCountries: "",
    localCurrency: "",
    specialty: "",
    notes: "",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
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
        <div className="flex items-center gap-2">
          <Link
            href="/admin/distributors/inventory"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition"
          >
            📊 Inventory & Burn Rate
          </Link>
          <Link
            href="/admin/worldwide-inventory"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            🌍 Worldwide Inventory
          </Link>
          <button
            onClick={() => {
              setShowCreate(true);
              setCreateError(null);
              setCreateSuccess(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition"
          >
            + New Distributor
          </button>
        </div>
      </div>

      {/* Create distributor modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900">New distributor</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {createError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {createError}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!createForm.name.trim()) {
                  setCreateError("Name is required");
                  return;
                }
                setCreating(true);
                setCreateError(null);
                try {
                  const res = await fetch("/api/admin/distributors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(createForm),
                  });
                  const j = await res.json();
                  if (!res.ok || !j.ok) {
                    setCreateError(j.error || `HTTP ${res.status}`);
                    return;
                  }
                  setCreateSuccess(`Created "${j.distributor.name}"`);
                  setCreateForm({
                    name: "",
                    country: "",
                    region: "",
                    city: "",
                    coverageCountries: "",
                    localCurrency: "",
                    specialty: "",
                    notes: "",
                  });
                  setShowCreate(false);
                  // Force reload of the list
                  window.location.reload();
                } catch (e: any) {
                  setCreateError(e?.message || "Network error");
                } finally {
                  setCreating(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder='e.g. "Tina Test Distributor"'
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={createForm.country}
                    onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="USA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Region</label>
                  <select
                    value={createForm.region}
                    onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                  >
                    <option value="">— pick —</option>
                    <option value="North America">North America</option>
                    <option value="Latin America">Latin America</option>
                    <option value="Europe">Europe</option>
                    <option value="Middle East">Middle East</option>
                    <option value="South Asia">South Asia</option>
                    <option value="East Asia">East Asia</option>
                    <option value="Southeast Asia">Southeast Asia</option>
                    <option value="Africa">Africa</option>
                    <option value="Oceania">Oceania</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="Salt Lake City"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Local currency</label>
                  <input
                    type="text"
                    value={createForm.localCurrency}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, localCurrency: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="USD"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Coverage countries <span className="text-slate-400 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={createForm.coverageCountries}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, coverageCountries: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder="USA, Canada, Mexico"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specialty <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={createForm.specialty}
                  onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder="Activewear / Home textiles / etc."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  placeholder="Test distributor for QA, etc."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating || !createForm.name.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-sm disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create distributor"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-sm"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                After creation, head to /admin/users to assign this distributor to a
                user account (sets DISTRIBUTOR_USER role + distributorId), or use
                "View As" to test the distributor portal flow.
              </p>
            </form>
          </div>
        </div>
      )}

      {createSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-800">
          ✓ {createSuccess}
        </div>
      )}

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
            allDistributors={distributors}
            expanded={expanded === d.id}
            onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
            onUpdate={() => {
              fetch("/api/admin/distributors")
                .then((r) => r.json())
                .then((j) => { if (j.ok) { setDistributors(j.distributors || []); setSummary(j.summary || null); } });
            }}
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
  allDistributors,
  expanded,
  onToggle,
  onUpdate,
}: {
  d: Distributor;
  allDistributors: Distributor[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [form, setForm] = useState({
    name: d.name,
    chineseName: d.chineseName || "",
    country: d.country || "",
    region: d.region || "",
    city: d.city || "",
    address: d.address || "",
    email: d.email || "",
    phone: d.phone || "",
    website: d.website || "",
    localCurrency: d.localCurrency || "",
    coverageCountries: d.coverageCountries.join(", "),
    status: d.status,
    notes: d.notes || "",
    // FUZE wholesale (restock-from-FUZE) — Tina's #3 blocker. Stored as
    // string in form state so empty input clears the price cleanly.
    fuzeRestockPricePerLiter:
      d.fuzeRestockPricePerLiter != null
        ? String(d.fuzeRestockPricePerLiter)
        : "",
    fuzeRestockCurrency: d.fuzeRestockCurrency || "USD",
    fuzeRestockNotes: d.fuzeRestockNotes || "",
    // Master/sub hierarchy
    parentDistributorId: d.parentDistributorId || "",
    subDistributorPricePerLiter:
      d.subDistributorPricePerLiter != null
        ? String(d.subDistributorPricePerLiter)
        : "",
    subDistributorCurrency: d.subDistributorCurrency || "",
    subDistributorNotes: d.subDistributorNotes || "",
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const coverageArr = form.coverageCountries
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/admin/distributors/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          chineseName: form.chineseName || null,
          country: form.country || null,
          region: form.region || null,
          city: form.city || null,
          address: form.address || null,
          email: form.email || null,
          phone: form.phone || null,
          website: form.website || null,
          localCurrency: form.localCurrency || null,
          coverageCountries: coverageArr,
          status: form.status,
          active: form.status !== "INACTIVE",
          notes: form.notes || null,
          fuzeRestockPricePerLiter:
            form.fuzeRestockPricePerLiter === ""
              ? null
              : form.fuzeRestockPricePerLiter,
          fuzeRestockCurrency: form.fuzeRestockCurrency || null,
          fuzeRestockNotes: form.fuzeRestockNotes || null,
          parentDistributorId: form.parentDistributorId || null,
          subDistributorPricePerLiter:
            form.subDistributorPricePerLiter === ""
              ? null
              : form.subDistributorPricePerLiter,
          subDistributorCurrency: form.subDistributorCurrency || null,
          subDistributorNotes: form.subDistributorNotes || null,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setSaveMsg({ ok: true, msg: "Saved!" });
        setEditing(false);
        onUpdate();
      } else {
        setSaveMsg({ ok: false, msg: j.error || "Save failed" });
      }
    } catch (e: any) {
      setSaveMsg({ ok: false, msg: e.message });
    } finally {
      setSaving(false);
    }
  };
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
          {/* Edit toggle + save message */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setEditing(!editing)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${editing ? "bg-slate-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
            >
              {editing ? "✕ Cancel Edit" : "✏️ Edit Distributor"}
            </button>
            {saveMsg && (
              <span className={`text-xs font-semibold ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {saveMsg.msg}
              </span>
            )}
          </div>

          {/* ─── Edit Form ─── */}
          {editing && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <EditField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <EditField label="Chinese Name" value={form.chineseName} onChange={(v) => setForm({ ...form, chineseName: v })} />
                <EditField label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                <EditField label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} placeholder="South Asia, Middle East, East Asia..." />
                <EditField label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <EditField label="Local Currency" value={form.localCurrency} onChange={(v) => setForm({ ...form, localCurrency: v })} placeholder="INR, AED, EUR, CNY..." />
                <EditField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                <EditField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <EditField label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
                <div className="sm:col-span-2">
                  <EditField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ONBOARDING">Onboarding</option>
                  </select>
                </div>
              </div>
              <div>
                <EditField
                  label="Coverage Countries (comma separated)"
                  value={form.coverageCountries}
                  onChange={(v) => setForm({ ...form, coverageCountries: v })}
                  placeholder="India, Bangladesh, Sri Lanka..."
                />
              </div>

              {/* FUZE Restock Pricing — wholesale rate this distributor pays
                  FUZE. Without this set, restock-from-FUZE returns 400. */}
              <div className="border-t border-slate-200 pt-3 mt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  FUZE Wholesale Pricing
                  <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case">
                    Required for distributor to place restock orders from
                    Salt Lake.
                  </span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Price per liter
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.fuzeRestockPricePerLiter}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fuzeRestockPricePerLiter: e.target.value,
                        })
                      }
                      placeholder="e.g. 38.50"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Currency
                    </label>
                    <select
                      value={form.fuzeRestockCurrency}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fuzeRestockCurrency: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CNY">CNY</option>
                      <option value="INR">INR</option>
                      <option value="AED">AED</option>
                      <option value="TRY">TRY</option>
                      <option value="NTD">NTD</option>
                      <option value="MXN">MXN</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1">
                    <EditField
                      label="Pricing notes"
                      value={form.fuzeRestockNotes}
                      onChange={(v) =>
                        setForm({ ...form, fuzeRestockNotes: v })
                      }
                      placeholder="FOB SLC, MOQ 1 gaylord..."
                    />
                  </div>
                </div>
                {form.fuzeRestockPricePerLiter === "" && !form.parentDistributorId && (
                  <p className="text-[10px] text-amber-600 mt-1.5">
                    ⚠ Empty: this distributor cannot place restock orders
                    from FUZE until a price is set.
                  </p>
                )}
              </div>

              {/* ─── Master / Sub hierarchy ──────────────────────
                  If this distributor is a SUB, it orders from a master,
                  not from FUZE. If it's a MASTER, the wholesale field
                  below is what the sub sees as their cost. */}
              <div className="border-t border-slate-200 pt-3 mt-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Master / Sub Hierarchy
                  <span className="ml-2 text-[10px] font-normal text-slate-400 normal-case">
                    Set a parent distributor to make this dist a SUB
                    (restocks order from the master, not from FUZE).
                  </span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Parent distributor (master)
                    </label>
                    <select
                      value={form.parentDistributorId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          parentDistributorId: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="">— Standalone / Master (no parent) —</option>
                      {allDistributors
                        .filter((opt) => opt.id !== d.id)
                        .map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                            {opt.country ? ` (${opt.country})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Master → Sub price/L
                      <span className="ml-1 text-slate-400 normal-case font-normal">
                        (only if you have subs)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.subDistributorPricePerLiter}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          subDistributorPricePerLiter: e.target.value,
                        })
                      }
                      placeholder="e.g. 42.00"
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Sub currency
                    </label>
                    <select
                      value={form.subDistributorCurrency}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          subDistributorCurrency: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="">—</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CNY">CNY</option>
                      <option value="INR">INR</option>
                      <option value="AED">AED</option>
                      <option value="TRY">TRY</option>
                      <option value="NTD">NTD</option>
                      <option value="MXN">MXN</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
                {form.parentDistributorId && (
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    This distributor is a <strong>SUB</strong>. Their
                    restocks will route to the master above. The FUZE
                    wholesale price section is ignored for sub-distributors.
                  </p>
                )}
              </div>

              {/* Quick link to the 5-tier pricing editor */}
              <div className="border-t border-slate-200 pt-3 mt-1">
                <a
                  href={`/admin/distributors/${d.id}/tiers`}
                  className="inline-flex items-center gap-1 text-xs text-[#00b4c3] font-semibold hover:underline"
                >
                  → Open 5-Tier Pricing & Factory Assignment for {d.name}
                </a>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "💾 Save Changes"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-white border text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
                        <span className={u.status === "ACTIVE" ? "text-emerald-500" : "text-slate-400"}>
                          ({u.status === "ACTIVE" ? "Active" : "Inactive"})
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

function EditField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
