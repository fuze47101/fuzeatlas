"use client";

/**
 * /factory-portal/spec/[brandId] — NEED-6 spec ack page.
 *
 * Renders the brand's current spec snapshot + the factory's
 * acknowledgement history for that brand. The factory user clicks
 * "I acknowledge" → POSTs to /api/factory-portal/spec-acks/[brandId]
 * → row written → notify fans to brand AM.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import ErrorPanel from "@/components/ErrorPanel";

interface BrandSpec {
  id: string;
  name: string;
  brandSpecUpdatedAt: string | null;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  requiresApproval: boolean;
  protocolDocUrl: string | null;
}

interface AckRow {
  id: string;
  specVersion: string;
  acknowledgedAt: string;
  acknowledgedBy: { id: string; name: string; email: string } | null;
  acknowledgedTier: string | null;
  acknowledgedCadenceBatches: number | null;
  acknowledgedCadenceLiters: number | null;
  acknowledgedProtocolDocUrl: string | null;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FactoryBrandSpecAckPage() {
  const params = useParams<{ brandId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.factoryPortal.brandSpec;
  const brandId = params?.brandId;

  const [brand, setBrand] = useState<BrandSpec | null>(null);
  const [history, setHistory] = useState<AckRow[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justAcked, setJustAcked] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/factory-portal/spec-acks/${encodeURIComponent(brandId)}`);
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setLoadError(j?.error || `Couldn't load spec (HTTP ${r.status}).`);
        return;
      }
      setBrand(j.brand);
      setIsPending(j.isPending);
      setHistory(j.history || []);
    } catch (e: any) {
      setLoadError(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    if (user && user.role !== "FACTORY_USER" && user.role !== "FACTORY_MANAGER" && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/factory-portal");
      return;
    }
    load();
  }, [user, router, load]);

  async function acknowledge() {
    if (!brandId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/factory-portal/spec-acks/${encodeURIComponent(brandId)}`, {
        method: "POST",
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setSubmitError(j?.error || `Submit failed (HTTP ${r.status}).`);
        return;
      }
      setJustAcked(true);
      // Refresh state — history will now include the new row + isPending will be false.
      await load();
    } catch (e: any) {
      setSubmitError(e?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !brand) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <ErrorPanel
          context="Load brand spec"
          error={loadError || "Brand not found"}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            {t.factoryPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.crumbCurrent} — {brand.name}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {brand.name} — {tx.pageTitleFallback}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Last updated{" "}
          <span className="font-semibold text-slate-700">
            {fmtDateTime(brand.brandSpecUpdatedAt)}
          </span>
          .
        </p>
      </div>

      {/* Status pill */}
      {justAcked ? (
        <div className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-900">✓ Acknowledged</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            We've notified {brand.name}'s account manager. The brand portal will mark
            your factory as "spec ack confirmed" on the next page load.
          </p>
        </div>
      ) : isPending ? (
        <div className="mb-5 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">⚠️ Acknowledgement required</p>
          <p className="text-xs text-amber-800 mt-0.5">
            The spec below is newer than your last confirmation. Review and click
            "I acknowledge" so production stays aligned with the current
            requirements.
          </p>
        </div>
      ) : (
        <div className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-900">✓ Spec is current</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            No pending acknowledgement for this brand. History below.
          </p>
        </div>
      )}

      {/* Current spec snapshot */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <h2 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider text-slate-600">
          Current spec
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-0.5">
              Required FUZE tier
            </p>
            <p className="text-lg font-bold text-slate-900">
              {brand.requiredFuzeTier || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-0.5">
              Brand approval required
            </p>
            <p className="text-lg font-bold text-slate-900">
              {brand.requiresApproval ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-0.5">
              ICP cadence — by batches
            </p>
            <p className="text-base text-slate-900">
              {brand.icpCadenceEveryNBatches
                ? `Every ${brand.icpCadenceEveryNBatches} batches`
                : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-0.5">
              ICP cadence — by liters
            </p>
            <p className="text-base text-slate-900">
              {brand.icpCadenceEveryLitersConsumed
                ? `Every ${brand.icpCadenceEveryLitersConsumed.toLocaleString()} L consumed`
                : "Not set"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-bold uppercase text-slate-500 mb-0.5">
              Protocol document
            </p>
            {brand.protocolDocUrl ? (
              <a
                href={brand.protocolDocUrl}
                target="_blank"
                rel="noopener"
                className="text-cyan-700 underline font-medium text-sm"
              >
                Open protocol →
              </a>
            ) : (
              <p className="text-sm text-slate-400">No protocol doc on file</p>
            )}
          </div>
        </div>
      </div>

      {submitError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {isPending && !justAcked && (
        <div className="mb-6">
          <button
            onClick={acknowledge}
            disabled={submitting}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold"
          >
            {submitting ? "Recording…" : `I acknowledge ${brand.name}'s updated spec`}
          </button>
          <p className="text-[11px] text-slate-500 mt-2">
            Acknowledgement is logged with your name + timestamp. The brand's AM gets
            an in-app notification on confirmation.
          </p>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">Acknowledgement history</h2>
        </div>
        {history.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">
            No prior acknowledgements on file.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">
                      {h.acknowledgedBy?.name || h.acknowledgedBy?.email || "Factory user"}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Spec version {fmtDateTime(h.specVersion)} · tier{" "}
                      <span className="font-mono">{h.acknowledgedTier || "—"}</span>
                      {h.acknowledgedCadenceBatches != null && (
                        <> · {h.acknowledgedCadenceBatches} batches</>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {fmtDateTime(h.acknowledgedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
