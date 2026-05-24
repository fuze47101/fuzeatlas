"use client";

/**
 * /admin/labs/[id]/credits — Phase 10F admin view.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Credit {
  id: string;
  amountUsd: number;
  sourceType: string;
  sourceNote: string | null;
  createdAt: string;
  spentAt: string | null;
  spentOnTestRunId: string | null;
  spentNote: string | null;
}

interface Payload {
  ok: boolean;
  lab: { id: string; name: string };
  credits: Credit[];
  balance: number;
}

export default function LabCreditsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const T = t.labCreditsAdmin;
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState({ amountUsd: "", sourceType: "REFERRAL", sourceNote: "" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/labs/${id}/credits`);
    const j = await res.json();
    if (j.ok) setData(j);
    else setError(j.error);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function add() {
    if (!draft.amountUsd) return;
    const res = await fetch(`/api/admin/labs/${id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, amountUsd: Number(draft.amountUsd) }),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.error);
      return;
    }
    setDraft({ amountUsd: "", sourceType: "REFERRAL", sourceNote: "" });
    load();
  }

  if (error) return <div className="p-6 text-red-700">{error}</div>;
  if (!data) return <div className="p-6 text-slate-500">{T.loading}</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/admin/labs" className="hover:text-[#00b4c3]">
            {T.crumbLabs}
          </Link>
          <span>·</span>
          <span className="text-slate-800 font-medium">{data.lab.name}</span>
          <span>·</span>
          <span className="text-slate-800 font-medium">{T.crumbCredits}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{data.lab.name} — {T.creditsSuffix}</h1>
      </div>

      <div className="rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] text-white p-6 mb-6">
        <p className="text-xs uppercase tracking-wider text-white/80">{T.balanceLabel}</p>
        <p className="text-5xl font-black mt-1">${data.balance.toFixed(0)}</p>
        <p className="text-xs text-white/80 mt-2">
          {T.balanceHint}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">{T.addCreditTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="number"
            placeholder={T.amountPlaceholder}
            value={draft.amountUsd}
            onChange={(e) => setDraft({ ...draft, amountUsd: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <select
            value={draft.sourceType}
            onChange={(e) => setDraft({ ...draft, sourceType: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          >
            <option value="REFERRAL">REFERRAL</option>
            <option value="OVERPAYMENT">OVERPAYMENT</option>
            <option value="MANUAL_ADJUSTMENT">MANUAL_ADJUSTMENT</option>
          </select>
          <input
            type="text"
            placeholder={T.sourceNotePlaceholder}
            value={draft.sourceNote}
            onChange={(e) => setDraft({ ...draft, sourceNote: e.target.value })}
            className="sm:col-span-1 px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <button
            onClick={add}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold hover:bg-[#009aa8]"
          >
            {T.addCreditBtn}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-left px-4 py-2">{T.colCreated}</th>
              <th className="text-right px-3 py-2">{T.colAmount}</th>
              <th className="text-left px-3 py-2">{T.colSource}</th>
              <th className="text-left px-3 py-2">{T.colNote}</th>
              <th className="text-left px-3 py-2">{T.colSpent}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.credits.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-mono">${c.amountUsd.toFixed(0)}</td>
                <td className="px-3 py-2 font-bold text-slate-900">{c.sourceType}</td>
                <td className="px-3 py-2 text-slate-600 text-xs">{c.sourceNote || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {c.spentAt ? (
                    <span className="text-slate-500">
                      {new Date(c.spentAt).toLocaleDateString()}
                      {c.spentNote && <span className="block">{c.spentNote}</span>}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">{T.availableLabel}</span>
                  )}
                </td>
              </tr>
            ))}
            {data.credits.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  {T.emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
