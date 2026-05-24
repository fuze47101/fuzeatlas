"use client";

/**
 * /signup/invitation/[token] — NEED-7a magic-link signup.
 *
 * Lands here after clicking the invitation email. Peeks the
 * invitation via GET /api/auth/invitation/[token], renders the
 * "Joining {Org} as {role}" page, lets the new user set a password,
 * and POSTs to the same endpoint to create the account + sign in.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface InvitationPreview {
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  entityType: string;
  entityName: string;
  invitedByName: string | null;
  expiresAt: string;
}

export default function InvitationSignupPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token;
  const { t } = useI18n();
  const T = t.signupInvitation;

  const [invite, setInvite] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/invitation/${encodeURIComponent(token)}`);
        const j = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !j?.ok) {
          setLoadError(j?.error || `HTTP ${res.status}`);
          return;
        }
        setInvite(j.invitation);
        const suggested = [j.invitation.firstName, j.invitation.lastName]
          .filter(Boolean)
          .join(" ");
        if (suggested) setName(suggested);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || T.errServerUnreachable);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, T.errServerUnreachable]);

  async function submit() {
    setError(null);
    if (!password || password.length < 8) {
      setError(T.errPasswordTooShort);
      return;
    }
    if (password !== passwordConfirm) {
      setError(T.errPasswordsMismatch);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/invitation/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, name: name.trim() || undefined }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setError(j?.error || `HTTP ${res.status}`);
        return;
      }
      router.push(j.landing || "/dashboard");
    } catch (e: any) {
      setError(e?.message || T.errNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <h1 className="text-lg font-bold text-red-900 mb-1">{T.problemTitle}</h1>
          <p className="text-sm text-red-800 mb-4">{loadError || T.problemDefault}</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-bold hover:bg-[#009ba8]"
          >
            {T.goToSignIn}
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel = invite.role.replace(/_/g, " ").toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-slate-200">
        <div className="px-6 pt-6 pb-3 border-b border-slate-100">
          <div className="text-[10px] uppercase tracking-widest text-[#00b4c3] font-bold mb-1">
            {T.appKicker}
          </div>
          <h1 className="text-xl font-black text-slate-900">
            {T.joinPrefix} {invite.entityName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {invite.invitedByName ? `${invite.invitedByName} ${T.invitedSuffix}` : T.youWereInvited} {T.asLabel}
            <span className="font-semibold"> {roleLabel}</span>.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              {T.emailLabel}
            </label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
              {invite.email}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              {T.yourNameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={T.fullNamePlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              {T.passwordLabel}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={T.passwordPlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              {T.confirmPasswordLabel}
            </label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder={T.confirmPasswordPlaceholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={submitting || !password || !passwordConfirm}
            className="w-full px-4 py-2.5 bg-[#00b4c3] hover:bg-[#009ba8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-colors"
          >
            {submitting ? T.creatingBtn : T.acceptBtn}
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            {T.expiresPrefix}{" "}
            {new Date(invite.expiresAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            .
          </p>
        </div>
      </div>
    </div>
  );
}
