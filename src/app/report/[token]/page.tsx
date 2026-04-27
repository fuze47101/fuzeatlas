// @ts-nocheck
/**
 * /report/[token]
 *
 * Customer-facing public report page. No Atlas login required —
 * possession of the token is the credential. Fetches the same report
 * shape as /admin/fabric-report/[fabricId]/print but through the
 * token-validated endpoint, with engagement tracking on every view.
 *
 * Renders the full Application & Validation Report — Cover, Prepared
 * For, Executive Summary, Recommended Recipe, FUZE Required matrix,
 * In-House Validation, Lab ICP Verification, login instructions,
 * Appendix. Print/Save-as-PDF in the top-right.
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";

const FUZE_CYAN = "#00b4c3";

async function getReport(token: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const res = await fetch(
    `${base}/api/fabric-report/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    return { error: json?.error || "Report unavailable" };
  }
  return res.json();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}
function fmtNum(n: number | null | undefined, digits = 2, unit = ""): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(digits)}${unit ? " " + unit : ""}`;
}
function prettyMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(2)} L`;
  return `${ml.toFixed(1)} mL`;
}
function fiberSummary(fabric: any, benchTest: any): string {
  if (fabric?.contents && fabric.contents.length > 0) {
    return fabric.contents
      .map((c: any) =>
        c.percent ? `${c.material} ${c.percent}%` : c.material,
      )
      .join(" · ");
  }
  if (fabric?.yarnType) return fabric.yarnType;
  if (benchTest?.fiberContent) return benchTest.fiberContent;
  return "—";
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getReport(token);

  if (data?.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-2xl font-black text-slate-900 mb-2">
            Report unavailable
          </p>
          <p className="text-sm text-slate-600 mb-4">{data.error}</p>
          <p className="text-xs text-slate-500">
            For long-term access, sign in at{" "}
            <a
              href={process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com"}
              className="text-[#00b4c3] underline"
            >
              FUZE Atlas
            </a>{" "}
            and find the report under <em>My Reports</em>, or reply to the
            email this came from.
          </p>
        </div>
      </div>
    );
  }
  if (!data?.ok) notFound();

  const {
    fabric,
    benchTest,
    sampleApplications,
    labTestRuns,
    fuzeMatrix,
    tierMgPerKg,
    stockMgPerL,
    pickupPct,
    recommendedTier,
    share,
  } = data;

  const recTierMg = tierMgPerKg[recommendedTier] ?? 1.0;
  const recBathMgPerL = pickupPct ? recTierMg / (pickupPct / 100) : null;
  const recFuzeMlPer100L = recBathMgPerL
    ? (recBathMgPerL * 100 * 1000) / stockMgPerL
    : null;

  const benchIcp = benchTest?.icpMeasuredPpm ?? null;
  const benchIcpExpected = benchTest?.icpExpectedPpm ?? null;
  const benchIcpAffinity = benchTest?.affinityPct ?? null;
  const labIcpRuns = (labTestRuns || []).filter(
    (tr: any) => tr.testType === "ICP" || tr.icpResult,
  );
  const portalUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {/* Action bar (screen-only) */}
      <div className="max-w-4xl mx-auto px-6 pt-6 flex justify-between items-center print:hidden">
        <Link
          href={portalUrl}
          className="text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          ← FUZE Atlas
        </Link>
        <PrintButton />
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none">
        {/* Header */}
        <header className="border-b-2 border-slate-900 pb-4 mb-6">
          <p
            className="text-[10px] font-bold tracking-[0.25em] uppercase"
            style={{ color: FUZE_CYAN }}
          >
            FUZE Biotech · Application & Validation Report
          </p>
          <h1 className="text-3xl font-black text-slate-900 mt-2 leading-tight">
            FUZE Treatment Recipe & Validation
          </h1>
          <h2 className="text-xl font-semibold text-slate-700 mt-1">
            {fabric.customerReference ||
              fabric.customerCode ||
              `FUZE-${fabric.fuzeNumber}`}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Issued{" "}
            {share?.sentAt ? fmtDate(share.sentAt) : fmtDate(new Date().toISOString())}
            {share?.expiresAt && (
              <>
                {" "}
                · This direct link is valid until{" "}
                <strong>{fmtDate(share.expiresAt)}</strong>
              </>
            )}
          </p>
        </header>

        {/* Prepared For */}
        <section className="mb-6">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Prepared For
          </h3>
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-4 bg-slate-50">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Brand</p>
              <p className="text-base font-semibold">
                {fabric.brand?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Factory</p>
              <p className="text-base font-semibold">
                {fabric.factory?.name || "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Customer Reference
              </p>
              <p className="text-lg font-mono font-bold">
                {fabric.customerReference || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Customer Item #
              </p>
              <p className="text-sm font-mono">{fabric.customerCode || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Factory Item #
              </p>
              <p className="text-sm font-mono">{fabric.factoryCode || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                FUZE Reference #
              </p>
              <p className="text-sm font-mono font-bold">
                FUZE-{fabric.fuzeNumber || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Construction
              </p>
              <p className="text-sm capitalize">
                {fabric.fabricCategory ||
                  fabric.construction ||
                  benchTest?.fabricType ||
                  "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Fiber Content
              </p>
              <p className="text-sm">{fiberSummary(fabric, benchTest)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Weight (GSM)
              </p>
              <p className="text-sm">
                {fabric.weightGsm ? `${fabric.weightGsm} g/m²` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Width</p>
              <p className="text-sm">
                {fabric.widthInches ? `${fabric.widthInches}"` : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Executive Summary */}
        <section className="mb-6">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Executive Summary
          </h3>
          <div className="border-l-4 border-slate-900 pl-4 py-2 text-[14px] leading-relaxed text-slate-800">
            <p>
              FUZE Biotech has validated{" "}
              <strong>
                {fabric.customerReference ||
                  fabric.customerCode ||
                  `FUZE-${fabric.fuzeNumber}`}
              </strong>{" "}
              for compatibility with FUZE{" "}
              <strong>{recommendedTier}</strong> treatment using a
              proprietary metamaterial antimicrobial finishing system.
              The recipe below was derived from a measured liquor pickup
              of <strong>{fmtNum(pickupPct, 2)}%</strong>
              {benchTest?.testNumber && (
                <>
                  {" "}
                  on bench test{" "}
                  <span className="font-mono">{benchTest.testNumber}</span>
                </>
              )}{" "}
              and is applied via standard textile finishing equipment
              (pad-dry-cure) at room temperature with no auxiliary,
              binder, or rinse step required.
            </p>
            {benchIcp != null && benchIcpExpected != null && (
              <p className="mt-2">
                In-house bench validation deposited{" "}
                <strong>{fmtNum(benchIcp, 3)} ppm</strong> against an
                expected target of{" "}
                <strong>{fmtNum(benchIcpExpected, 3)} ppm</strong> on
                fabric ({fmtNum(benchIcpAffinity, 1)}% affinity),
                confirming the recipe lands on tier within standard
                operating tolerance.
              </p>
            )}
            <p className="mt-2 text-slate-600 italic">
              FUZE is OEKO-TEX Standard 100 Class I, bluesign® approved,
              EPA registered, and PFAS-free.
            </p>
          </div>
        </section>

        {/* Recommended Recipe */}
        <section className="mb-6 print:break-inside-avoid">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Recommended Recipe
          </h3>
          {benchTest && pickupPct && recBathMgPerL ? (
            <div
              className="rounded p-4 border-2"
              style={{ borderColor: FUZE_CYAN }}
            >
              <p className="text-base text-slate-900 leading-relaxed">
                For every <strong>100 L</strong> of bath, mix{" "}
                <strong style={{ color: FUZE_CYAN }}>
                  {prettyMl(recFuzeMlPer100L || 0)}
                </strong>{" "}
                of FUZE stock ({fmtNum(stockMgPerL, 0)} mg/L) with DI
                water to volume. This yields a bath concentration of{" "}
                <strong>{fmtNum(recBathMgPerL, 3)} mg/L</strong> (
                {fmtNum(recBathMgPerL, 3)} ppm) which deposits{" "}
                <strong>{fmtNum(recTierMg, 2)} mg/kg</strong> ({fmtNum(recTierMg, 2)} ppm)
                on fabric — Tier <strong>{recommendedTier}</strong>.
              </p>
              <p className="text-sm text-slate-600 mt-2">
                <strong>Method:</strong>{" "}
                {benchTest.applicationMethod || "PAD_DRY_CURE"} · squeeze{" "}
                {fmtNum(benchTest.squeezePressure, 1, "bar")} · VFD{" "}
                {fmtNum(benchTest.vfdFrequencyHz, 1, "Hz")} · line speed{" "}
                {fmtNum(benchTest.lineSpeedMPerMin, 1, "m/min")}.
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <strong>Curing:</strong> Dry at{" "}
                {fmtNum(benchTest.dryingTemp, 0, "°C")} for{" "}
                {fmtNum(benchTest.dryingTime, 0, "min")}, then cure at{" "}
                {fmtNum(benchTest.curingTemp, 0, "°C")} for{" "}
                {fmtNum(benchTest.curingTime, 0, "min")}.
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <strong>No binder. No auxiliary chemistry. No rinse.</strong>{" "}
                FUZE bonds during the dry/cure step alone.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Recipe details unavailable in this revision.
            </p>
          )}
        </section>

        {/* FUZE Required */}
        <section className="mb-6 print:break-inside-avoid">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            FUZE Required (Production Bath Sizes)
          </h3>
          {pickupPct && fuzeMatrix?.length ? (
            <>
              <p className="text-xs text-slate-600 mb-2">
                FUZE stock at {fmtNum(stockMgPerL, 0)} mg/L. Numbers are
                exact for the measured pickup of {fmtNum(pickupPct, 2)}%.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="border border-slate-700 px-2 py-2 text-left">
                        Bath Size
                      </th>
                      {["F1", "F2", "F3", "F4"].map((tier) => (
                        <th
                          key={tier}
                          className="border border-slate-700 px-2 py-2 text-center"
                        >
                          {tier}
                          <br />
                          <span className="text-[10px] font-normal opacity-80">
                            {fmtNum(tierMgPerKg[tier], 2)} mg/kg OWF
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fuzeMatrix.map((row: any) => (
                      <tr key={row.bathL} className="even:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-2 font-bold">
                          {row.bathL} L
                        </td>
                        {["F1", "F2", "F3", "F4"].map((tier) => {
                          const cell = row.tiers[tier];
                          if (!cell) {
                            return (
                              <td
                                key={tier}
                                className="border border-slate-300 px-2 py-2 text-center text-slate-400"
                              >
                                —
                              </td>
                            );
                          }
                          return (
                            <td
                              key={tier}
                              className="border border-slate-300 px-2 py-2 text-center"
                            >
                              <div
                                className="font-bold text-base"
                                style={{ color: FUZE_CYAN }}
                              >
                                {cell.fuzeMl >= 1000
                                  ? `${cell.fuzeL.toFixed(2)} L`
                                  : `${cell.fuzeMl.toFixed(0)} mL`}
                              </div>
                              <div className="text-[10px] text-slate-600">
                                FUZE stock
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1">
                                bath: {cell.bathPpm.toFixed(2)} ppm
                              </div>
                              <div className="text-[10px] text-slate-500">
                                fabric: {cell.fabricPpm.toFixed(2)} ppm
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Top up the bath with DI water to reach the bath size column
                header. <strong>Unit reference:</strong> bath ppm = mg of
                FUZE per L of bath. Fabric ppm = mg per kg of dry fabric
                (OWF). 1 ppm = 1 mg/kg.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Production scaling table unavailable in this revision.
            </p>
          )}
        </section>

        {/* Lab ICP Verification */}
        {labIcpRuns.length > 0 && (
          <section className="mb-6 print:break-inside-avoid">
            <h3
              className="text-[11px] font-black uppercase tracking-widest mb-3"
              style={{ color: FUZE_CYAN }}
            >
              Independent Lab ICP Verification
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700">
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Test #
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Date
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Lab
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-right">
                      ppm on fabric
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-right">
                      mg/kg OWF
                    </th>
                    <th className="border border-slate-300 px-2 py-2 text-left">
                      Method
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {labIcpRuns.map((tr: any) => {
                    const v = tr.icpResult?.agValue;
                    return (
                      <tr key={tr.id} className="even:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-2 font-mono">
                          {tr.testReportNumber || tr.testNumber || "—"}
                        </td>
                        <td className="border border-slate-300 px-2 py-2">
                          {fmtDate(tr.testDate)}
                        </td>
                        <td className="border border-slate-300 px-2 py-2">
                          {tr.lab?.name || "—"}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-right font-bold">
                          {v != null ? fmtNum(v, 3) : "—"}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-right">
                          {v != null ? fmtNum(v, 3) : "—"}
                        </td>
                        <td className="border border-slate-300 px-2 py-2 text-slate-600">
                          {tr.testMethodStd || tr.testMethodRaw || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Where to find it */}
        <section className="mb-6 print:break-inside-avoid">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Accessing This Report Later
          </h3>
          <div className="border border-slate-300 rounded p-4 bg-slate-50 text-sm text-slate-700 leading-relaxed">
            <p>
              This report lives in your FUZE Atlas portal under{" "}
              <strong>My Reports</strong>. To find it next month:
            </p>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>
                Open <strong>{portalUrl}</strong>.
              </li>
              <li>
                Sign in with the email this report was sent to. If you
                don't have a password yet, click{" "}
                <em>"Forgot password / Set password"</em> and we'll email
                you a one-time link.
              </li>
              <li>
                In the sidebar, open <strong>My Reports</strong> — your
                reports are sorted newest-first and searchable.
              </li>
              <li>
                The direct download link in your email stays live for 90
                days; after that, sign in for a fresh copy that includes
                any new lab results.
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">
              Trouble logging in? Reply to the email this report came
              from — it routes to your FUZE account manager.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-300 text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            FUZE Atlas · Application Report ·{" "}
            <span className="font-mono">FUZE-{fabric.fuzeNumber}</span>
            {fabric.customerReference && (
              <> · {fabric.customerReference}</>
            )}
          </span>
          <span>Viewed {fmtDate(new Date().toISOString())}</span>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: Letter; margin: 0.5in; }
          body { background: white !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
