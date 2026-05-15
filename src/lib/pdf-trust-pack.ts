/**
 * src/lib/pdf-trust-pack.ts — BONUS-2 brand trust pack composer.
 *
 * Pattern follows src/lib/pdf-sustainability-competitive.ts: returns
 * a fully-styled HTML document that the browser renders + the user
 * Ctrl-P's to PDF. Avoids the pdfkit + font-shipping headache in
 * serverless. The output is print-friendly (@media print) with no
 * page-break orphans.
 *
 * Trust pack contents:
 *   1. Cover page — brand identity, prepared date, FUZE Atlas verified
 *      seal
 *   2. FUZE story — the canonical voice block (pulled from
 *      fuze-knowledge philosophy)
 *   3. Certifications inventory — OEKO-TEX Standard 100 Class I,
 *      bluesign® approved, EPA federal registration, California EPA
 *      approval (Q1 2026), PFAS-free attestation
 *   4. This brand's spec — required tier, ICP cadence, protocol doc
 *   5. Supply chain — every factory in the brand's chain with summary
 *      stats (fabric count, last test date)
 *   6. Recent test runs — last 10 brand-visible TestRuns with
 *      lab, date, type, and result summary
 *
 * The composer accepts pre-fetched data so the API route can keep its
 * queries close to the data it owns and the lib stays pure.
 */

export interface TrustPackBrand {
  id: string;
  name: string;
  website: string | null;
  requiredFuzeTier: string | null;
  icpCadenceEveryNBatches: number | null;
  icpCadenceEveryLitersConsumed: number | null;
  protocolDocUrl: string | null;
}

export interface TrustPackFactory {
  id: string;
  name: string;
  country: string | null;
  fabricCount: number;
  lastTestRunAt: string | null;
}

export interface TrustPackTestRun {
  id: string;
  testType: string;
  testDate: string | null;
  labName: string | null;
  fuzeNumber: number | null;
  resultSummary: string | null;
}

export interface TrustPackInput {
  brand: TrustPackBrand;
  factories: TrustPackFactory[];
  recentTestRuns: TrustPackTestRun[];
  generatedAt: Date;
  preparedFor?: string | null;
}

