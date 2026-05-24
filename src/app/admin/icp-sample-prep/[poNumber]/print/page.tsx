// @ts-nocheck
"use client";

/**
 * Printable CTLA submission packet + one sample tag per fabric.
 *
 * Page 1  — Submission packet (CTLA intake sheet) listing every sample,
 *           FUZE PO number, return reporting instructions, and a summary
 *           table the lab tech at CTLA fills in on receipt.
 *
 * Page 2+ — One sample tag per fabric (cut out / fold → place inside bag)
 *
 * Print lots-of-samples runs fine on one print job — each page uses
 * `print:break-before-page` so each tag gets its own sheet.
 */

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

type LineMeta = {
  kind: string;
  fabricId: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  color: string | null;
  construction: string | null;
  weightGsm: number | null;
  brandName: string | null;
  factoryName: string | null;
  sampleMassG: number;
  sampleAreaCm2: number;
  digestTargetG: number;
  tier: string | null;
  benchTestId: string | null;
  sampleNotes: string | null;
};

function parseMeta(notes: string | null): LineMeta | null {
  if (!notes) return null;
  try { return JSON.parse(notes); } catch { return null; }
}

export default function IcpBatchPrintPage() {
  const { t } = useI18n();
  const T = t.icpSamplePrepPrint;
  const { poNumber } = useParams<{ poNumber: string }>();
  const [tr, setTr] = useState<any>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/icp-sample-prep?poNumber=${encodeURIComponent(poNumber)}`)
      .then(async (r) => {
        const d = await r.json();
        if (d.ok) setTr(d.testRequest);
        else setErr(d.error || `HTTP ${r.status}`);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [poNumber]);

  if (loading) return <div className="p-10 text-slate-500">{T.loading.replace("{po}", String(poNumber))}</div>;
  if (!tr) return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-2">{T.poNotFound}</h1>
      <p className="text-sm text-slate-600">{T.poLabel} <code>{poNumber}</code></p>
      {err && <p className="text-sm text-red-700 mt-2">{err}</p>}
      <a href="/admin/icp-sample-prep" className="inline-block mt-4 text-[#00b4c3] font-semibold">{T.backToWizardShort}</a>
    </div>
  );

  const lines = (tr.lines || []).map((l: any) => ({ ...l, meta: parseMeta(l.notes) as LineMeta | null }));
  const today = new Date();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @media print {
          /* Reset every parent to white + edge-to-edge so the
             @page margins are the ONLY whitespace. Earlier the
             min-h-screen + bg-slate-100 chrome was bleeding into
             the print viewport and nudging content off the right
             edge. Ashlee's #cmoalxjcy CTLA-packet alignment bug. */
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; size: letter; }
          /* Pages: no shadow, no rounded corners, no extra max-width
             constraint, no top margin (the @page handles it). The
             bench card and tag pages each occupy their own sheet. */
          .page {
            break-before: page;
            page-break-before: always;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            padding: 0 !important;
          }
          .page:first-child { break-before: auto; page-break-before: auto; }
          /* Force every flex/grid child to honor the page width — fixes
             the "right column getting clipped" symptom. */
          .page * { box-sizing: border-box; }
        }
      `}</style>

      <div className="no-print max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between flex-wrap gap-3">
        <a href="/admin/icp-sample-prep" className="text-sm text-[#00b4c3] font-semibold">{T.backToWizard}</a>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">{T.tagPo} {poNumber} · {lines.length} {lines.length === 1 ? T.sampleSuffix : T.samplesSuffix}</span>
          {/* Per-fabric carrier label sheets — one click per fabric in
              this PO. Surfaces the new /fabrics/[id]/labels/print page
              so Tina can run carrier stickers + the 4×6 baggie sticker
              for each sample without going through the wizard again. */}
          {lines.length > 0 && (
            <details className="relative">
              <summary className="cursor-pointer list-none px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-lg">
                {T.printCarrierLabels}
              </summary>
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-10 max-h-72 overflow-auto min-w-[280px]">
                <p className="text-[10px] uppercase font-bold text-slate-500 px-2 pb-1">
                  {T.carrierSheetHint}
                </p>
                {lines.map((l: any) => (
                  <a
                    key={l.fabricId}
                    href={`/fabrics/${l.fabricId}/labels/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-2 py-1.5 hover:bg-slate-50 rounded text-xs"
                  >
                    <strong className="font-mono">FUZE-{l.fuzeNumber || "—"}</strong>
                    {l.customerCode && (
                      <span className="text-slate-500"> · {l.customerCode}</span>
                    )}
                  </a>
                ))}
              </div>
            </details>
          )}
          <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
            {T.printPacketTags}
          </button>
        </div>
      </div>

      {/* ───── PAGE 1: CTLA submission packet ───── */}
      <div className="page max-w-5xl mx-auto bg-white p-8 mt-4 shadow print:shadow-none print:mt-0">
        <header className="border-b-4 border-[#00b4c3] pb-4 mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">{T.headerBadge}</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">{T.headerTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {T.tagPo} <span className="font-mono font-bold">{tr.poNumber}</span> · {lines.length} {lines.length === 1 ? T.sampleSuffix : T.samplesSuffix} · {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="w-20 h-20 rounded-full bg-[#00b4c3] text-white flex items-center justify-center text-4xl font-black">F</div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-slate-300 rounded p-3">
            <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.requesterLabel}</h2>
            <p className="font-semibold">{T.requesterName}</p>
            <p className="text-xs">{T.requesterAddr1}</p>
            <p className="text-xs">{T.requesterAddr2}</p>
            <p className="text-xs mt-2 text-slate-700">{T.requesterContact} <span className="font-semibold">{T.contactName}</span></p>
            <p className="text-xs">{T.contactEmail}</p>
          </div>
          <div className="border border-slate-300 rounded p-3">
            <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.labLabel}</h2>
            <p className="font-semibold">{tr.lab?.name || T.labFallback}</p>
            <p className="text-xs">{[tr.lab?.city, tr.lab?.state, tr.lab?.country].filter(Boolean).join(", ")}</p>
            {tr.lab?.email && <p className="text-xs mt-2 text-slate-700">{tr.lab.email}</p>}
            {tr.lab?.phone && <p className="text-xs">{tr.lab.phone}</p>}
          </div>
        </section>

        <section className="mb-5 bg-amber-50 border-l-4 border-amber-500 p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-1">{T.requestedTestsLabel}</h2>
          <p className="text-slate-700"><strong>{T.requestedTestsBody}</strong></p>
          <p className="mt-1 text-slate-700"><strong>{T.billingLabel}</strong> {T.billingBody}</p>
        </section>

        <section className="mb-4">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">{T.manifestHeading} ({lines.length})</h2>
          <table className="w-full text-xs border border-slate-300">
            <thead className="bg-slate-100">
              <tr className="text-left">
                <th className="p-2 border-b border-slate-300">{T.colIndex}</th>
                <th className="p-2 border-b border-slate-300">{T.colFuzeNum}</th>
                <th className="p-2 border-b border-slate-300">{T.colCustFactoryCode}</th>
                <th className="p-2 border-b border-slate-300">{T.colFabric}</th>
                <th className="p-2 border-b border-slate-300">{T.colTier}</th>
                <th className="p-2 border-b border-slate-300">{T.colMass}</th>
                <th className="p-2 border-b border-slate-300">{T.colExpectedAg}</th>
                <th className="p-2 border-b border-slate-300">{T.colMeasuredAg}</th>
                <th className="p-2 border-b border-slate-300">{T.colReceived}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: any, i: number) => {
                const m = l.meta;
                const tierTarget: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
                const expectedPpm = m?.tier ? tierTarget[m.tier] : null;
                return (
                  <tr key={l.id} className="border-b border-slate-200">
                    <td className="p-2 font-mono">{i + 1}</td>
                    <td className="p-2 font-mono font-bold">{m?.fuzeNumber ? `FUZE-${m.fuzeNumber}` : "—"}</td>
                    <td className="p-2 text-slate-700">
                      {m?.customerCode || "—"}
                      {m?.factoryCode ? ` / ${m.factoryCode}` : ""}
                    </td>
                    <td className="p-2 text-slate-700">
                      {m?.color ? `${m.color} · ` : ""}{m?.construction || "—"}
                      {m?.weightGsm ? ` · ${m.weightGsm} g/m²` : ""}
                    </td>
                    <td className="p-2 font-bold text-[#00b4c3]">{m?.tier || "—"}</td>
                    <td className="p-2 font-mono">{m?.sampleMassG?.toFixed(2) || "—"}</td>
                    <td className="p-2 font-mono text-slate-600">{expectedPpm != null ? `~${expectedPpm} mg/kg` : "—"}</td>
                    <td className="p-2 font-mono border-l border-dashed border-slate-400">&nbsp;</td>
                    <td className="p-2 font-mono border-l border-dashed border-slate-400">&nbsp;</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Pre-ship checklist */}
        <section className="mb-4 bg-slate-50 border border-slate-300 rounded p-3 text-[11px]">
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-1">{T.preShipHeading}</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-700">
            <span>{T.checklistCut}</span>
            <span>{T.checklistFragments}</span>
            <span>{T.checklistOneBag}</span>
            <span>{T.checklistDecon}</span>
            <span>{T.checklistOnTop}</span>
            <span>{T.checklistTracking}</span>
          </div>
        </section>

        {/* Return reporting */}
        <section className="mb-4 border-2 border-slate-300 rounded p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-500 mb-2">{T.returnHeading}</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">{T.returnTo}</span> <span className="font-semibold">andrew@fuze47.com</span></div>
            <div><span className="text-slate-500">{T.returnFormat}</span> {T.returnFormatValue}</div>
            <div><span className="text-slate-500">{T.returnLabIdPrefix}</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">{T.returnReceivedDate}</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">{T.returnCompletedDate}</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">{T.returnTechnician}</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
          </div>
        </section>

        <footer className="pt-2 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>{T.footerCompany}</span>
          <span>{T.footerGenerated} {today.toLocaleString()} · {T.tagPo} {tr.poNumber}</span>
        </footer>
      </div>

      {/* ───── PAGE 2+: One tag per fabric ───── */}
      {lines.map((l: any, i: number) => {
        const m = l.meta;
        const tierTarget: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
        const expectedPpm = m?.tier ? tierTarget[m.tier] : null;
        return (
          <div key={l.id} className="page max-w-3xl mx-auto bg-white p-8 mt-6 shadow print:shadow-none print:mt-0">
            <div className="border-4 border-[#00b4c3] rounded-xl p-6">
              <div className="flex items-start justify-between pb-3 border-b-2 border-[#00b4c3]">
                <div>
                  <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">{T.tagBadge}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{T.tagSampleXofY.replace("{n}", String(i + 1)).replace("{total}", String(lines.length))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{T.tagPo}</p>
                  <p className="font-mono font-black text-xl text-slate-900">{tr.poNumber}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagFuzeFabricNum}</p>
                  <p className="font-mono font-black text-4xl text-[#00b4c3]">{m?.fuzeNumber ? `FUZE-${m.fuzeNumber}` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagTierApplied}</p>
                  <p className="font-mono font-black text-3xl text-slate-900">{m?.tier || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagSampleMass}</p>
                  <p className="font-mono font-black text-3xl text-slate-900">{m?.sampleMassG?.toFixed(2) || "—"} <span className="text-base text-slate-500">g</span></p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagCustomerCode}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.customerCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagFactoryCode}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.factoryCode || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagColor}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.color || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagConstruction}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.construction || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagWeight}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.weightGsm ? `${m.weightGsm} g/m²` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagGeometry}</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.sampleAreaCm2 || 100} cm²</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagBrand}</p>
                  <p className="font-semibold text-sm text-slate-900">{m?.brandName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{T.tagFactory}</p>
                  <p className="font-semibold text-sm text-slate-900">{m?.factoryName || "—"}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">{T.tagDigestProtocol}</p>
                    <p className="font-semibold text-slate-800">{T.tagDigestProtocolValue}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">{T.tagExpectedAg}</p>
                    <p className="font-mono font-black text-slate-900">{expectedPpm != null ? `~${expectedPpm} mg/kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">{T.tagReportBy}</p>
                    <p className="font-semibold text-slate-800">{T.tagReportByValue}</p>
                  </div>
                </div>
                {m?.sampleNotes && (
                  <p className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-700"><strong>{T.tagNotes}</strong> {m.sampleNotes}</p>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between text-[10px] text-slate-500">
                <span>{T.tagReturnTo}</span>
                <span>{T.tagCompanyFooter}</span>
              </div>
            </div>

            {/* Cut line */}
            <div className="mt-6 text-center text-[10px] text-slate-400 tracking-[0.3em]">{T.tagCutLine}</div>
          </div>
        );
      })}
    </div>
  );
}
