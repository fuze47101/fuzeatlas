"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

interface Credit {
  id: string;
  amountUsd: number;
  sourceType: string;
  sourceNote: string | null;
  createdAt: string;
  spentAt: string | null;
}

export default function LabCreditsPage() {
  const { t } = useI18n();
  const tx = t.labPortal.creditsPage;
  const [data, setData] = useState<{ credits: Credit[]; balance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lab-portal/credits")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-black text-slate-900 mb-2">{tx.pageTitle}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Credit FUZE has accumulated with you for past referrals + adjustments.
        Auto-applies against future FUZE-paid testing at this lab.
      </p>

      <div className="rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white p-6 mb-6">
        <p className="text-xs uppercase tracking-wider text-white/80">FUZE balance with you</p>
        <p className="text-5xl font-black mt-1">${data.balance.toFixed(0)}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-right px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.credits.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-mono">
                  ${c.amountUsd.toFixed(0)}
                </td>
                <td className="px-3 py-2 font-bold text-slate-900">
                  {c.sourceType}
                  {c.sourceNote && <span className="block text-[11px] text-slate-500 font-normal">{c.sourceNote}</span>}
                </td>
                <td className="px-3 py-2 text-xs">
                  {c.spentAt ? (
                    <span className="text-slate-500">
                      Applied {new Date(c.spentAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">Available</span>
                  )}
                </td>
              </tr>
            ))}
            {data.credits.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400">
                  No credits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
