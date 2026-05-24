"use client";

/**
 * /admin/brands/[id]/hangtag-qr — Phase 12B admin bulk generator.
 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Row {
  id: string;
  token: string;
  productSku: string | null;
  batchCode: string | null;
  printedAt: string | null;
  scannedCount: number;
  firstScannedAt: string | null;
  lastScannedAt: string | null;
  fabric: { id: string; fuzeNumber: number | null } | null;
  createdAt: string;
}

export default function HangtagQRPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const T = t.hangtagQrAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [draft, setDraft] = useState({
    count: "10",
    fabricId: "",
    productSku: "",
    batchCode: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/brands/${id}/hangtag-qr`);
    const j = await res.json();
    if (j.ok) setRows(j.rows);
    else setError(j.error);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function mint() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/brands/${id}/hangtag-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(draft.count) || 1,
          fabricId: draft.fabricId || null,
          productSku: draft.productSku || null,
          batchCode: draft.batchCode || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error || T.mintFailedError);
      else load();
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const lines = [
      ["token", "url", "productSku", "batchCode", "fuzeNumber", "scannedCount"].join(","),
    ];
    for (const r of rows) {
      lines.push(
        [
          r.token,
          `https://fuzeatlas.com/verified/qr/${r.token}`,
          r.productSku || "",
          r.batchCode || "",
          r.fabric?.fuzeNumber || "",
          r.scannedCount,
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hangtag-qr-${id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href={`/brands/${id}`} className="hover:text-[#00b4c3]">
            {T.brandCrumb}
          </Link>
          <span>·</span>
          <span className="text-slate-800 font-medium">{T.crumb}</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">{T.heading}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {T.subtitlePrefix}{" "}
          <code className="font-mono bg-slate-100 px-1">/verified/qr/{`{token}`}</code>.
          {" "}{T.subtitleSuffix}
        </p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">{T.mintTokensTitle}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <input
            type="number"
            min="1"
            max="500"
            placeholder={T.countPlaceholder}
            value={draft.count}
            onChange={(e) => setDraft({ ...draft, count: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder={T.fabricIdPlaceholder}
            value={draft.fabricId}
            onChange={(e) => setDraft({ ...draft, fabricId: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder={T.skuPlaceholder}
            value={draft.productSku}
            onChange={(e) => setDraft({ ...draft, productSku: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder={T.batchPlaceholder}
            value={draft.batchCode}
            onChange={(e) => setDraft({ ...draft, batchCode: e.target.value })}
            className="px-3 py-2 border border-slate-300 rounded text-sm"
          />
          <button
            onClick={mint}
            disabled={saving}
            className="px-4 py-2 bg-[#00b4c3] text-white rounded text-sm font-bold hover:bg-[#009aa8] disabled:opacity-50"
          >
            {saving ? T.mintingBusy : T.mintBtn}
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          {T.mintFootnote}
        </p>
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-slate-600">{rows.length} {rows.length === 1 ? T.tokenSingular : T.tokenPlural}</p>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {T.exportCsvBtn}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
            <tr>
              <th className="text-left px-4 py-2">{T.colToken}</th>
              <th className="text-left px-3 py-2">{T.colSkuBatch}</th>
              <th className="text-left px-3 py-2">{T.colFabric}</th>
              <th className="text-right px-3 py-2">{T.colScans}</th>
              <th className="text-left px-3 py-2">{T.colLastScan}</th>
              <th className="text-left px-3 py-2">{T.colVerifyUrl}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono text-xs">{r.token}</td>
                <td className="px-3 py-2 text-xs">
                  {r.productSku || "—"}
                  {r.batchCode && (
                    <div className="text-slate-400">{r.batchCode}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {r.fabric?.fuzeNumber ? `FUZE-${r.fabric.fuzeNumber}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold">
                  {r.scannedCount}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {r.lastScannedAt
                    ? new Date(r.lastScannedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`/verified/qr/${r.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#00b4c3] hover:underline"
                  >
                    /verified/qr/{r.token.slice(0, 6)}…
                  </a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-slate-400">
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
