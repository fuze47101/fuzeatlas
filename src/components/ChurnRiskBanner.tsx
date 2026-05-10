"use client";

/**
 * <ChurnRiskBanner /> — Phase 11C.
 *
 * Renders a red/amber banner on /brands/[id] when Brand.churnRiskScore
 * is > 60. Hidden otherwise. Self-fetching — drop in and forget.
 */
import { useEffect, useState } from "react";

interface ChurnPayload {
  ok: boolean;
  score: number | null;
  reasoning: string | null;
  updatedAt: string | null;
}

export default function ChurnRiskBanner({ brandId }: { brandId: string }) {
  const [data, setData] = useState<ChurnPayload | null>(null);
  useEffect(() => {
    fetch(`/api/brands/${brandId}/churn-risk`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
      })
      .catch(() => {});
  }, [brandId]);

  if (!data?.score || data.score <= 60) return null;
  const tone =
    data.score >= 80
      ? "border-red-400 bg-red-50 text-red-900"
      : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-xl border-l-4 p-4 mb-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">
            ⚠ Churn risk: {Math.round(data.score)}
          </p>
          {data.reasoning && (
            <p className="text-xs mt-1 leading-snug">{data.reasoning}</p>
          )}
          {data.updatedAt && (
            <p className="text-[10px] opacity-70 mt-1">
              Updated {new Date(data.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
