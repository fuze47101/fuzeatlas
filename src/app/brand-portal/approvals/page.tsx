"use client";

/**
 * /brand-portal/approvals — Phase 7B page.
 *
 * Three sections of pending items (submissions / test results /
 * orders). Approve buttons fire instantly; Reject opens a modal
 * for the required reason. Severity badges color rows by age
 * (fresh / watch / overdue at 5 days).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import RestrictedSurface, { type TeammateLite } from "@/components/RestrictedSurface";
import LoadingSkeleton from "@/components/LoadingSkeleton";

type Severity = "fresh" | "watch" | "overdue";

interface SubmissionRow {
  id: string;
  fuzeFabricNumber: number | null;
  customerFabricCode: string | null;
  factory: { id: string; name: string } | null;
  daysPending: number;
  severity: Severity;
}

interface TestRow {
  id: string;
  testType: string;
  testReportNumber: string | null;
  lab: { id: string; name: string } | null;
  submission: {
    factory: { id: string; name: string } | null;
    fuzeFabricNumber: number | null;
  } | null;
  daysPending: number;
  severity: Severity;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  volumeLiters: number | null;
  fuzeTier: string | null;
  factory: { id: string; name: string } | null;
  daysPending: number;
  severity: Severity;
}

const SEVERITY_STYLE: Record<Severity, string> = {
  fresh: "bg-emerald-100 text-emerald-800",
  watch: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
};

function daysCopy(
  n: number,
  tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["approvals"],
) {
  return (n === 1 ? tx.daysPending : tx.daysPendingPlural).replace("{n}", String(n));
}

export default function BrandPortalApprovalsPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.approvals;
  const { user } = useAuth();

  const [data, setData] = useState<{
    pendingSubmissions: SubmissionRow[];
    pendingTestResults: TestRow[];
    pendingOrders: OrderRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [teamWithRole, setTeamWithRole] = useState<TeammateLite[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState<{
    kind: "submission" | "test" | "order";
    id: string;
    reason: string;
  } | null>(null);
  const [submittingReject, setSubmittingReject] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/brand-portal/approvals");
      if (res.status === 403) {
        setForbidden(true);
        // Best-effort fetch of brand teammates with BRAND_MANAGER so
        // the explainer can name them. Endpoint is auth-gated; if it
        // returns nothing the surface still works without the names.
        try {
          const tm = await fetch("/api/brand-portal/managers").then((r) => r.json());
          if (tm.ok && Array.isArray(tm.managers)) setTeamWithRole(tm.managers);
        } catch {}
        return;
      }
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setData({
        pendingSubmissions: j.pendingSubmissions || [],
        pendingTestResults: j.pendingTestResults || [],
        pendingOrders: j.pendingOrders || [],
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(kind: "submission" | "test" | "order", id: string) {
    setBusy(`approve:${id}`);
    setError(null);
    try {
      const j = await fetch("/api/brand-portal/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, decision: "APPROVED" }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.approveFailed);
      setFlash(tx.flashApproved);
      setTimeout(() => setFlash(null), 2500);
      await load();
    } catch (e: any) {
      setError(e.message || tx.approveFailed);
    } finally {
      setBusy(null);
    }
  }

  async function submitReject() {
    if (!reject || !reject.reason.trim()) return;
    setSubmittingReject(true);
    setError(null);
    try {
      const j = await fetch("/api/brand-portal/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: reject.kind,
          id: reject.id,
          decision: "REJECTED",
          reason: reject.reason.trim(),
        }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.rejectFailed);
      setReject(null);
      setFlash(tx.flashRejected);
      setTimeout(() => setFlash(null), 2500);
      await load();
    } catch (e: any) {
      setError(e.message || tx.rejectFailed);
    } finally {
      setSubmittingReject(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton variant="page" label={tx.loading} />;
  }
  if (forbidden) {
    return (
      <RestrictedSurface
        requiredRole="BRAND_MANAGER"
        featureLabel="Brand approvals queue"
        scope="brand"
        scopeId={user?.brandId || null}
        currentRole={user?.role}
        teamWithRole={teamWithRole}
        rationale="Approving brand-visible test results, fabric submissions, and incoming FUZE orders is a brand-manager responsibility — it touches the brand's compliance surface."
      />
    );
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error || "Failed"}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {flash ? (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          {flash}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 mb-6 max-w-lg">
        <Stat n={data.pendingSubmissions.length} label={tx.statSubmissions} />
        <Stat n={data.pendingTestResults.length} label={tx.statTests} />
        <Stat n={data.pendingOrders.length} label={tx.statOrders} />
      </div>

      <Section title={tx.submissionsHeader} empty={tx.noSubmissions} count={data.pendingSubmissions.length}>
        <ul className="divide-y divide-slate-100">
          {data.pendingSubmissions.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">
                  {tx.fabricLabel.replace("{n}", String(r.fuzeFabricNumber || "—"))}
                </div>
                <div className="text-xs text-slate-500">
                  {tx.factoryLabel.replace("{name}", r.factory?.name || "—")}
                </div>
                {r.customerFabricCode ? (
                  <div className="text-xs text-slate-500">{r.customerFabricCode}</div>
                ) : null}
                <SeverityRow days={r.daysPending} severity={r.severity} tx={tx} />
              </div>
              <RowButtons
                onApprove={() => approve("submission", r.id)}
                onReject={() => setReject({ kind: "submission", id: r.id, reason: "" })}
                busy={busy === `approve:${r.id}`}
                tx={tx}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={tx.testsHeader} empty={tx.noTests} count={data.pendingTestResults.length}>
        <ul className="divide-y divide-slate-100">
          {data.pendingTestResults.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">
                  {r.testType}
                  {r.testReportNumber ? ` · #${r.testReportNumber}` : ""}
                </div>
                <div className="text-xs text-slate-500">
                  {tx.factoryLabel.replace("{name}", r.submission?.factory?.name || "—")}
                </div>
                {r.submission?.fuzeFabricNumber ? (
                  <div className="text-xs text-slate-500">
                    {tx.fabricLabel.replace("{n}", String(r.submission.fuzeFabricNumber))}
                  </div>
                ) : null}
                {r.lab?.name ? (
                  <div className="text-xs text-slate-500">
                    {tx.labLabel.replace("{name}", r.lab.name)}
                  </div>
                ) : null}
                <SeverityRow days={r.daysPending} severity={r.severity} tx={tx} />
              </div>
              <RowButtons
                onApprove={() => approve("test", r.id)}
                onReject={() => setReject({ kind: "test", id: r.id, reason: "" })}
                busy={busy === `approve:${r.id}`}
                tx={tx}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={tx.ordersHeader} empty={tx.noOrders} count={data.pendingOrders.length}>
        <ul className="divide-y divide-slate-100">
          {data.pendingOrders.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">{r.orderNumber}</div>
                <div className="text-xs text-slate-500">
                  {tx.factoryLabel.replace("{name}", r.factory?.name || "—")}
                </div>
                <div className="text-xs text-slate-500">
                  {r.volumeLiters
                    ? tx.volumeLabel.replace("{liters}", String(r.volumeLiters))
                    : "—"}
                  {r.fuzeTier ? ` · ${tx.tierLabel.replace("{tier}", r.fuzeTier)}` : ""}
                </div>
                <SeverityRow days={r.daysPending} severity={r.severity} tx={tx} />
              </div>
              <RowButtons
                onApprove={() => approve("order", r.id)}
                onReject={() => setReject({ kind: "order", id: r.id, reason: "" })}
                busy={busy === `approve:${r.id}`}
                tx={tx}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* Reject modal */}
      {reject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{tx.rejectTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{tx.rejectHint}</p>
            </div>
            <div className="p-6">
              <textarea
                value={reject.reason}
                onChange={(e) => setReject({ ...reject, reason: e.target.value })}
                placeholder={tx.reasonPlaceholder}
                rows={5}
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setReject(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                {tx.cancel}
              </button>
              <button
                onClick={submitReject}
                disabled={submittingReject || !reject.reason.trim()}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {submittingReject ? tx.rejecting : tx.submitReject}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <div className="text-2xl font-black text-slate-900">{n}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-5">
      <div className="px-5 py-3 border-b bg-slate-50 flex items-center justify-between">
        <h2 className="font-bold text-slate-900 text-sm">{title}</h2>
        <span className="text-xs text-slate-500">{count}</span>
      </div>
      {count === 0 ? <div className="text-sm text-slate-500 text-center py-8">{empty}</div> : children}
    </div>
  );
}

function SeverityRow({
  days,
  severity,
  tx,
}: {
  days: number;
  severity: Severity;
  tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["approvals"];
}) {
  const label =
    severity === "fresh" ? tx.severityFresh : severity === "watch" ? tx.severityWatch : tx.severityOverdue;
  return (
    <div className="flex items-center gap-2 mt-1">
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${SEVERITY_STYLE[severity]}`}
      >
        {label}
      </span>
      <span className="text-xs text-slate-400">{daysCopy(days, tx)}</span>
    </div>
  );
}

function RowButtons({
  onApprove,
  onReject,
  busy,
  tx,
}: {
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
  tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["approvals"];
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={onApprove}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? tx.approving : tx.approve}
      </button>
      <button
        onClick={onReject}
        className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50"
      >
        {tx.reject}
      </button>
    </div>
  );
}
