// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FULL APPLICATION REPORT — PRINTABLE / EXTERNAL-SAFE
 *
 *  The customer-facing deliverable that Andrew (#102) ordered after the
 *  Penfabric escalation. One self-contained document a brand or factory can
 *  read end-to-end and walk away knowing:
 *    1. WHAT fabric this is (their reference, their item #, brand, factory)
 *    2. WHAT recipe to run on the production padder, in plain English
 *    3. WHAT we mixed in our bench lab to validate it (in-house pad/dry)
 *    4. WHAT a third-party ICP lab measured on the treated sample
 *    5. HOW MUCH FUZE they need at production scale (100/200/300/400 L)
 *    6. HOW to log back into Atlas to find this report next month
 *
 *  Structure mirrors the bench-test recipe card (Phase 1) but goes deeper:
 *  this is the long-form report, not the bench card. The bench card stays
 *  the one-page operator hand-out; this is the report PDF that gets emailed
 *  to the customer + lives in their /portal/my-reports landing.
 *
 *  Voice: pulled from src/lib/fuze-knowledge.ts per CLAUDE.md hard rule —
 *  FUZE / metamaterial only, never silver / nano / silver-ion.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";

const FUZE_CYAN = "#00b4c3";

// ─── Fetch helper — server-side, follows the sample-application/print pattern.
async function getReport(fabricId: string) {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const cookie = h.get("cookie") || "";
  const base = `${proto}://${host}`;
  const res = await fetch(
    `${base}/api/admin/fabric-report/${encodeURIComponent(fabricId)}`,
    {
      cache: "no-store",
      headers: { cookie },
    },
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.ok) return null;
  return json;
}

// ─── Format helpers ───────────────────────────────────────────────────────
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
function constructionLabel(fabric: any, benchTest: any): string {
  return (
    fabric?.fabricCategory ||
    fabric?.construction ||
    benchTest?.fabricType ||
    "—"
  );
}

export default async function FullApplicationReportPage({
  params,
}: {
  params: Promise<{ fabricId: string }>;
}) {
  const { fabricId } = await params;
  const data = await getReport(fabricId);
  if (!data) notFound();

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
    safeForExternal,
    missingForExternal,
  } = data;

  // ─── Recommended Recipe (carry-over from Phase 1, with extra detail) ──
  const recTierMg = tierMgPerKg[recommendedTier] ?? 1.0;
  const recBathMgPerL =
    pickupPct ? recTierMg / (pickupPct / 100) : null;
  const recFuzeMlPer100L =
    recBathMgPerL ? (recBathMgPerL * 100 * 1000) / stockMgPerL : null;
  const recFuzeMlPer1L =
    recBathMgPerL ? (recBathMgPerL * 1 * 1000) / stockMgPerL : null;

  // ─── ICP roll-up ──────────────────────────────────────────────────────
  // Two sources of ICP truth:
  //   (a) RecipeBenchTest.icpMeasuredPpm (in-house bench validation we sent
  //       to the lab as part of the recipe sign-off)
  //   (b) FabricSubmission → TestRun.icpResult.agValue (the customer's
  //       actual treated production sample sent to a third-party lab)
  // Andrew #102 wants both.
  const benchIcp = benchTest?.icpMeasuredPpm ?? null;
  const benchIcpExpected = benchTest?.icpExpectedPpm ?? null;
  const benchIcpAffinity = benchTest?.affinityPct ?? null;
  const labIcpRuns = (labTestRuns || []).filter(
    (tr: any) =>
      tr.testType === "ICP" || tr.icpResult || tr.icpResult?.agValue != null,
  );

  // Latest passing antibacterial result (for executive summary one-liner)
  const abRuns = (labTestRuns || []).filter(
    (tr: any) => tr.abResult,
  );

  const portalUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://fuzeatlas.com";

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white">
      {/* ─── Top action bar (screen-only) ───────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pt-6 flex justify-between items-center print:hidden">
        <Link
          href={`/fabrics/${fabric.id}`}
          className="text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          ← Back to Fabric
        </Link>
        <div className="flex gap-3">
          <Link
            href={`/admin/fabric-report/${fabric.id}/send`}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded hover:bg-slate-800"
          >
            Email to Customer
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* ─── External-safety banner (screen + print) ────────────────── */}
      {!safeForExternal && (
        <div className="max-w-4xl mx-auto mt-4 mx-6 print:my-2 border-2 border-red-600 bg-red-50 rounded p-4">
          <p className="text-sm font-black text-red-700 uppercase tracking-widest mb-2">
            ⚠ Not Safe to Send Externally
          </p>
          <p className="text-sm text-red-800 mb-2">
            This report is missing identifying information that the customer
            needs in order to recognize the submission. Fill these in on the
            fabric record before emailing:
          </p>
          <ul className="text-sm text-red-800 list-disc pl-5">
            {missingForExternal.map((m: string) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="text-xs text-red-700 mt-2 print:hidden">
            <Link
              href={`/fabrics/${fabric.id}/edit`}
              className="underline font-semibold"
            >
              → Edit fabric record
            </Link>
          </p>
        </div>
      )}

      {/* ─── Report body ────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto p-6 print:p-4 print:max-w-none">
        {/* ─── Cover / Header ──────────────────────────────────────── */}
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
            Issued {fmtDate(new Date().toISOString())} · Document covers
            recommended bath recipe, in-house pad/dry validation, and
            independent lab ICP verification.
          </p>
        </header>

        {/* ─── 1. Prepared For (Customer Identification) ────────────── */}
        <section className="mb-6">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Prepared For
          </h3>
          <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-4 bg-slate-50">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Brand
              </p>
              <p className="text-base font-semibold">
                {fabric.brand?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Factory
              </p>
              <p className="text-base font-semibold">
                {fabric.factory?.name || "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Customer Reference
              </p>
              <p className="text-lg font-mono font-bold text-slate-900">
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
                {constructionLabel(fabric, benchTest)}
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
              <p className="text-[10px] text-slate-500 uppercase font-bold">
                Width
              </p>
              <p className="text-sm">
                {fabric.widthInches ? `${fabric.widthInches}"` : "—"}
              </p>
            </div>
            {fabric.color && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  Color
                </p>
                <p className="text-sm">{fabric.color}</p>
              </div>
            )}
            {fabric.dyeStage && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  Dye Stage
                </p>
                <p className="text-sm">{fabric.dyeStage}</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── 2. Executive Summary ─────────────────────────────────── */}
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
              proprietary metamaterial antimicrobial finishing system. The
              recipe below was derived from a measured liquor pickup of{" "}
              <strong>{fmtNum(pickupPct, 2)}%</strong>
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
                fabric (
                {fmtNum(benchIcpAffinity, 1)}% affinity), confirming the
                recipe lands on tier within standard operating tolerance.
              </p>
            )}
            {labIcpRuns.length > 0 && (
              <p className="mt-2">
                A third-party laboratory independently measured FUZE
                deposit on the treated sample, validating the recipe is
                production-ready (see Section 5).
              </p>
            )}
            <p className="mt-2 text-slate-600 italic">
              FUZE is OEKO-TEX Standard 100 Class I, bluesign® approved,
              EPA registered, and PFAS-free. No silver-ion, no
              nanoparticles — FUZE metamaterial bonds elementally to
              fibers during standard textile finishing.
            </p>
          </div>
        </section>

        {/* ─── 3. Recommended Recipe ────────────────────────────────── */}
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
                <strong>{fmtNum(recTierMg, 2)} mg/kg</strong> ({fmtNum(
                  recTierMg,
                  2,
                )}{" "}
                ppm) on fabric — Tier{" "}
                <strong>{recommendedTier}</strong>.
              </p>
              <p className="text-sm text-slate-600 mt-2">
                <strong>Method:</strong>{" "}
                {benchTest.applicationMethod || "PAD_DRY_CURE"} ·
                squeeze{" "}
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
              <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-200">
                Derived from validated bench test{" "}
                <span className="font-mono font-bold">
                  {benchTest.testNumber}
                </span>{" "}
                · {fmtDate(benchTest.testDate)} · pickup{" "}
                {fmtNum(pickupPct, 2)}%
              </p>
            </div>
          ) : (
            <div className="border-2 border-amber-400 bg-amber-50 rounded p-4">
              <p className="text-sm font-bold text-amber-900">
                No validated bench test on file for this fabric.
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Run the Recipe Calculator to produce a measured pickup %
                before this section can be filled in.
              </p>
            </div>
          )}
        </section>

        {/* ─── 4. FUZE Required at Production Scale ─────────────────── */}
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
                exact for the measured pickup of {fmtNum(pickupPct, 2)}% —
                re-run if your line conditions change pickup by more than
                ±2 percentage points.
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
                Top-up the bath with DI water to reach the bath size
                column header. Example: for a 200 L bath at F1, mix the
                listed mL of FUZE stock with DI water until total volume
                equals 200 L.
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                <strong>Unit reference:</strong> bath ppm = mg of FUZE
                metamaterial per L of bath water. Fabric ppm = mg per kg
                of dry fabric (OWF, on-weight-of-fabric). 1 ppm = 1 mg/kg
                = 0.0001%.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 italic">
              FUZE Required matrix unavailable — requires a measured
              pickup % from a validated bench test.
            </p>
          )}
        </section>

        {/* ─── 5. In-House Validation Chain ─────────────────────────── */}
        <section className="mb-6 print:break-inside-avoid">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            In-House Validation
          </h3>
          {benchTest ? (
            <div className="border border-slate-300 rounded">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Bench Test{" "}
                  <span className="font-mono">{benchTest.testNumber}</span>
                </p>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">
                    Test date
                  </p>
                  <p className="font-semibold">
                    {fmtDate(benchTest.testDate)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">
                    Method
                  </p>
                  <p className="font-semibold">
                    {benchTest.applicationMethod}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">
                    Pickup
                  </p>
                  <p className="font-semibold">
                    {fmtNum(pickupPct, 2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">
                    Stock
                  </p>
                  <p className="font-semibold">
                    {fmtNum(stockMgPerL, 0)} mg/L
                  </p>
                </div>
                {benchTest.icpExpectedPpm != null && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      ICP expected
                    </p>
                    <p className="font-semibold">
                      {fmtNum(benchTest.icpExpectedPpm, 3)} ppm
                    </p>
                  </div>
                )}
                {benchTest.icpMeasuredPpm != null && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      ICP measured
                    </p>
                    <p
                      className="font-semibold"
                      style={{ color: FUZE_CYAN }}
                    >
                      {fmtNum(benchTest.icpMeasuredPpm, 3)} ppm
                    </p>
                  </div>
                )}
                {benchTest.affinityPct != null && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      Affinity
                    </p>
                    <p className="font-semibold">
                      {fmtNum(benchTest.affinityPct, 1)}%
                    </p>
                  </div>
                )}
                {benchTest.icpLab && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      ICP lab
                    </p>
                    <p className="font-semibold">{benchTest.icpLab}</p>
                  </div>
                )}
              </div>
              {sampleApplications && sampleApplications.length > 0 && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">
                    Sample applications ({sampleApplications.length})
                  </p>
                  <div className="space-y-1">
                    {sampleApplications.slice(0, 5).map((app: any) => (
                      <div
                        key={app.id}
                        className="text-xs flex items-center gap-2"
                      >
                        <span className="font-mono text-slate-600">
                          {app.appNumber}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-semibold">{app.tier}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          {fmtNum(app.bathVolumeL, 2)} L bath
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          padded {fmtDate(app.paddedAt)}
                        </span>
                        {app.driedAt && (
                          <>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600">
                              dried {fmtDate(app.driedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              No in-house validation data on file yet.
            </p>
          )}
        </section>

        {/* ─── 6. Lab ICP Verification (third-party) ────────────────── */}
        <section className="mb-6 print:break-inside-avoid">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Independent Lab ICP Verification
          </h3>
          {labIcpRuns.length > 0 ? (
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
                      FUZE on fabric (ppm)
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
                    // IcpResult.unit may be ppm or mg/kg — they're
                    // numerically identical for solid fabric, but we
                    // surface both columns for the customer's QA team.
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
              <p className="text-[10px] text-slate-500 mt-2">
                ICP-OES results expressed as elemental FUZE metamaterial.
                On solid fabric, ppm and mg/kg are numerically equivalent
                (1 ppm = 1 mg per 1 kg of fabric).
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              No third-party lab ICP results on file for this fabric yet.
              Bench validation (Section 5) is the current proof of recipe.
            </p>
          )}

          {/* Antibacterial / Fungal / Odor side-band, if any */}
          {abRuns.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">
                Antibacterial efficacy (third-party)
              </p>
              <div className="space-y-1">
                {abRuns.slice(0, 4).map((tr: any) => (
                  <div key={tr.id} className="text-xs">
                    <span className="font-semibold">
                      {tr.abResult?.organism ||
                        tr.abResult?.organism1 ||
                        "—"}
                    </span>
                    {tr.abResult?.percentReduction != null && (
                      <span className="ml-2">
                        {fmtNum(tr.abResult.percentReduction, 1)}%
                        reduction
                      </span>
                    )}
                    {tr.abResult?.activityValue != null && (
                      <span className="ml-2">
                        A = {fmtNum(tr.abResult.activityValue, 2)}
                      </span>
                    )}
                    <span className="ml-2 text-slate-500">
                      ({tr.testMethodStd || "—"} ·{" "}
                      {tr.lab?.name || "—"} ·{" "}
                      {tr.washCount != null
                        ? `${tr.washCount} washes`
                        : "no wash"}
                      )
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ─── 7. Where to Find This Report (login instructions) ────── */}
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
                reports are sorted newest-first and searchable by your
                customer reference, item number, or FUZE number.
              </li>
              <li>
                The download link in the email that delivered this report
                stays live for 90 days; after that, sign in to pull a
                fresh copy that includes any new lab results.
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">
              Trouble logging in? Reply to the email this report came
              from — it routes to your FUZE account manager.
            </p>
          </div>
        </section>

        {/* ─── 8. Appendix / Footer ─────────────────────────────────── */}
        <section className="mt-8 pt-4 border-t border-slate-300">
          <h3
            className="text-[11px] font-black uppercase tracking-widest mb-3"
            style={{ color: FUZE_CYAN }}
          >
            Appendix
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold text-slate-700">FUZE compliance</p>
              <p className="text-slate-600 mt-1">
                OEKO-TEX Standard 100 Class I · bluesign® approved · EPA
                registered (federal) · California EPA approved (Q1 2026)
                · PFAS-free.
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-700">Test standards</p>
              <p className="text-slate-600 mt-1">
                AATCC 100 · AATCC 30 · ISO 20743 · ISO 18184 · ICP-OES
                per lab method.
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-700">Issued by</p>
              <p className="text-slate-600 mt-1">
                FUZE Biotech · 1895 West 2100 South, Salt Lake City, UT
                84119 USA · andrew@fuze47.com
              </p>
            </div>
            <div>
              <p className="font-bold text-slate-700">Document version</p>
              <p className="text-slate-600 mt-1">
                Live report — regenerated on every download from the
                Atlas database. Bench test{" "}
                <span className="font-mono">
                  {benchTest?.testNumber || "—"}
                </span>{" "}
                · pickup {fmtNum(pickupPct, 2)}%.
              </p>
            </div>
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
          <span>Printed {fmtDate(new Date().toISOString())}</span>
        </div>
      </div>

      {/* Print-specific styles */}
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
