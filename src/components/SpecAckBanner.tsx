"use client";

/**
 * <SpecAckBanner /> — NEED-6 factory-portal banner.
 *
 * Renders one row per brand whose spec is newer than this factory's
 * most-recent acknowledgement. Click-through goes to
 * /factory-portal/spec/[brandId] for the review + confirm flow.
 *
 * Silent on empty queue (no banner clutter when everyone's caught up)
 * and silent on API failure (banner is decorative; the spec changes
 * themselves still notify via the existing notifySpecChange fan-out).
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface PendingAck {
  brandId: string;
  brandName: string;
  specVersion: string;
  requiredFuzeTier: string | null;
  lastAcknowledgedAt: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export default function SpecAckBanner() {
  const [pending, setPending] = useState<PendingAck[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/factory-portal/spec-acks");
        const j = await r.json().catch(() => null);
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.pending)) setPending(j.pending);
      } catch {
        /* silent — banner is decorative */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || pending.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-amber-900">
            {pending.length === 1
              ? "1 brand updated their FUZE spec — review and acknowledge"
              : `${pending.length} brands updated their FUZE spec — review and acknowledge`}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Confirming the spec sends notice back to the brand's account manager so
            production stays aligned. Until you confirm, the brand sees this factory as
            "spec ack pending."
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((p) => {
              const updated = fmtDate(p.specVersion);
              return (
                <li
                  key={p.brandId}
                  className="flex items-start justify-between gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-bold text-slate-900">{p.brandName}</span>
                    {p.requiredFuzeTier && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold">
                        {p.requiredFuzeTier}
                      </span>
                    )}
                    {updated && (
                      <span className="ml-2 text-[11px] text-slate-500">
                        Updated {updated}
                      </span>
                    )}
                    {p.lastAcknowledgedAt && (
                      <span className="ml-2 text-[11px] text-slate-400">
                        · last ack {fmtDate(p.lastAcknowledgedAt)}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/factory-portal/spec/${encodeURIComponent(p.brandId)}`}
                    className="shrink-0 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold whitespace-nowrap"
                  >
                    Review →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
