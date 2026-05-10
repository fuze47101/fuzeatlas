"use client";

/**
 * /brand-portal/team — Phase 5A.
 *
 * List teammates on the caller's brand + pending invitations.
 * Brand managers + admins can invite; brand users see the same
 * read-only view minus the invite form.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

interface Teammate {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  jobTitle: string | null;
  createdAt: string;
}

const INVITE_ROLES = ["ADMIN", "EMPLOYEE", "BRAND_MANAGER", "SALES_MANAGER", "SALES_REP"];

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

export default function BrandPortalTeamPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.brandPortal.team;

  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    notes: "",
  });

  const canInvite = user && INVITE_ROLES.includes(user.role);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch("/api/brand-portal/team").then((r) => r.json());
      if (!j.ok) throw new Error(j.error || "Failed to load");
      setBrand(j.brand);
      setTeammates(j.teammates || []);
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

  async function submitInvite() {
    if (!form.firstName || !form.email) return;
    setSubmitting(true);
    setError(null);
    setFlash(null);
    try {
      const j = await fetch("/api/brand-portal/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error || tx.sendFailed);
      setFlash(tx.sentFlash);
      setForm({ firstName: "", lastName: "", email: "", jobTitle: "", notes: "" });
      setTimeout(() => setFlash(null), 4000);
      await load();
    } catch (e: any) {
      setError(e.message || tx.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">{tx.loading}</div>
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

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-slate-900">{teammates.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statTeammates}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-1">{tx.statPending}</div>
        </div>
      </div>

      {canInvite ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <h2 className="font-bold text-slate-900 mb-1">{tx.inviteHeader}</h2>
          <p className="text-xs text-slate-500 mb-4">{tx.inviteHint}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder={tx.firstNamePlaceholder}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder={tx.lastNamePlaceholder}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={tx.emailPlaceholder}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder={tx.jobTitlePlaceholder}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={tx.notesPlaceholder}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none mb-3"
          />
          <button
            onClick={submitInvite}
            disabled={submitting || !form.firstName || !form.email}
            className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
          >
            {submitting ? tx.sending : tx.sendInvite}
          </button>
        </div>
      ) : null}

      {/* Teammates */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">{tx.teammatesHeader}</h2>
        </div>
        {teammates.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">{tx.noTeammates}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {teammates.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{t.name || t.email}</div>
                  <div className="text-xs text-slate-500">{t.email}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {tx.roleLabel.replace("{role}", t.role)} ·{" "}
                    {t.lastLoginAt
                      ? tx.lastLogin.replace("{date}", formatDate(t.lastLoginAt))
                      : tx.neverLoggedIn}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    t.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {t.status === "ACTIVE" ? tx.statusActive : tx.statusInactive}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invites */}
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
                <div className="font-semibold text-slate-900">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-xs text-slate-500">{p.email}</div>
                {p.jobTitle ? (
                  <div className="text-xs text-slate-500">{p.jobTitle}</div>
                ) : null}
                <div className="text-xs text-slate-400 mt-0.5">
                  {tx.sentAt.replace("{date}", formatDate(p.createdAt))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
