// @ts-nocheck
/**
 * PDF Report Templates for FUZE Atlas
 * Generates professional HTML email-compatible report templates for:
 * - Test Results Reports
 * - Brand Scorecards
 * - Compliance Reports
 * - Weekly Digests
 */

const FUZE_TEAL = "#00b4c3";
const FUZE_DARK = "#1A1A2E";
const FUZE_LIGHT_BG = "#f5f5f5";
const FUZE_SUCCESS = "#28a745";
const FUZE_WARNING = "#ffc107";
const FUZE_DANGER = "#dc3545";

/**
 * Common HTML/CSS template utilities
 */
function getBaseStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #333;
      line-height: 1.6;
      background: white;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      border-bottom: 3px solid ${FUZE_TEAL};
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: start;
    }
    .header-left h1 {
      color: ${FUZE_TEAL};
      font-size: 28px;
      margin-bottom: 5px;
    }
    .header-left p {
      color: #666;
      font-size: 12px;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #999;
    }
    .doc-title {
      font-size: 20px;
      font-weight: bold;
      color: ${FUZE_DARK};
      margin: 30px 0 20px 0;
    }
    .doc-subtitle {
      font-size: 13px;
      color: #666;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-label {
      background: ${FUZE_LIGHT_BG};
      padding: 12px 15px;
      font-weight: bold;
      color: ${FUZE_DARK};
      border-left: 4px solid ${FUZE_TEAL};
      margin-bottom: 15px;
      font-size: 13px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .info-item {
      font-size: 12px;
    }
    .info-label {
      color: #666;
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 11px;
    }
    .info-value {
      color: #333;
      font-weight: 500;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 11px;
    }
    th {
      background: ${FUZE_TEAL};
      color: white;
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      border: none;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #eee;
      color: #333;
    }
    tr:nth-child(even) {
      background: ${FUZE_LIGHT_BG};
    }
    tr:hover {
      background: #f0f0f0;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-align: center;
    }
    .badge-pass {
      background: ${FUZE_SUCCESS};
      color: white;
    }
    .badge-fail {
      background: ${FUZE_DANGER};
      color: white;
    }
    .badge-pending {
      background: ${FUZE_WARNING};
      color: #333;
    }
    .metric-box {
      background: ${FUZE_LIGHT_BG};
      padding: 15px;
      border-left: 4px solid ${FUZE_TEAL};
      margin: 10px 0;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: ${FUZE_TEAL};
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .highlight {
      background: #fff3cd;
      padding: 10px;
      border-left: 3px solid ${FUZE_WARNING};
      margin: 10px 0;
      font-size: 12px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #999;
      text-align: center;
    }
    .divider {
      height: 1px;
      background: #eee;
      margin: 20px 0;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .container { padding: 20px; }
      table { page-break-inside: avoid; }
      .section { page-break-inside: avoid; }
    }
  `;
}

/**
 * Generate Test Results Report
 */
export function generateTestResultsReport(params: {
  brandName: string;
  fabricCode?: string;
  submissionId?: string;
  testRuns: Array<{
    testType: string;
    testMethod?: string;
    testDate?: string;
    labName?: string;
    passed: boolean;
    passFailReason?: string;
    icpAg?: number;
    icpAu?: number;
    abReduction?: number;
    fungalResult?: string;
    odorResult?: string;
    washCount?: number;
  }>;
  generatedDate?: string;
}): string {
  const now = params.generatedDate
    ? new Date(params.generatedDate)
    : new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const passCount = params.testRuns.filter((t) => t.passed).length;
  const totalCount = params.testRuns.length;
  const passRate =
    totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : "0";

  const testRunRows = params.testRuns
    .map(
      (test) => `
    <tr>
      <td>${test.testType}</td>
      <td>${test.testMethod || "—"}</td>
      <td>${test.testDate ? new Date(test.testDate).toLocaleDateString() : "—"}</td>
      <td>${test.labName || "—"}</td>
      <td>
        <span class="badge ${test.passed ? "badge-pass" : "badge-fail"}">
          ${test.passed ? "PASS" : "FAIL"}
        </span>
      </td>
      <td>${test.passFailReason || "—"}</td>
    </tr>
  `
    )
    .join("");

  const resultDetailsRows = params.testRuns
    .filter(
      (t) =>
        t.icpAg !== undefined ||
        t.icpAu !== undefined ||
        t.abReduction !== undefined
    )
    .map(
      (test) => `
    <tr>
      <td>${test.testType}</td>
      <td>${test.washCount !== undefined ? `${test.washCount} wash(es)` : "—"}</td>
      <td>
        ${
          test.icpAg !== undefined
            ? `Ag: ${test.icpAg} ppm`
            : test.icpAu !== undefined
              ? `Au: ${test.icpAu} ppm`
              : test.abReduction !== undefined
                ? `${test.abReduction}% reduction`
                : "—"
        }
      </td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>FUZE ATLAS</h1>
        <p>Antimicrobial Textile Management Platform</p>
      </div>
      <div class="header-meta">
        <div>Generated</div>
        <div style="font-weight: bold;">${dateStr}</div>
      </div>
    </div>

    <div class="doc-title">Test Results Report</div>
    <div class="doc-subtitle">Comprehensive test summary for ${params.brandName}</div>

    <div class="section">
      <div class="section-label">FABRIC & SUBMISSION DETAILS</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Brand</div>
          <div class="info-value">${params.brandName}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Fabric Code</div>
          <div class="info-value">${params.fabricCode || "N/A"}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="metric-box">
        <div class="metric-value">${passRate}%</div>
        <div class="metric-label">Pass Rate (${passCount}/${totalCount} tests passed)</div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">TEST RESULTS SUMMARY</div>
      <table>
        <thead>
          <tr>
            <th>Test Type</th>
            <th>Method</th>
            <th>Date</th>
            <th>Lab</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${testRunRows || "<tr><td colspan='6'>No test results available</td></tr>"}
        </tbody>
      </table>
    </div>

    ${
      resultDetailsRows
        ? `
    <div class="section">
      <div class="section-label">DETAILED RESULT VALUES</div>
      <table>
        <thead>
          <tr>
            <th>Test Type</th>
            <th>Wash Count</th>
            <th>Result Value</th>
          </tr>
        </thead>
        <tbody>
          ${resultDetailsRows}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    <div class="footer">
      Generated by FUZE Atlas | ${dateStr}<br>
      This is a confidential report for ${params.brandName}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Brand Scorecard Report
 */
export function generateBrandScorecard(params: {
  brandName: string;
  pipelineStage?: string;
  totalFabrics?: number;
  totalTests?: number;
  passRate?: number;
  activeSows?: number;
  complianceStatus?: string;
  recentTests?: Array<{
    fabricCode: string;
    testType: string;
    passed: boolean;
    date: string;
  }>;
  upcomingMilestones?: Array<{
    title: string;
    dueDate: string;
    status?: string;
  }>;
  generatedDate?: string;
}): string {
  const now = params.generatedDate
    ? new Date(params.generatedDate)
    : new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const recentTestRows = (params.recentTests || [])
    .map(
      (test) => `
    <tr>
      <td>${test.fabricCode}</td>
      <td>${test.testType}</td>
      <td><span class="badge ${test.passed ? "badge-pass" : "badge-fail"}">${test.passed ? "PASS" : "FAIL"}</span></td>
      <td>${new Date(test.date).toLocaleDateString()}</td>
    </tr>
  `
    )
    .join("");

  const milestonesHtml = (params.upcomingMilestones || [])
    .map(
      (milestone) => `
    <div style="margin-bottom: 12px; padding: 10px; background: ${FUZE_LIGHT_BG}; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${milestone.title}</div>
      <div style="font-size: 11px; color: #666; margin-top: 3px;">
        Due: ${new Date(milestone.dueDate).toLocaleDateString()}
        ${milestone.status ? `| Status: ${milestone.status}` : ""}
      </div>
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>FUZE ATLAS</h1>
        <p>Brand Health Dashboard</p>
      </div>
      <div class="header-meta">
        <div>Generated</div>
        <div style="font-weight: bold;">${dateStr}</div>
      </div>
    </div>

    <div class="doc-title">${params.brandName}</div>
    <div class="doc-subtitle">Scorecard & Health Metrics</div>

    <div class="section">
      <div class="section-label">KEY METRICS</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
        <div class="metric-box">
          <div class="metric-value">${params.totalFabrics || 0}</div>
          <div class="metric-label">Total Fabrics</div>
        </div>
        <div class="metric-box">
          <div class="metric-value">${params.totalTests || 0}</div>
          <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric-box">
          <div class="metric-value">${(params.passRate || 0).toFixed(1)}%</div>
          <div class="metric-label">Pass Rate</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">PIPELINE & COMPLIANCE</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Pipeline Stage</div>
          <div class="info-value">${params.pipelineStage || "—"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Active SOWs</div>
          <div class="info-value">${params.activeSows || 0}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Compliance Status</div>
          <div class="info-value">
            <span class="badge ${params.complianceStatus === "Green" ? "badge-pass" : params.complianceStatus === "Yellow" ? "badge-pending" : "badge-fail"}">
              ${params.complianceStatus || "Unknown"}
            </span>
          </div>
        </div>
      </div>
    </div>

    ${
      recentTestRows
        ? `
    <div class="section">
      <div class="section-label">RECENT TEST RESULTS</div>
      <table>
        <thead>
          <tr>
            <th>Fabric Code</th>
            <th>Test Type</th>
            <th>Result</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          ${recentTestRows}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    ${
      milestonesHtml
        ? `
    <div class="section">
      <div class="section-label">UPCOMING MILESTONES</div>
      ${milestonesHtml}
    </div>
    `
        : ""
    }

    <div class="footer">
      Generated by FUZE Atlas | ${dateStr}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Compliance Report
 */
export function generateComplianceReport(params: {
  brandName?: string;
  certifications?: Array<{
    name: string;
    status: "Active" | "Expired" | "Pending" | "None";
    details?: string;
  }>;
  testPassRatesByType?: Record<string, number>;
  flaggedTests?: Array<{
    testType: string;
    reason: string;
    date: string;
    resolution?: string;
  }>;
  recommendations?: string[];
  generatedDate?: string;
}): string {
  const now = params.generatedDate
    ? new Date(params.generatedDate)
    : new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const certRows = (params.certifications || [])
    .map(
      (cert) => `
    <tr>
      <td>${cert.name}</td>
      <td>
        <span class="badge ${cert.status === "Active" ? "badge-pass" : cert.status === "Pending" ? "badge-pending" : "badge-fail"}">
          ${cert.status}
        </span>
      </td>
      <td>${cert.details || "—"}</td>
    </tr>
  `
    )
    .join("");

  const passRateRows = Object.entries(params.testPassRatesByType || {})
    .map(
      ([testType, rate]) => `
    <tr>
      <td>${testType}</td>
      <td style="text-align: center;">${(rate as number).toFixed(1)}%</td>
      <td>
        <div style="background: #f0f0f0; height: 20px; border-radius: 3px; overflow: hidden; position: relative;">
          <div style="background: ${FUZE_TEAL}; height: 100%; width: ${Math.min((rate as number), 100)}%; transition: width 0.3s;"></div>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  const flaggedRows = (params.flaggedTests || [])
    .map(
      (flag) => `
    <tr style="background: #ffe6e6;">
      <td>${flag.testType}</td>
      <td>${flag.reason}</td>
      <td>${new Date(flag.date).toLocaleDateString()}</td>
      <td>${flag.resolution || "Pending"}</td>
    </tr>
  `
    )
    .join("");

  const recommendationsHtml = (params.recommendations || [])
    .map((rec) => `<li style="margin-bottom: 8px;">${rec}</li>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>FUZE ATLAS</h1>
        <p>Compliance & Certification Summary</p>
      </div>
      <div class="header-meta">
        <div>Generated</div>
        <div style="font-weight: bold;">${dateStr}</div>
      </div>
    </div>

    <div class="doc-title">Compliance Report</div>
    <div class="doc-subtitle">${params.brandName ? `${params.brandName} Compliance Status` : "General Compliance Summary"}</div>

    <div class="section">
      <div class="section-label">CERTIFICATIONS STATUS</div>
      ${
        certRows
          ? `
      <table>
        <thead>
          <tr>
            <th>Certification</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${certRows}
        </tbody>
      </table>
      `
          : '<div style="color: #999; font-size: 12px;">No certifications recorded</div>'
      }
    </div>

    <div class="section">
      <div class="section-label">TEST PASS RATES BY TYPE</div>
      ${
        passRateRows
          ? `
      <table>
        <thead>
          <tr>
            <th>Test Type</th>
            <th>Pass Rate</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          ${passRateRows}
        </tbody>
      </table>
      `
          : '<div style="color: #999; font-size: 12px;">No test data available</div>'
      }
    </div>

    ${
      flaggedRows
        ? `
    <div class="section">
      <div class="section-label">FLAGGED / FAILED TESTS</div>
      <table>
        <thead>
          <tr>
            <th>Test Type</th>
            <th>Reason</th>
            <th>Date</th>
            <th>Resolution</th>
          </tr>
        </thead>
        <tbody>
          ${flaggedRows}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    ${
      recommendationsHtml
        ? `
    <div class="section">
      <div class="section-label">RECOMMENDATIONS</div>
      <ul style="margin-left: 20px; font-size: 12px;">
        ${recommendationsHtml}
      </ul>
    </div>
    `
        : ""
    }

    <div class="footer">
      Generated by FUZE Atlas | ${dateStr}<br>
      Compliance review prepared for internal use
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate Weekly Digest Report (Andrew's weekly drop)
 */
export function generateWeeklyDigest(params: {
  weekStartDate: string;
  weekEndDate: string;
  testResults?: Array<{
    brandName: string;
    fabricCode: string;
    testType: string;
    passed: boolean;
    labName?: string;
  }>;
  newBrands?: Array<{
    name: string;
    pipelineStage: string;
  }>;
  newFactories?: Array<{
    name: string;
    country?: string;
  }>;
  pipelineMovements?: Array<{
    brandName: string;
    fromStage: string;
    toStage: string;
  }>;
  complianceUpdates?: Array<{
    brandName: string;
    update: string;
  }>;
  upcomingWeek?: Array<{
    activity: string;
    dueDate: string;
  }>;
  generatedDate?: string;
}): string {
  const now = params.generatedDate
    ? new Date(params.generatedDate)
    : new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const weekStart = new Date(params.weekStartDate).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    }
  );
  const weekEnd = new Date(params.weekEndDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const testResultRows = (params.testResults || [])
    .map(
      (test) => `
    <tr>
      <td>${test.brandName}</td>
      <td>${test.fabricCode}</td>
      <td>${test.testType}</td>
      <td><span class="badge ${test.passed ? "badge-pass" : "badge-fail"}">${test.passed ? "PASS" : "FAIL"}</span></td>
      <td>${test.labName || "—"}</td>
    </tr>
  `
    )
    .join("");

  const newBrandsHtml = (params.newBrands || [])
    .map(
      (brand) => `
    <div style="padding: 10px; background: ${FUZE_LIGHT_BG}; margin-bottom: 10px; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${brand.name}</div>
      <div style="font-size: 11px; color: #666;">Stage: ${brand.pipelineStage}</div>
    </div>
  `
    )
    .join("");

  const newFactoriesHtml = (params.newFactories || [])
    .map(
      (factory) => `
    <div style="padding: 10px; background: ${FUZE_LIGHT_BG}; margin-bottom: 10px; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${factory.name}</div>
      <div style="font-size: 11px; color: #666;">${factory.country || "Location TBD"}</div>
    </div>
  `
    )
    .join("");

  const pipelineMovementHtml = (params.pipelineMovements || [])
    .map(
      (movement) => `
    <div style="padding: 10px; background: ${FUZE_LIGHT_BG}; margin-bottom: 10px; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${movement.brandName}</div>
      <div style="font-size: 11px; color: #666;">
        ${movement.fromStage} → <strong>${movement.toStage}</strong>
      </div>
    </div>
  `
    )
    .join("");

  const complianceUpdatesHtml = (params.complianceUpdates || [])
    .map(
      (update) => `
    <div style="padding: 10px; background: ${FUZE_LIGHT_BG}; margin-bottom: 10px; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${update.brandName}</div>
      <div style="font-size: 11px; color: #666;">${update.update}</div>
    </div>
  `
    )
    .join("");

  const upcomingHtml = (params.upcomingWeek || [])
    .map(
      (item) => `
    <div style="padding: 10px; background: ${FUZE_LIGHT_BG}; margin-bottom: 10px; border-radius: 4px;">
      <div style="font-weight: 600; color: ${FUZE_DARK};">${item.activity}</div>
      <div style="font-size: 11px; color: #666;">Due: ${new Date(item.dueDate).toLocaleDateString()}</div>
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <h1>FUZE ATLAS</h1>
        <p>Weekly Digest</p>
      </div>
      <div class="header-meta">
        <div>Week of ${weekStart} - ${weekEnd}</div>
        <div style="font-weight: bold; margin-top: 5px;">${dateStr}</div>
      </div>
    </div>

    <div class="doc-title">Weekly Digest</div>
    <div class="doc-subtitle">Week of ${weekStart} - ${weekEnd}</div>

    ${
      testResultRows
        ? `
    <div class="section">
      <div class="section-label">THIS WEEK'S TEST RESULTS</div>
      <table>
        <thead>
          <tr>
            <th>Brand</th>
            <th>Fabric Code</th>
            <th>Test Type</th>
            <th>Result</th>
            <th>Lab</th>
          </tr>
        </thead>
        <tbody>
          ${testResultRows}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    ${
      newBrandsHtml
        ? `
    <div class="section">
      <div class="section-label">NEW BRANDS / ONBOARDED</div>
      ${newBrandsHtml}
    </div>
    `
        : ""
    }

    ${
      newFactoriesHtml
        ? `
    <div class="section">
      <div class="section-label">NEW FACTORIES ONBOARDED</div>
      ${newFactoriesHtml}
    </div>
    `
        : ""
    }

    ${
      pipelineMovementHtml
        ? `
    <div class="section">
      <div class="section-label">PIPELINE MOVEMENT</div>
      <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Brands advancing through stages this week</p>
      ${pipelineMovementHtml}
    </div>
    `
        : ""
    }

    ${
      complianceUpdatesHtml
        ? `
    <div class="section">
      <div class="section-label">COMPLIANCE UPDATES</div>
      ${complianceUpdatesHtml}
    </div>
    `
        : ""
    }

    ${
      upcomingHtml
        ? `
    <div class="section">
      <div class="section-label">COMING UP NEXT WEEK</div>
      ${upcomingHtml}
    </div>
    `
        : ""
    }

    <div class="footer">
      Generated by FUZE Atlas | ${dateStr}<br>
      This is your automated weekly digest. Detailed data available in the platform.
    </div>
  </div>
</body>
</html>
  `;
}
