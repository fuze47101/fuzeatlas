// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════
 *  PRINTABLE SAMPLE APPLICATION RECIPE CARD
 *
 *  One-page print view that Ashlee keeps at the bench. Shows:
 *    · fabric identity (FUZE#, customer code, construction, color, gsm)
 *    · bath recipe (mL of 30 ppm FUZE stock + mL DI water)
 *    · tier + bath concentration + pickup WPU used to derive it
 *    · padder settings snapshotted from the RecipeBenchTest
 *      (squeeze pressure bar, VFD Hz, line speed m/min)
 *    · lifecycle timestamps (padded / dried)
 *    · app number, operator, notes
 *
 *  This is a server component that fetches the SampleApplication
 *  via the admin API and renders a tight A4 card optimized for
 *  a single black-and-white print.
 * ═══════════════════════════════════════════════════════════════
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "./PrintButton";
import { getServerTranslations } from "@/i18n/server";

async function getApplication(id: string) {
  // Next 15: headers() is async. We build an absolute URL off the inbound
  // host so this works both in dev and on Vercel (where localhost fetch
  // would fail against an API route that needs middleware/auth context).
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const res = await fetch(
    `${base}/api/admin/sample-application?id=${encodeURIComponent(id)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.ok) return null;
  return json.sampleApplication;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}
function fmtNum(n: number | null | undefined, digits = 2, unit = ""): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(digits)}${unit ? " " + unit : ""}`;
}

export default async function SampleApplicationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string; locale?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.locale || sp.lang)).sampleApplicationPrint;
  const app = await getApplication(id);
  if (!app) notFound();

  const f = app.fabric || {};
  const bench = app.benchTest || {};
  const pickupPct = app.pickupDryToWetPct ?? bench.pickupDryToWetPct;

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {/* Top action bar — hidden on print */}
      <div className="max-w-3xl mx-auto px-6 pt-6 flex justify-between items-center print:hidden">
        <Link
          href="/admin/icp-sample-prep"
          className="text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          {T.backToPrep}
        </Link>
        <PrintButton />
      </div>

      {/* Print card */}
      <div className="max-w-3xl mx-auto p-6 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold text-[#00b4c3] tracking-[0.25em] uppercase">
              {T.kicker}
            </p>
            <h1 className="text-2xl font-black text-slate-900 mt-1 leading-tight">
              {T.pageTitle}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {T.pageSubtitle}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
              {T.appNumberLabel}
            </p>
            <p className="text-lg font-mono font-bold">{app.appNumber}</p>
            <p className="text-[10px] text-slate-500 mt-1">
              {T.createdLabel} {fmtDate(app.createdAt)}
            </p>
          </div>
        </div>

        {/* Fabric identity */}
        <section className="mb-4">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {T.fabricSection}
          </h2>
          <div className="border border-slate-300 rounded p-3 bg-slate-50">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-xl font-black">
                {f.fuzeNumber ? `FUZE-${f.fuzeNumber}` : T.noFuzeNumber}
              </p>
              <p className="text-sm text-slate-600">
                {f.customerCode && <span className="font-bold">{f.customerCode}</span>}
                {f.factoryCode && <span className="ml-2">· {f.factoryCode}</span>}
              </p>
            </div>
            <p className="text-sm">
              {[f.construction, f.color, f.weightGsm ? `${f.weightGsm} gsm` : null, f.widthInches ? `${f.widthInches}"` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {(f.brand?.name || f.factory?.name) && (
              <p className="text-xs text-slate-500 mt-1">
                {f.brand?.name && <>{T.brandLabel} <b>{f.brand.name}</b></>}
                {f.brand?.name && f.factory?.name && " · "}
                {f.factory?.name && <>{T.factoryLabel} <b>{f.factory.name}</b></>}
              </p>
            )}
          </div>
        </section>

        {/* Bath recipe */}
        <section className="mb-4">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {T.bathRecipeSection}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-300 rounded p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.tierLabel}</p>
              <p className="text-2xl font-black mt-1">{app.tier}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {T.targetPickup} {app.tier === "F1" ? "1.00" : app.tier === "F2" ? "0.75" : app.tier === "F3" ? "0.50" : "0.25"} mg/kg
              </p>
            </div>
            <div className="border border-slate-300 rounded p-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.bathVolumeLabel}</p>
              <p className="text-2xl font-black mt-1">{fmtNum(app.bathVolumeL, 2)} L</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {T.concentrationLabel} {fmtNum(app.bathConcentrationMgPerL, 3)} mg/L
              </p>
            </div>
          </div>

          <div className="mt-3 border-2 border-slate-900 rounded p-4 bg-white">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">
              {T.mixThisBath}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center border-r border-slate-300 pr-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  {T.fuzeStock} ({fmtNum(app.stockMgPerL, 0)} mg/L)
                </p>
                <p className="text-4xl font-black text-[#00b4c3] mt-1 leading-none">
                  {fmtNum(app.fuzeMl, 2)}
                </p>
                <p className="text-sm font-bold">{T.mlUnit}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold">{T.diWater}</p>
                <p className="text-4xl font-black text-slate-900 mt-1 leading-none">
                  {fmtNum(app.waterMl, 2)}
                </p>
                <p className="text-sm font-bold">{T.mlUnit}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
              {T.derivedFromPickup} <b>{fmtNum(pickupPct, 2)}%</b> {T.measuredInBench}{" "}
              <span className="font-mono font-bold">
                {bench.testNumber || "—"}
              </span>
            </p>
          </div>
        </section>

        {/* Padder settings */}
        <section className="mb-4">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {T.padderSettings}
          </h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="border border-slate-300 rounded p-2 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.squeeze}</p>
              <p className="text-lg font-black mt-1">
                {fmtNum(app.squeezePressure, 1)}
              </p>
              <p className="text-[10px] text-slate-500">{T.barUnit}</p>
            </div>
            <div className="border border-slate-300 rounded p-2 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.vfd}</p>
              <p className="text-lg font-black mt-1">
                {fmtNum(app.vfdFrequencyHz, 1)}
              </p>
              <p className="text-[10px] text-slate-500">{T.hzUnit}</p>
            </div>
            <div className="border border-slate-300 rounded p-2 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.lineSpeed}</p>
              <p className="text-lg font-black mt-1">
                {fmtNum(app.lineSpeedMPerMin, 1)}
              </p>
              <p className="text-[10px] text-slate-500">{T.mPerMinUnit}</p>
            </div>
            <div className="border border-slate-300 rounded p-2 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.pickup}</p>
              <p className="text-lg font-black mt-1">{fmtNum(pickupPct, 2)}</p>
              <p className="text-[10px] text-slate-500">{T.percentUnit}</p>
            </div>
          </div>
          {bench.applicationMethod && (
            <p className="text-[11px] text-slate-500 mt-2">
              {T.methodLabel} <b>{bench.applicationMethod}</b>
            </p>
          )}
        </section>

        {/* Lifecycle */}
        <section className="mb-4">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {T.lifecycleSection}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-slate-300 rounded p-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.paddedLabel}</p>
              <p className="text-sm font-bold mt-1">
                {app.paddedAt ? fmtDate(app.paddedAt) : T.notRecorded}
              </p>
            </div>
            <div className="border border-slate-300 rounded p-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.driedLabel}</p>
              <p className="text-sm font-bold mt-1">
                {app.driedAt ? fmtDate(app.driedAt) : T.notRecorded}
              </p>
            </div>
          </div>
        </section>

        {/* Operator + notes */}
        <section className="mb-4 grid grid-cols-1 gap-2">
          <div className="border border-slate-300 rounded p-2">
            <p className="text-[10px] text-slate-500 uppercase font-bold">{T.operatorLabel}</p>
            <p className="text-sm mt-1">{app.operator || "—"}</p>
          </div>
          {app.notes && (
            <div className="border border-slate-300 rounded p-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">{T.notesLabel}</p>
              <p className="text-sm mt-1 whitespace-pre-wrap">{app.notes}</p>
            </div>
          )}
        </section>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            {T.footerLeft} <b className="font-mono">{app.appNumber}</b>
          </span>
          <span>{T.footerPrinted} {fmtDate(new Date().toISOString())}</span>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page { size: Letter; margin: 0.4in; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
