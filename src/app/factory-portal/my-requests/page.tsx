// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Draft", color: "text-slate-600", bg: "bg-slate-100" },
  PENDING_APPROVAL: { label: "Pending Approval", color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { label: "Approved — Ship Samples", color: "text-blue-700", bg: "bg-blue-100" },
  SUBMITTED: { label: "Samples at Lab", color: "text-indigo-700", bg: "bg-indigo-100" },
  IN_PROGRESS: { label: "Testing In Progress", color: "text-purple-700", bg: "bg-purple-100" },
  RESULTS_RECEIVED: { label: "Results Ready", color: "text-green-700", bg: "bg-green-100" },
  COMPLETE: { label: "Complete", color: "text-green-800", bg: "bg-green-200" },
  CANCELLED: { label: "Cancelled", color: "text-red-700", bg: "bg-red-100" },
};

const TIMELINE_STAGES = [
  { key: "PENDING_APPROVAL", label: "Submitted" },
  { key: "APPROVED", label: "Approved" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "SUBMITTED", label: "Received" },
  { key: "IN_PROGRESS", label: "Testing" },
  { key: "RESULTS_RECEIVED", label: "Results" },
  { key: "COMPLETE", label: "Complete" },
];

function getStageIndex(status: string, hasShipment: boolean): number {
  if (status === "COMPLETE") return 6;
  if (status === "RESULTS_RECEIVED") return 5;
  if (status === "IN_PROGRESS") return 4;
  if (status === "SUBMITTED") return hasShipment ? 3 : 2;
  if (status === "APPROVED") return 1;
  return 0;
}

export default function MyRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState<{ id: string; carrier: string; tracking: string; date: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/factory-portal/my-requests");
      const data = await res.json();
      if (data.ok) setRequests(data.requests || []);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleShipSample = async () => {
    if (!shipForm || !shipForm.carrier || !shipForm.tracking) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/test-requests/${shipForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_shipped",
          carrier: shipForm.carrier,
          trackingNumber: shipForm.tracking,
          shipDate: shipForm.date || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast("Shipment recorded! You'll get a confirmation email shortly.");
        setShipForm(null);
        fetchRequests();
      } else {
        setToast(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setToast(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
          <div className="h-32 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl text-sm max-w-md">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Test Requests</h1>
          <p className="text-slate-500 mt-1">Track your samples and view results</p>
        </div>
        <a href="/factory-portal/request-test"
          className="px-5 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Test Request
        </a>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500 text-lg mb-4">No test requests yet</p>
          <a href="/factory-portal/request-test"
            className="inline-block px-5 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700">
            Submit Your First Request
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => {
            const status = STATUS_LABELS[req.status] || { label: req.status, color: "text-slate-600", bg: "bg-slate-100" };
            const expanded = expandedId === req.id;
            const hasShipment = req.shipments?.length > 0;
            const shipment = req.shipments?.[0];
            const stageIdx = getStageIndex(req.status, hasShipment);
            const canShip = req.status === "APPROVED" || (req.status === "SUBMITTED" && !hasShipment);

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(expanded ? null : req.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{req.poNumber}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {req.fabric?.fuzeNumber ? `FUZE-${req.fabric.fuzeNumber}` : ""}
                        {req.fabric?.customerCode ? ` (${req.fabric.customerCode})` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color} ${status.bg}`}>
                      {status.label}
                    </span>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Details */}
                {expanded && (
                  <div className="border-t border-slate-100 px-6 py-5 space-y-5">
                    {/* Timeline */}
                    <div className="flex items-center justify-between px-2">
                      {TIMELINE_STAGES.map((stage, i) => {
                        const active = i <= stageIdx;
                        const current = i === stageIdx;
                        return (
                          <div key={stage.key} className="flex flex-col items-center flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              current ? "bg-cyan-600 text-white ring-4 ring-cyan-100" :
                              active ? "bg-cyan-600 text-white" : "bg-slate-200 text-slate-400"
                            }`}>
                              {active && i < stageIdx ? "✓" : i + 1}
                            </div>
                            <span className={`text-xs mt-1 ${current ? "font-bold text-cyan-700" : active ? "text-slate-600" : "text-slate-400"}`}>
                              {stage.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400 text-xs">Lab</span>
                        <p className="text-slate-900 font-medium">{req.lab?.name || "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Tests</span>
                        <p className="text-slate-900 font-medium">{req.lines?.map((l: any) => l.testType).join(", ") || "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Estimated Cost</span>
                        <p className="text-slate-900 font-medium">{req.estimatedCost ? `$${req.estimatedCost.toFixed(2)}` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Est. Completion</span>
                        <p className="text-slate-900 font-medium">
                          {req.estimatedCompletionDate
                            ? new Date(req.estimatedCompletionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Shipment Info */}
                    {hasShipment && (
                      <div className="bg-slate-50 rounded-lg p-4 text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                          </svg>
                          <span className="font-semibold text-slate-700">Shipment</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <span className="text-slate-400 text-xs">Carrier</span>
                            <p className="text-slate-900">{shipment.carrier || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs">Tracking</span>
                            <p className="text-slate-900 font-mono text-xs">{shipment.trackingNumber || "—"}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 text-xs">Status</span>
                            <p className="text-slate-900">{shipment.status || "—"}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ship Sample Action */}
                    {canShip && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        {shipForm?.id === req.id ? (
                          <div className="space-y-3">
                            <p className="text-blue-800 font-semibold text-sm mb-3">Enter Shipping Details</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Carrier *</label>
                                <select
                                  value={shipForm.carrier}
                                  onChange={(e) => setShipForm({ ...shipForm, carrier: e.target.value })}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                >
                                  <option value="">Select carrier</option>
                                  <option value="FedEx">FedEx</option>
                                  <option value="DHL">DHL</option>
                                  <option value="UPS">UPS</option>
                                  <option value="SF Express">SF Express</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Tracking Number *</label>
                                <input
                                  type="text"
                                  placeholder="e.g. 7891234567"
                                  value={shipForm.tracking}
                                  onChange={(e) => setShipForm({ ...shipForm, tracking: e.target.value })}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Ship Date</label>
                                <input
                                  type="date"
                                  value={shipForm.date}
                                  onChange={(e) => setShipForm({ ...shipForm, date: e.target.value })}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={handleShipSample}
                                disabled={submitting || !shipForm.carrier || !shipForm.tracking}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                              >
                                {submitting ? "Submitting..." : "Confirm Shipment"}
                              </button>
                              <button
                                onClick={() => setShipForm(null)}
                                className="px-5 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-blue-800 font-semibold text-sm">Ready to ship your samples?</p>
                              <p className="text-blue-600 text-xs mt-0.5">Enter your carrier and tracking number once shipped</p>
                            </div>
                            <button
                              onClick={() => setShipForm({ id: req.id, carrier: "", tracking: "", date: new Date().toISOString().split("T")[0] })}
                              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                              </svg>
                              Enter Tracking
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
