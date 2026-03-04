"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { INVOICE_STATUSES, formatMoney, daysAgo } from "@/lib/revenue-calc";
import { CURRENCIES } from "@/lib/fuze-calc";

type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  paidDate: string | null;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  notes: string | null;
  ageDays: number;
  distributor: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-400 line-through",
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [factories, setFactories] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: "",
    currency: "USD",
    status: "DRAFT",
    distributorId: "",
    factoryId: "",
    brandId: "",
    projectId: "",
    description: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => {
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    Promise.all([
      fetch(`/api/invoices${qs}`).then((r) => r.json()),
      fetch("/api/factories").then((r) => r.json()),
      fetch("/api/distributors").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/brands").then((r) => r.json()),
    ])
      .then(([ij, fj, dj, pj, bj]) => {
        if (ij.ok) {
          setInvoices(ij.invoices || []);
          setSummary(ij.summary);
        }
        if (fj.ok) setFactories(fj.factories || []);
        if (dj.ok) setDistributors(dj.distributors || []);
        if (pj.ok) setProjects(pj.projects || []);
        if (bj.ok) setBrands(bj.brands || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter]);

  const handleCreate = async () => {
    if (!form.invoiceNumber.trim() || !form.distributorId || !form.factoryId || !form.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        setShowCreate(false);
        setForm({
          invoiceNumber: "", invoiceDate: new Date().toISOString().slice(0, 10),
          dueDate: "", amount: "", currency: "USD", status: "DRAFT",
          distributorId: "", factoryId: "", brandId: "", projectId: "", description: "",
        });
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Loading invoices...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoice Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track distributor invoices and payments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          + New Invoice
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600">{formatMoney(summary.totalPaid)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">Outstanding</p>
            <p className="text-xl font-bold text-amber-600">{formatMoney(summary.totalOutstanding)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">Collection Rate</p>
            <p className="text-xl font-bold text-blue-600">{summary.collectionRate}%</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-[10px] font-medium text-slate-400 uppercase">Total Invoices</p>
            <p className="text-xl font-bold text-slate-700">{invoices.length}</p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatusFilter("")}
          className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
            !statusFilter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        {INVOICE_STATUSES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatusFilter(s.id)}
            className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${
              statusFilter === s.id ? "bg-slate-800 text-white" : `${s.color} hover:opacity-80`
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-slate-400 uppercase">
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Factory</th>
                <th className="py-2.5 px-3">Distributor</th>
                <th className="py-2.5 px-3">Brand</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Age</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">No invoices found</td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-medium text-slate-800">{inv.invoiceNumber}</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {new Date(inv.invoiceDate).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{inv.factory?.name || "—"}</td>
                  <td className="py-2.5 px-3 text-slate-600">{inv.distributor?.name || "—"}</td>
                  <td className="py-2.5 px-3 text-slate-600">{inv.brand?.name || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    ${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    {inv.currency !== "USD" && (
                      <span className="text-[10px] text-slate-400 ml-0.5">{inv.currency}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[inv.status] || "bg-slate-100"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs text-slate-400">{inv.ageDays}d</td>
                  <td className="py-2.5 px-3">
                    {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                      <button
                        onClick={() => updateStatus(inv.id, "PAID")}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Create Invoice</h3>
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-500">Invoice Number *</label>
                <input className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Date *</label>
                <input type="date" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Distributor *</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.distributorId} onChange={(e) => set("distributorId", e.target.value)}>
                  <option value="">Select...</option>
                  {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Factory *</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.factoryId} onChange={(e) => set("factoryId", e.target.value)}>
                  <option value="">Select...</option>
                  {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Amount *</label>
                <input type="number" step="0.01" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Currency</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Status</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {INVOICE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Due Date</label>
                <input type="date" className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Brand</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                  <option value="">None</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Project</label>
                <select className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500">Description</label>
                <input className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg text-sm" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {saving ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
