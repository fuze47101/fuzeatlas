"use client";

/**
 * /factory-portal/network — Phase 5C.
 *
 * Mirror of /brand-portal/network from the factory side. Lists
 * brands the caller's factory supplies plus any pending
 * FactoryInvitation rows the factory can accept (matched by email
 * or pre-linked).
 *
 * Auto-accepts a token from the URL ?invitation= param so the public
 * landing's "We're already in Atlas" CTA works end-to-end.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";

interface BrandRow {
  id: string;
  name: string;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  profile: { logoUrl: string | null } | null;
}

interface PendingInvite {
  id: string;
  invitedFactoryName: string;
  invitedContactEmail: string;
  invitedAt: string;
  inviteToken: string;
  brand: {
    id: string;
    name: string;
    profile: { logoUrl: string | null } | null;
  };
}

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

export default function FactoryNetworkPage() {
  const { t } = useI18n();
  const tx = t.factoryPortal.network;
  const search = useSearchParams();

  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [autoConsumed, setAutoConsumed] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/factory-portal/network").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setBrands(j.brands || []);
      setPending(j.pending || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function accept(token: string) {
    setAccepting(token);
    try {
      const j = await fetch("/api/factory-portal/network/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.acceptFailed);
      setFlash(tx.acceptFlash);
      setTimeout(() => setFlash(null), 4000);
      await load();
    } catch (e: any) {
      setError(e.message || tx.acceptFailed);
    } finally {
      setAccepting(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Auto-accept the token from the URL once on first load.
  useEffect(() => {
    if (autoConsumed) return;
    const token = search?.get("invitation");
    if (!token || loading) return;
    setAutoConsumed(true);
    if (pending.some((p) => p.inviteToken === token)) {
      accept(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, loading, pending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/factory-portal" className="hover:text-[#00b4c3]">
            {t.factoryPortal.crumb}
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

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-slate-900">{brands.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statBrands}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statPending}</div>
        </div>
      </div>

      {/* Pending invitations first — they're the action items */}
      {pending.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b bg-amber-50">
            <h2 className="font-bold text-amber-900 text-sm">{tx.pendingHeader}</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {p.brand.profile?.logoUrl ? (
                    <img
                      src={p.brand.profile.logoUrl}
                      alt={p.brand.name}
                      className="h-10 w-10 rounded-lg object-contain bg-slate-100 p-1 shrink-0"
                    />
                  ) : null}
                  <div>
                    <div className="font-bold text-slate-900">
                      {tx.from.replace("{brand}", p.brand.name)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tx.sentTo.replace("{email}", p.invitedContactEmail)}
                    </div>
                    <div className="text-xs text-slate-400">
                      {tx.sentDate.replace("{date}", formatDate(p.invitedAt))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => accept(p.inviteToken)}
                  disabled={accepting === p.inviteToken}
                  className="px-4 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
                >
                  {accepting === p.inviteToken ? tx.accepting : tx.acceptButton}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Brands */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.brandsHeader}</h2>
        </div>
        {brands.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noBrands}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {brands.map((b) => (
              <li key={b.id} className="px-5 py-4 flex items-start gap-3">
                {b.profile?.logoUrl ? (
                  <img
                    src={b.profile.logoUrl}
                    alt={b.name}
                    className="h-10 w-10 rounded-lg object-contain bg-slate-100 p-1 shrink-0"
                  />
                ) : null}
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{b.name}</div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs">
                    {b.requiredFuzeTier ? (
                      <span className="rounded-md bg-cyan-50 ring-1 ring-cyan-200 text-cyan-800 px-2.5 py-0.5 font-semibold">
                        {tx.tierLabel.replace("{tier}", b.requiredFuzeTier)}
                      </span>
                    ) : null}
                    {b.icpCadenceEveryNBatches ? (
                      <span className="rounded-md bg-slate-50 ring-1 ring-slate-200 text-slate-700 px-2.5 py-0.5">
                        {tx.cadenceOrders.replace("{n}", String(b.icpCadenceEveryNBatches))}
                      </span>
                    ) : null}
                    {b.icpCadenceEveryLitersConsumed ? (
                      <span className="rounded-md bg-slate-50 ring-1 ring-slate-200 text-slate-700 px-2.5 py-0.5">
                        {tx.cadenceLiters.replace("{n}", String(b.icpCadenceEveryLitersConsumed))}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
