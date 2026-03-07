"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AccessRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  company: string;
  website?: string;
  requestType?: string;
  // Brand fields
  fabricTypes?: string;
  annualVolume?: string;
  timeline?: string;
  currentAntimicrobial?: string;
  // Factory fields
  factoryLocation?: string;
  capabilities?: string;
  certifications?: string;
  productTypes?: string;
  monthlyCapacity?: string;
  fuzeApplicationMethod?: string;
  notes?: string;
  status: string;
  reviewedAt?: string;
  reviewNote?: string;
  deniedReason?: string;
  sowId?: string;
  sow?: { id: string; title: string; status: string };
  user?: { id: string; name: string; email: string; role: string; status: string };
  factory?: { id: string; name: string; country?: string };
  createdAt: string;
}

interface Stats { pending: number; approved: number; denied: number; }

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, denied: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeTab, setTypeTab] = useState<"ALL" | "BRAND" | "FACTORY">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Approval result state
  const [lastApproval, setLastApproval] = useState<{ name: string; email: string; password: string } | null>(null);

  const loadRequests = async (status?: string, type?: string) => {
    try {
      let params = [];
      if (status) params.push(`status=${status}`);
      if (type && type !== "ALL") params.push(`type=${type}`);
      const url = `/api/access-requests${params.length ? "?" + params.join("&") : ""}`;
      const res = await fetch(url);
      const d = await res.json();
      if (d.ok) {
        setRequests(d.requests);
        setStats(d.stats);
      }
    } catch (e) {
      setError("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(statusFilter, typeTab); }, [statusFilter, typeTab]);

  const handleAction = async (id: string, action: "approve" | "deny", reviewNote?: string, deniedReason?: string) => {
    setProcessing(id);
    setError("");
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote, deniedReason }),
      });
      const d = await res.json();
      if (d.ok) {
        if (action === "approve" && d.user) {
          setLastApproval({ name: d.user.name, email: d.user.email, password: d.user.tempPassword });
        }
        setSuccess(d.message);
        setTimeout(() => setSuccess(""), 8000);
        loadRequests(statusFilter, typeTab);
      } else {
        setError(d.error);
      }
    } catch {
      setError("Failed to process request");
    } finally {
      setProcessing(null);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    DENIED: "bg-red-100 text-red-800",
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/dashboard" className="hover:text-[#00b4c3]">Dashboard</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Access Requests</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Portal Access Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Review and approve brand and factory portal access requests</p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(["ALL", "BRAND", "FACTORY"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setTypeTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
              typeTab === tab
                ? "border-[#00b4c3] text-[#00b4c3]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "ALL" ? "All Requests" : tab === "BRAND" ? "Brand Requests" : "Factory Requests"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <button onClick={() => setStatusFilter("PENDING")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "PENDING" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
          <div className="text-xs font-medium text-slate-500">Pending Review</div>
        </button>
        <button onClick={() => setStatusFilter("APPROVED")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "APPROVED" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-emerald-600">{stats.approved}</div>
          <div className="text-xs font-medium text-slate-500">Approved</div>
        </button>
        <button onClick={() => setStatusFilter("DENIED")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "DENIED" ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="text-2xl font-black text-red-600">{stats.denied}</div>
          <div className="text-xs font-medium text-slate-500">Denied</div>
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Approval credentials banner */}
      {lastApproval && (
        <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">!</span>
            <h3 className="font-bold text-emerald-800">Account Created — Send These Credentials</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Name:</span>
              <p className="font-medium text-slate-800">{lastApproval.name}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Email:</span>
              <p className="font-medium text-slate-800">{lastApproval.email}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Temporary Password:</span>
              <p className="font-mono font-bold text-emerald-700 text-lg">{lastApproval.password}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">Send these credentials to the brand contact. They can log in at <span className="font-mono text-[#00b4c3]">fuzeatlas.com/login</span></p>
          <button onClick={() => setLastApproval(null)} className="mt-2 text-xs text-slate-400 hover:text-slate-600">Dismiss</button>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-400">No {filter.toLowerCase()} access requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const isExpanded = expandedId === req.id;
            const isPending = req.status === "PENDING";
            return (
              <div key={req.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Row Header */}
                <div className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900">{req.firstName} {req.lastName}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[req.status] || "bg-slate-100 text-slate-600"}`}>
                        {req.status}
                      </span>
                      {req.requestType && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          req.requestType === "FACTORY"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}>
                          {req.requestType === "FACTORY" ? "🏭 Factory" : "🏢 Brand"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">{req.company}</span>
                      {req.jobTitle && <><span>·</span><span>{req.jobTitle}</span></>}
                      <span>·</span>
                      <span>{req.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact</h4>
                        <div>
                          <p className="text-xs text-slate-500">Full Name</p>
                          <p className="text-sm font-medium text-slate-800">{req.firstName} {req.lastName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Email</p>
                          <a href={`mailto:${req.email}`} className="text-sm text-blue-600 hover:underline">{req.email}</a>
                        </div>
                        {req.phone && (
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm text-slate-800">{req.phone}</p>
                          </div>
                        )}
                        {req.jobTitle && (
                          <div>
                            <p className="text-xs text-slate-500">Title</p>
                            <p className="text-sm text-slate-800">{req.jobTitle}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {req.requestType === "FACTORY" ? "Factory" : "Company"}
                        </h4>
                        <div>
                          <p className="text-xs text-slate-500">{req.requestType === "FACTORY" ? "Factory Name" : "Company Name"}</p>
                          <p className="text-sm font-medium text-slate-800">{req.company}</p>
                        </div>
                        {req.website && (
                          <div>
                            <p className="text-xs text-slate-500">Website</p>
                            <a href={req.website.startsWith("http") ? req.website : `https://${req.website}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline">{req.website}</a>
                          </div>
                        )}
                        {req.requestType === "FACTORY" && req.factoryLocation && (
                          <div>
                            <p className="text-xs text-slate-500">Location</p>
                            <p className="text-sm text-slate-800">{req.factoryLocation}</p>
                          </div>
                        )}
                        {req.requestType === "FACTORY" && req.monthlyCapacity && (
                          <div>
                            <p className="text-xs text-slate-500">Monthly Capacity</p>
                            <p className="text-sm text-slate-800">{req.monthlyCapacity}</p>
                          </div>
                        )}
                        {req.requestType === "BRAND" && req.annualVolume && (
                          <div>
                            <p className="text-xs text-slate-500">Annual Volume</p>
                            <p className="text-sm text-slate-800">{req.annualVolume}</p>
                          </div>
                        )}
                        {req.requestType === "BRAND" && req.timeline && (
                          <div>
                            <p className="text-xs text-slate-500">Timeline</p>
                            <p className="text-sm text-slate-800">{req.timeline}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {req.requestType === "FACTORY" ? "Details" : "Program Interest"}
                        </h4>
                        {req.requestType === "FACTORY" && req.capabilities && (
                          <div>
                            <p className="text-xs text-slate-500">Capabilities</p>
                            <p className="text-sm text-slate-800">{req.capabilities}</p>
                          </div>
                        )}
                        {req.requestType === "FACTORY" && req.certifications && (
                          <div>
                            <p className="text-xs text-slate-500">Certifications</p>
                            <p className="text-sm text-slate-800">{req.certifications}</p>
                          </div>
                        )}
                        {req.requestType === "FACTORY" && req.productTypes && (
                          <div>
                            <p className="text-xs text-slate-500">Product Types</p>
                            <p className="text-sm text-slate-800">{req.productTypes}</p>
                          </div>
                        )}
                        {req.requestType === "FACTORY" && req.fuzeApplicationMethod && (
                          <div>
                            <p className="text-xs text-slate-500">FUZE Application Interest</p>
                            <p className="text-sm text-slate-800">{req.fuzeApplicationMethod}</p>
                          </div>
                        )}
                        {req.requestType === "BRAND" && req.fabricTypes && (
                          <div>
                            <p className="text-xs text-slate-500">Fabric Types</p>
                            <p className="text-sm text-slate-800">{req.fabricTypes}</p>
                          </div>
                        )}
                        {req.requestType === "BRAND" && req.currentAntimicrobial && (
                          <div>
                            <p className="text-xs text-slate-500">Current Antimicrobial</p>
                            <p className="text-sm text-slate-800 font-medium">{req.currentAntimicrobial}</p>
                          </div>
                        )}
                        {req.notes && (
                          <div>
                            <p className="text-xs text-slate-500">Additional Notes</p>
                            <p className="text-sm text-slate-800">{req.notes}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500">Submitted</p>
                          <p className="text-sm text-slate-800">{new Date(req.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    {/* Approved user info */}
                    {req.user && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                        <p className="text-xs font-semibold text-emerald-700 mb-1">Account Created</p>
                        <p className="text-sm text-slate-700">
                          User: <span className="font-medium">{req.user.name}</span> · Email: <span className="font-mono">{req.user.email}</span> · Role: <span className="font-medium">{req.user.role}</span>
                        </p>
                      </div>
                    )}

                    {/* Denied reason */}
                    {req.deniedReason && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                        <p className="text-xs font-semibold text-red-700 mb-1">Reason for Denial</p>
                        <p className="text-sm text-slate-700">{req.deniedReason}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {isPending && (
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => handleAction(req.id, "approve")}
                          disabled={processing === req.id}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {processing === req.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Approve & Create Account
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Reason for denial (optional):");
                            handleAction(req.id, "deny", undefined, reason || undefined);
                          }}
                          disabled={processing === req.id}
                          className="px-5 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                        >
                          Deny
                        </button>
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
