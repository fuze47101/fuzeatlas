// @ts-nocheck
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

interface Trial {
  id: string;
  status: string;
  purposeType: string;
  trialType: string;
  totalMeters: number;
  totalUnit: string;
  targetFuzeTier?: string;
  sampleVolumeLiters?: number;
  applicationMethod?: string;
  sampleTrackingNumber?: string;
  icpAgValue?: number;
  notes?: string;
  adminNotes?: string;
  createdAt: string;
  approvedAt?: string;
  sampleShippedDate?: string;
  icpSubmittedAt?: string;
  fabric?: { id: string; fuzeNumber?: number; customerCode?: string; construction?: string; weightGsm?: number };
  factory?: { id: string; name: string; country?: string };
  brand?: { id: string; name: string };
  requestedBy?: { id: string; name: string; email: string };
  icpLab?: { id: string; name: string; city?: string; country?: string };
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SAMPLE_SHIPPED: "bg-purple-100 text-purple-700",
  SAMPLE_RECEIVED: "bg-indigo-100 text-indigo-700",
  TRIAL_IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  ICP_PENDING: "bg-orange-100 text-orange-700",
  ICP_SUBMITTED: "bg-teal-100 text-teal-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SAMPLE_SHIPPED: "Shipped",
  SAMPLE_RECEIVED: "Received",
  TRIAL_IN_PROGRESS: "In Progress",
  ICP_PENDING: "ICP Pending",
  ICP_SUBMITTED: "ICP Submitted",
  COMPLETE: "Complete",
};

const ALL_STATUSES = [
  "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED",
  "SAMPLE_SHIPPED", "SAMPLE_RECEIVED", "TRIAL_IN_PROGRESS",
  "ICP_PENDING", "ICP_SUBMITTED", "COMPLETE",
];

export default function AdminSampleTrialsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [trials, setTrials] = useState<Trial[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [factories, setFactories] = useState<{ id: string; name: string; country?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Inline action
  const [actionTrialId, setActionTrialId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [actionTracking, setActionTracking] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionRejectReason, setActionRejectReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTrials = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (factoryFilter) params.set("factoryId", factoryFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/sample-trials?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setTrials(data.trials);
        setStatusCounts(data.statusCounts || {});
        if (data.factories) setFactories(data.factories);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to load trials");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, factoryFilter, search]);

  useEffect(() => {
    const role = user?.role;
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    loadTrials();
  }, [user, router, loadTrials]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openAction = (trial: Trial) => {
    setActionTrialId(trial.id);
    setActionStatus(trial.status);
    setActionTracking(trial.sampleTrackingNumber || "");
    setActionNotes(trial.adminNotes || "");
    setActionRejectReason("");
  };

  const saveAction = async () => {
    if (!actionTrialId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/factory-portal/sample-trial/${actionTrialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionStatus,
          sampleTrackingNumber: actionTracking || null,
          adminNotes: actionNotes || null,
          rejectedReason: actionStatus === "REJECTED" ? actionRejectReason : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionTrialId(null);
        loadTrials();
      } else {
        setError(data.error || "Update failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const totalTrials = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const needsAttention = (statusCounts["SUBMITTED"] || 0) + (statusCounts["ICP_SUBMITTED"] || 0);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/dashboard" className="hover:text-[#00b4c3]">Dashboard</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Sample Trials</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Sample Trial Management</h1>
        <p className="text-sm text-slate-500 mt-1">Review, approve, ship, and track all factory sample trial requests</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{totalTrials}</p>
          <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
        </div>
        {needsAttention > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-black text-amber-700">{needsAttention}</p>
            <p className="text-[10px] text-amber-600 uppercase font-bold">Needs Action</p>
          </div>
        )}
        {["APPROVED", "SAMPLE_SHIPPED", "TRIAL_IN_PROGRESS", "COMPLETE"].map(s => (
          statusCounts[s] ? (
            <div key={s} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-slate-800">{statusCounts[s]}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold">{STATUS_LABELS[s]}</p>
            </div>
          ) : null
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search fabric, factory, brand, contact..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[180px]">
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]} {statusCounts[s] ? `(${statusCounts[s]})` : ""}
            </option>
          ))}
        </select>
        <select value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white min-w-[180px]">
          <option value="">All Factories</option>
          {factories.map(f => (
            <option key={f.id} value={f.id}>{f.name}{f.country ? ` (${f.country})` : ""}</option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Inline Action Panel */}
      {actionTrialId && (
        <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Quick Action — {trials.find(t => t.id === actionTrialId)?.fabric?.fuzeNumber ? `FUZE-${trials.find(t => t.id === actionTrialId)?.fabric?.fuzeNumber}` : "Trial"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Status</label>
              <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Tracking Number</label>
              <input type="text" value={actionTracking} onChange={(e) => setActionTracking(e.target.value)}
                placeholder="FedEx/DHL/UPS #"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Admin Notes</label>
              <input type="text" value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Internal notes..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {actionStatus === "REJECTED" && (
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Rejection Reason</label>
              <textarea value={actionRejectReason} onChange={(e) => setActionRejectReason(e.target.value)}
                rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={saveAction} disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => setActionTrialId(null)}
              className="px-5 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Trials Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trials.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500">
            {statusFilter || factoryFilter || search ? "No trials match your filters" : "No sample trials yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Fabric</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Factory</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Details</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden xl:table-cell">ICP Lab</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trials.map(trial => (
                  <tr key={trial.id} className={`hover:bg-slate-50 transition-colors ${trial.status === "SUBMITTED" ? "bg-blue-50/30" : trial.status === "ICP_SUBMITTED" ? "bg-teal-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">
                        FUZE-{trial.fabric?.fuzeNumber || "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {trial.fabric?.customerCode || ""} {trial.fabric?.construction ? `· ${trial.fabric.construction}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{trial.factory?.name || "—"}</div>
                      <div className="text-xs text-slate-400">{trial.factory?.country}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-slate-700">
                        {trial.purposeType === "BRAND_PARTNERSHIP" ? trial.brand?.name || "Brand" : "Self-Dev"}
                      </div>
                      <div className="text-xs text-slate-400">{trial.trialType === "LAB_TRIAL" ? "Lab" : "Production"} · {trial.totalMeters} {trial.totalUnit}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[trial.status] || "bg-slate-100 text-slate-700"}`}>
                        {STATUS_LABELS[trial.status] || trial.status}
                      </span>
                      {trial.sampleTrackingNumber && (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">{trial.sampleTrackingNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Tier: <span className="font-medium">{trial.targetFuzeTier || "—"}</span> · {trial.sampleVolumeLiters || "—"}L</div>
                        {trial.icpAgValue != null && (
                          <div className="text-emerald-700 font-medium">ICP Ag: {trial.icpAgValue} ppm</div>
                        )}
                        {trial.requestedBy && <div className="text-slate-400">By: {trial.requestedBy.name}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-slate-600">
                      {trial.icpLab ? (
                        <div>
                          <div className="font-medium">{trial.icpLab.name}</div>
                          <div className="text-slate-400">{[trial.icpLab.city, trial.icpLab.country].filter(Boolean).join(", ")}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(trial.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openAction(trial)}
                          className="px-2.5 py-1.5 bg-[#00b4c3]/10 hover:bg-[#00b4c3]/20 text-[#009ba8] rounded-lg text-xs font-medium transition-colors">
                          Action
                        </button>
                        <Link href={`/factory-portal/sample-trial/${trial.id}`} target="_blank"
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
