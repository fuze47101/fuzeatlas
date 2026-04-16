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

  if (loading) return <div className="p-10 text-slate-500">Loading {poNumber}…</div>;
  if (!tr) return (
    <div className="p-10 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-2">PO not found</h1>
      <p className="text-sm text-slate-600">PO: <code>{poNumber}</code></p>
      {err && <p className="text-sm text-red-700 mt-2">{err}</p>}
      <a href="/admin/icp-sample-prep" className="inline-block mt-4 text-[#00b4c3] font-semibold">← Back to ICP Sample Prep</a>
    </div>
  );

  const lines = (tr.lines || []).map((l: any) => ({ ...l, meta: parseMeta(l.notes) as LineMeta | null }));
  const today = new Date();

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { margin: 0.4in; size: letter; }
          .page { break-before: page; page-break-before: always; }
          .page:first-child { break-before: auto; page-break-before: auto; }
        }
      `}</style>

      <div className="no-print max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <a href="/admin/icp-sample-prep" className="text-sm text-[#00b4c3] font-semibold">← Back to wizard</a>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">PO {poNumber} · {lines.length} sample{lines.length === 1 ? "" : "s"}</span>
          <button onClick={() => window.print()} className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800">
            🖨 Print packet + tags
          </button>
        </div>
      </div>

      {/* ───── PAGE 1: CTLA submission packet ───── */}
      <div className="page max-w-5xl mx-auto bg-white p-8 mt-4 shadow print:shadow-none print:mt-0">
        <header className="border-b-4 border-[#00b4c3] pb-4 mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">FUZE Biotech · ICP-MS Submission Packet</p>
            <h1 className="text-3xl font-black text-slate-900 mt-1">ICP-MS Test Request</h1>
            <p className="text-sm text-slate-500 mt-1">
              PO <span className="font-mono font-bold">{tr.poNumber}</span> · {lines.length} fabric sample{lines.length === 1 ? "" : "s"} · {today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="w-20 h-20 rounded-full bg-[#00b4c3] text-white flex items-center justify-center text-4xl font-black">F</div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <div className="border border-slate-300 rounded p-3">
            <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">Requester</h2>
            <p className="font-semibold">FUZE Biotech</p>
            <p className="text-xs">1895 West 2100 South</p>
            <p className="text-xs">Salt Lake City, UT 84119 USA</p>
            <p className="text-xs mt-2 text-slate-700">Contact: <span className="font-semibold">Andrew Peterson</span></p>
            <p className="text-xs">andrew@fuze47.com</p>
          </div>
          <div className="border border-slate-300 rounded p-3">
            <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">Lab</h2>
            <p className="font-semibold">{tr.lab?.name || "CTLA Laboratories"}</p>
            <p className="text-xs">{[tr.lab?.city, tr.lab?.state, tr.lab?.country].filter(Boolean).join(", ")}</p>
            {tr.lab?.email && <p className="text-xs mt-2 text-slate-700">{tr.lab.email}</p>}
            {tr.lab?.phone && <p className="text-xs">{tr.lab.phone}</p>}
          </div>
        </section>

        <section className="mb-5 bg-amber-50 border-l-4 border-amber-500 p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-1">Requested Tests</h2>
          <p className="text-slate-700"><strong>ICP-MS quantitative determination of silver (Ag) on treated fabric.</strong> Microwave-assisted aqua regia digest. 0.5 g per digest run. <strong>Report silver content in mg/kg (ppm) on fabric weight basis per fabric submission number.</strong></p>
          <p className="mt-1 text-slate-700"><strong>Billing:</strong> Please invoice per fabric submission number so we can reconcile to the Atlas PO line items above.</p>
        </section>

        <section className="mb-4">
          <h2 className="font-black uppercase tracking-wide text-slate-500 text-xs mb-2">Sample Manifest ({lines.length})</h2>
          <table className="w-full text-xs border border-slate-300">
            <thead className="bg-slate-100">
              <tr className="text-left">
                <th className="p-2 border-b border-slate-300">#</th>
                <th className="p-2 border-b border-slate-300">FUZE #</th>
                <th className="p-2 border-b border-slate-300">Customer / Factory Code</th>
                <th className="p-2 border-b border-slate-300">Fabric</th>
                <th className="p-2 border-b border-slate-300">Tier</th>
                <th className="p-2 border-b border-slate-300">Mass (g)</th>
                <th className="p-2 border-b border-slate-300">Expected Ag</th>
                <th className="p-2 border-b border-slate-300">Measured Ag</th>
                <th className="p-2 border-b border-slate-300">Received</th>
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
          <h2 className="font-black uppercase tracking-wide text-slate-900 mb-1">Pre-Ship Checklist</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-slate-700">
            <span>☐ Every fabric cut to &gt; 5 g on analytical balance</span>
            <span>☐ Fragments ~5 × 5 mm for digestion</span>
            <span>☐ One bag per fabric · tag inside</span>
            <span>☐ Cutter decontaminated between samples</span>
            <span>☐ This packet on top of box</span>
            <span>☐ Tracking # entered in Atlas after drop-off</span>
          </div>
        </section>

        {/* Return reporting */}
        <section className="mb-4 border-2 border-slate-300 rounded p-3 text-xs">
          <h2 className="font-black uppercase tracking-wide text-slate-500 mb-2">CTLA: Return Reporting</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Return report to:</span> <span className="font-semibold">andrew@fuze47.com</span></div>
            <div><span className="text-slate-500">Format:</span> PDF + per-fabric ppm in email body</div>
            <div><span className="text-slate-500">Lab sample ID prefix:</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">Received date:</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">Completed date:</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
            <div><span className="text-slate-500">Technician:</span> <span className="border-b-2 border-slate-400 inline-block w-40">&nbsp;</span></div>
          </div>
        </section>

        <footer className="pt-2 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between">
          <span>FUZE Biotech · 1895 West 2100 South · Salt Lake City, UT 84119 USA</span>
          <span>Generated {today.toLocaleString()} · PO {tr.poNumber}</span>
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
                  <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.2em] uppercase">FUZE ICP-MS SAMPLE TAG</p>
                  <p className="text-xs text-slate-500 mt-0.5">Sample {i + 1} of {lines.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">PO</p>
                  <p className="font-mono font-black text-xl text-slate-900">{tr.poNumber}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">FUZE Fabric Number</p>
                  <p className="font-mono font-black text-4xl text-[#00b4c3]">{m?.fuzeNumber ? `FUZE-${m.fuzeNumber}` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Tier Applied</p>
                  <p className="font-mono font-black text-3xl text-slate-900">{m?.tier || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sample Mass (shipped)</p>
                  <p className="font-mono font-black text-3xl text-slate-900">{m?.sampleMassG?.toFixed(2) || "—"} <span className="text-base text-slate-500">g</span></p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Customer Code</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.customerCode || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Factory Code</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.factoryCode || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Color</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.color || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Construction</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.construction || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Weight</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.weightGsm ? `${m.weightGsm} g/m²` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sample Geometry</p>
                  <p className="font-mono font-bold text-lg text-slate-900">{m?.sampleAreaCm2 || 100} cm²</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Brand</p>
                  <p className="font-semibold text-sm text-slate-900">{m?.brandName || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Factory</p>
                  <p className="font-semibold text-sm text-slate-900">{m?.factoryName || "—"}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 bg-slate-50 -mx-6 -mb-6 px-6 py-3 rounded-b-xl">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Digest protocol</p>
                    <p className="font-semibold text-slate-800">0.5 g × microwave aqua regia</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Expected Ag</p>
                    <p className="font-mono font-black text-slate-900">{expectedPpm != null ? `~${expectedPpm} mg/kg` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-500">Report by</p>
                    <p className="font-semibold text-slate-800">Fabric submission #</p>
                  </div>
                </div>
                {m?.sampleNotes && (
                  <p className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-700"><strong>Notes:</strong> {m.sampleNotes}</p>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between text-[10px] text-slate-500">
                <span>Return report to: andrew@fuze47.com</span>
                <span>FUZE Biotech · Salt Lake City, UT</span>
              </div>
            </div>

            {/* Cut line */}
            <div className="mt-6 text-center text-[10px] text-slate-400 tracking-[0.3em]">✂ CUT AND PLACE INSIDE BAG ✂</div>
          </div>
        );
      })}
    </div>
  );
}
