"use client";

/**
 * /brand-portal/network — Phase 5B.
 *
 * Brand-side factory-network management. List supplying factories +
 * pending invitations, add an existing Atlas factory via search, or
 * invite a factory that isn't in Atlas yet.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

interface NetworkFactory {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  specialty: string | null;
}

interface SearchHit extends NetworkFactory {
  alreadyLinked: boolean;
}

interface PendingInvite {
  id: string;
  invitedFactoryName: string;
  invitedContactName: string | null;
  invitedContactEmail: string;
  invitedCountry: string | null;
  invitedAt: string;
}

const EDIT_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

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

export default function BrandPortalNetworkPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.brandPortal.network;

  const canEdit = user && EDIT_ROLES.includes(user.role);

  const [factories, setFactories] = useState<NetworkFactory[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Add modal — search mode by default; flips to invite mode when no
  // search results match.
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Invite mode
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    invitedFactoryName: "",
    invitedContactName: "",
    invitedContactEmail: "",
    invitedContactPhone: "",
    invitedCountry: "",
    notes: "",
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/brand-portal/network").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setFactories(j.factories || []);
      setPending(j.pendingInvites || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!showSearch || searchQ.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const j = await fetch(
          `/api/brand-portal/network/search?q=${encodeURIComponent(searchQ.trim())}`,
        ).then((r) => r.json());
        if (j.ok) setSearchHits(j.factories || []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQ, showSearch]);

  async function addFactory(factoryId: string) {
    setAdding(factoryId);
    try {
      const j = await fetch("/api/brand-portal/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factoryId }),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed");
      setFlash(tx.sentFlash);
      setShowSearch(false);
      setSearchQ("");
      await load();
      setTimeout(() => setFlash(null), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdding(null);
    }
  }

  async function removeFactory(f: NetworkFactory) {
    if (!confirm(tx.removeConfirm.replace("{factory}", f.name))) return;
    setRemoving(f.id);
    try {
      const j = await fetch(`/api/brand-portal/network?factoryId=${encodeURIComponent(f.id)}`, {
        method: "DELETE",
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRemoving(null);
    }
  }

  async function submitInvite() {
    setSubmittingInvite(true);
    setError(null);
    try {
      const j = await fetch("/api/brand-portal/network/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.sendFailed);
      setFlash(tx.sentFlash);
      setShowInvite(false);
      setShowSearch(false);
      setInviteForm({
        invitedFactoryName: "",
        invitedContactName: "",
        invitedContactEmail: "",
        invitedContactPhone: "",
        invitedCountry: "",
        notes: "",
      });
      await load();
      setTimeout(() => setFlash(null), 3000);
    } catch (e: any) {
      setError(e.message || tx.sendFailed);
    } finally {
      setSubmittingInvite(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
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
        {canEdit ? (
          <button
            onClick={() => {
              setShowSearch(true);
              setShowInvite(false);
              setSearchQ("");
            }}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8] shrink-0"
          >
            {tx.addFactoryButton}
          </button>
        ) : null}
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
          <div className="text-2xl font-black text-slate-900">{factories.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statFactories}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statPending}</div>
        </div>
      </div>

      {/* Linked factories */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.networkHeader}</h2>
        </div>
        {factories.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noFactories}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-bold">{tx.colFactory}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colCountry}</th>
                  <th className="text-left px-4 py-2 font-bold">{tx.colSpecialty}</th>
                  {canEdit ? (
                    <th className="text-right px-4 py-2 font-bold">{tx.colActions}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {factories.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">{f.name}</td>
                    <td className="px-4 py-2 text-slate-700">{f.country || "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{f.specialty || "—"}</td>
                    {canEdit ? (
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => removeFactory(f)}
                          disabled={removing === f.id}
                          className="text-xs text-red-600 hover:underline font-semibold disabled:opacity-50"
                        >
                          {removing === f.id ? tx.removing : tx.removeButton}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.pendingHeader}</h2>
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noPending}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="font-semibold text-slate-900">{p.invitedFactoryName}</div>
                <div className="text-xs text-slate-500">
                  {tx.sentTo.replace("{email}", p.invitedContactEmail)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {tx.sentDate.replace("{date}", formatDate(p.invitedAt))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Search modal */}
      {showSearch ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto p-4 pt-16">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {showInvite ? tx.inviteTitle : tx.searchTitle}
              </h2>
              {!showInvite ? <p className="text-xs text-slate-500 mt-1">{tx.searchHint}</p> : null}
              {showInvite ? <p className="text-xs text-slate-500 mt-1">{tx.inviteHint}</p> : null}
            </div>
            <div className="p-6 space-y-3">
              {!showInvite ? (
                <>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder={tx.searchPlaceholder}
                    autoFocus
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  {searchQ.trim().length >= 2 ? (
                    searchHits.length === 0 && !searching ? (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-center">
                        <p className="text-sm text-slate-600 mb-2">{tx.searchEmpty}</p>
                        <button
                          onClick={() => {
                            setShowInvite(true);
                            setInviteForm({
                              ...inviteForm,
                              invitedFactoryName: searchQ,
                            });
                          }}
                          className="text-sm font-semibold text-[#00b4c3] hover:underline"
                        >
                          {tx.searchInvite}
                        </button>
                      </div>
                    ) : (
                      <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {searchHits.map((h) => (
                          <li
                            key={h.id}
                            className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 text-sm">{h.name}</div>
                              <div className="text-xs text-slate-500">
                                {[h.city, h.country].filter(Boolean).join(", ")}
                                {h.specialty ? ` · ${h.specialty}` : ""}
                              </div>
                            </div>
                            {h.alreadyLinked ? (
                              <span className="text-xs text-slate-400 italic">{tx.alreadyLinked}</span>
                            ) : (
                              <button
                                onClick={() => addFactory(h.id)}
                                disabled={adding === h.id}
                                className="px-3 py-1 rounded-md bg-[#00b4c3] text-white text-xs font-bold hover:bg-[#009ba8] disabled:opacity-50"
                              >
                                {adding === h.id ? tx.adding : tx.addNow}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={inviteForm.invitedFactoryName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, invitedFactoryName: e.target.value })
                    }
                    placeholder={tx.inviteFactoryName}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <input
                    type="text"
                    value={inviteForm.invitedContactName}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, invitedContactName: e.target.value })
                    }
                    placeholder={tx.inviteContactName}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <input
                    type="email"
                    value={inviteForm.invitedContactEmail}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, invitedContactEmail: e.target.value })
                    }
                    placeholder={tx.inviteContactEmail}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <input
                    type="text"
                    value={inviteForm.invitedContactPhone}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, invitedContactPhone: e.target.value })
                    }
                    placeholder={tx.inviteContactPhone}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <input
                    type="text"
                    value={inviteForm.invitedCountry}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, invitedCountry: e.target.value })
                    }
                    placeholder={tx.inviteCountry}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  />
                  <textarea
                    value={inviteForm.notes}
                    onChange={(e) => setInviteForm({ ...inviteForm, notes: e.target.value })}
                    placeholder={tx.inviteNotes}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none"
                  />
                </>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSearch(false);
                  setShowInvite(false);
                  setSearchQ("");
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                {tx.cancel}
              </button>
              {showInvite ? (
                <button
                  onClick={submitInvite}
                  disabled={
                    submittingInvite ||
                    !inviteForm.invitedFactoryName ||
                    !inviteForm.invitedContactEmail
                  }
                  className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
                >
                  {submittingInvite ? tx.sending : tx.sendInvite}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
