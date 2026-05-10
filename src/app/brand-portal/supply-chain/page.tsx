"use client";

/**
 * Brand Supply Chain dashboard.
 *
 * Built May 2026 as the missing piece behind Andrew's email to Joseph
 * at KUIU: "you get visibility over all factories in your supply chain
 * that are supplying fabrics. Each time they submit for testing to our
 * lab you are notified of the submission and the results for approval
 * QA and oversight." The notifications shipped earlier this week; this
 * is the page Joseph opens to see the rollup.
 *
 * No edit affordances yet — pure read-only dashboard. Edit/approval
 * surfaces (per-fabric approve/reject, set ICP cadence) come in
 * subsequent commits as separate tasks (#39 and #40 on the roadmap).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface FactoryRow {
  factoryId: string;
  factoryName: string;
  country: string | null;
  city: string | null;
  fabricCount: number;
  submissionCount: number;
  lastSubmissionAt: string | null;
  testRunsTotal: number;
  testRunsPassed: number;
  openTestRequests: number;
  lastTestRun: {
    id: string;
    testDate: string | null;
    testType: string | null;
    passed: boolean;
    brandVisible: boolean | null;
  } | null;
  consumptionLitersTotal: number;
  lastConsumptionAt: string | null;
  lastConsumptionTier: string | null;
}

interface Totals {
  factories: number;
  fabrics: number;
  submissions: number;
  testsTotal: number;
  testsPassed: number;
  openTestRequests: number;
  consumptionLitersTotal: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatLiters(n: number): string {
  if (!n) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k L`;
  if (n >= 100) return `${Math.round(n)} L`;
  return `${n.toFixed(1)} L`;
}

function StatusBadge({ row, tx }: { row: FactoryRow; tx: ReturnType<typeof useI18n>["t"]["brandPortal"]["supplyChain"] }) {
  if (row.openTestRequests > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
        {tx.statusOpen.replace("{n}", String(row.openTestRequests))}
      </span>
    );
  }
  if (row.testRunsTotal === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        {tx.statusNoTests}
      </span>
    );
  }
  const passRate = row.testRunsTotal > 0 ? row.testRunsPassed / row.testRunsTotal : 0;
  const pct = String(Math.round(passRate * 100));
  if (passRate >= 0.9) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        {tx.statusPassRateOk.replace("{pct}", pct)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300">
      {tx.statusPassRate.replace("{pct}", pct)}
    </span>
  );
}

export default function BrandSupplyChainPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.supplyChain;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<
    | {
        id: string;
        name: string;
        requiredFuzeTier?: string | null;
        icpCadenceEveryNBatches?: number | null;
        icpCadenceEveryLitersConsumed?: number | null;
        protocolDocUrl?: string | null;
      }
    | null
  >(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [factories, setFactories] = useState<FactoryRow[]>([]);
  // Recipe-request modal state — Phase 4C affordance.
  const [recipeFor, setRecipeFor] = useState<FactoryRow | null>(null);
  const [recipeForm, setRecipeForm] = useState<{ tier: string; fabricId: string; notes: string }>({
    tier: "",
    fabricId: "",
    notes: "",
  });
  const [recipeSubmitting, setRecipeSubmitting] = useState(false);
  const [recipeFlash, setRecipeFlash] = useState<string | null>(null);
  const trx = t.brandPortal.recipeRequest;

  async function submitRecipeRequest() {
    if (!recipeFor) return;
    setRecipeSubmitting(true);
    setRecipeFlash(null);
    try {
      const r = await fetch("/api/brand-portal/recipe-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factoryId: recipeFor.factoryId,
          requestedTier: recipeForm.tier || null,
          fabricId: recipeForm.fabricId || null,
          notes: recipeForm.notes || null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || trx.submitFailed);
      setRecipeFlash(trx.successFlash);
      setRecipeFor(null);
      setRecipeForm({ tier: "", fabricId: "", notes: "" });
      setTimeout(() => setRecipeFlash(null), 3000);
    } catch (e: any) {
      setRecipeFlash(e?.message || trx.submitFailed);
    } finally {
      setRecipeSubmitting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/brand-portal/supply-chain")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error || tx.errorFallback);
          return;
        }
        setBrand(j.brand);
        setTotals(j.totals);
        setFactories(j.factories || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || tx.networkError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {tx.loading}
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            {t.brandPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {tx.pageTitle}
          {brand?.name ? <span className="text-slate-400 font-normal"> — {brand.name}</span> : null}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>

        {/* Brand-stipulated spec strip — what every factory in this
            supply chain is being held to. Click "Edit spec" to update. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-500">{tx.specHeader}</span>
          {brand?.requiredFuzeTier ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">{tx.specTierLabel}</span>{" "}
              <span className="text-[#00b4c3] font-bold">{brand.requiredFuzeTier}</span>
            </span>
          ) : (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 text-slate-400">
              {tx.specNoTier}
            </span>
          )}
          {brand?.icpCadenceEveryNBatches ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">{tx.specIcpEvery}</span>{" "}
              {(brand.icpCadenceEveryNBatches === 1 ? tx.specIcpOrders : tx.specIcpOrdersPlural).replace(
                "{n}",
                String(brand.icpCadenceEveryNBatches),
              )}
            </span>
          ) : null}
          {brand?.icpCadenceEveryLitersConsumed ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
              <span className="font-semibold text-slate-700">{tx.specIcpEvery}</span>{" "}
              {tx.specIcpLiters.replace("{n}", String(brand.icpCadenceEveryLitersConsumed))}
            </span>
          ) : null}
          {!brand?.icpCadenceEveryNBatches && !brand?.icpCadenceEveryLitersConsumed ? (
            <span className="rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 text-slate-400">
              {tx.specNoCadence}
            </span>
          ) : null}
          {brand?.protocolDocUrl ? (
            <a
              href={brand.protocolDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-indigo-50 px-2 py-1 ring-1 ring-indigo-200 text-indigo-700 hover:bg-indigo-100"
            >
              {tx.protocolDoc}
            </a>
          ) : null}
          <Link
            href="/brand-portal/spec"
            className="ml-auto text-[#00b4c3] hover:underline font-semibold"
          >
            {tx.editSpec}
          </Link>
        </div>
      </div>

      {/* Totals strip */}
      {totals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-[#00b4c3]">{totals.factories}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalFactories}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">{totals.fabrics}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalFabrics}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-slate-700">{totals.submissions}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalSubmissions}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-emerald-600">{totals.testsPassed}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalTestsPassed}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-black text-amber-500">{totals.openTestRequests}</div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalOpenRequests}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border col-span-2">
            <div className="text-2xl font-black text-slate-900">
              {formatLiters(totals.consumptionLitersTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1">{tx.totalFuzeConsumed}</div>
          </div>
        </div>
      ) : null}

      {/* Factory table */}
      {factories.length === 0 ? (
        <div className="bg-white rounded-xl p-10 border border-dashed border-slate-300 text-center">
          <div className="text-5xl mb-3">🏭</div>
          <div className="text-base font-bold text-slate-900 mb-1">{tx.noFactoriesTitle}</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{tx.noFactoriesBlurb}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-bold">{tx.colFactory}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colFabrics}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colSubmissions}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLastSubmission}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLastTest}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colStatus}</th>
                  <th className="text-right px-4 py-3 font-bold">{tx.colFuzeConsumed}</th>
                  <th className="text-left px-4 py-3 font-bold">{tx.colLastRun}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factories.map((row) => (
                  <tr key={row.factoryId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/factories/${row.factoryId}`}
                        className="font-semibold text-slate-900 hover:text-[#00b4c3]"
                      >
                        {row.factoryName}
                      </Link>
                      {row.country || row.city ? (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {[row.city, row.country].filter(Boolean).join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{row.fabricCount}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.submissionCount}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.lastSubmissionAt)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.lastTestRun ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700">
                            {row.lastTestRun.testType || tx.testFallback}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(row.lastTestRun.testDate)}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge row={row} tx={tx} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatLiters(row.consumptionLitersTotal)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex flex-col">
                        <span>{formatDate(row.lastConsumptionAt)}</span>
                        {row.lastConsumptionTier ? (
                          <span className="text-xs text-slate-400">
                            {row.lastConsumptionTier}
                          </span>
                        ) : null}
                      </div>
                      <button
                        onClick={() => {
                          setRecipeFor(row);
                          setRecipeForm({ tier: "", fabricId: "", notes: "" });
                        }}
                        className="mt-2 text-[11px] font-semibold text-[#00b4c3] hover:underline"
                      >
                        {trx.cta} →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-6">{tx.footerNote}</p>

      {recipeFlash ? (
        <div className="fixed bottom-6 right-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 shadow-lg z-50">
          {recipeFlash}
        </div>
      ) : null}

      {recipeFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {trx.modalTitle.replace("{factory}", recipeFor.factoryName)}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {trx.tierLabel}
                </label>
                <select
                  value={recipeForm.tier}
                  onChange={(e) => setRecipeForm({ ...recipeForm, tier: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                >
                  <option value="">{trx.tierPlaceholder}</option>
                  <option value="F1">F1</option>
                  <option value="F2">F2</option>
                  <option value="F3">F3</option>
                  <option value="F4">F4</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {trx.fabricLabel}
                </label>
                <input
                  type="text"
                  value={recipeForm.fabricId}
                  onChange={(e) => setRecipeForm({ ...recipeForm, fabricId: e.target.value })}
                  placeholder={trx.fabricPlaceholder}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {trx.notesLabel}
                </label>
                <textarea
                  value={recipeForm.notes}
                  onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                  placeholder={trx.notesPlaceholder}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setRecipeFor(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                {trx.cancel}
              </button>
              <button
                onClick={submitRecipeRequest}
                disabled={recipeSubmitting}
                className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
              >
                {recipeSubmitting ? trx.submitting : trx.submit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
