// @ts-nocheck
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";

export default function FabricEnrichmentPage() {
  const { t } = useI18n();
  const T = t.fabricsEnrich;
  const router = useRouter();
  const { user } = useAuth();
  const [scan, setScan] = useState<any>(null);
  const [dryRun, setDryRun] = useState<any>(null);
  const [icpDryRun, setIcpDryRun] = useState<any>(null);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [icpApplyResult, setIcpApplyResult] = useState<any>(null);
  const [loading, setLoading] = useState("");

  if (user && user.role !== "ADMIN") {
    return <div className="max-w-4xl mx-auto p-8 text-center text-red-500 font-bold">{T.accessDenied}</div>;
  }

  const runScan = async () => {
    setLoading("scan");
    const res = await fetch("/api/fabrics/enrich");
    setScan(await res.json());
    setLoading("");
  };

  const runDryRun = async () => {
    setLoading("dryRun");
    const res = await fetch("/api/fabrics/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun: true }) });
    setDryRun(await res.json());
    setLoading("");
  };

  const applyEnrichment = async () => {
    if (!confirm(T.confirmEnrichApply)) return;
    setLoading("apply");
    const res = await fetch("/api/fabrics/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun: false }) });
    setApplyResult(await res.json());
    setLoading("");
  };

  const runIcpDryRun = async () => {
    setLoading("icpDry");
    const res = await fetch("/api/fabrics/enrich/icp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun: true }) });
    setIcpDryRun(await res.json());
    setLoading("");
  };

  const applyIcp = async () => {
    if (!confirm(T.confirmIcpApply)) return;
    setLoading("icpApply");
    const res = await fetch("/api/fabrics/enrich/icp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun: false }) });
    setIcpApplyResult(await res.json());
    setLoading("");
  };

  const pctBar = (pct: number) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? "#22c55e" : pct > 40 ? "#f59e0b" : "#ef4444" }} />
      </div>
      <span className="text-xs font-bold w-10 text-right">{pct}%</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/fabrics")} className="text-sm text-blue-600 hover:underline mb-1">{T.backLink}</button>
          <h1 className="text-2xl font-black text-slate-900">{T.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">{T.pageSubtitle}</p>
        </div>
      </div>

      {/* Step 1: Data Completeness Scan */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">{T.step1Title}</h2>
          <button onClick={runScan} disabled={loading === "scan"} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 disabled:opacity-50">
            {loading === "scan" ? T.scanning : T.runScan}
          </button>
        </div>
        {scan && scan.ok && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 font-semibold">{T.totalFabricsTemplate.replace("{n}", String(scan.total))}</p>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(scan.completeness).map(([field, data]: [string, any]) => (
                <div key={field}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{field}</span>
                    <span className="text-slate-400">{data.count}/{scan.total}</span>
                  </div>
                  {pctBar(data.pct)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Field Enrichment */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{T.step2Title}</h2>
            <p className="text-xs text-slate-500">{T.step2Subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runDryRun} disabled={!!loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading === "dryRun" ? T.analyzing : T.previewDryRun}
            </button>
            {dryRun && dryRun.ok && dryRun.enriched > 0 && (
              <button onClick={applyEnrichment} disabled={!!loading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {loading === "apply" ? T.applying : T.applyToTemplate.replace("{n}", String(dryRun.enriched))}
              </button>
            )}
          </div>
        </div>
        {applyResult && applyResult.ok && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-semibold">
            {T.enrichmentSuccessTemplate.replace("{n}", String(applyResult.enriched))}
          </div>
        )}
        {(dryRun || applyResult) && (() => {
          const data = applyResult?.ok ? applyResult : dryRun;
          if (!data?.ok) return null;
          return (
            <div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-slate-50 rounded-lg text-center"><p className="text-2xl font-black">{data.totalFabrics}</p><p className="text-[10px] text-slate-500 uppercase">{T.statTotal}</p></div>
                <div className="p-3 bg-blue-50 rounded-lg text-center"><p className="text-2xl font-black text-blue-700">{data.enriched}</p><p className="text-[10px] text-blue-500 uppercase">{T.statEnrichable}</p></div>
                <div className="p-3 bg-slate-50 rounded-lg text-center"><p className="text-2xl font-black">{data.skipped}</p><p className="text-[10px] text-slate-500 uppercase">{T.statNoData}</p></div>
                <div className="p-3 bg-green-50 rounded-lg text-center"><p className="text-2xl font-black text-green-700">{data.totalFabrics - data.enriched - data.skipped}</p><p className="text-[10px] text-green-500 uppercase">{T.statAlreadyComplete}</p></div>
              </div>
              {data.fieldBreakdown && Object.keys(data.fieldBreakdown).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">{T.fieldsToEnrich}</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.fieldBreakdown).sort(([,a]: any, [,b]: any) => b - a).map(([field, count]: [string, any]) => (
                      <span key={field} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">{field}: {count}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.results && data.results.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2">{T.previewFirstTemplate.replace("{n}", String(data.results.length))}</h3>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0"><tr>
                        <th className="p-2 text-left">{T.colFuzeNumber}</th>
                        <th className="p-2 text-left">{T.colFields}</th>
                        <th className="p-2 text-left">{T.colContentAdded}</th>
                        <th className="p-2 text-left">{T.colReasons}</th>
                      </tr></thead>
                      <tbody>
                        {data.results.map((r: any) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2 font-bold">{r.fuzeNumber || "—"}</td>
                            <td className="p-2">{r.fieldsEnriched.join(", ")}</td>
                            <td className="p-2">{r.contentAdded || 0}</td>
                            <td className="p-2 text-slate-500">{r.reasons.slice(0, 2).join("; ")}{r.reasons.length > 2 ? "..." : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Step 3: ICP Test Profile Generation */}
      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{T.step3Title}</h2>
            <p className="text-xs text-slate-500">{T.step3Subtitle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runIcpDryRun} disabled={!!loading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
              {loading === "icpDry" ? T.analyzing : T.previewIcp}
            </button>
            {icpDryRun && icpDryRun.ok && icpDryRun.profilesGenerated > 0 && (
              <button onClick={applyIcp} disabled={!!loading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {loading === "icpApply" ? T.creating : T.generateIcpTemplate.replace("{n}", String(icpDryRun.profilesGenerated))}
              </button>
            )}
          </div>
        </div>
        {icpApplyResult && icpApplyResult.ok && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-semibold">
            {T.icpSuccessTemplate.replace("{n}", String(icpApplyResult.profilesGenerated))}
          </div>
        )}
        {(icpDryRun || icpApplyResult) && (() => {
          const data = icpApplyResult?.ok ? icpApplyResult : icpDryRun;
          if (!data?.ok) return null;
          return (
            <div>
              <div className="grid grid-cols-4 gap-3 mb-2">
                <div className="p-3 bg-slate-50 rounded-lg text-center"><p className="text-2xl font-black">{data.totalWithoutIcp}</p><p className="text-[10px] text-slate-500 uppercase">{T.statWithoutIcp}</p></div>
                <div className="p-3 bg-purple-50 rounded-lg text-center"><p className="text-2xl font-black text-purple-700">{data.profilesGenerated}</p><p className="text-[10px] text-purple-500 uppercase">{T.statProfiles}</p></div>
                <div className="p-3 bg-green-50 rounded-lg text-center"><p className="text-2xl font-black text-green-700">{data.summary?.astm2149PassRate || "—"}</p><p className="text-[10px] text-green-500 uppercase">{T.statAstmPass}</p></div>
                <div className="p-3 bg-blue-50 rounded-lg text-center"><p className="text-2xl font-black text-blue-700">{data.summary?.aatcc100PassRate || "—"}</p><p className="text-[10px] text-blue-500 uppercase">{T.statAatccPass}</p></div>
              </div>
              {data.summary?.tierDistribution && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="p-2 bg-purple-50 rounded-lg text-center"><p className="text-lg font-black text-purple-700">{data.summary.tierDistribution.F1}</p><p className="text-[10px] text-purple-500">F1 (1.0 mg/kg)</p></div>
                  <div className="p-2 bg-blue-50 rounded-lg text-center"><p className="text-lg font-black text-blue-700">{data.summary.tierDistribution.F2}</p><p className="text-[10px] text-blue-500">F2 (0.75 mg/kg)</p></div>
                  <div className="p-2 bg-emerald-50 rounded-lg text-center"><p className="text-lg font-black text-emerald-700">{data.summary.tierDistribution.F3}</p><p className="text-[10px] text-emerald-500">F3 (0.50 mg/kg)</p></div>
                  <div className="p-2 bg-slate-50 rounded-lg text-center"><p className="text-lg font-black text-slate-700">{data.summary.tierDistribution.F4}</p><p className="text-[10px] text-slate-500">F4 (0.25 mg/kg)</p></div>
                </div>
              )}
              {data.results && data.results.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2">{T.icpPreviewTemplate.replace("{n}", String(data.results.length))}</h3>
                  {data.summary && (
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-purple-600">{T.astmPassCard}</p>
                        <p className="text-lg font-black text-purple-700">{data.summary.astm2149PassRate}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-blue-600">{T.aatccPassCard}</p>
                        <p className="text-lg font-black text-blue-700">{data.summary.aatcc100PassRate}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-600">{T.agRangeCard}</p>
                        <p className="text-lg font-black text-slate-700">{data.summary.agRange}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-emerald-600">{T.modelCard}</p>
                        <p className="text-lg font-black text-emerald-700">{data.summary.model}</p>
                      </div>
                    </div>
                  )}
                  <div className="max-h-80 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0"><tr>
                        <th className="p-2 text-left">{T.colFuzeNumber}</th>
                        <th className="p-2 text-left">{T.colFiber}</th>
                        <th className="p-2 text-center">{T.colTier}</th>
                        <th className="p-2 text-right">{T.colAgMgKg}</th>
                        <th className="p-2 text-center">{T.colConf}</th>
                        <th className="p-2 text-center">{T.colAstm}</th>
                        <th className="p-2 text-center">{T.colAatcc}</th>
                      </tr></thead>
                      <tbody>
                        {data.results.map((r: any) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-2 font-bold">{r.fuzeNumber || "—"}</td>
                            <td className="p-2">{r.dominantFiber || "—"}{r.isCotton ? " 🌿" : ""}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.assignedTier === "F1" ? "bg-purple-100 text-purple-700" : r.assignedTier === "F2" ? "bg-blue-100 text-blue-700" : r.assignedTier === "F3" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{r.assignedTier}</span>
                            </td>
                            <td className="p-2 text-right font-mono font-bold">{r.icpEstimate.agPpm}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.confidence === "HIGH" ? "bg-green-100 text-green-700" : r.confidence === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{r.confidence}</span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={r.astm2149?.pass ? "text-green-700" : "text-red-600"}>{r.astm2149?.reduction || r.antibacterialCorrelation?.expectedReduction || "—"}</span>
                            </td>
                            <td className="p-2 text-center">
                              <span className={r.aatcc100?.pass ? "text-green-700" : "text-red-600"}>{r.aatcc100?.reduction || "—"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>{T.noteHeader}</strong>{T.noteBody}<code className="bg-amber-100 px-1 rounded">{T.noteCodeMarker}</code>{T.noteAfterCode}
      </div>
    </div>
  );
}
