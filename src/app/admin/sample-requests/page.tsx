// @ts-nocheck
"use client";

/**
 * /admin/sample-requests
 *
 * Admin tracker for factory FUZE sample requests. Built for Scott Pace
 * (#cmo7jxpom) — "I currently have no path to locate or fulfill inbound
 * sample requests." This is the missing inbox.
 *
 * Sorted: action-needed first (SUBMITTED / UNDER_REVIEW / ICP_PENDING),
 * then by createdAt desc. Stale rows (3+ days in SUBMITTED/UNDER_REVIEW)
 * surface a red flag.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n";

interface Request {
  id: string;
  status: string;
  ageDays: number;
  isStale: boolean;
  actionNeeded: boolean;
  createdAt: string;
  trialType: string;
  totalMeters: number;
  totalUnit: string;
  targetFuzeTier: string | null;
  applicationMethod: string | null;
  sampleVolumeLiters: number | null;
  sampleTrackingNumber: string | null;
  sampleShippedDate: string | null;
  sampleReceivedDate: string | null;
  notes: string | null;
  adminNotes: string | null;
  rejectedReason: string | null;
  factory: { id: string; name: string; country: string | null };
  fabric: {
    id: string;
    fuzeNumber: number | null;
    customerCode: string | null;
    customerReference: string | null;
    fabricCategory: string | null;
    color: string | null;
    weightGsm: number | null;
  };
  brand: { id: string; name: string } | null;
  requestedBy: { name: string; email: string } | null;
  icpLab: { name: string } | null;
}

interface Summary {
  total: number;
  submitted: number;
  underReview: number;
  approved: number;
  shipped: number;
  stale: number;
  complete: number;
}

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-700",
  SAMPLE_SHIPPED: "bg-indigo-100 text-indigo-700",
  SAMPLE_RECEIVED: "bg-purple-100 text-purple-700",
  TRIAL_IN_PROGRESS: "bg-purple-100 text-purple-700",
  ICP_PENDING: "bg-amber-100 text-amber-800",
  ICP_SUBMITTED: "bg-cyan-100 text-cyan-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function AdminSampleRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const T = t.sampleRequestsAdmin;
  const [requests, setRequests] = useState<Request[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [trackingForm, setTrackingForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    if (
      !["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP", "LAB_USER", "LAB_MANAGER"].includes(user.role)
    ) {
      router.push("/home");
      return;
    }
    load();
    // eslint-disable-next-line
  }, [user, statusFilter, staleOnly]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (staleOnly) params.set("stale", "1");
      const res = await fetch(`/api/admin/sample-requests?${params}`);
      const json = await res.json();
      if (json.ok) {
        setRequests(json.requests);
        setSummary(json.summary);
      }
    } finally {
      setLoading(false);
    }
  }

  async function patch(id: string, action: string, extras: any = {}) {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/sample-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extras }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(json.error || T.errUpdateFailed);
      } else {
        load();
      }
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/admin" className="hover:text-[#00b4c3]">{T.crumbAdmin}</Link>
          <span>/</span>
          <span>{T.crumbSampleRequests}</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          {T.title}
        </h1>
        <p className="text-slate-600 mt-1 max-w-2xl">
          {T.subtitle}
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <Tile label={T.tileTotal} value={summary.total} />
          <Tile
            label={T.tileSubmitted}
            value={summary.submitted}
            warn={summary.submitted > 0}
          />
          <Tile label={T.tileUnderReview} value={summary.underReview} />
          <Tile label={T.tileApproved} value={summary.approved} />
          <Tile label={T.tileShipped} value={summary.shipped} />
          <Tile
            label={T.tileStale}
            value={summary.stale}
            warn={summary.stale > 0}
          />
          <Tile label={T.tileComplete} value={summary.complete} />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 uppercase font-bold">
          {T.statusLabel}
        </span>
        {[
          "",
          "SUBMITTED",
          "UNDER_REVIEW",
          "APPROVED",
          "SAMPLE_SHIPPED",
          "SAMPLE_RECEIVED",
          "TRIAL_IN_PROGRESS",
          "ICP_PENDING",
          "COMPLETE",
          "REJECTED",
        ].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              statusFilter === s
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s ? s.replace("_", " ") : T.allBtn}
          </button>
        ))}
        <span className="ml-auto" />
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
          />
          {T.staleOnlyToggle}
        </label>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <span className="text-4xl mb-3 block">📭</span>
          <p className="text-slate-600">{T.emptyState}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const tf = trackingForm[r.id] || {};
            const flag = r.isStale;
            return (
              <div
                key={r.id}
                className={`bg-white border rounded-xl p-4 ${
                  flag ? "border-red-300 bg-red-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/factories/${r.factory.id}`}
                        className="font-black text-slate-900 hover:underline"
                      >
                        {r.factory.name}
                      </Link>
                      {r.factory.country && (
                        <span className="text-xs text-slate-500">
                          ({r.factory.country})
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[r.status] || "bg-slate-100 text-slate-700"}`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                      {flag && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          {T.staleBadge} {r.ageDays}d
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {r.fabric.fuzeNumber && (
                        <Link
                          href={`/fabrics/${r.fabric.id}`}
                          className="font-mono font-semibold text-blue-600 hover:underline"
                        >
                          FUZE-{r.fabric.fuzeNumber}
                        </Link>
                      )}
                      {r.fabric.customerReference && (
                        <> · {r.fabric.customerReference}</>
                      )}
                      {r.fabric.fabricCategory && (
                        <> · {r.fabric.fabricCategory}</>
                      )}
                      {r.fabric.weightGsm && <> · {r.fabric.weightGsm} g/m²</>}
                      {r.fabric.color && <> · {r.fabric.color}</>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {r.trialType.replace("_", " ")} ·{" "}
                      {r.totalMeters} {r.totalUnit}
                      {r.targetFuzeTier && <> · {r.targetFuzeTier}</>}
                      {r.sampleVolumeLiters && (
                        <> · {r.sampleVolumeLiters}{T.sampleSuffix}</>
                      )}
                      {r.brand?.name && <> · {T.forPrefix} {r.brand.name}</>}
                    </p>
                    {r.requestedBy && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {T.requestedByPrefix} {r.requestedBy.name || r.requestedBy.email}{" "}
                        · {fmtDate(r.createdAt)}
                      </p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-slate-500 italic mt-1">
                        "{r.notes}"
                      </p>
                    )}
                    {r.adminNotes && (
                      <p className="text-xs text-slate-700 mt-1">
                        <strong>{T.adminPrefix}</strong> {r.adminNotes}
                      </p>
                    )}
                    {r.rejectedReason && (
                      <p className="text-xs text-red-700 mt-1">
                        <strong>{T.rejectedPrefix}</strong> {r.rejectedReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action row by status */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {r.status === "SUBMITTED" && (
                    <>
                      <button
                        onClick={() => patch(r.id, "approve")}
                        disabled={updating === r.id}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {T.approveBtn}
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt(T.rejectPrompt);
                          if (reason) patch(r.id, "reject", { rejectedReason: reason });
                        }}
                        disabled={updating === r.id}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 disabled:opacity-50"
                      >
                        {T.rejectBtn}
                      </button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <>
                      <input
                        type="text"
                        value={tf.sampleTrackingNumber || ""}
                        onChange={(e) =>
                          setTrackingForm((s) => ({
                            ...s,
                            [r.id]: {
                              ...(s[r.id] || {}),
                              sampleTrackingNumber: e.target.value,
                            },
                          }))
                        }
                        placeholder={T.trackingPlaceholder}
                        className="px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        value={tf.shippingCarrier || ""}
                        onChange={(e) =>
                          setTrackingForm((s) => ({
                            ...s,
                            [r.id]: {
                              ...(s[r.id] || {}),
                              shippingCarrier: e.target.value,
                            },
                          }))
                        }
                        placeholder={T.carrierPlaceholder}
                        className="px-2 py-1 border border-slate-300 rounded text-xs w-28"
                      />
                      <button
                        onClick={() => patch(r.id, "mark-shipped", tf)}
                        disabled={updating === r.id}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {T.markShippedBtn}
                      </button>
                    </>
                  )}
                  {r.status === "SAMPLE_SHIPPED" && (
                    <button
                      onClick={() => patch(r.id, "mark-received")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {T.markReceivedBtn}
                    </button>
                  )}
                  {r.status === "SAMPLE_RECEIVED" && (
                    <button
                      onClick={() => patch(r.id, "mark-trial-in-progress")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700 disabled:opacity-50"
                    >
                      {T.trialStartedBtn}
                    </button>
                  )}
                  {r.status === "TRIAL_IN_PROGRESS" && (
                    <button
                      onClick={() => patch(r.id, "mark-icp-pending")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 disabled:opacity-50"
                    >
                      {T.awaitingIcpBtn}
                    </button>
                  )}
                  {r.status === "ICP_PENDING" && (
                    <button
                      onClick={() => patch(r.id, "mark-complete")}
                      disabled={updating === r.id}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {T.markCompleteBtn}
                    </button>
                  )}
                  {r.sampleTrackingNumber && (
                    <span className="text-xs text-slate-500 ml-auto">
                      {T.trackingPrefix} {r.sampleTrackingNumber}
                      {r.sampleShippedDate
                        ? ` · ${T.shippedPrefix} ${fmtDate(r.sampleShippedDate)}`
                        : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  warn,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${
        warn ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-600 font-bold">
        {label}
      </p>
      <p
        className={`text-2xl font-black ${
          warn ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
