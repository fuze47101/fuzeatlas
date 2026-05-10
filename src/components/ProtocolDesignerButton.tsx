"use client";

/**
 * <ProtocolDesignerButton fabricId={...} /> — Phase 11G.
 *
 * Drops onto /fabrics/[id]. Click → fires POST /api/admin/protocol-designer
 * with the fabric id → renders the AI-suggested test battery in a modal.
 */
import { useState } from "react";

interface RecommendedTest {
  standard: string;
  organism?: string | null;
  reasoning: string;
  slaDays: number;
  estimatedCostUsd: number;
}

interface Designed {
  ok: boolean;
  targetTier: string;
  applicationMethod: string;
  reasoning: string;
  recommendedTests: RecommendedTest[];
  fabric: { fuzeNumber: number | null; construction: string | null; weightGsm: number | null };
  brand: { id: string; name: string } | null;
}

export default function ProtocolDesignerButton({ fabricId }: { fabricId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Designed | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/protocol-designer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fabricId }),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error || "Designer failed");
      else setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const total = data?.recommendedTests.reduce((a, t) => a + (t.estimatedCostUsd || 0), 0) || 0;

  return (
    <>
      <button
        onClick={run}
        className="px-3 py-1.5 rounded-md border border-indigo-300 bg-indigo-50 text-indigo-800 text-sm font-bold hover:bg-indigo-100"
      >
        🧪 Design test protocol with AI →
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">AI test protocol</h2>
                {data?.fabric && (
                  <p className="text-xs text-slate-500 mt-1">
                    FUZE-{data.fabric.fuzeNumber} · {data.fabric.construction || "—"} ·{" "}
                    {data.fabric.weightGsm ? `${data.fabric.weightGsm} GSM` : "—"}
                    {data.brand && <> · {data.brand.name}</>}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  setData(null);
                  setError(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {loading && <p className="text-slate-500 text-sm">Designing protocol…</p>}
            {error && <p className="text-red-700 text-sm">{error}</p>}
            {data && !loading && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <Tile label="Target tier" value={data.targetTier} />
                  <Tile label="Application" value={data.applicationMethod} />
                  <Tile label="Tests" value={String(data.recommendedTests.length)} />
                  <Tile label="Est. cost" value={`$${total.toFixed(0)}`} />
                </div>

                <div className="rounded-lg bg-indigo-50/40 border border-indigo-200 p-3 mb-4 text-sm">
                  <p className="text-indigo-900 italic">{data.reasoning}</p>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-2">Recommended battery</h3>
                <div className="space-y-2">
                  {data.recommendedTests.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{t.standard}</p>
                          {t.organism && (
                            <p className="text-xs text-slate-500">{t.organism}</p>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 tabular-nums">
                          {t.slaDays}d · ${t.estimatedCostUsd}
                        </p>
                      </div>
                      <p className="text-xs text-slate-700 mt-1">{t.reasoning}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-4 italic">
                  Estimates only — convert to a real TestRequest via the lab catalog to lock in
                  the actual SLA and per-protocol price.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </p>
      <p className="text-base font-black text-slate-900">{value}</p>
    </div>
  );
}
