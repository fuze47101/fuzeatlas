"use client";
/**
 * /admin/contact-hygiene — Ticket #102 admin sweep.
 *
 * Cleans up the regression Andrew flagged: half of Active Line Corp's
 * "verified" contacts were Jane/John Doe placeholders, template emails,
 * or role mailboxes. The BD Wizard already buckets those at pick-time
 * via partitionContacts(), but without persistence the flag was
 * ephemeral — every refresh recomputed, and there was no way to sweep
 * the whole DB from one place.
 *
 * This page:
 *   - Shows a stat row by verdict (real / suspicious / placeholder /
 *     role_account) pulled from the persisted hygieneVerdict column.
 *   - Lets the admin run the scan across all contacts (or a scoped
 *     brand) in preview mode OR commit mode (autoHide).
 *   - Lists contacts worst-first (lowest hygieneScore) with every flag
 *     reason inline.
 *   - Offers per-row Hide / Un-hide actions that write to
 *     /api/admin/contact-hygiene/[id]/hide|unflag and refresh the list.
 *
 * Admin + EMPLOYEE + SALES_MANAGER only. Reps don't need this view —
 * the wizard already hides suspect contacts for them.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";

type Verdict = "real" | "suspicious" | "placeholder" | "role_account";

interface HygieneRow {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  title: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  hygieneScore: number | null;
  hygieneVerdict: Verdict | null;
  hygieneFlags: string[];
  hygieneCheckedAt: string | null;
  emailValidity: string | null;
  linkedinValidity: string | null;
  hiddenFromWizard: boolean;
  outreachStatus: string | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
}

interface HygieneList {
  ok: boolean;
  rows: HygieneRow[];
  totals: Record<string, number>;
  hiddenCount: number;
  limit: number;
}

const VERDICT_FILTER_KEYS: Array<{ key: string; labelKey: string }> = [
  { key: "", labelKey: "filterAllScanned" },
  { key: "placeholder", labelKey: "filterPlaceholder" },
  { key: "suspicious", labelKey: "filterSuspicious" },
  { key: "role_account", labelKey: "filterRoleMailbox" },
  { key: "real", labelKey: "filterReal" },
  { key: "unscanned", labelKey: "filterUnscanned" },
];

const HIDDEN_FILTER_KEYS: Array<{ key: string; labelKey: string }> = [
  { key: "", labelKey: "filterAllVisibility" },
  { key: "true", labelKey: "filterHiddenOnly" },
  { key: "false", labelKey: "filterVisibleOnly" },
];

export default function ContactHygienePage() {
  const { t } = useI18n();
  const T = t.contactHygiene;
  const VERDICT_FILTERS = VERDICT_FILTER_KEYS.map(v => ({ key: v.key, label: (T as any)[v.labelKey] }));
  const HIDDEN_FILTERS = HIDDEN_FILTER_KEYS.map(v => ({ key: v.key, label: (T as any)[v.labelKey] }));
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<HygieneList | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<any>(null);
  const [verdict, setVerdict] = useState("");
  const [hidden, setHidden] = useState("");
  const [q, setQ] = useState("");

  const isManager =
    user?.role === "ADMIN" || user?.role === "EMPLOYEE" || user?.role === "SALES_MANAGER";

  useEffect(() => {
    if (!user) return;
    if (!isManager) router.push("/dashboard");
  }, [user, isManager, router]);

  const load = useCallback(async () => {
    try {
      const sp = new URLSearchParams();
      if (verdict) sp.set("verdict", verdict);
      if (hidden) sp.set("hidden", hidden);
      if (q) sp.set("q", q);
      const res = await fetch(`/api/admin/contact-hygiene?${sp.toString()}`);
      const json = await res.json();
      if (json.ok) setData(json);
    } catch (e) {
      console.error("hygiene load failed", e);
    } finally {
      setLoading(false);
    }
  }, [verdict, hidden, q]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const runScan = async (autoHide: boolean) => {
    if (
      autoHide &&
      !confirm(T.confirmAutoHide)
    )
      return;
    setScanning(true);
    setScanSummary(null);
    try {
      const res = await fetch("/api/admin/contact-hygiene/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyStale: false, autoHide }),
      });
      const json = await res.json();
      setScanSummary(json);
      await load();
    } catch (e: any) {
      setScanSummary({ ok: false, error: e.message });
    } finally {
      setScanning(false);
    }
  };

  const toggleHidden = async (row: HygieneRow) => {
    const reason = prompt(
      row.hiddenFromWizard ? T.promptUnhide : T.promptHide,
      "",
    );
    if (reason === null) return; // user cancelled
    const path = row.hiddenFromWizard ? "unflag" : "hide";
    try {
      const res = await fetch(`/api/admin/contact-hygiene/${row.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(`${T.failedPrefix} ${json.error || "unknown"}`);
        return;
      }
      await load();
    } catch (e: any) {
      alert(`${T.networkErrPrefix} ${e.message}`);
    }
  };

  if (!user || !isManager) return null;

  const totals = data?.totals || {};

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin" className="hover:text-[#00b4c3]">
              {T.crumbAdmin}
            </Link>
            <span>/</span>
            <span>{T.crumbHere}</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">{T.pageTitle}</h1>
          <p className="text-slate-600 mt-1">
            {T.pageSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runScan(false)}
            disabled={scanning}
            className="px-3 py-2 bg-white border border-slate-300 hover:border-[#00b4c3] rounded-lg text-sm font-semibold disabled:opacity-50"
            title={T.titlePreviewScan}
          >
            {scanning ? T.btnScanning : T.btnPreviewScan}
          </button>
          <button
            onClick={() => runScan(true)}
            disabled={scanning}
            className="px-3 py-2 bg-[#00b4c3] hover:bg-[#009aa6] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            title={T.titleAutoHide}
          >
            {scanning ? T.btnHiding : T.btnAutoHide}
          </button>
        </div>
      </div>

      {/* ── Scan summary banner ── */}
      {scanSummary && (
        <div
          className={`mb-6 rounded-xl p-4 border ${
            scanSummary.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {scanSummary.ok ? (
            <>
              {T.summaryScanned} <b>{scanSummary.scanned}</b> {T.summaryContacts}{" "}
              <b>{scanSummary.buckets?.placeholder || 0}</b> {T.summarySuspicious}{" "}
              <b>{scanSummary.buckets?.suspicious || 0}</b> {T.summaryRole}{" "}
              <b>{scanSummary.buckets?.role_account || 0}</b> {T.summaryReal}{" "}
              <b>{scanSummary.buckets?.real || 0}</b>
              {scanSummary.autoHide && scanSummary.hiddenThisRun > 0 && (
                <>
                  {" "}
                  {T.summaryHiddenPrefix} <b>{scanSummary.hiddenThisRun}</b> {T.summaryHiddenSuffix}
                </>
              )}
            </>
          ) : (
            <>{T.scanFailedPrefix} {scanSummary.error}</>
          )}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label={T.statPlaceholder} value={totals.placeholder || 0} tone="red" />
        <StatCard label={T.statSuspicious} value={totals.suspicious || 0} tone="amber" />
        <StatCard label={T.statRole} value={totals.role_account || 0} tone="slate" />
        <StatCard label={T.statReal} value={totals.real || 0} tone="emerald" />
        <StatCard label={T.statUnscanned} value={totals.unscanned || 0} tone="slate" />
        <StatCard label={T.statHidden} value={data?.hiddenCount || 0} tone="violet" />
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 uppercase tracking-wide">{T.filterVerdict}</label>
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {VERDICT_FILTERS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 uppercase tracking-wide">{T.filterVisibility}</label>
          <select
            value={hidden}
            onChange={(e) => setHidden(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {HIDDEN_FILTERS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={T.searchPlaceholder}
          className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-600">
          {T.emptyTitle}
          {totals.unscanned > 0 && (
            <div className="mt-2 text-sm text-slate-500">
              {T.emptyUnscannedTpl.replace("{n}", String(totals.unscanned))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-3">{T.colContact}</th>
                <th className="text-left px-3 py-3">{T.colBrandFactory}</th>
                <th className="text-center px-3 py-3">{T.colVerdict}</th>
                <th className="text-center px-3 py-3">{T.colEmail}</th>
                <th className="text-center px-3 py-3">{T.colLinkedin}</th>
                <th className="text-right px-3 py-3">{T.colScore}</th>
                <th className="text-left px-3 py-3">{T.colFlags}</th>
                <th className="text-right px-3 py-3">{T.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={
                    idx % 2 === 0
                      ? "bg-white border-b border-slate-100"
                      : "bg-slate-50/40 border-b border-slate-100"
                  }
                >
                  <td className="px-3 py-3">
                    <Link
                      href={`/contacts/${row.id}`}
                      className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                    >
                      {row.name || `${row.firstName || ""} ${row.lastName || ""}`.trim() || T.unnamed}
                    </Link>
                    <div className="text-xs text-slate-500 truncate max-w-xs">
                      {row.email || T.noEmail}
                    </div>
                    {row.hiddenFromWizard && (
                      <span className="inline-block mt-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">
                        {T.hiddenLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {row.brand ? (
                      <Link href={`/brands/${row.brand.id}`} className="hover:text-[#00b4c3]">
                        {row.brand.name}
                      </Link>
                    ) : row.factory ? (
                      <Link href={`/factories/${row.factory.id}`} className="hover:text-[#00b4c3]">
                        {row.factory.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <VerdictBadge verdict={row.hygieneVerdict} T={T} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ValidityBadge validity={row.emailValidity} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.linkedinUrl ? (
                      <ValidityBadge validity={row.linkedinValidity} />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">
                    {row.hygieneScore ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600 max-w-sm">
                    {row.hygieneFlags.length > 0 ? (
                      <ul className="list-disc pl-4 space-y-0.5">
                        {row.hygieneFlags.slice(0, 3).map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                        {row.hygieneFlags.length > 3 && (
                          <li className="text-slate-400">
                            +{row.hygieneFlags.length - 3} {T.flagsMore}
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className="text-slate-400">{T.flagsClean}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => toggleHidden(row)}
                      className={
                        row.hiddenFromWizard
                          ? "text-xs text-emerald-700 hover:underline font-semibold"
                          : "text-xs text-red-600 hover:underline font-semibold"
                      }
                    >
                      {row.hiddenFromWizard ? T.actionUnhide : T.actionHide}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">
        {T.helpFooter}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "emerald" | "slate" | "violet";
}) {
  const toneMap: Record<string, string> = {
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums mt-1">{value}</p>
    </div>
  );
}

function VerdictBadge({ verdict, T }: { verdict: Verdict | null; T: any }) {
  const map: Record<string, { label: string; cls: string }> = {
    real: { label: T.verdictReal, cls: "bg-emerald-100 text-emerald-700" },
    suspicious: { label: T.verdictSuspect, cls: "bg-amber-100 text-amber-700" },
    placeholder: { label: T.verdictPlaceholder, cls: "bg-red-100 text-red-700" },
    role_account: { label: T.verdictRoleMbx, cls: "bg-slate-200 text-slate-700" },
  };
  const v = verdict && map[verdict];
  if (!v) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
        {T.verdictUnscanned}
      </span>
    );
  }
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${v.cls}`}>
      {v.label}
    </span>
  );
}

function ValidityBadge({ validity }: { validity: string | null }) {
  if (!validity)
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">—</span>
    );
  const map: Record<string, string> = {
    valid: "bg-emerald-100 text-emerald-700",
    invalid: "bg-red-100 text-red-700",
    risky: "bg-amber-100 text-amber-700",
    unknown: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${map[validity] || map.unknown}`}
    >
      {validity}
    </span>
  );
}
