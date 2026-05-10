"use client";

/**
 * Phase 9I — Referral attribution badge.
 *
 * Renders a small "Referred by: X" badge next to the brand name on
 * /brands/[id] if the Brand has referredByBrandId or
 * referredByContactId set. Resolves the source name client-side so
 * the parent page doesn't need to change its fetch shape.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  brandId: string;
}

interface Referral {
  source: { kind: "BRAND" | "CONTACT"; id: string; name: string } | null;
  note: string | null;
  value: number | null;
}

export default function ReferralBadge({ brandId }: Props) {
  const [data, setData] = useState<Referral | null>(null);
  useEffect(() => {
    fetch(`/api/brands/${brandId}/referral`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .catch(() => {});
  }, [brandId]);

  if (!data?.source) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
      <span>🔗 Referred by:</span>
      {data.source.kind === "BRAND" ? (
        <Link href={`/brands/${data.source.id}`} className="hover:underline font-bold">
          {data.source.name}
        </Link>
      ) : (
        <Link href={`/contacts/${data.source.id}`} className="hover:underline font-bold">
          {data.source.name}
        </Link>
      )}
      {data.note && <span className="text-violet-600 font-normal">· {data.note}</span>}
    </span>
  );
}
