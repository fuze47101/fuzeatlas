"use client";

/**
 * <OrgTeamPage /> — NEED-7a shared team roster surface.
 *
 * Used by `/factory-portal/team`, `/distributor-portal/team`, and
 * `/lab-portal/team`. Renders the active teammate list + pending
 * invitations + (for admins) an invite form and a revoke action.
 *
 * Each portal page imports this and passes:
 *   - apiPath     e.g. "/api/factory-portal/team"
 *   - portalLabel e.g. "Factory Portal"
 *   - portalHref  e.g. "/factory-portal"
 *   - inviteRoles e.g. ["FACTORY_USER", "FACTORY_MANAGER"]
 *   - defaultRole e.g. "FACTORY_USER"
 *   - entityKey   "factory" | "distributor" | "lab" (used to read the
 *                 entity name out of the API response)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ErrorPanel from "@/components/ErrorPanel";

interface Teammate {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  createdAt: string;
  expiresAt: string;
  invitedByName: string | null;
}

interface Props {
  apiPath: string;
  portalLabel: string;
  portalHref: string;
  inviteRoles: string[];
  defaultRole: string;
  entityKey: "factory" | "distributor" | "lab";
}

function fmtDate(iso: string | null) {
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

export default function OrgTeamPage({
  apiPath,
  portalLabel,
  portalHref,
  inviteRoles,
  defaultRole,
  entityKey,
}: Props) {
  const [entityName, setEntityName] = useState<string | null>(null);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    role: defaultRole,
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(apiPath);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setLoadError(j?.error || `Couldn't load team (HTTP ${res.status}).`);
        return;
      }
      const ent = j[entityKey];
      setEntityName(ent?.name || null);
      setTeammates(j.teammates || []);
      setPending(j.pendingInvites || []);
      setCanManage(!!j.canManage);
    } catch (e: any) {
      setLoadError(e?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }, [apiPath, entityKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitInvite() {
    if (!form.email) {
      setError("Email is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      const preExisting = j.invite?.preExisting;
      setFlash(
        preExisting
          ? `Reminder sent — invitation refreshed for ${form.email}.`
          : `Invitation sent to ${form.email}.`,
      );
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        jobTitle: "",
        role: defaultRole,
        notes: "",
      });
      setTimeout(() => setFlash(null), 4000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Send failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvite(invitationId: string) {
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    setRevoking(invitationId);
    setError(null);
    try {
      const res = await fetch(
        `${apiPath}?invitationId=${encodeURIComponent(invitationId)}`,
        { method: "DELETE" },
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      setFlash("Invitation revoked.");
      setTimeout(() => setFlash(null), 3000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Revoke failed.");
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="h-64 flex items-center justify-center text-slate-400">Loading team…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href={portalHref} className="hover:text-[#00b4c3]">
              {portalLabel}
            </Link>
            <span>›</span>
            <span>Team</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Team</h1>
        </div>
        <ErrorPanel
          context={`Load ${entityKey} team`}
          error={loadError}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href={portalHref} className="hover:text-[#00b4c3]">
            {portalLabel}
          </Link>
          <span>›</span>
          <span>Team</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">
          {entityName ? `${entityName} — team` : "Team"}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage who can sign in to FUZE Atlas on behalf of {entityName || "your organization"}.
          Invitations expire after 14 days. No FUZE admin in the loop.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {flash && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          {flash}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-slate-900">{teammates.length}</div>
          <div className="text-xs text-slate-500 mt-1">Teammates</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-1">Pending invites</div>
        </div>
      </div>

      {canManage && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
          <h2 className="font-bold text-slate-900 mb-1">Invite teammate</h2>
          <p className="text-xs text-slate-500 mb-4">
            We&apos;ll email a one-time signup link. They set a password; we provision the
            account with their role pre-stamped.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="First name (optional)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Last name (optional)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email (required)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <input
              type="text"
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              placeholder="Job title (optional)"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            >
              {inviteRoles.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Internal notes (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] resize-none mb-3"
          />
          <button
            onClick={submitInvite}
            disabled={submitting || !form.email}
            className="px-5 py-2 rounded-lg bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009ba8] disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send invite"}
          </button>
        </div>
      )}

      {/* Teammates */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">Teammates</h2>
        </div>
        {teammates.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">No teammates yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {teammates.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{t.name || t.email}</div>
                  <div className="text-xs text-slate-500">{t.email}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    role: <span className="font-medium">{t.role.replace(/_/g, " ").toLowerCase()}</span>{" "}
                    · joined {fmtDate(t.createdAt)}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    t.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {t.status === "ACTIVE" ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invites */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">Pending invites</h2>
        </div>
        {pending.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-10">No pending invitations.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {p.firstName || p.lastName
                      ? `${p.firstName || ""} ${p.lastName || ""}`.trim()
                      : p.email}
                  </div>
                  <div className="text-xs text-slate-500">{p.email}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    role: <span className="font-medium">{p.role.replace(/_/g, " ").toLowerCase()}</span>
                    {p.invitedByName ? ` · invited by ${p.invitedByName}` : ""}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    sent {fmtDate(p.createdAt)} · expires {fmtDate(p.expiresAt)}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => revokeInvite(p.id)}
                    disabled={revoking === p.id}
                    className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold border border-red-200 disabled:opacity-50"
                  >
                    {revoking === p.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
