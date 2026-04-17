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

interface Stats {
  pending: number;
  approved: number;
  denied: number;
}

interface CompanyOption {
  id: string;
  name: string;
  country?: string;
  type: "brand" | "factory" | "distributor" | "lab";
}

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, denied: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeTab, setTypeTab] = useState<"ALL" | "BRAND" | "FACTORY" | "LAB">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Approval result state
  const [lastApproval, setLastApproval] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  // Company linking state
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [approveModal, setApproveModal] = useState<string | null>(null); // request ID being approved
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [companySearch, setCompanySearch] = useState("");
  const [createNewCompany, setCreateNewCompany] = useState(false);
  // Admin can override the request type if the signer picked the wrong one
  const [overrideType, setOverrideType] = useState<string>("");
  // Admin assigns the final user role (defaults derived from type)
  const [overrideRole, setOverrideRole] = useState<string>("");
  // Admin can edit the company name before approval — e.g. requester typed
  // "BV" but admin wants to save as "BV Xiaoxing" (with city). Used as the
  // canonical name when creating a new Brand/Factory/Lab entity.
  const [editedCompanyName, setEditedCompanyName] = useState<string>("");

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

  useEffect(() => {
    loadRequests(statusFilter, typeTab);
  }, [statusFilter, typeTab]);

  // Load companies (brands, factories) for the linking dropdown
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const [brandsRes, factoriesRes, labsRes, distributorsRes] = await Promise.all([
          fetch("/api/brands"),
          fetch("/api/factories"),
          fetch("/api/labs"),
          fetch("/api/distributors").catch(() => null),
        ]);
        const brandsData = await brandsRes.json();
        const factoriesData = await factoriesRes.json();
        const labsData = await labsRes.json();
        const distributorsData = distributorsRes
          ? await distributorsRes.json().catch(() => ({}))
          : {};
        const opts: CompanyOption[] = [];
        if (brandsData.brands) {
          brandsData.brands.forEach((b: any) =>
            opts.push({ id: b.id, name: b.name, country: b.country, type: "brand" }),
          );
        } else if (brandsData.grouped) {
          Object.values(brandsData.grouped).forEach((arr: any) =>
            arr.forEach((b: any) =>
              opts.push({ id: b.id, name: b.name, country: b.country, type: "brand" }),
            ),
          );
        }
        if (factoriesData.factories) {
          factoriesData.factories.forEach((f: any) =>
            opts.push({ id: f.id, name: f.name, country: f.country, type: "factory" }),
          );
        }
        if (labsData.labs) {
          labsData.labs.forEach((l: any) =>
            opts.push({ id: l.id, name: l.name, country: l.country, type: "lab" }),
          );
        }
        const dists = distributorsData?.distributors || distributorsData;
        if (Array.isArray(dists)) {
          dists.forEach((d: any) =>
            opts.push({ id: d.id, name: d.name, country: d.country, type: "distributor" }),
          );
        }
        setCompanies(opts);
      } catch {}
    };
    loadCompanies();
  }, []);

  const openApproveModal = (reqId: string) => {
    const req = requests.find((r) => r.id === reqId);
    setApproveModal(reqId);
    setSelectedCompanyId("");
    setCompanySearch(req?.company || "");
    setCreateNewCompany(false);
    setOverrideType("");
    setOverrideRole("");
    setEditedCompanyName(req?.company || "");
  };

  const handleApproveWithCompany = async () => {
    if (!approveModal) return;
    const req = requests.find((r) => r.id === approveModal);
    if (!req) return;

    setProcessing(approveModal);
    setError("");
    try {
      const effectiveType = overrideType || req.requestType;
      const defaultRole =
        effectiveType === "FACTORY"
          ? "FACTORY_USER"
          : effectiveType === "LAB"
            ? "LAB_USER"
            : effectiveType === "DISTRIBUTOR"
              ? "DISTRIBUTOR_USER"
              : "BRAND_USER";
      const finalRole = overrideRole || defaultRole;
      const INTERNAL_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"];
      const isInternal = INTERNAL_ROLES.includes(finalRole);

      const payload: any = { action: "approve", role: finalRole };
      if (overrideType && overrideType !== req.requestType) {
        payload.overrideType = overrideType;
      }
      if (createNewCompany) {
        payload.createNewEntity = true;
        // Admin may have edited the company name (e.g. added city, fixed typo)
        if (editedCompanyName.trim() && editedCompanyName.trim() !== req.company) {
          payload.companyName = editedCompanyName.trim();
        }
      }
      // Internal roles don't get linked to any entity — they're FUZE staff.
      if (!isInternal && selectedCompanyId && !createNewCompany) {
        if (effectiveType === "FACTORY") {
          payload.factoryId = selectedCompanyId;
        } else if (effectiveType === "LAB") {
          payload.labId = selectedCompanyId;
        } else if (effectiveType === "DISTRIBUTOR") {
          payload.distributorId = selectedCompanyId;
        } else {
          payload.brandId = selectedCompanyId;
        }
      }

      const res = await fetch(`/api/access-requests/${approveModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (d.ok) {
        if (d.user) {
          setLastApproval({
            name: d.user.name,
            email: d.user.email,
            password: d.user.tempPassword,
          });
        }
        setSuccess(d.message);
        setTimeout(() => setSuccess(""), 8000);
        setApproveModal(null);
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

  const handleDeny = async (id: string) => {
    const reason = prompt("Reason for denial (optional):");
    setProcessing(id);
    setError("");
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deny", deniedReason: reason || undefined }),
      });
      const d = await res.json();
      if (d.ok) {
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

  const [resending, setResending] = useState<string | null>(null);

  const handleResendEmail = async (id: string) => {
    setResending(id);
    setError("");
    try {
      const res = await fetch(`/api/access-requests/${id}/resend-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (d.ok) {
        setLastApproval({
          name:
            requests.find((r) => r.id === id)?.firstName +
              " " +
              requests.find((r) => r.id === id)?.lastName || "",
          email: requests.find((r) => r.id === id)?.email || "",
          password: d.tempPassword,
        });
        setSuccess(d.message);
        setTimeout(() => setSuccess(""), 8000);
      } else {
        // Even on failure, if tempPassword is returned show it
        if (d.tempPassword) {
          setLastApproval({
            name:
              requests.find((r) => r.id === id)?.firstName +
                " " +
                requests.find((r) => r.id === id)?.lastName || "",
            email: requests.find((r) => r.id === id)?.email || "",
            password: d.tempPassword,
          });
        }
        setError(d.error || "Failed to resend email");
      }
    } catch {
      setError("Failed to resend email");
    } finally {
      setResending(null);
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
            <Link href="/dashboard" className="hover:text-[#00b4c3]">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Access Requests</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Portal Access Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and approve brand and factory portal access requests
          </p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(["ALL", "BRAND", "FACTORY"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTypeTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
              typeTab === tab
                ? "border-[#00b4c3] text-[#00b4c3]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "ALL"
              ? "All Requests"
              : tab === "BRAND"
                ? "Brand Requests"
                : "Factory Requests"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setStatusFilter("PENDING")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "PENDING" ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="text-2xl font-black text-amber-600">{stats.pending}</div>
          <div className="text-xs font-medium text-slate-500">Pending Review</div>
        </button>
        <button
          onClick={() => setStatusFilter("APPROVED")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "APPROVED" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="text-2xl font-black text-emerald-600">{stats.approved}</div>
          <div className="text-xs font-medium text-slate-500">Approved</div>
        </button>
        <button
          onClick={() => setStatusFilter("DENIED")}
          className={`p-4 rounded-xl border-2 transition-all ${statusFilter === "DENIED" ? "border-red-400 bg-red-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
        >
          <div className="text-2xl font-black text-red-600">{stats.denied}</div>
          <div className="text-xs font-medium text-slate-500">Denied</div>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Approval credentials banner */}
      {lastApproval && (
        <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
              !
            </span>
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
              <p className="font-mono font-bold text-emerald-700 text-lg">
                {lastApproval.password}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Send these credentials to the brand contact. They can log in at{" "}
            <span className="font-mono text-[#00b4c3]">fuzeatlas.com/login</span>
          </p>
          <button
            onClick={() => setLastApproval(null)}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Request List */}
      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-400">No {typeTab.toLowerCase()} access requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedId === req.id;
            const isPending = req.status === "PENDING";
            return (
              <div
                key={req.id}
                className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
              >
                {/* Row Header */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900">
                        {req.firstName} {req.lastName}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[req.status] || "bg-slate-100 text-slate-600"}`}
                      >
                        {req.status}
                      </span>
                      {req.requestType && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            req.requestType === "FACTORY"
                              ? "bg-blue-100 text-blue-800"
                              : req.requestType === "LAB"
                                ? "bg-amber-100 text-amber-800"
                                : req.requestType === "DISTRIBUTOR"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {req.requestType === "FACTORY"
                            ? "🏭 Factory"
                            : req.requestType === "LAB"
                              ? "🔬 Lab"
                              : req.requestType === "DISTRIBUTOR"
                                ? "🌍 Distributor"
                                : "🏢 Brand"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">{req.company}</span>
                      {req.jobTitle && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span>{req.jobTitle}</span>
                        </>
                      )}
                      <span className="hidden sm:inline">·</span>
                      <span className="truncate max-w-[200px] sm:max-w-none">{req.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-slate-400">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          Contact
                        </h4>
                        <div>
                          <p className="text-xs text-slate-500">Full Name</p>
                          <p className="text-sm font-medium text-slate-800">
                            {req.firstName} {req.lastName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Email</p>
                          <a
                            href={`mailto:${req.email}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {req.email}
                          </a>
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
                          <p className="text-xs text-slate-500">
                            {req.requestType === "FACTORY" ? "Factory Name" : "Company Name"}
                          </p>
                          <p className="text-sm font-medium text-slate-800">{req.company}</p>
                        </div>
                        {req.website && (
                          <div>
                            <p className="text-xs text-slate-500">Website</p>
                            <a
                              href={
                                req.website.startsWith("http")
                                  ? req.website
                                  : `https://${req.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {req.website}
                            </a>
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
                            <p className="text-sm text-slate-800 font-medium">
                              {req.currentAntimicrobial}
                            </p>
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
                          <p className="text-sm text-slate-800">
                            {new Date(req.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Approved user info */}
                    {req.user && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-emerald-700 mb-1">
                              Account Created
                            </p>
                            <p className="text-sm text-slate-700">
                              User: <span className="font-medium">{req.user.name}</span> · Email:{" "}
                              <span className="font-mono">{req.user.email}</span> · Role:{" "}
                              <span className="font-medium">{req.user.role}</span>
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendEmail(req.id);
                            }}
                            disabled={resending === req.id}
                            className="px-3 py-1.5 bg-[#00b4c3] text-white rounded-lg text-xs font-semibold hover:bg-[#009daa] disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                          >
                            {resending === req.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                            Resend Email
                          </button>
                        </div>
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
                          onClick={() => openApproveModal(req.id)}
                          disabled={processing === req.id}
                          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Approve & Link Company
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
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
      {/* ── Approve & Link Company Modal ── */}
      {approveModal &&
        (() => {
          const req = requests.find((r) => r.id === approveModal);
          if (!req) return null;
          const effectiveType = overrideType || req.requestType;
          const isFactory = effectiveType === "FACTORY";
          const isLab = effectiveType === "LAB";
          const isDistributor = effectiveType === "DISTRIBUTOR";
          const entityType = isFactory
            ? "factory"
            : isLab
              ? "lab"
              : isDistributor
                ? "distributor"
                : "brand";
          const entityLabel = isFactory
            ? "factory"
            : isLab
              ? "laboratory"
              : isDistributor
                ? "distributor"
                : "brand";
          const entityIcon = isFactory ? "🏭" : isLab ? "🔬" : isDistributor ? "🌍" : "🏢";
          const typeChanged = overrideType && overrideType !== req.requestType;
          // Fuzzy match: matches initials (BV → Bureau Veritas), partial words,
          // and substrings. Scores results for best-match sorting.
          const fuzzyMatch = (name: string, query: string): number => {
            if (!query) return 1;
            const n = name.toLowerCase();
            const q = query.toLowerCase().trim();
            // Exact substring match (highest)
            if (n.includes(q)) return 100;
            // Initials match: "BV" matches "Bureau Veritas", "ITS" matches "ITS - Taiwan"
            const words = n.split(/[\s\-—/,]+/).filter(Boolean);
            const initials = words.map((w) => w[0]).join("");
            if (initials.includes(q)) return 90;
            // Abbreviation: first letters of each query word match first letters of name words
            const qWords = q.split(/\s+/);
            if (qWords.length > 1) {
              const qInitials = qWords.map((w) => w[0]).join("");
              if (initials.includes(qInitials)) return 85;
            }
            // Any word starts with query
            if (words.some((w) => w.startsWith(q))) return 80;
            // All query tokens found somewhere in name
            const tokens = q.split(/\s+/);
            if (tokens.every((t) => n.includes(t))) return 70;
            // Any query token found
            if (tokens.some((t) => n.includes(t))) return 50;
            return 0;
          };
          const relevantCompanies = companies
            .filter((c) => c.type === entityType)
            .map((c) => ({ ...c, score: fuzzyMatch(c.name, companySearch) }))
            .filter((c) => !companySearch || c.score > 0)
            .sort((a, b) => b.score - a.score);
          // Cross-type fallback: when no matches in the current type but the
          // search string hits something in another entity type, surface it as
          // "did you mean...?" — prevents the Allied Feather case where the
          // record exists but in a different type and the admin gives up.
          const crossTypeMatches = companies
            .filter((c) => c.type !== entityType)
            .map((c) => ({ ...c, score: fuzzyMatch(c.name, companySearch) }))
            .filter((c) => companySearch && c.score >= 70)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          const typeBadge: Record<string, { icon: string; label: string; v: string }> = {
            brand: { icon: "🏢", label: "Brand", v: "BRAND" },
            factory: { icon: "🏭", label: "Factory", v: "FACTORY" },
            lab: { icon: "🔬", label: "Lab", v: "LAB" },
            distributor: { icon: "🌍", label: "Distributor", v: "DISTRIBUTOR" },
          };
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setApproveModal(null)}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="text-lg font-bold text-slate-900">Approve Access Request</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    <span className="font-medium">
                      {req.firstName} {req.lastName}
                    </span>{" "}
                    from <span className="font-medium text-slate-700">{req.company}</span>
                  </p>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {/* What they typed — and what we'll save it as */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-amber-700 mb-1">
                        Company name they provided:
                      </p>
                      <p className="text-sm font-bold text-slate-800">{req.company}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 mb-1">
                        Save as (edit if needed — e.g. add city "BV Xiaoxing"):
                      </label>
                      <input
                        type="text"
                        value={editedCompanyName}
                        onChange={(e) => setEditedCompanyName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="Canonical company name"
                      />
                      {editedCompanyName.trim() !== req.company &&
                        editedCompanyName.trim().length > 0 && (
                          <p className="text-[11px] text-amber-700 mt-1">
                            Will be saved as{" "}
                            <span className="font-bold">"{editedCompanyName.trim()}"</span> when a
                            new {entityLabel} is created.
                          </p>
                        )}
                    </div>
                    <p className="text-xs text-amber-600 pt-1 border-t border-amber-200">
                      {entityIcon} {entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)}{" "}
                      request
                      {typeChanged && (
                        <span className="ml-2 text-red-600 font-semibold">
                          (was {req.requestType} — you changed it)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Type picker — lets admin correct a misfiled signup */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Entity type{" "}
                      <span className="text-xs font-normal text-slate-500">
                        (override if signer picked wrong)
                      </span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { v: "BRAND", label: "Brand", icon: "🏢" },
                        { v: "FACTORY", label: "Factory", icon: "🏭" },
                        { v: "LAB", label: "Lab", icon: "🔬" },
                        { v: "DISTRIBUTOR", label: "Distributor", icon: "🌍" },
                      ].map((opt) => {
                        const active = effectiveType === opt.v;
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => {
                              setOverrideType(opt.v);
                              setOverrideRole("");
                              setSelectedCompanyId("");
                              setCreateNewCompany(false);
                              setCompanySearch("");
                            }}
                            className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                              active
                                ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <div className="text-lg">{opt.icon}</div>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Role picker — critical: lets admin flag internal hires as */}
                  {/* SALES_REP / EMPLOYEE and skip the brand linking entirely. */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      User role{" "}
                      <span className="text-xs font-normal text-slate-500">
                        (what they can do once logged in)
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <p className="col-span-2 text-[11px] uppercase font-bold text-slate-400 tracking-wide">
                        External
                      </p>
                      {[
                        { v: "BRAND_USER", label: "Brand User", icon: "🏢", color: "purple" },
                        { v: "FACTORY_USER", label: "Factory User", icon: "🏭", color: "blue" },
                        {
                          v: "FACTORY_MANAGER",
                          label: "Factory Manager",
                          icon: "🏭",
                          color: "blue",
                        },
                        { v: "LAB_USER", label: "Lab User", icon: "🔬", color: "amber" },
                        {
                          v: "DISTRIBUTOR_USER",
                          label: "Distributor User",
                          icon: "🌍",
                          color: "emerald",
                        },
                      ].map((opt) => {
                        const active =
                          (overrideRole ||
                            (effectiveType === "FACTORY"
                              ? "FACTORY_USER"
                              : effectiveType === "LAB"
                                ? "LAB_USER"
                                : effectiveType === "DISTRIBUTOR"
                                  ? "DISTRIBUTOR_USER"
                                  : "BRAND_USER")) === opt.v;
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setOverrideRole(opt.v)}
                            className={`p-2 rounded-lg border text-xs text-left font-semibold transition-all ${
                              active
                                ? "border-[#00b4c3] bg-[#00b4c3]/10 text-[#00b4c3]"
                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span className="mr-1">{opt.icon}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                      <p className="col-span-2 mt-2 text-[11px] uppercase font-bold text-slate-400 tracking-wide">
                        Internal (FUZE staff — no company link)
                      </p>
                      {[
                        { v: "SALES_REP", label: "Sales Rep", icon: "💼" },
                        { v: "SALES_MANAGER", label: "Sales Manager", icon: "💼" },
                        { v: "EMPLOYEE", label: "Employee", icon: "👤" },
                        { v: "ADMIN", label: "Admin", icon: "⚙️" },
                      ].map((opt) => {
                        const active = overrideRole === opt.v;
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => {
                              setOverrideRole(opt.v);
                              setSelectedCompanyId("");
                              setCreateNewCompany(false);
                            }}
                            className={`p-2 rounded-lg border text-xs text-left font-semibold transition-all ${
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 text-slate-700 hover:border-slate-400"
                            }`}
                          >
                            <span className="mr-1">{opt.icon}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(overrideRole) && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                        ✓ Internal user — won't create or link any brand/factory/lab/distributor.
                      </p>
                    )}
                  </div>

                  {/* Link to existing or create new (hidden for internal roles) */}
                  {!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(overrideRole) && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Link to existing {entityLabel}:
                        </label>
                        <input
                          type="text"
                          placeholder={`Search ${entityLabel === "factory" ? "factories" : entityLabel + "s"}...`}
                          value={companySearch}
                          onChange={(e) => {
                            setCompanySearch(e.target.value);
                            setCreateNewCompany(false);
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent"
                        />

                        {/* Company list */}
                        <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                          {relevantCompanies.length === 0 ? (
                            <div className="p-3 text-center text-sm text-slate-400">
                              No matching{" "}
                              {entityLabel === "factory" ? "factories" : entityLabel + "s"} found
                            </div>
                          ) : (
                            relevantCompanies.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedCompanyId(c.id);
                                  setCreateNewCompany(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-sm border-b border-slate-100 last:border-0 transition-colors ${
                                  selectedCompanyId === c.id && !createNewCompany
                                    ? "bg-[#00b4c3]/10 text-[#00b4c3] font-semibold"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span className="font-medium">{c.name}</span>
                                {c.country && (
                                  <span className="text-slate-400 ml-2 text-xs">{c.country}</span>
                                )}
                                {selectedCompanyId === c.id && !createNewCompany && (
                                  <span className="float-right text-[#00b4c3]">&#10003;</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>

                        {/* Cross-type suggestions: "did you mean..." when the
                          current type has no match but another type does. */}
                        {crossTypeMatches.length > 0 && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-xs font-semibold text-blue-800 mb-2">
                              💡 Found matches in other entity types — did you mean one of these?
                            </p>
                            <div className="space-y-1">
                              {crossTypeMatches.map((c) => {
                                const badge = typeBadge[c.type];
                                return (
                                  <button
                                    key={`cross-${c.id}`}
                                    onClick={() => {
                                      setOverrideType(badge.v);
                                      setOverrideRole("");
                                      setSelectedCompanyId(c.id);
                                      setCreateNewCompany(false);
                                      setCompanySearch(c.name);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm bg-white border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                                  >
                                    <span className="mr-1.5">{badge.icon}</span>
                                    <span className="font-medium text-slate-800">{c.name}</span>
                                    {c.country && (
                                      <span className="text-slate-400 ml-2 text-xs">
                                        {c.country}
                                      </span>
                                    )}
                                    <span className="float-right text-[11px] text-blue-700 font-semibold uppercase">
                                      switch to {badge.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Or create new */}
                      <button
                        onClick={() => {
                          setCreateNewCompany(true);
                          setSelectedCompanyId("");
                        }}
                        className={`w-full p-3 border-2 rounded-lg text-sm font-medium text-left transition-all ${
                          createNewCompany
                            ? "border-[#00b4c3] bg-[#00b4c3]/5 text-[#00b4c3]"
                            : "border-dashed border-slate-300 text-slate-500 hover:border-slate-400"
                        }`}
                      >
                        + Create new {entityLabel}:{" "}
                        <span className="font-bold">
                          "{editedCompanyName.trim() || req.company}"
                        </span>
                        {createNewCompany && <span className="float-right">&#10003;</span>}
                      </button>

                      {!selectedCompanyId && !createNewCompany && (
                        <p className="text-xs text-amber-600">
                          Please select an existing {entityLabel} or choose to create a new one
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setApproveModal(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveWithCompany}
                    disabled={
                      (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(
                        overrideRole,
                      ) &&
                        !selectedCompanyId &&
                        !createNewCompany) ||
                      processing === approveModal
                    }
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {processing === approveModal ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                    {["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(overrideRole)
                      ? `Approve as ${overrideRole}`
                      : selectedCompanyId && !createNewCompany
                        ? `Approve & Link to ${companies.find((c) => c.id === selectedCompanyId)?.name || "Company"}`
                        : `Approve & Create "${editedCompanyName.trim() || req.company}"`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