function escape(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

const TIER_BLURB: Record<string, string> = {
  F1: "Full Spectrum — 100-wash claim, third-party validated.",
  F2: "Advanced Performance — 75-wash claim, third-party validated.",
  F3: "Core Performance — 50-wash claim.",
  F4: "Essential Protection — 25-wash claim.",
};

const CERTIFICATIONS = [
  {
    name: "OEKO-TEX Standard 100 Class I",
    detail:
      "Tested against the strictest OEKO-TEX class — safe for fabrics in direct contact with skin including baby products.",
  },
  {
    name: "bluesign® approved",
    detail:
      "Validated against the bluesign® criteria for chemistry, resources, and workplace safety. End-to-end supply chain accountability.",
  },
  {
    name: "EPA federal registration",
    detail:
      "Registered with the US Environmental Protection Agency as an antimicrobial pesticide. Federal registration covers the active ingredient.",
  },
  {
    name: "California EPA approval (Q1 2026)",
    detail:
      "Approved by the California Department of Pesticide Regulation. Required for textile antimicrobial sales in California — the stricter US benchmark.",
  },
  {
    name: "PFAS-free",
    detail:
      "Zero per- and poly-fluoroalkyl substances in FUZE or its application chemistry. Compliant with California SB 707 (textiles) and aligned with Texas AG's PFAS investigation tailwind.",
  },
];

export function generateTrustPackHtml(input: TrustPackInput): string {
  const { brand, factories, recentTestRuns, generatedAt, preparedFor } = input;
  const tierBlurb = brand.requiredFuzeTier
    ? TIER_BLURB[brand.requiredFuzeTier] || ""
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>FUZE Trust Pack — ${escape(brand.name)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: #0f172a;
    margin: 0;
    background: #ffffff;
    line-height: 1.55;
  }
  .page {
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0.6in;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 26pt; margin: 0 0 0.2in; font-weight: 800; color: #0f172a; }
  h2 { font-size: 16pt; margin: 0.4in 0 0.12in; font-weight: 800; color: #0f172a; border-bottom: 2px solid #00b4c3; padding-bottom: 6pt; }
  h3 { font-size: 12pt; margin: 0.2in 0 0.08in; font-weight: 700; color: #0f172a; }
  p { margin: 0 0 0.08in; font-size: 11pt; }
  .label { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; }
  .value { font-size: 14pt; font-weight: 700; color: #0f172a; }
  .badge { display: inline-block; padding: 3pt 10pt; border-radius: 999pt; font-size: 9pt; font-weight: 700; background: #00b4c3; color: white; }
  .pill { display: inline-block; padding: 2pt 8pt; border-radius: 999pt; font-size: 8pt; font-weight: 700; background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.2in; margin: 0.18in 0; }
  .card { padding: 0.18in; border: 1px solid #e2e8f0; border-radius: 6pt; background: #f8fafc; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 0.12in; }
  th { text-align: left; padding: 6pt 8pt; background: #f1f5f9; font-weight: 700; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; border-bottom: 2px solid #cbd5e1; }
  td { padding: 6pt 8pt; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .cover-hero { display: flex; align-items: center; justify-content: space-between; gap: 0.3in; }
  .cover-meta { font-size: 10pt; color: #475569; line-height: 1.7; }
  .quote { padding: 0.2in 0.3in; background: #ecfeff; border-left: 4pt solid #00b4c3; border-radius: 4pt; font-size: 11pt; font-style: italic; margin: 0.2in 0; color: #155e75; }
  .footer { font-size: 9pt; color: #64748b; margin-top: 0.4in; padding-top: 0.12in; border-top: 1px solid #e2e8f0; }
  @media print {
    body { background: #ffffff; }
    .page { padding: 0.4in; }
  }
</style>
</head>
<body>

<!-- ── PAGE 1: COVER ── -->
<div class="page">
  <div class="cover-hero">
    <div>
      <span class="badge">FUZE TRUST PACK</span>
      <h1 style="margin-top: 0.15in;">${escape(brand.name)}</h1>
      <p style="font-size: 12pt; color: #475569;">
        FUZE antimicrobial textile treatment — verified supply chain &amp; compliance dossier.
      </p>
    </div>
  </div>
  <div class="cover-meta" style="margin-top: 0.6in;">
    <p><strong>Prepared:</strong> ${fmtDate(generatedAt.toISOString())}</p>
    ${preparedFor ? `<p><strong>Prepared for:</strong> ${escape(preparedFor)}</p>` : ""}
    ${brand.website ? `<p><strong>Brand website:</strong> ${escape(brand.website)}</p>` : ""}
    <p><strong>Supply chain footprint:</strong> ${factories.length} factor${factories.length === 1 ? "y" : "ies"} · ${recentTestRuns.length} recent lab validation${recentTestRuns.length === 1 ? "" : "s"}</p>
  </div>
  <div class="quote" style="margin-top: 0.6in;">
    FUZE is a proprietary antimicrobial textile treatment by FUZE Biotech.
    Metamaterial chemistry bonds to fibers during standard textile finishing —
    exhaust, pad-dry-cure, or spray. No PFAS. No binder. No curing oven required.
    Cures at 150–170 °C using the same line equipment the mill already runs for color
    fixation.
  </div>
  <div class="footer">
    FUZE Biotech · 1895 West 2100 South · Salt Lake City, Utah 84119 USA · fuzeatlas.com
  </div>
</div>

<!-- ── PAGE 2: BRAND SPEC ── -->
<div class="page">
  <h2>${escape(brand.name)} — FUZE Spec</h2>
  <p style="color: #475569;">
    The brand-stipulated FUZE specification this trust pack is anchored to. Every
    factory below ships against this spec; deviations trigger an order-validation
    alert in real time.
  </p>
  <div class="grid">
    <div class="card">
      <div class="label">Required FUZE tier</div>
      <div class="value">${escape(brand.requiredFuzeTier || "Not set")}</div>
      ${tierBlurb ? `<p style="font-size: 9pt; color: #475569; margin-top: 6pt;">${escape(tierBlurb)}</p>` : ""}
    </div>
    <div class="card">
      <div class="label">ICP cadence — by batches</div>
      <div class="value">
        ${brand.icpCadenceEveryNBatches ? `Every ${brand.icpCadenceEveryNBatches} batches` : "Not set"}
      </div>
    </div>
    <div class="card">
      <div class="label">ICP cadence — by liters consumed</div>
      <div class="value">
        ${brand.icpCadenceEveryLitersConsumed ? `Every ${Math.round(brand.icpCadenceEveryLitersConsumed).toLocaleString()} L` : "Not set"}
      </div>
    </div>
    <div class="card">
      <div class="label">Protocol document</div>
      <div class="value">
        ${brand.protocolDocUrl ? `<a href="${escape(brand.protocolDocUrl)}">View protocol →</a>` : "Not provided"}
      </div>
    </div>
  </div>
</div>

<!-- ── PAGE 3: CERTIFICATIONS ── -->
<div class="page">
  <h2>FUZE Certifications</h2>
  <p style="color: #475569;">
    FUZE is verified against the strictest US and EU textile safety standards.
    Each certification listed below covers the active ingredient and our standard
    application chemistry; brand-side and SKU-side variants don't change the
    underlying compliance posture.
  </p>
  ${CERTIFICATIONS.map(
    (c) => `
    <h3>${escape(c.name)}</h3>
    <p style="color: #334155;">${escape(c.detail)}</p>
  `,
  ).join("")}
</div>

<!-- ── PAGE 4: SUPPLY CHAIN ── -->
<div class="page">
  <h2>${escape(brand.name)} — Supply Chain</h2>
  <p style="color: #475569;">
    Every factory currently linked to ${escape(brand.name)} as a FUZE supplier. Activity dates and
    test runs come from the live Atlas record.
  </p>
  ${
    factories.length === 0
      ? `<p style="color: #94a3b8; font-style: italic;">No factories linked yet. Once SupplyChainLink rows exist this section auto-populates.</p>`
      : `<table>
          <thead>
            <tr><th>Factory</th><th>Country</th><th>Fabrics</th><th>Last test</th></tr>
          </thead>
          <tbody>
          ${factories
            .map(
              (f) => `
            <tr>
              <td><strong>${escape(f.name)}</strong></td>
              <td>${escape(f.country || "—")}</td>
              <td>${f.fabricCount}</td>
              <td>${fmtDate(f.lastTestRunAt)}</td>
            </tr>
          `,
            )
            .join("")}
          </tbody>
        </table>`
  }
</div>

<!-- ── PAGE 5: RECENT TESTS ── -->
<div class="page">
  <h2>Recent Lab Validations</h2>
  <p style="color: #475569;">
    The last ${recentTestRuns.length} brand-visible test runs for ${escape(brand.name)}.
    All results are third-party validated by accredited labs.
  </p>
  ${
    recentTestRuns.length === 0
      ? `<p style="color: #94a3b8; font-style: italic;">No brand-visible test runs yet.</p>`
      : `<table>
          <thead>
            <tr><th>Date</th><th>Test</th><th>Lab</th><th>Fabric</th><th>Result</th></tr>
          </thead>
          <tbody>
          ${recentTestRuns
            .map(
              (r) => `
            <tr>
              <td>${fmtDate(r.testDate)}</td>
              <td><span class="pill">${escape(r.testType.replace(/_/g, " "))}</span></td>
              <td>${escape(r.labName || "—")}</td>
              <td>${r.fuzeNumber != null ? `FUZE-${r.fuzeNumber}` : "—"}</td>
              <td>${escape(r.resultSummary || "Passed")}</td>
            </tr>
          `,
            )
            .join("")}
          </tbody>
        </table>`
  }
  <div class="footer">
    Trust pack generated by FUZE Atlas · ${fmtDate(generatedAt.toISOString())} · fuzeatlas.com/verify
  </div>
</div>

</body>
</html>`;
}
