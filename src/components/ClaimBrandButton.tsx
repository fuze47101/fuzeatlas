// @ts-nocheck
"use client";

/**
 * Claim / Release button for a brand account.
 *
 * Minimum claim-and-work UI. Uses PUT /api/brands/[id] with { salesRepId }
 * (the endpoint already accepts this field today).
 *
 *   - No owner         → "Claim this account" (sets salesRepId = current user)
 *   - You own it       → "You own this"  +  small "Release" button
 *   - Someone else     → "Owned by <name>"  +  admins get a "Take over" button
 *
 * BD_REP role + canClaim flag + 90-day auto-expiry come as part of #36.
 * This is the live walkthrough button so Viktor can claim on screen.
 */

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

type Rep = { id: string; name: string; email?: string } | null;

export default function ClaimBrandButton({
  brandId,
  brandName,
  salesRep,
  onChanged,
}: {
  brandId: string;
  brandName: string;
  salesRep: Rep;
  onChanged?: (next: Rep) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isMine = !!salesRep && salesRep.id === user.id;
  const isOwned = !!salesRep && !isMine;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const updateRep = async (salesRepId: string | null, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ salesRepId }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Update failed");
      onChanged?.(salesRepId ? { id: user.id, name: user.name } : null);
      // Force a soft refresh so the rep pill in the header updates
      if (typeof window !== "undefined") window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Unclaimed → big green Claim CTA
  if (!salesRep) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateRep(user.id)}
          disabled={busy}
          title={`Claim ${brandName} — you become the rep of record`}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 shadow-sm"
        >
          {busy ? "Claiming…" : "🙋 Claim this account"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  // You own it → badge + Release
  if (isMine) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold"
          title="You are the rep of record"
        >
          ✅ You own this
        </span>
        <button
          onClick={() =>
            updateRep(null, `Release ${brandName}? Another rep will be able to claim it.`)
          }
          disabled={busy}
          className="px-3 py-1.5 bg-white border border-slate-300 hover:border-slate-900 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          {busy ? "Releasing…" : "Release"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  // Someone else owns it
  if (isOwned) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold"
          title={`${salesRep!.name} is the rep of record`}
        >
          🔒 Owned by {salesRep!.name}
        </span>
        {isAdmin && (
          <button
            onClick={() => updateRep(user.id, `Take over ${brandName} from ${salesRep!.name}?`)}
            disabled={busy}
            className="px-3 py-1.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "…" : "Take over"}
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return null;
}
