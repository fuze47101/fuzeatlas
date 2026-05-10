"use client";

/**
 * /factory-portal/recipe-requests — Phase 4C.
 *
 * Lists every RecipeRequest pointed at the caller's factory, grouped
 * by status. The OPEN section gets an "Acknowledge" button per row
 * that flips status to IN_DEVELOPMENT (factory-side ack). Once
 * acknowledged, the row sits in IN_DEVELOPMENT until FUZE Ops
 * attaches a graduated recipe via the admin endpoint.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface RecipeReq {
  id: string;
  brandId: string;
  factoryId: string;
  fabricId: string | null;
  requestedTier: string | null;
  notes: string | null;
  status: string;
  requestedAt: string;
  fulfilledRecipeId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  brand: { id: string; name: string } | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-amber-100", text: "text-amber-800" },
  IN_DEVELOPMENT: { bg: "bg-blue-100", text: "text-blue-800" },
  RECIPE_PROVIDED: { bg: "bg-emerald-100", text: "text-emerald-800" },
  DECLINED: { bg: "bg-red-100", text: "text-red-800" },
  EXPIRED: { bg: "bg-slate-100", text: "text-slate-700" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function FactoryRecipeRequestsPage() {
  const { t } = useI18n();
  const tx = t.factoryPortal.recipeRequests;
  const [requests, setRequests] = useState<RecipeReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);

  function statusLabel(s: string) {
    switch (s) {
      case "OPEN":
        return tx.statusOpen;
      case "IN_DEVELOPMENT":
        return tx.statusInDevelopment;
      case "RECIPE_PROVIDED":
        return tx.statusRecipeProvided;
      case "DECLINED":
        return tx.statusDeclined;
      case "EXPIRED":
        return tx.statusExpired;
      default:
        return s;
    }
  }

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/factory-portal/recipe-requests").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setRequests(j.requests || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function ack(id: string) {
    setAcking(id);
    try {
      const j = await fetch("/api/factory-portal/recipe-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.ackFailed);
      await load();
    } catch (e: any) {
      setError(e.message || tx.ackFailed);
    } finally {
      setAcking(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            {t.factoryPortal.crumb}
          </Link>
          <span>›</span>
          <span>{tx.pageTitle}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{tx.pageTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{tx.pageSubtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <div className="text-5xl mb-3">🧪</div>
          <div className="text-base font-bold text-slate-900 mb-1">{tx.empty}</div>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{tx.emptyBlurb}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const style = STATUS_STYLE[r.status] || STATUS_STYLE.OPEN;
            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">
                        {tx.brandLabel.replace("{name}", r.brand?.name || "—")}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
                        {statusLabel(r.status)}
                      </span>
                      {r.requestedTier ? (
                        <span className="text-xs text-slate-500">
                          {tx.tierLabel.replace("{tier}", r.requestedTier)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {tx.requestedAt.replace("{date}", formatDate(r.requestedAt))}
                    </p>
                  </div>
                  {r.status === "OPEN" ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => ack(r.id)}
                        disabled={acking === r.id}
                        className="px-4 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
                      >
                        {acking === r.id ? tx.acking : tx.ackButton}
                      </button>
                      <p className="text-[11px] text-slate-400 max-w-[180px] text-right">
                        {tx.ackHint}
                      </p>
                    </div>
                  ) : null}
                </div>
                {r.notes ? (
                  <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <span className="font-bold text-slate-500">{tx.notesLabel}:</span> {r.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
