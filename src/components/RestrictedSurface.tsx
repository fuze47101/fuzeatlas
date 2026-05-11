"use client";

/**
 * <RestrictedSurface /> — Phase 15 IMP-2.
 *
 * Replaces bare "Forbidden" / 403 walls with an explainer that
 * shows:
 *   - Which role gates this feature
 *   - Who at the caller's brand / factory / etc. currently has
 *     that role (best-effort — empty if the caller has no scope)
 *   - A "Request access" button that opens a
 *     RoleEscalationRequest (POST /api/brand-portal/request-role
 *     for now; extend to other portals as adoption rolls out).
 *
 * Pages render this when their gating API returns 403. The
 * component is deliberately presentational + state-less: callers
 * pre-fetch the "who currently has this role" list (typically
 * from EntityManager) and pass it in.
 */
import { useState } from "react";

export interface TeammateLite {
  id: string;
  name: string;
  email?: string | null;
  role: string;
}

interface Props {
  requiredRole: string;
  /** Human label for the gated feature ("Brand approvals queue"). */
  featureLabel: string;
  /** Scope kind. */
  scope: "brand" | "factory" | "distributor" | "lab";
  /** Entity id of the scope (brandId / factoryId / ...). Optional. */
  scopeId?: string | null;
  /** Caller's current role (rendered for context). */
  currentRole?: string;
  /** Teammates at this scope who DO hold the required role. */
  teamWithRole?: TeammateLite[];
  /** Brief justification of why the role is gated. */
  rationale?: string;
}

export default function RestrictedSurface({
  requiredRole,
  featureLabel,
  scope,
  scopeId,
  currentRole,
  teamWithRole = [],
  rationale,
}: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestAccess() {
    if (!scopeId) {
      setError("Missing scope — can't request access without a brand/factory/lab id.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        scope === "brand"
          ? "/api/brand-portal/request-role"
          : scope === "factory"
            ? "/api/factory-portal/request-role"
            : scope === "lab"
              ? "/api/lab-portal/request-role"
              : "/api/distributor-portal/request-role";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          scopeId,
          requestedRole: requiredRole,
          reason: reason.trim() || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Request failed");
      setSubmitted({ id: j.request?.id || "ok" });
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 sm:p-8">
          <p className="text-2xl mb-2" aria-hidden="true">✓</p>
          <h1 className="text-xl font-black text-emerald-900">Access requested</h1>
          <p className="text-sm text-emerald-900 mt-2">
            We notified the right people. You'll get an in-app + email update
            when the request is approved.
          </p>
          {teamWithRole.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                You can also reach out directly
              </p>
              <ul className="mt-2 text-sm text-emerald-900 space-y-1">
                {teamWithRole.map((m) => (
                  <li key={m.id}>
                    <span className="font-bold">{m.name}</span>
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        className="ml-2 text-[#0c7a82] hover:underline"
                      >
                        {m.email}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
          Restricted — manager role required
        </p>
        <h1 className="text-xl font-black text-slate-900">
          {featureLabel} is gated to {humanRole(requiredRole)}
        </h1>
        {rationale && <p className="text-sm text-slate-700 mt-2">{rationale}</p>}
        {currentRole && (
          <p className="text-xs text-slate-600 mt-2">
            Your role: <span className="font-mono">{currentRole}</span>
          </p>
        )}

        {teamWithRole.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Teammates with that role
            </p>
            <ul className="mt-2 text-sm text-slate-800 space-y-1">
              {teamWithRole.map((m) => (
                <li key={m.id}>
                  <span className="font-bold">{m.name}</span>
                  {m.email && (
                    <a
                      href={`mailto:${m.email}`}
                      className="ml-2 text-[#00b4c3] hover:underline"
                    >
                      {m.email}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Why do you need this access?
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Optional. Helps the approver decide quickly."
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus-ring"
          />
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-700">{error}</p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={requestAccess}
            disabled={submitting}
            className="px-4 py-2 rounded bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50 focus-ring"
          >
            {submitting ? "Sending…" : "Request access"}
          </button>
          <span className="text-xs text-slate-600">
            We'll notify your manager + FUZE Ops.
          </span>
        </div>
      </div>
    </div>
  );
}

function humanRole(r: string): string {
  switch (r) {
    case "BRAND_MANAGER": return "brand managers";
    case "FACTORY_MANAGER": return "factory managers";
    case "LAB_MANAGER": return "lab managers";
    case "DISTRIBUTOR_USER": return "distributor users";
    case "ADMIN": return "FUZE admins";
    case "EMPLOYEE": return "FUZE employees";
    default: return r.replace(/_/g, " ").toLowerCase();
  }
}
