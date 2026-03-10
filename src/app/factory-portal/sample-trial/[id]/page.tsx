// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

const STATUS_STEPS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "SAMPLE_SHIPPED",
  "SAMPLE_RECEIVED",
  "TRIAL_IN_PROGRESS",
  "ICP_PENDING",
  "ICP_SUBMITTED",
  "COMPLETE",
];

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SAMPLE_SHIPPED: "Sample Shipped",
  SAMPLE_RECEIVED: "Sample Received",
  TRIAL_IN_PROGRESS: "Trial In Progress",
  ICP_PENDING: "ICP Pending",
  ICP_SUBMITTED: "ICP Submitted",
  COMPLETE: "Complete",
};

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

export default function TrialDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [trial, setTrial] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  // ICP Submission form
  const [showIcpForm, setShowIcpForm] = useState(false);
  const [icpAg, setIcpAg] = useState("");
  const [icpAu, setIcpAu] = useState("");
  const [icpUnit, setIcpUnit] = useState("ppm");
  const [icpMethod, setIcpMethod] = useState("ICP-OES");
  const [icpLabRef, setIcpLabRef] = useState("");
  const [icpNotes, setIcpNotes] = useState("");
  const [icpSubmitting, setIcpSubmitting] = useState(false);

  // Admin fields
  const [adminStatus, setAdminStatus] = useState("");
  const [adminTracking, setAdminTracking] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const isAdmin = user?.role === "ADMIN" || user?.role === "EMPLOYEE";

  const loadTrial = async () => {
    try {
      const res = await fetch(`/api/factory-portal/sample-trial/${id}`);
      const data = await res.json();
      if (data.ok) {
        setTrial(data.trial);
        setAdminStatus(data.trial.status);
        setAdminTracking(data.trial.sampleTrackingNumber || "");
        setAdminNotes(data.trial.adminNotes || "");
      } else {
        setError(data.error || "Failed to load trial");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrial(); }, [id]);

  const updateStatus = async (status: string, extra?: any) => {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/factory-portal/sample-trial/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (data.ok) {
        setTrial(data.trial);
        setAdminStatus(data.trial.status);
      } else {
        setError(data.error || "Update failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setUpdating(false);
    }
  };

  const submitIcp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIcpSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/factory-portal/sample-trial/${id}/icp-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agValue: parseFloat(icpAg),
          auValue: icpAu ? parseFloat(icpAu) : null,
          unit: icpUnit,
          testMethod: icpMethod,
          labReportRef: icpLabRef || null,
          notes: icpNotes || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowIcpForm(false);
        await loadTrial();
      } else {
        setError(data.error || "ICP submission failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setIcpSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!trial) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto text-center">
        <p className="text-red-500 font-bold">{error || "Trial not found"}</p>
        <Link href="/factory-portal/sample-trial" className="text-[#00b4c3] hover:underline text-sm mt-2 inline-block">← Back to Trials</Link>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(trial.status);
  const isRejected = trial.status === "REJECTED";

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
        <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
        <span>/</span>
        <Link href="/factory-portal/sample-trial" className="hover:text-[#00b4c3]">Sample Trials</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">FUZE-{trial.fabric?.fuzeNumber || "—"}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            Sample Trial — FUZE-{trial.fabric?.fuzeNumber || "—"} {trial.fabric?.customerCode ? `(${trial.fabric.customerCode})` : ""}
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[trial.status] || "bg-slate-100 text-slate-700"}`}>
              {STATUS_LABELS[trial.status] || trial.status}
            </span>
            <span>Requested {new Date(trial.createdAt).toLocaleDateString()}</span>
            {trial.requestedBy && <span>by {trial.requestedBy.name}</span>}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Progress Stepper */}
      {!isRejected && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Progress</h3>
          <div className="flex items-center gap-1 overflow-x-auto">
            {STATUS_STEPS.map((step, i) => {
              const isDone = i <= currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={step} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                    isCurrent ? "bg-[#00b4c3] text-white" : isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isDone && !isCurrent && <span>✓</span>}
                    <span>{STATUS_LABELS[step]}</span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 ${isDone ? "bg-emerald-300" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rejected banner */}
      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h3 className="text-red-900 font-bold mb-1">Request Rejected</h3>
          <p className="text-red-700 text-sm">{trial.rejectedReason || "No reason provided."}</p>
        </div>
      )}

      {/* Trial Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Fabric & Purpose */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Fabric & Purpose</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Fabric</span>
              <span className="font-medium text-slate-900">FUZE-{trial.fabric?.fuzeNumber} {trial.fabric?.customerCode ? `(${trial.fabric.customerCode})` : ""}</span>
            </div>
            {trial.fabric?.construction && (
              <div className="flex justify-between">
                <span className="text-slate-500">Construction</span>
                <span className="font-medium text-slate-900">{trial.fabric.construction}</span>
              </div>
            )}
            {trial.fabric?.weightGsm && (
              <div className="flex justify-between">
                <span className="text-slate-500">Weight</span>
                <span className="font-medium text-slate-900">{trial.fabric.weightGsm} gsm</span>
              </div>
            )}
            {trial.fabric?.contents?.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Blend</span>
                <span className="font-medium text-slate-900">{trial.fabric.contents.map((c: any) => `${c.material} ${c.percent}%`).join(", ")}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Purpose</span>
                <span className="font-medium text-slate-900">{trial.purposeType === "BRAND_PARTNERSHIP" ? "Brand Partnership" : "Self-Development"}</span>
              </div>
              {trial.brand && (
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Brand</span>
                  <span className="font-medium text-slate-900">{trial.brand.name}</span>
                </div>
              )}
              {trial.partnershipNote && (
                <p className="text-xs text-slate-500 mt-1">{trial.partnershipNote}</p>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Factory</span>
              <span className="font-medium text-slate-900">{trial.factory?.name}{trial.factory?.country ? `, ${trial.factory.country}` : ""}</span>
            </div>
          </div>
        </div>

        {/* Right: Trial Specs */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Trial Specifications</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Trial Type</span>
              <span className="font-medium text-slate-900">{trial.trialType === "LAB_TRIAL" ? "Lab Trial" : "Production Trial"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Fabric</span>
              <span className="font-medium text-slate-900">{trial.totalMeters} {trial.totalUnit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">FUZE Tier</span>
              <span className="font-medium text-slate-900">{trial.targetFuzeTier || "TBD"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Application Method</span>
              <span className="font-medium text-slate-900">{trial.applicationMethod || "TBD"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Est. Sample Volume</span>
              <span className="font-bold text-[#00b4c3]">{trial.sampleVolumeLiters || "—"} L</span>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <div className="flex justify-between">
                <span className="text-slate-500">ICP Lab</span>
                <span className="font-medium text-slate-900">
                  {trial.icpLab ? `${trial.icpLab.name}, ${trial.icpLab.city || ""} ${trial.icpLab.country || ""}` : trial.icpLabOther || "—"}
                </span>
              </div>
            </div>
            {trial.sampleTrackingNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking #</span>
                <span className="font-mono font-medium text-slate-900">{trial.sampleTrackingNumber}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shipping & Freight */}
      {(trial.shippingAddress || trial.shippingCity || trial.shippingCountry) && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">Delivery Address</h3>
              <div className="text-sm text-slate-700">
                {trial.shippingContactName && <p className="font-medium">{trial.shippingContactName}</p>}
                {trial.shippingAddress && <p>{trial.shippingAddress}</p>}
                <p>{[trial.shippingCity, trial.shippingState, trial.shippingPostalCode].filter(Boolean).join(", ")}</p>
                <p>{trial.shippingCountry}</p>
                {trial.shippingContactPhone && <p className="text-slate-500 mt-1">Phone: {trial.shippingContactPhone}</p>}
                {trial.shippingContactEmail && <p className="text-slate-500">Email: {trial.shippingContactEmail}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">Freight Account</h3>
              <div className="text-sm text-slate-700 space-y-1">
                {trial.shippingCarrier && <p><span className="text-slate-500">Carrier:</span> {trial.shippingCarrier}</p>}
                {trial.shippingAccountNumber && <p><span className="text-slate-500">Account #:</span> {trial.shippingAccountNumber}</p>}
                {trial.shippingMethod && <p><span className="text-slate-500">Method:</span> {trial.shippingMethod === "EXPRESS" ? "Express (1-3 days)" : trial.shippingMethod === "ECONOMY" ? "Economy (7-14 days)" : "Standard (5-7 days)"}</p>}
                {!trial.shippingCarrier && !trial.shippingAccountNumber && <p className="text-amber-600 text-xs italic">No freight account provided — shipping arrangement pending</p>}
              </div>
              {trial.shippingNotes && (
                <div className="mt-3">
                  <h3 className="text-sm font-bold text-slate-700 mb-1">Shipping Notes</h3>
                  <p className="text-sm text-slate-600">{trial.shippingNotes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ICP Results (if submitted) */}
      {trial.icpAgValue != null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-emerald-800 mb-3">ICP Test Results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-700">{trial.icpAgValue}</p>
              <p className="text-[10px] text-emerald-600 uppercase font-bold">Ag (ppm)</p>
            </div>
            {trial.icpAuValue != null && (
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-700">{trial.icpAuValue}</p>
                <p className="text-[10px] text-emerald-600 uppercase font-bold">Au (ppm)</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-700">{trial.icpSubmittedAt ? new Date(trial.icpSubmittedAt).toLocaleDateString() : "—"}</p>
              <p className="text-[10px] text-emerald-600 uppercase font-bold">Submitted</p>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {trial.notes && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-2">Notes</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{trial.notes}</p>
        </div>
      )}

      {/* ────── FACTORY ACTIONS ────── */}
      {!isAdmin && !isRejected && (
        <div className="space-y-4 mb-6">
          {trial.status === "SAMPLE_SHIPPED" && (
            <button onClick={() => updateStatus("SAMPLE_RECEIVED")} disabled={updating}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50">
              {updating ? "Updating..." : "Confirm Sample Received"}
            </button>
          )}
          {trial.status === "SAMPLE_RECEIVED" && (
            <button onClick={() => updateStatus("TRIAL_IN_PROGRESS")} disabled={updating}
              className="w-full py-3 bg-cyan-600 text-white rounded-xl font-semibold text-sm hover:bg-cyan-700 disabled:opacity-50">
              {updating ? "Updating..." : "Mark Trial In Progress"}
            </button>
          )}
          {trial.status === "TRIAL_IN_PROGRESS" && (
            <button onClick={() => updateStatus("ICP_PENDING")} disabled={updating}
              className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold text-sm hover:bg-orange-700 disabled:opacity-50">
              {updating ? "Updating..." : "Trial Complete — ICP Testing Next"}
            </button>
          )}
          {(trial.status === "ICP_PENDING" || trial.status === "TRIAL_IN_PROGRESS") && !trial.icpAgValue && (
            <button onClick={() => setShowIcpForm(true)}
              className="w-full py-3 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-xl font-semibold text-sm hover:shadow-lg">
              Submit ICP Results
            </button>
          )}
        </div>
      )}

      {/* ────── ICP SUBMISSION FORM ────── */}
      {showIcpForm && (
        <div className="bg-white border-2 border-[#00b4c3] rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Submit ICP Test Results</h3>
          <form onSubmit={submitIcp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Ag Value (required)</label>
                <input type="number" value={icpAg} onChange={(e) => setIcpAg(e.target.value)}
                  placeholder="e.g., 35.2" step="0.01" min="0" required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Au Value (optional)</label>
                <input type="number" value={icpAu} onChange={(e) => setIcpAu(e.target.value)}
                  placeholder="e.g., 1.5" step="0.01" min="0"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Unit</label>
                <select value={icpUnit} onChange={(e) => setIcpUnit(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]">
                  <option value="ppm">ppm</option>
                  <option value="mg/kg">mg/kg</option>
                  <option value="mg/L">mg/L</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Test Method</label>
                <select value={icpMethod} onChange={(e) => setIcpMethod(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]">
                  <option value="ICP-OES">ICP-OES</option>
                  <option value="ICP-MS">ICP-MS</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Lab Report Reference #</label>
              <input type="text" value={icpLabRef} onChange={(e) => setIcpLabRef(e.target.value)}
                placeholder="Lab report or certificate number"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Notes</label>
              <textarea value={icpNotes} onChange={(e) => setIcpNotes(e.target.value)} rows={2}
                placeholder="Any additional notes about the test results..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3]" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={icpSubmitting || !icpAg}
                className="flex-1 py-3 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm disabled:opacity-50">
                {icpSubmitting ? "Submitting..." : "Submit ICP Results"}
              </button>
              <button type="button" onClick={() => setShowIcpForm(false)}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ────── ADMIN CONTROLS ────── */}
      {isAdmin && !isRejected && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Admin Controls</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Update Status</label>
                <select value={adminStatus} onChange={(e) => setAdminStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {STATUS_STEPS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Tracking Number</label>
                <input type="text" value={adminTracking} onChange={(e) => setAdminTracking(e.target.value)}
                  placeholder="DHL/FedEx/UPS #"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            {adminStatus === "REJECTED" && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Rejection Reason</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Admin Notes</label>
              <textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)}
                rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <button onClick={() => updateStatus(adminStatus, {
              sampleTrackingNumber: adminTracking || null,
              adminNotes: adminNotes || null,
              rejectedReason: adminStatus === "REJECTED" ? rejectReason : null,
            })} disabled={updating}
              className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-semibold text-sm hover:bg-slate-900 disabled:opacity-50">
              {updating ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Admin notes display for factory users */}
      {!isAdmin && trial.adminNotes && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-700 mb-2">Notes from FUZE Team</h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{trial.adminNotes}</p>
        </div>
      )}
    </div>
  );
}
