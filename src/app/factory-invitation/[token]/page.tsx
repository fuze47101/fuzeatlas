"use client";

/**
 * /factory-invitation/[token] — Phase 5B public landing.
 *
 * Anonymous (no auth) — middleware exempts this path. Reads the
 * invitation by token, shows brand context, offers two CTAs:
 *   1. Sign up — creates a fresh Factory + User + SupplyChainLink
 *      via the existing /request-factory-access flow with the token
 *      threaded through.
 *   2. Already in Atlas — sends to /login with a return URL that
 *      drops the user into /factory-portal/network with the
 *      invitation pre-loaded for one-click accept.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n";

interface Invitation {
  id: string;
  brandId: string;
  invitedFactoryName: string;
  invitedContactName: string | null;
  invitedContactEmail: string;
  invitedCountry: string | null;
  notes: string | null;
  status: string;
  invitedAt: string;
  respondedAt: string | null;
  brand: {
    id: string;
    name: string;
    profile: {
      logoUrl: string | null;
      primaryColor: string | null;
      supportEmail: string | null;
      heroHeadline: string | null;
    } | null;
  };
}

export default function FactoryInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token as string | undefined;
  const { t } = useI18n();
  const T = t.factoryInvitation;

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/factory-invitations/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error || "Invitation not found");
        setInvitation(j.invitation);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        {T.loadingState}
      </div>
    );
  }
  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">{T.notFoundTitle}</h1>
          <p className="text-slate-400">
            {error || T.notFoundFallback}
          </p>
        </div>
      </div>
    );
  }

  const brand = invitation.brand;
  const accent = brand.profile?.primaryColor || "#00b4c3";
  const closed = invitation.status !== "PENDING";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6">
        {/* Brand chip */}
        <div className="flex items-center gap-3 mb-8">
          {brand.profile?.logoUrl ? (
            <img
              src={brand.profile.logoUrl}
              alt={`${brand.name} logo`}
              className="h-12 w-12 rounded-xl object-contain bg-white p-1"
            />
          ) : null}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              {T.chipLabel}
            </div>
            <div className="text-lg font-bold">{brand.name}</div>
          </div>
          <div
            className="ml-auto h-12 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">
          {brand.name} {T.headingMiddle}{" "}
          <span style={{ color: accent }}>{invitation.invitedFactoryName}</span> {T.headingSuffix}
        </h1>
        <p className="text-base text-slate-300 mb-8 max-w-2xl">
          {brand.profile?.heroHeadline ||
            `${brand.name} ${T.heroSubtitleFallbackPrefix} ${T.heroSubtitleFallbackSuffix}`}
        </p>

        {/* Notes from inviter */}
        {invitation.notes ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 mb-8 text-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              {T.notePrefix} {brand.name}
            </div>
            <p className="text-slate-200 whitespace-pre-wrap">{invitation.notes}</p>
          </div>
        ) : null}

        {/* CTAs */}
        {closed ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-100">
            {T.closedPrefix}{" "}
            <strong>{invitation.status.toLowerCase()}</strong>. {T.closedReachOutPrefix}{" "}
            {brand.profile?.supportEmail || `${T.closedTeamFallbackPrefix} ${brand.name} ${T.closedTeamFallbackSuffix}`} {T.closedFreshLink}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={`/request-factory-access?invitation=${encodeURIComponent(token!)}&factory=${encodeURIComponent(invitation.invitedFactoryName)}&email=${encodeURIComponent(invitation.invitedContactEmail)}`}
              className="block rounded-2xl p-6 text-center font-bold text-lg transition-all hover:opacity-90 shadow-lg"
              style={{ backgroundColor: accent, color: "#fff" }}
            >
              {T.signUpCta}
              <div className="text-xs font-normal opacity-90 mt-1">
                {T.signUpSubPrefix} {invitation.invitedFactoryName} {T.signUpSubSuffix}
              </div>
            </a>
            <a
              href={`/login?next=${encodeURIComponent(`/factory-portal/network?invitation=${token}`)}`}
              className="block rounded-2xl p-6 text-center font-bold text-lg bg-white/10 border border-white/20 hover:bg-white/15 transition-all"
            >
              {T.alreadyInCta}
              <div className="text-xs font-normal opacity-80 mt-1">
                {T.alreadyInSub}
              </div>
            </a>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-12">
          {T.sentPrefix} {new Date(invitation.invitedAt).toLocaleDateString()}
          {brand.profile?.supportEmail
            ? ` ${T.questionsPrefix} ${brand.profile.supportEmail}`
            : ""}
        </p>
      </div>
    </div>
  );
}
