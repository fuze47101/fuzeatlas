// @ts-nocheck
/**
 * Combined Sustainability + Competitive Intelligence PDF Report
 * Generates a professional branded HTML report for browser print-to-PDF
 *
 * Usage: Called from /api/reports/sustainability-competitive endpoint
 * Input: Fabric params + competitor selection (or "all")
 * Output: Full HTML document optimized for print
 */

import { COMPETITORS, type Competitor } from "./competitors";
import {
  calcSustainabilityScore,
  generateESGClaims,
  FUZE_SUSTAINABILITY,
  type SustainabilityScore,
  type ESGClaim,
} from "./sustainability";

// ══════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════

export type ReportParams = {
  gsm: number;
  widthInches: number;
  targetWashes: number;
  metersPerGarment: number;
  annualMeters: number;
  competitorIds: string[] | "all";
  brandName?: string;       // optional: brand requesting the report
  preparedFor?: string;     // optional: person name
};

type CompetitorResult = {
  competitor: Competitor;
  score: SustainabilityScore;
  claims: ESGClaim[];
};

// ══════════════════════════════════════════════════
// MAIN GENERATOR
// ══════════════════════════════════════════════════

export function generateSustainabilityCompetitiveReport(params: ReportParams): string {
  const {
    gsm, widthInches, targetWashes, metersPerGarment, annualMeters,
    competitorIds, brandName, preparedFor,
  } = params;

  const widthM = widthInches * 0.0254;
  const fabricWeightKg = (gsm * widthM * 1) / 1000; // kg per linear meter

  // Select competitors
  const selectedCompetitors = competitorIds === "all"
    ? COMPETITORS
    : COMPETITORS.filter(c => competitorIds.includes(c.id));

  // Run sustainability scoring for each
  const results: CompetitorResult[] = selectedCompetitors.map(comp => {
    const score = calcSustainabilityScore(comp, fabricWeightKg, targetWashes, metersPerGarment);
    const claims = generateESGClaims(score, comp, annualMeters);
    return { competitor: comp, score, claims };
  });

  // Sort by sustainability score (highest = worst competitor = best for FUZE)
  results.sort((a, b) => b.score.sustainabilityScore - a.score.sustainabilityScore);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FUZE Environmental Impact & Competitive Analysis Report</title>
<style>
${getReportStyles()}
</style>
</head>
<body>
  ${renderCoverPage(params, today)}
  ${renderExecutiveSummary(results, params)}
  ${renderGradeAndRecyclability(results)}
  ${renderFUZETechnology()}
  ${renderLifecycleStage1(results, params)}
  ${renderLifecycleStage2(results, params)}
  ${renderLifecycleStage3(results, params)}
  ${renderLifecycleStage4(results, params)}
  ${renderCompetitorComparison(results, params)}
  ${results.map((r, i) => renderCompetitorTeardown(r, params, i)).join("")}
  ${renderESGSummary(results, params)}
  ${renderCostAnalysis(results, params)}
  ${renderCertifications()}
  ${renderDisclaimer(today)}
</body>
</html>`;
}

// ══════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════

function getReportStyles(): string {
  return `
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
      .no-break { page-break-inside: avoid; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a2e; line-height: 1.6; background: white; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 50px; }

    /* Cover */
    .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #0a1628 0%, #1a1a2e 50%, #0d2b3e 100%); color: white; text-align: center; padding: 60px; }
    .cover-logo { font-size: 48px; font-weight: 900; letter-spacing: 4px; color: #00b4c3; margin-bottom: 8px; }
    .cover-sub { font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 60px; }
    .cover-title { font-size: 28px; font-weight: 300; color: white; margin-bottom: 10px; line-height: 1.3; }
    .cover-title strong { font-weight: 700; color: #00b4c3; }
    .cover-meta { margin-top: 60px; font-size: 12px; color: rgba(255,255,255,0.4); }
    .cover-meta strong { color: rgba(255,255,255,0.7); }
    .cover-badge { display: inline-block; margin-top: 30px; padding: 8px 24px; border: 1px solid rgba(0,180,195,0.4); border-radius: 4px; color: #00b4c3; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }

    /* Section headers */
    .section-header { background: #0d2b3e; color: white; padding: 16px 24px; margin: 40px -50px 24px -50px; font-size: 16px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    .section-header span { color: #00b4c3; margin-right: 8px; }
    .stage1-header { background: #1e3a8a !important; }
    .stage2-header { background: #92400e !important; }
    .stage3-header { background: #ea580c !important; }
    .stage4-header { background: #8b5cf6 !important; }

    /* Tables */
    .data-table { width: 100%; border-collapse: collapse; margin: 16px 0 24px 0; font-size: 11px; }
    .data-table th { background: #1a1a2e; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .data-table td { padding: 8px 12px; border-bottom: 1px solid #e8e8e8; }
    .data-table tr:nth-child(even) td { background: #f8f9fa; }
    .data-table .fuze-row td { background: rgba(0,180,195,0.08); font-weight: 600; }
    .data-table .danger { color: #dc3545; font-weight: 600; }
    .data-table .success { color: #28a745; font-weight: 600; }
    .data-table .warning { color: #e67e22; }
    .data-table .muted { color: #999; font-size: 10px; }

    /* Metric cards */
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; border-top: 3px solid #00b4c3; }
    .metric-value { font-size: 28px; font-weight: 800; color: #1a1a2e; }
    .metric-unit { font-size: 11px; color: #666; margin-top: 2px; }
    .metric-label { font-size: 11px; color: #999; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Competitor cards */
    .comp-card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; margin-bottom: 20px; page-break-inside: avoid; }
    .comp-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #eee; }
    .comp-name { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .comp-company { font-size: 12px; color: #666; }
    .comp-grade { display: inline-block; padding: 4px 16px; border-radius: 4px; font-weight: 800; font-size: 14px; color: white; }
    .grade-a { background: #28a745; }
    .grade-b { background: #e67e22; }
    .grade-c { background: #dc3545; }
    .comp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .comp-stat { padding: 8px 12px; background: #f8f9fa; border-radius: 4px; }
    .comp-stat-label { font-size: 10px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; }
    .comp-stat-value { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-top: 2px; }

    /* EPA badge */
    .epa-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .epa-active { background: #d4edda; color: #155724; }
    .epa-inactive { background: #f8d7da; color: #721c24; }
    .epa-conditional { background: #fff3cd; color: #856404; }
    .epa-none { background: #e2e3e5; color: #383d41; }

    /* Score bar */
    .score-bar { height: 8px; background: #e8e8e8; border-radius: 4px; overflow: hidden; margin-top: 4px; }
    .score-fill { height: 100%; border-radius: 4px; }

    /* ESG claims */
    .esg-claim { display: flex; gap: 16px; padding: 16px; margin-bottom: 12px; background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0; }
    .esg-icon { font-size: 24px; flex-shrink: 0; }
    .esg-headline { font-weight: 700; font-size: 13px; color: #1a1a2e; }
    .esg-detail { font-size: 11px; color: #555; margin-top: 4px; }
    .esg-metric { font-size: 10px; color: #22c55e; font-weight: 600; margin-top: 4px; }

    /* Cost comparison */
    .cost-bar-container { margin: 8px 0; }
    .cost-bar-label { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
    .cost-bar { height: 24px; border-radius: 4px; display: flex; overflow: hidden; }
    .cost-segment { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 9px; color: white; font-weight: 600; }
    .seg-chemical { background: #3b82f6; }
    .seg-binder { background: #ef4444; }
    .seg-curing { background: #f59e0b; }
    .seg-remediation { background: #8b5cf6; }
    .seg-fuze { background: #00b4c3; }

    /* Certifications */
    .cert-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .cert-card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; gap: 12px; align-items: start; }
    .cert-icon { font-size: 24px; }
    .cert-name { font-weight: 700; font-size: 12px; color: #1a1a2e; }
    .cert-note { font-size: 10px; color: #666; margin-top: 2px; }

    /* Grade cards */
    .grade-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; margin: 24px 0; }
    .grade-card { text-align: center; padding: 24px; border-radius: 12px; }
    .grade-card-fuze { background: linear-gradient(135deg, #059669, #10b981); color: white; }
    .grade-card-comp { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; }
    .grade-card-comp-c { background: linear-gradient(135deg, #d97706, #f59e0b); color: white; }
    .grade-letter { font-size: 56px; font-weight: 900; line-height: 1; margin-bottom: 8px; }
    .grade-label { font-size: 13px; font-weight: 700; }
    .grade-sub { font-size: 10px; opacity: 0.8; margin-top: 4px; }
    .grade-vs { font-size: 24px; font-weight: 800; color: #ccc; }

    .recycle-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center; margin: 24px 0; }
    .recycle-card { text-align: center; padding: 24px; border-radius: 12px; border: 2px solid #e5e7eb; }
    .recycle-card-yes { border-color: #059669; background: #f0fdf4; }
    .recycle-card-no { border-color: #dc2626; background: #fef2f2; }
    .recycle-icon { font-size: 48px; margin-bottom: 8px; }
    .recycle-label { font-size: 13px; font-weight: 700; }
    .recycle-name { font-size: 11px; color: #666; margin-top: 4px; }
    .sb707-box { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .sb707-title { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 4px; }
    .sb707-text { font-size: 10px; color: #78350f; }

    /* Misc */
    .text-sm { font-size: 12px; color: #555; margin-bottom: 12px; }
    .text-xs { font-size: 10px; color: #999; }
    .highlight { background: rgba(0,180,195,0.1); padding: 16px 20px; border-radius: 8px; border-left: 4px solid #00b4c3; margin: 16px 0; }
    .highlight strong { color: #00b4c3; }
    .footer { text-align: center; padding: 40px 0; border-top: 1px solid #eee; margin-top: 40px; }
    .footer p { font-size: 10px; color: #bbb; }
    .confidential { display: inline-block; padding: 4px 12px; background: #fee2e2; color: #991b1b; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-radius: 3px; margin-bottom: 8px; }
  `;
}

// ══════════════════════════════════════════════════
// RENDER SECTIONS
// ══════════════════════════════════════════════════

function renderCoverPage(params: ReportParams, today: string): string {
  return `
  <div class="cover">
    <div class="cover-logo">FUZE</div>
    <div class="cover-sub">BIOTECH</div>
    <div class="cover-title">
      <strong>Environmental Impact</strong> &amp;<br>
      Competitive Intelligence Report
    </div>
    ${params.preparedFor ? `<div class="cover-meta">Prepared for <strong>${params.preparedFor}</strong>${params.brandName ? ` · ${params.brandName}` : ""}</div>` : ""}
    <div class="cover-meta">${today} · Confidential</div>
    <div class="cover-badge">Reference: ${params.gsm} GSM · ${params.widthInches}" width · ${params.targetWashes} target washes</div>
  </div>`;
}

// Helper function for number formatting
const num = (n: number, d = 2) => {
  if (n === 0) return "0";
  if (isNaN(n) || !isFinite(n)) return "0";
  return n.toFixed(d);
};

function renderExecutiveSummary(results: CompetitorResult[], params: ReportParams): string {
  const avgScore = results.reduce((s, r) => s + r.score.sustainabilityScore, 0) / results.length;
  const avgCO2 = results.reduce((s, r) => s + r.score.co2SavedPerMeter, 0) / results.length;
  const avgCost = results.reduce((s, r) => s + r.score.hiddenCostPerMeter, 0) / results.length;
  const totalAnnualCO2 = avgCO2 * params.annualMeters;

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="section-header"><span>01</span> Executive Summary</div>
    <p class="text-sm">
      This report compares FUZE metamaterial technology against ${results.length} competing antimicrobial chemistries
      across environmental impact, hidden costs, regulatory standing, and performance durability.
      All calculations reference a ${params.gsm} GSM fabric at ${params.widthInches}" width with ${params.targetWashes}-wash durability targets.
    </p>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">${avgScore.toFixed(0)}</div>
        <div class="metric-unit">out of 100</div>
        <div class="metric-label">Avg. FUZE Advantage Score</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${totalAnnualCO2 >= 1000 ? (totalAnnualCO2/1000).toFixed(1) + "t" : totalAnnualCO2.toFixed(0) + "kg"}</div>
        <div class="metric-unit">CO₂ saved annually</div>
        <div class="metric-label">vs avg. competitor @ ${(params.annualMeters/1000).toFixed(0)}k meters</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">$${(avgCost * params.annualMeters / 1000).toFixed(1)}k</div>
        <div class="metric-unit">hidden costs eliminated</div>
        <div class="metric-label">Binder + Curing + Remediation</div>
      </div>
    </div>
    <div class="highlight">
      <strong>Bottom line:</strong> Switching to FUZE eliminates an average of
      <strong>$${avgCost.toFixed(3)}/meter</strong> in hidden costs that competing antimicrobials don't disclose —
      binders, curing energy, and wastewater remediation. Over ${(params.annualMeters/1000).toFixed(0)}k annual meters,
      that's <strong>$${(avgCost * params.annualMeters).toFixed(0)}</strong> in real savings.
    </div>
  </div>`;
}

function renderGradeAndRecyclability(results: CompetitorResult[]): string {
  const gradeRows = results.map(r => {
    const g = r.score.competitorEnvironmentalGrade;
    const gradeClass = (g === "F" || g === "D") ? "grade-card-comp" : "grade-card-comp-c";
    const recyclableIcon = r.score.competitorRecyclable ? "👍" : "👎";
    const recyclableText = r.score.competitorRecyclable ? "Recyclable" : "Not Recyclable";
    const recyclableClass = r.score.competitorRecyclable ? "recycle-card-yes" : "recycle-card-no";
    return `
      <div class="no-break" style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px;">${r.competitor.product} <span style="font-size: 11px; color: #666; font-weight: 400;">— ${r.competitor.company}</span></div>
        <div class="grade-grid">
          <div class="grade-card grade-card-fuze">
            <div class="grade-letter">A</div>
            <div class="grade-label">FUZE</div>
            <div class="grade-sub">Zero binders · Zero curing · Zero leaching</div>
          </div>
          <div class="grade-vs">vs</div>
          <div class="grade-card ${gradeClass}">
            <div class="grade-letter">${g}</div>
            <div class="grade-label">${r.competitor.product}</div>
            <div class="grade-sub">${r.competitor.binderRequired ? "Binder required" : ""}${r.competitor.binderRequired && r.competitor.curingRequired ? " · " : ""}${r.competitor.curingRequired ? r.competitor.curingTempC + "°C curing" : ""}${r.competitor.leachRatePerWash > 0 ? " · Leaches metals" : ""}</div>
          </div>
        </div>
        <div class="recycle-grid">
          <div class="recycle-card recycle-card-yes">
            <div class="recycle-icon">👍</div>
            <div class="recycle-label" style="color: #059669;">Fully Recyclable</div>
            <div class="recycle-name">FUZE</div>
          </div>
          <div class="grade-vs">vs</div>
          <div class="recycle-card ${recyclableClass}">
            <div class="recycle-icon">${recyclableIcon}</div>
            <div class="recycle-label" style="color: ${r.score.competitorRecyclable ? "#059669" : "#dc2626"};">${recyclableText}</div>
            <div class="recycle-name">${r.competitor.product}</div>
          </div>
        </div>
      </div>`;
  }).join("");

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="section-header"><span>02</span> Environmental Rating &amp; Textile Recyclability</div>
    <p class="text-sm">
      FUZE receives an <strong style="color: #059669;">A</strong> environmental rating — zero binders, zero curing energy,
      zero leaching, zero VOCs, and fully recyclable textiles. Each competitor is graded on the same criteria.
    </p>
    ${gradeRows}
    <div class="sb707-box">
      <div class="sb707-title">⚖️ California SB 707 — Responsible Textile Recovery Act</div>
      <div class="sb707-text">
        Requires textile producers to fund collection and recycling programs. Chemical binders and curing agents
        that prevent clean fiber recovery create compliance risk and increased producer responsibility fees.
        FUZE-treated textiles remain fully recyclable — no binders, no coatings, no contamination of recycling streams.
      </div>
    </div>
  </div>`;
}

function renderLifecycleStage1(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const mfgCO2Annual = (s.co2SavedPerMeter * params.annualMeters);
    return `<tr>
      <td><strong>${c.product}</strong></td>
      <td>${num(s.co2SavedPerMeter, 3)}</td>
      <td>${num(mfgCO2Annual >= 1000 ? mfgCO2Annual / 1000 : mfgCO2Annual, mfgCO2Annual >= 1000 ? 1 : 0)} ${mfgCO2Annual >= 1000 ? "t" : "kg"}</td>
      <td class="success">$0.000</td>
      <td class="success">0 kg</td>
      <td class="success">0 L</td>
    </tr>`;
  }).join("");

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="section-header" style="background: #1e3a8a;"><span>03</span> Lifecycle Stage 1: Chemical Plant Manufacturing</div>
    <p class="text-sm">
      Upstream impacts from antimicrobial chemical production, including CO₂ from synthesis, process waste, VOC emissions,
      and water consumption at the manufacturing facility. FUZE uses recycled electronics feedstock with 85% lower upstream emissions.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:25%">Product</th>
          <th>CO₂ per Meter (kg)</th>
          <th>Annual CO₂ Savings @ ${(params.annualMeters/1000).toFixed(0)}k m</th>
          <th>Waste Cost</th>
          <th>VOC Emissions</th>
          <th>Water Consumed</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong></td>
          <td class="success">0.000</td>
          <td class="success">—</td>
          <td class="success">$0.000</td>
          <td class="success">0 kg</td>
          <td class="success">0 L</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function renderLifecycleStage2(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const curingCO2Annual = (s.energySavedPerMeter * params.annualMeters);
    return `<tr>
      <td><strong>${c.product}</strong></td>
      <td>${c.curingRequired ? `${c.curingTempC}°C` : "None"}</td>
      <td>${c.binderRequired ? c.binderGPerKg + "g/kg " + c.binderType : "None"}</td>
      <td>${num(s.energySavedPerMeter, 3)}</td>
      <td>${num(curingCO2Annual >= 1000 ? curingCO2Annual / 1000 : curingCO2Annual, curingCO2Annual >= 1000 ? 1 : 0)} ${curingCO2Annual >= 1000 ? "t" : "kg"}</td>
      <td>${c.binderVOC ? "Yes" : "No"}</td>
    </tr>`;
  }).join("");

  return `
  <div class="container">
    <div class="section-header" style="background: #92400e;"><span>04</span> Lifecycle Stage 2: Factory Application</div>
    <p class="text-sm">
      Application-stage impacts at the textile mill: curing temperatures, binder chemical usage, energy consumption,
      VOC emissions during drying and thermal processing. FUZE requires no curing (air dry only) and zero binders.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:20%">Product</th>
          <th>Curing Temp</th>
          <th>Binder Required</th>
          <th>Energy/Meter (kWh)</th>
          <th>Curing CO₂/year</th>
          <th>VOC Emissions</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong></td>
          <td class="success">None</td>
          <td class="success">None</td>
          <td class="success">0.000</td>
          <td class="success">—</td>
          <td class="success">No</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function renderLifecycleStage3(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const remCostAnnual = (s.remediationCostPerMeter * params.annualMeters);
    return `<tr>
      <td><strong>${c.product}</strong></td>
      <td>${num(s.remediationCostPerMeter, 3)}</td>
      <td>${num(remCostAnnual >= 1000 ? remCostAnnual / 1000 : remCostAnnual, remCostAnnual >= 1000 ? 1 : 0)} ${remCostAnnual >= 1000 ? "k" : ""}</td>
      <td>${s.waterSavedPerMeter > 0 ? num(s.waterSavedPerMeter, 2) : "0"}</td>
      <td>${(s.waterSavedPerMeter * params.annualMeters / 1000).toFixed(1)}</td>
      <td class="success">0.000</td>
    </tr>`;
  }).join("");

  return `
  <div class="container">
    <div class="section-header" style="background: #ea580c;"><span>05</span> Lifecycle Stage 3: Factory Wastewater Remediation</div>
    <p class="text-sm">
      Post-application treatment costs: chemical remediation of metals in wastewater, energy for treatment,
      sludge handling, and regulatory compliance. FUZE produces no wastewater requiring treatment.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:20%">Product</th>
          <th>Treatment Cost/m ($)</th>
          <th>Annual Treatment Cost @ ${(params.annualMeters/1000).toFixed(0)}k m</th>
          <th>Water Contaminated/m (L)</th>
          <th>Annual Water Treated (k L)</th>
          <th>Remediation Cost (FUZE saves)</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong></td>
          <td class="success">$0.000</td>
          <td class="success">—</td>
          <td class="success">0</td>
          <td class="success">—</td>
          <td class="success">$0.000</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function renderLifecycleStage4(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const bioaccumDesc = (s.consumerBioaccumulationFactor || 0) > 0.7 ? "High persistence"
      : (s.consumerBioaccumulationFactor || 0) >= 0.4 ? "Moderate"
      : "Low";
    const annualWaterContam = (s.consumerWaterContaminatedLitersLifetime || 0) / (params.targetWashes > 0 ? params.targetWashes : 1) * params.targetWashes;
    return `<tr>
      <td><strong>${c.product}</strong></td>
      <td>${num(s.consumerLeachedMetalMgPerWash || 0, 2)}</td>
      <td>${num(s.consumerTotalLeachedMgLifetime || 0, 1)}</td>
      <td>${num((s.consumerWaterContaminatedLitersLifetime || 0) / 1000, 1)}</td>
      <td>$${num(s.municipalTreatmentCostPerGarment || 0, 3)}</td>
      <td>${num(s.consumerMicroplasticShedGPerWash || 0, 3)}</td>
      <td>${bioaccumDesc}</td>
    </tr>`;
  }).join("");

  return `
  <div class="container">
    <div class="section-header" style="background: #8b5cf6;"><span>06</span> Lifecycle Stage 4: Consumer & Municipal Impact</div>
    <p class="text-sm">
      End-of-life impacts: metal leaching during home washing cycles, contamination of household wastewater,
      municipal treatment costs, microplastic shedding from binder degradation, and bioaccumulation in aquatic ecosystems.
      FUZE has zero leaching and zero microplastic shedding over the garment lifetime.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:20%">Product</th>
          <th>Metal/Wash (mg)</th>
          <th>Lifetime Metal (mg)</th>
          <th>Water Contaminated (k L)</th>
          <th>Municipal Treat. Cost ($)</th>
          <th>Microplastic/Wash (g)</th>
          <th>Bioaccumulation</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong></td>
          <td class="success">0.00</td>
          <td class="success">0.0</td>
          <td class="success">0.0</td>
          <td class="success">$0.000</td>
          <td class="success">0.000</td>
          <td class="success">None</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function renderFUZETechnology(): string {
  return `
  <div class="container">
    <div class="section-header"><span>02</span> FUZE Metamaterial Technology</div>
    <p class="text-sm">
      FUZE is an antimicrobial textile treatment consisting of 99.998% ultrapure 18-megaohm deionized water
      and 30 ppm FUZE metamaterial — a high-density allotrope synthesized via liquid laser ablation from
      recycled electronic waste. The product integrates permanently into the textile fiber matrix with zero
      binders, zero curing, and zero leaching over the lifetime of the garment.
    </p>
    <div class="comp-grid" style="margin-top: 16px;">
      <div class="comp-stat"><div class="comp-stat-label">Binder Required</div><div class="comp-stat-value success">None — zero polymer binder</div></div>
      <div class="comp-stat"><div class="comp-stat-label">Curing Required</div><div class="comp-stat-value success">None — air dry only</div></div>
      <div class="comp-stat"><div class="comp-stat-label">VOC Emissions</div><div class="comp-stat-value success">Zero grams</div></div>
      <div class="comp-stat"><div class="comp-stat-label">Wastewater Treatment</div><div class="comp-stat-value success">Not required — $0/m³</div></div>
      <div class="comp-stat"><div class="comp-stat-label">Leach Rate</div><div class="comp-stat-value success">0% — permanent bond</div></div>
      <div class="comp-stat"><div class="comp-stat-label">Metal Source</div><div class="comp-stat-value">Recycled e-waste (85% CO₂ reduction)</div></div>
      <div class="comp-stat"><div class="comp-stat-label">Application</div><div class="comp-stat-value">Existing dye bath, exhaust, or spray</div></div>
      <div class="comp-stat"><div class="comp-stat-label">EPA Registration</div><div class="comp-stat-value">Lifetime durability claim</div></div>
    </div>
  </div>`;
}

function renderCompetitorComparison(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const gradeClass = s.sustainabilityScore >= 75 ? "grade-a" : s.sustainabilityScore >= 50 ? "grade-b" : "grade-c";
    const epaClass = c.epaRegNumber === "N/A" || c.epaRegNumber === "" ? "epa-none"
      : c.epaRegNote.toLowerCase().includes("conditional") || c.epaRegNote.toLowerCase().includes("court") ? "epa-conditional"
      : c.epaRegNote.toLowerCase().includes("inactive") ? "epa-inactive"
      : "epa-active";
    const epaLabel = c.epaRegNumber === "N/A" || c.epaRegNumber === "" ? "NONE"
      : c.epaRegNote.toLowerCase().includes("conditional") ? "CONDITIONAL"
      : c.epaRegNote.toLowerCase().includes("inactive") ? "INACTIVE"
      : c.epaRegNumber;

    return `<tr>
      <td><strong>${c.product}</strong><br><span class="muted">${c.company}</span></td>
      <td>${c.chemistryLabel}</td>
      <td><span class="epa-badge ${epaClass}">${epaLabel}</span></td>
      <td>${c.binderRequired ? `<span class="danger">Yes</span><br><span class="muted">${c.binderGPerKg}g/kg ${c.binderType.split(" ")[0]}</span>` : '<span class="success">No</span>'}</td>
      <td>${c.curingRequired ? `<span class="danger">${c.curingTempC}°C</span>` : '<span class="success">None</span>'}</td>
      <td>${c.leachRateFirst10Washes > 0 ? `<span class="danger">${c.leachRateFirst10Washes}%</span><br><span class="muted">first 10 washes</span>` : '<span class="success">0%</span>'}</td>
      <td><span style="display:inline-block; padding:2px 10px; border-radius:4px; font-weight:800; font-size:12px; color:white; background:${(s.competitorEnvironmentalGrade === "F" || s.competitorEnvironmentalGrade === "D") ? "#dc2626" : s.competitorEnvironmentalGrade.startsWith("C") ? "#d97706" : "#059669"};">${s.competitorEnvironmentalGrade}</span></td>
      <td>${s.competitorRecyclable ? '<span class="success">👍</span>' : '<span class="danger">👎</span>'}</td>
      <td><span class="comp-grade ${gradeClass}" style="font-size:11px; padding:2px 8px;">${s.grade}</span></td>
    </tr>`;
  }).join("");

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="section-header"><span>07</span> Competitive Comparison Matrix</div>
    <p class="text-sm">Side-by-side comparison of ${results.length} competing antimicrobial technologies against FUZE.
    Environmental Rating grades each product on binders, curing, leaching, VOCs, and recyclability. Recyclable column indicates SB 707 compliance for textile circularity.</p>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:18%">Product</th>
          <th>Chemistry</th>
          <th>EPA Reg.</th>
          <th>Binder</th>
          <th>Curing</th>
          <th>Leach</th>
          <th>Rating</th>
          <th>♻️</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong><br><span class="muted">FUZE Biotech</span></td>
          <td>Metamaterial</td>
          <td><span class="epa-badge epa-active">LIFETIME</span></td>
          <td><span class="success">None</span></td>
          <td><span class="success">None</span></td>
          <td><span class="success">0%</span></td>
          <td><span style="display:inline-block; padding:2px 10px; border-radius:4px; font-weight:800; font-size:12px; color:white; background:#059669;">A</span></td>
          <td><span class="success">👍</span></td>
          <td>—</td>
        </tr>
        ${rows}
      </tbody>
    </table>
  </div>`;
}

function renderCompetitorTeardown(result: CompetitorResult, params: ReportParams, index: number): string {
  const { competitor: c, score: s } = result;
  const gradeClass = s.sustainabilityScore >= 75 ? "grade-a" : s.sustainabilityScore >= 50 ? "grade-b" : "grade-c";

  // Only do full teardown pages for first 5 competitors to keep report manageable
  if (index >= 5) return "";

  const annualCO2 = s.co2SavedPerMeter * params.annualMeters;
  const annualWater = s.waterSavedPerMeter * params.annualMeters;
  const annualHiddenCost = s.hiddenCostPerMeter * params.annualMeters;

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="comp-card no-break">
      <div class="comp-card-header">
        <div>
          <div class="comp-name">${c.product}</div>
          <div class="comp-company">${c.company} · ${c.chemistryLabel}</div>
        </div>
        <div class="comp-grade ${gradeClass}">${s.grade}</div>
      </div>

      <div style="display:flex; gap:16px; margin-bottom:16px;">
        <div style="flex:1; display:flex; align-items:center; gap:12px; padding:12px 16px; background:linear-gradient(135deg,#059669,#10b981); border-radius:8px; color:white;">
          <span style="font-size:32px; font-weight:900;">A</span>
          <div><div style="font-size:11px; font-weight:700;">FUZE Environmental Rating</div><div style="font-size:9px; opacity:0.8;">Zero binders · Zero curing · Zero leaching</div></div>
        </div>
        <div style="flex:1; display:flex; align-items:center; gap:12px; padding:12px 16px; background:linear-gradient(135deg,${(s.competitorEnvironmentalGrade === "F" || s.competitorEnvironmentalGrade === "D") ? "#dc2626,#ef4444" : "#d97706,#f59e0b"}); border-radius:8px; color:white;">
          <span style="font-size:32px; font-weight:900;">${s.competitorEnvironmentalGrade}</span>
          <div><div style="font-size:11px; font-weight:700;">${c.product} Rating</div><div style="font-size:9px; opacity:0.8;">${c.binderRequired ? "Binder req." : ""}${c.curingRequired ? " · Curing" : ""}${c.leachRatePerWash > 0 ? " · Leaches" : ""}</div></div>
        </div>
        <div style="flex:0.6; display:flex; align-items:center; gap:8px; padding:12px 16px; background:${s.competitorRecyclable ? "#f0fdf4" : "#fef2f2"}; border:2px solid ${s.competitorRecyclable ? "#059669" : "#dc2626"}; border-radius:8px;">
          <span style="font-size:24px;">${s.competitorRecyclable ? "👍" : "👎"}</span>
          <div><div style="font-size:10px; font-weight:700; color:${s.competitorRecyclable ? "#059669" : "#dc2626"};">${s.competitorRecyclable ? "Recyclable" : "Not Recyclable"}</div><div style="font-size:8px; color:#666;">SB 707</div></div>
        </div>
      </div>

      <div class="comp-grid">
        <div class="comp-stat">
          <div class="comp-stat-label">EPA Registration</div>
          <div class="comp-stat-value">${c.epaRegNumber !== "N/A" ? c.epaRegNumber + (c.epaRegYear ? ` (${c.epaRegYear})` : "") : "Not Published"}</div>
          <div style="font-size:10px; color:#666; margin-top:4px;">${c.epaRegNote}</div>
        </div>
        <div class="comp-stat">
          <div class="comp-stat-label">Dosage Range</div>
          <div class="comp-stat-value">${c.dosageLow}–${c.dosageHigh} mg/kg (typical: ${c.dosageTypical})</div>
          <div style="font-size:10px; color:#666; margin-top:4px;">FUZE: 0.25–1.0 mg/kg (${c.dosageTypical / 1}× less)</div>
        </div>
        <div class="comp-stat">
          <div class="comp-stat-label">Binder Requirement</div>
          <div class="comp-stat-value">${c.binderRequired
            ? `<span style="color:#dc3545">${c.binderGPerKg}g/kg ${c.binderType}</span>`
            : '<span style="color:#28a745">None required</span>'}</div>
          ${c.binderFormaldehyde ? '<div style="font-size:10px; color:#dc3545; margin-top:4px;">⚠ Contains formaldehyde crosslinker</div>' : ""}
          ${c.binderVOC ? '<div style="font-size:10px; color:#e67e22; margin-top:4px;">⚠ VOC emissions during curing</div>' : ""}
        </div>
        <div class="comp-stat">
          <div class="comp-stat-label">Curing</div>
          <div class="comp-stat-value">${c.curingRequired
            ? `<span style="color:#dc3545">${c.curingTempC}°C required</span>`
            : '<span style="color:#28a745">Not required</span>'}</div>
        </div>
        <div class="comp-stat">
          <div class="comp-stat-label">Wash Durability</div>
          <div class="comp-stat-value">${c.maxWashClaim} washes claimed</div>
          <div style="font-size:10px; color:#666; margin-top:4px;">${c.washClaimNote}</div>
        </div>
        <div class="comp-stat">
          <div class="comp-stat-label">Leaching Profile</div>
          <div class="comp-stat-value">${c.leachRateFirst10Washes}% lost in first 10 washes</div>
          <div style="font-size:10px; color:#666; margin-top:4px;">${c.leachRatePerWash}% per wash · ${c.heavyMetalReleased} released</div>
        </div>
      </div>

      <div style="margin-top:20px;">
        <div style="font-size:12px; font-weight:700; color:#1a1a2e; margin-bottom:8px;">Environmental Savings by Switching to FUZE</div>
        <div class="metric-grid" style="grid-template-columns: repeat(4, 1fr); gap:8px;">
          <div class="metric-card" style="padding:12px;">
            <div class="metric-value" style="font-size:18px;">${annualCO2 >= 1000 ? (annualCO2/1000).toFixed(1) + "t" : annualCO2.toFixed(0) + "kg"}</div>
            <div class="metric-label" style="font-size:9px;">CO₂/year</div>
          </div>
          <div class="metric-card" style="padding:12px;">
            <div class="metric-value" style="font-size:18px;">${(annualWater/1000).toFixed(1)}k</div>
            <div class="metric-label" style="font-size:9px;">Liters water/year</div>
          </div>
          <div class="metric-card" style="padding:12px;">
            <div class="metric-value" style="font-size:18px;">$${annualHiddenCost >= 1000 ? (annualHiddenCost/1000).toFixed(1) + "k" : annualHiddenCost.toFixed(0)}</div>
            <div class="metric-label" style="font-size:9px;">Hidden costs/year</div>
          </div>
          <div class="metric-card" style="padding:12px;">
            <div class="metric-value" style="font-size:18px;">${s.sustainabilityScore}</div>
            <div class="metric-label" style="font-size:9px;">Advantage score</div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-size:12px; font-weight:700; color:#1a1a2e; margin-bottom:8px;">Consumer & Municipal Stage 4 Impact</div>
        <div class="comp-grid">
          <div class="comp-stat">
            <div class="comp-stat-label">Metal Leached/Wash</div>
            <div class="comp-stat-value" style="color:${(s.consumerLeachedMetalMgPerWash || 0) > 0 ? '#dc3545' : '#28a745'}">${num(s.consumerLeachedMetalMgPerWash || 0, 2)} mg</div>
          </div>
          <div class="comp-stat">
            <div class="comp-stat-label">Total Lifetime Metal</div>
            <div class="comp-stat-value" style="color:${(s.consumerTotalLeachedMgLifetime || 0) > 0 ? '#dc3545' : '#28a745'}">${num(s.consumerTotalLeachedMgLifetime || 0, 1)} mg</div>
          </div>
          <div class="comp-stat">
            <div class="comp-stat-label">Water Contaminated</div>
            <div class="comp-stat-value" style="color:${(s.consumerWaterContaminatedLitersLifetime || 0) > 0 ? '#dc3545' : '#28a745'}">${num((s.consumerWaterContaminatedLitersLifetime || 0) / 1000, 1)}k L</div>
          </div>
          <div class="comp-stat">
            <div class="comp-stat-label">Municipal Treatment Cost</div>
            <div class="comp-stat-value" style="color:${(s.municipalTreatmentCostPerGarment || 0) > 0 ? '#dc3545' : '#28a745'}">$${num(s.municipalTreatmentCostPerGarment || 0, 3)}</div>
          </div>
          <div class="comp-stat">
            <div class="comp-stat-label">Microplastic/Wash</div>
            <div class="comp-stat-value" style="color:${(s.consumerMicroplasticShedGPerWash || 0) > 0 ? '#dc3545' : '#28a745'}">${num(s.consumerMicroplasticShedGPerWash || 0, 3)} g</div>
          </div>
          <div class="comp-stat">
            <div class="comp-stat-label">Bioaccumulation Factor</div>
            <div class="comp-stat-value" style="color:${(s.consumerBioaccumulationFactor || 0) > 0.7 ? '#dc3545' : (s.consumerBioaccumulationFactor || 0) >= 0.4 ? '#e67e22' : '#28a745'}">
              ${num(s.consumerBioaccumulationFactor || 0, 2)}
              <div style="font-size:9px; color:#666; margin-top:2px;">
                ${(s.consumerBioaccumulationFactor || 0) > 0.7 ? "High persistence" : (s.consumerBioaccumulationFactor || 0) >= 0.4 ? "Moderate" : "Low"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-size:12px; font-weight:700; color:#1a1a2e; margin-bottom:8px;">True Cost Breakdown (per linear meter)</div>
        <div class="cost-bar-container">
          <div class="cost-bar-label">
            <span><strong>${c.product}</strong></span>
            <span><strong>$${s.trueTotalCostPerMeter.toFixed(3)}/m</strong></span>
          </div>
          <div class="cost-bar">
            ${renderCostBar(c, s)}
          </div>
          <div style="display:flex; gap:12px; margin-top:4px; font-size:9px; color:#666;">
            <span style="color:#3b82f6;">■ Chemical</span>
            ${c.binderRequired ? '<span style="color:#ef4444;">■ Binder</span>' : ''}
            ${c.curingRequired ? '<span style="color:#f59e0b;">■ Curing</span>' : ''}
            <span style="color:#8b5cf6;">■ Remediation</span>
          </div>
        </div>
        <div class="cost-bar-container" style="margin-top:8px;">
          <div class="cost-bar-label">
            <span><strong>FUZE FTP F1</strong></span>
            <span><strong>$${s.fuzeTrueCostPerMeter.toFixed(3)}/m</strong></span>
          </div>
          <div class="cost-bar" style="width:${Math.max(10, (s.fuzeTrueCostPerMeter / s.trueTotalCostPerMeter) * 100)}%">
            <div class="cost-segment seg-fuze" style="width:100%">$${s.fuzeTrueCostPerMeter.toFixed(3)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderCostBar(c: Competitor, s: SustainabilityScore): string {
  const total = s.trueTotalCostPerMeter;
  if (total <= 0) return "";

  const chemCost = c.estimatedCostPerMeterTypical;
  const binderCost = c.binderRequired ? (c.binderGPerKg * c.binderPricePerKg / 1000 * 0.15) : 0; // rough per meter
  const curingCost = c.curingRequired ? (s.energySavedPerMeter * 0.10) : 0;
  const remCost = s.remediationCostPerMeter;

  const segments = [
    { cost: chemCost, cls: "seg-chemical", label: "Chemical" },
    { cost: binderCost, cls: "seg-binder", label: "Binder" },
    { cost: curingCost, cls: "seg-curing", label: "Curing" },
    { cost: remCost, cls: "seg-remediation", label: "Remed." },
  ].filter(s => s.cost > 0);

  const segTotal = segments.reduce((a, b) => a + b.cost, 0);

  return segments.map(seg => {
    const pct = Math.max(8, (seg.cost / segTotal) * 100);
    return `<div class="cost-segment ${seg.cls}" style="width:${pct}%">$${seg.cost.toFixed(3)}</div>`;
  }).join("");
}

function renderESGSummary(results: CompetitorResult[], params: ReportParams): string {
  // Use the worst competitor's claims as the most dramatic example
  const worst = results[0]; // already sorted by score desc
  const claims = worst.claims;

  return `
  <div class="page-break"></div>
  <div class="container">
    <div class="section-header"><span>09</span> ESG Impact Claims</div>
    <p class="text-sm">
      The following claims are generated from verified data comparing FUZE against ${worst.competitor.product}
      at ${(params.annualMeters/1000).toFixed(0)}k annual meters. These claims can be used in brand sustainability reports,
      marketing materials, and regulatory filings.
    </p>
    ${claims.map(claim => `
      <div class="esg-claim no-break">
        <div class="esg-icon">${claim.icon}</div>
        <div>
          <div class="esg-headline">${claim.headline}</div>
          <div class="esg-detail">${claim.detail}</div>
          <div class="esg-metric">${claim.metric}</div>
        </div>
      </div>
    `).join("")}
  </div>`;
}

function renderCostAnalysis(results: CompetitorResult[], params: ReportParams): string {
  const rows = results.map(r => {
    const c = r.competitor;
    const s = r.score;
    const stage1 = s.co2SavedPerMeter * 0.05; // approx mfg cost impact
    const stage2 = c.curingRequired ? (s.energySavedPerMeter * 0.10) : 0;
    const stage3 = s.remediationCostPerMeter;
    return `<tr>
      <td><strong>${c.product}</strong></td>
      <td>$${c.estimatedCostPerMeterTypical.toFixed(3)}</td>
      <td>$${stage1.toFixed(3)}</td>
      <td>${c.binderRequired ? "$" + ((c.binderGPerKg * c.binderPricePerKg / 1000) * 0.15).toFixed(3) : "—"}</td>
      <td>${c.curingRequired ? "$" + stage2.toFixed(3) : "—"}</td>
      <td>$${stage3.toFixed(3)}</td>
      <td><strong>$${s.trueTotalCostPerMeter.toFixed(3)}</strong></td>
      <td class="success">$${(s.trueTotalCostPerMeter - s.fuzeTrueCostPerMeter).toFixed(3)}</td>
    </tr>`;
  }).join("");

  return `
  <div class="container">
    <div class="section-header"><span>10</span> True Cost Analysis: 4 Lifecycle Stages</div>
    <p class="text-sm">
      Competing antimicrobials advertise only the chemical cost. The true cost includes manufacturing (Stage 1),
      application (Stage 2), binder + curing (Stage 2), and wastewater remediation (Stage 3) — costs that are real but rarely disclosed.
      Stage 4 (consumer/municipal) impacts are quantified separately above.
    </p>
    <table class="data-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Chemical Cost</th>
          <th>Stage 1: Mfg</th>
          <th>Stage 2: Binder</th>
          <th>Stage 2: Curing</th>
          <th>Stage 3: Remediation</th>
          <th>True Total</th>
          <th>FUZE Saves</th>
        </tr>
      </thead>
      <tbody>
        <tr class="fuze-row">
          <td><strong>FUZE FTP F1</strong></td>
          <td>$0.270</td>
          <td>$0.000</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td><strong>$0.270</strong></td>
          <td>—</td>
        </tr>
        ${rows}
      </tbody>
    </table>
    <p class="text-xs" style="margin-top:8px;">All costs per linear meter. Chemical costs based on distributor pricing at typical dosage on ${params.gsm} GSM fabric. Stage costs are calculated from sustainability modeling.</p>
  </div>`;
}

function renderCertifications(): string {
  return `
  <div class="container">
    <div class="section-header"><span>11</span> Certifications &amp; Registrations</div>
    <div class="cert-grid">
      ${FUZE_SUSTAINABILITY.certifications.map(cert => `
        <div class="cert-card no-break">
          <div class="cert-icon">${cert.icon}</div>
          <div>
            <div class="cert-name">${cert.name}</div>
            <div class="cert-note">${cert.note}</div>
          </div>
        </div>
      `).join("")}
    </div>
  </div>`;
}

function renderDisclaimer(today: string): string {
  return `
  <div class="container">
    <div class="footer">
      <div class="confidential">Confidential</div>
      <p>
        FUZE Biotech · 1895 West 2100 South, Salt Lake City, Utah 84119 USA<br>
        info@fuze47.com · www.fuze47.com · 801.809.6000<br><br>
        Generated ${today}. Data sourced from EPA filings, manufacturer documentation, and independent research.
        Cost estimates are approximations based on available distributor pricing and may vary by region.
        This document is proprietary and intended for the designated recipient only.
      </p>
    </div>
  </div>`;
}
