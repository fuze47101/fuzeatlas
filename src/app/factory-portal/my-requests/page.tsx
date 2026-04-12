// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { label: "Approved", color: "text-blue-700", bg: "bg-blue-100" },
  SHIPPED: { label: "Shipped", color: "text-indigo-700", bg: "bg-indigo-100" },
  RECEIVED: { label: "Received at Lab", color: "text-purple-700", bg: "bg-purple-100" },
  IN_PROGRESS: { label: "Testing In Progress", color: "text-cyan-700", bg: "bg-cyan-100" },
  RESULTS_RECEIVED: { label: "Results Ready", color: "text-green-700", bg: "bg-green-100" },
  COMPLETE: { label: "Complete", color: "text-emerald-800", bg: "bg-emerald-200" },
  CANCELLED: { label: "Cancelled", color: "text-red-700", bg: "bg-red-100" },
};

// Friendly test names
const TEST_NAMES: Record<string, string> = {
  "recipe-build": "Recipe Build",
  "antibacterial-screen": "Antibacterial Screen",
  "icp-analysis": "ICP Analysis",
  "wash-durability": "Wash Durability",
  "full-certification": "Full Certification",
  "fungal-test": "Fungal Test",
  "odor-test": "Odor Test",
};

export default function MyRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
            const statusInfo = STATUS_LABELS[req.status] || { label: req.status, color: "text-slate-600", bg: "bg-slate-100" };
            const expanded = expandedId === req.id;
            const tests = Array.isArray(req.selectedTests) ? req.selectedTests : [];
            const fabricLabel = req.fabric
              ? `FUZE-${req.fabric.fuzeNumber || "—"}${req.fabric.customerCode ? ` (${req.fabric.customerCode})` : ""}${req.fabric.factoryCode ? ` - ${req.fabric.factoryCode}` : ""}`
              : "Unknown Fabric";

            return (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : req.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <div className="text-sm font-bold text-slate-900">{fabricLabel}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {tests.length} test{tests.length !== 1 ? "s" : ""} · {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.color} ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-slate-100 px-6 py-5 space-y-4">
                    {/* Tests selected */}
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tests Requested</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tests.map((t: string) => (
                          <span key={t} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                            {TEST_NAMES[t] || t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400 text-xs">Min. Sample</span>
                        <p className="text-slate-900 font-medium">{req.totalMoqMeters ? `${req.totalMoqMeters}m` : "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Control Required</span>
                        <p className="text-slate-900 font-medium">{req.controlRequired ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Tracking #</span>
                        <p className="text-slate-900 font-mono text-xs">{req.trackingNumber || "—"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs">Submitted</span>
                        <p className="text-slate-900 font-medium">
                          {new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    {req.notes && (
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notes</span>
                        <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{req.notes}</p>
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
