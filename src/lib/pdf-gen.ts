/**
 * PDF Generation Library for FUZE Atlas
 * Generates purchase orders, SOWs, and compliance certificates
 * Returns HTML that can be printed/exported to PDF by the browser
 */

const FUZE_TEAL = "#00b4c3";
const FUZE_DARK = "#1A1A2E";

/**
 * Generate PO PDF as HTML
 * Returns Buffer with HTML content that browsers can print to PDF
 */
export async function generatePoPdf(testRequest: any): Promise<Buffer> {
  const po = testRequest;
  const html = generatePoHtml(po);
  return Buffer.from(html, "utf-8");
}

/**
 * Generate SOW PDF as HTML
 * Returns Buffer with HTML content that browsers can print to PDF
 */
export async function generateSowPdf(sow: any): Promise<Buffer> {
  const html = generateSowHtml(sow);
  return Buffer.from(html, "utf-8");
}

/**
 * Generate Compliance Certificate PDF as HTML
 * Returns Buffer with HTML content that browsers can print to PDF
 */
export async function generateComplianceCert(testRun: any): Promise<Buffer> {
  const html = generateCertificateHtml(testRun);
  return Buffer.from(html, "utf-8");
}

function generatePoHtml(po: any): string {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0.00";
    return `$${amount.toFixed(2)}`;
  };

  const labAddress = `${po.lab?.address || ""}, ${po.lab?.city || ""} ${po.lab?.state || ""} ${po.lab?.country || ""}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
    .container { width: 100%; max-width: 8.5in; margin: 0 auto; padding: 40px; }
    .header { border-bottom: 3px solid #00b4c3; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #00b4c3; font-size: 28px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 11px; }
    .doc-title { font-size: 16px; font-weight: bold; color: #1A1A2E; margin: 30px 0 20px 0; }
    .section { margin-bottom: 25px; }
    .section-label { background: #f5f5f5; padding: 8px 12px; font-weight: bold; color: #1A1A2E; border-left: 4px solid #00b4c3; margin-bottom: 12px; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
    .info-item { font-size: 11px; }
    .info-label { color: #666; font-weight: 600; margin-bottom: 3px; }
    .info-value { color: #333; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px; }
    th { background: #00b4c3; color: white; padding: 10px 8px; text-align: left; font-weight: 600; }
    td { padding: 10px 8px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row { background: #f0f0f0; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center; }
    .amount { text-align: right; }
    @media print { body { margin: 0; padding: 0; } .container { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FUZE ATLAS</h1>
      <p>Antimicrobial Textile Management Platform</p>
    </div>

    <div class="doc-title">PURCHASE ORDER</div>

    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">PO Number</div>
        <div class="info-value" style="font-weight: bold; font-size: 13px;">${po.poNumber}</div>
      </div>
      <div class="info-item">
        <div class="info-label">PO Date</div>
        <div class="info-value">${formatDate(po.poDate)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Requested By</div>
        <div class="info-value">${po.requestedBy?.name || "N/A"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">${po.status}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">SHIP TO (TESTING LAB)</div>
      <div class="info-item">
        <div class="info-label">Laboratory</div>
        <div class="info-value"><strong>${po.lab?.name || "N/A"}</strong></div>
      </div>
      <div class="info-item">
        <div class="info-label">Address</div>
        <div class="info-value">${labAddress.trim()}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Contact</div>
        <div class="info-value">${po.lab?.email || ""} | ${po.lab?.phone || ""}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Customer Number</div>
        <div class="info-value">${po.labCustomerNumber || po.lab?.customerNumber || "N/A"}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">FABRIC INFORMATION</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Brand</div>
          <div class="info-value">${po.brand?.name || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">FUZE Fabric #</div>
          <div class="info-value">${po.fuzeFabricNumber || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Customer Code</div>
          <div class="info-value">${po.customerFabricCode || "N/A"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Factory Code</div>
          <div class="info-value">${po.factoryFabricCode || "N/A"}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-label">TEST LINE ITEMS</div>
      <table>
        <thead>
          <tr>
            <th>Test Type</th>
            <th>Test Method</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th class="amount">Total</th>
          </tr>
        </thead>
        <tbody>
          ${
            po.lines && po.lines.length > 0
              ? po.lines
                  .map(
                    (line: any) => `
            <tr>
              <td>${line.testType || "N/A"}</td>
              <td>${line.testMethod || "N/A"}</td>
              <td>${line.quantity || 1}</td>
              <td class="amount">${formatCurrency(line.unitPrice)}</td>
              <td class="amount">${formatCurrency(line.totalPrice)}</td>
            </tr>
          `
                  )
                  .join("")
              : "<tr><td colspan='5'>No line items</td></tr>"
          }
          <tr class="total-row">
            <td colspan="4" style="text-align: right;">ESTIMATED TOTAL:</td>
            <td class="amount">${formatCurrency(po.estimatedCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${
      po.specialInstructions
        ? `
    <div class="section">
      <div class="section-label">SPECIAL INSTRUCTIONS</div>
      <div class="info-item" style="padding: 10px; background: #f9f9f9; border-left: 3px solid #00b4c3;">
        ${po.specialInstructions}
      </div>
    </div>
    `
        : ""
    }

    <div class="section">
      <div class="section-label">APPROVALS</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Approved By</div>
          <div class="info-value">${po.approvedBy?.name || "Pending"}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Approval Date</div>
          <div class="info-value">${formatDate(po.approvedAt) || "Pending"}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Generated by FUZE Atlas | ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
    </div>
  </div>
</body>
</html>
  `;
}

function generateSowHtml(sow: any): string {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .container { width: 100%; max-width: 8.5in; margin: 0 auto; padding: 40px; }
    .header { border-bottom: 3px solid #00b4c3; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #00b4c3; font-size: 28px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 11px; }
    .doc-title { font-size: 18px; font-weight: bold; color: #1A1A2E; margin: 30px 0 10px 0; }
    .doc-subtitle { font-size: 12px; color: #666; margin-bottom: 20px; }
    .section { margin-bottom: 25px; }
    .section-label { background: #f5f5f5; padding: 10px 12px; font-weight: bold; color: #1A1A2E; border-left: 4px solid #00b4c3; margin-bottom: 12px; font-size: 13px; }
    .section-content { padding: 0 12px; }
    .info-item { margin-bottom: 12px; font-size: 11px; }
    .info-label { color: #666; font-weight: 600; margin-bottom: 3px; }
    .info-value { color: #333; }
    .requirements { background: #f9f9f9; padding: 12px; border-left: 3px solid #00b4c3; margin: 10px 0; font-size: 11px; line-height: 1.5; }
    .milestone { background: #f9f9f9; padding: 10px; margin: 10px 0; border-left: 3px solid #00b4c3; }
    .milestone-title { font-weight: 600; color: #1A1A2E; }
    .milestone-date { font-size: 10px; color: #666; }
    .status-badge { display: inline-block; padding: 4px 8px; background: #00b4c3; color: white; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9px; color: #999; text-align: center; }
    @media print { body { margin: 0; padding: 0; } .container { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>FUZE ATLAS</h1>
      <p>Antimicrobial Textile Management Platform</p>
    </div>

    <div class="doc-title">STATEMENT OF WORK</div>
    <div class="doc-subtitle">${sow.title || "SOW"} <span class="status-badge">${sow.status}</span></div>

    <div class="section">
      <div class="section-label">BASIC INFORMATION</div>
      <div class="section-content">
        <div class="info-item">
          <div class="info-label">Brand</div>
          <div class="info-value"><strong>${sow.brand?.name || "N/A"}</strong></div>
        </div>
        <div class="info-item">
          <div class="info-label">Created</div>
          <div class="info-value">${formatDate(sow.createdAt)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Last Updated</div>
          <div class="info-value">${formatDate(sow.updatedAt)}</div>
        </div>
      </div>
    </div>

    ${
      sow.expectations
        ? `
    <div class="section">
      <div class="section-label">EXPECTATIONS</div>
      <div class="section-content">
        <div class="requirements">${sow.expectations}</div>
      </div>
    </div>
    `
        : ""
    }

    ${
      sow.performanceCriteria
        ? `
    <div class="section">
      <div class="section-label">PERFORMANCE CRITERIA</div>
      <div class="section-content">
        <div class="requirements">${sow.performanceCriteria}</div>
      </div>
    </div>
    `
        : ""
    }

    ${
      sow.pricingTerms
        ? `
    <div class="section">
      <div class="section-label">PRICING TERMS</div>
      <div class="section-content">
        <div class="requirements">${sow.pricingTerms}</div>
      </div>
    </div>
    `
        : ""
    }

    ${
      sow.milestones && sow.milestones.length > 0
        ? `
    <div class="section">
      <div class="section-label">MILESTONES</div>
      <div class="section-content">
        ${sow.milestones
          .map(
            (m: any) => `
          <div class="milestone">
            <div class="milestone-title">${m.title}</div>
            ${m.description ? `<div style="font-size: 11px; color: #666; margin: 3px 0;">${m.description}</div>` : ""}
            ${m.dueDate ? `<div class="milestone-date">Due: ${formatDate(m.dueDate)}</div>` : ""}
            ${m.completedAt ? `<div class="milestone-date" style="color: #00b4c3;">Completed: ${formatDate(m.completedAt)}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <div class="footer">
      Generated by FUZE Atlas | ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
    </div>
  </div>
</body>
</html>
  `;
}

function generateCertificateHtml(testRun: any): string {
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const certNumber = `FUZE-CERT-${testRun.id.substring(0, 8).toUpperCase()}`;

  // Map enum test types to display labels
  const testTypeLabels: Record<string, string> = {
    ICP: "ICP-MS",
    ANTIBACTERIAL: "Antibacterial",
    FUNGAL: "Antifungal",
    ODOR: "Odor",
  };
  const displayTestType = testTypeLabels[testRun.testType] || testRun.testType;

  let resultSummary = "N/A";
  if (testRun.testType === "ICP" && testRun.icpResult) {
    resultSummary = `Ag: ${testRun.icpResult.agValue || "N/A"} ppm, Au: ${testRun.icpResult.auValue || "N/A"} ppm`;
  } else if (testRun.testType === "ANTIBACTERIAL" && testRun.abResult) {
    resultSummary = `Reduction: ${testRun.abResult.percentReduction || "N/A"}%`;
  } else if (testRun.testType === "FUNGAL" && testRun.fungalResult) {
    resultSummary = testRun.fungalResult.writtenResult || "Passed";
  } else if (testRun.testType === "ODOR" && testRun.odorResult) {
    resultSummary = testRun.odorResult.result || "Passed";
  }

  const labName = testRun.lab?.name || "Testing Laboratory";
  const labAddress = testRun.lab
    ? `${testRun.lab.address || ""}, ${testRun.lab.city || ""} ${testRun.lab.state || ""} ${testRun.lab.country || ""}`.trim()
    : "";

  const FUZE_LOGO_B64 = "data:image/png;base64,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";

  // Determine FUZE tier for ICP results
  let fuzeTier = "";
  if (testRun.testType === "ICP" && testRun.icpResult) {
    const ag = testRun.icpResult.agValue;
    if (typeof ag === "number") {
      if (ag >= 1.0) fuzeTier = "F1+";
      else if (ag >= 0.75) fuzeTier = "F1";
      else if (ag >= 0.50) fuzeTier = "F2";
      else if (ag >= 0.25) fuzeTier = "F3";
      else if (ag >= 0.10) fuzeTier = "F4";
    }
  }

  const fabricInfo = testRun.submission?.fabric;
  const fabricDesc = fabricInfo
    ? [fabricInfo.construction, fabricInfo.yarnType, fabricInfo.color, fabricInfo.weightGsm ? `${fabricInfo.weightGsm} GSM` : ""].filter(Boolean).join(" · ")
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: white; }
    .page { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 0; position: relative; }

    /* Decorative border */
    .border-outer { position: absolute; top: 12px; left: 12px; right: 12px; bottom: 12px; border: 2px solid #00b4c3; }
    .border-inner { position: absolute; top: 18px; left: 18px; right: 18px; bottom: 18px; border: 1px solid #c8e6e8; }

    .content { position: relative; z-index: 1; padding: 50px 60px 40px 60px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; padding-bottom: 20px; border-bottom: 2px solid #00b4c3; }
    .logo-area img { height: 45px; }
    .header-right { text-align: right; font-size: 10px; color: #888; line-height: 1.6; }

    /* Title */
    .title-block { text-align: center; margin: 30px 0 25px 0; }
    .cert-title { font-size: 28px; font-weight: 700; color: #1a1a2e; letter-spacing: 3px; text-transform: uppercase; }
    .cert-subtitle { font-size: 13px; color: #00b4c3; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase; font-weight: 600; }
    .cert-number { font-size: 11px; color: #999; margin-top: 12px; font-family: 'Courier New', monospace; letter-spacing: 1px; }

    /* Statement */
    .statement { font-size: 12px; line-height: 1.8; text-align: center; color: #444; margin: 25px 40px; font-style: italic; }

    /* Details table */
    .details-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
    .details-table td { padding: 10px 16px; font-size: 11px; border-bottom: 1px solid #eee; vertical-align: top; }
    .details-table .label { font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; width: 160px; font-size: 10px; }
    .details-table .value { color: #333; }
    .details-table .section-header td { background: #f8fafa; font-weight: 700; color: #00b4c3; text-transform: uppercase; letter-spacing: 1px; font-size: 10px; border-bottom: 2px solid #00b4c3; padding: 8px 16px; }

    /* Result highlight */
    .result-box { margin: 25px 0; padding: 20px 30px; background: linear-gradient(135deg, #f0fafb 0%, #e8f8f9 100%); border: 1px solid #b8e6ea; border-radius: 6px; text-align: center; }
    .result-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #00b4c3; margin-bottom: 6px; }
    .result-value { font-size: 22px; font-weight: 700; color: #1a1a2e; }
    .result-tier { font-size: 14px; font-weight: 600; color: #00b4c3; margin-top: 4px; }

    /* Official stamp */
    .stamp-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 25px; border-top: 1px solid #ddd; }
    .stamp { position: relative; width: 140px; height: 140px; }
    .stamp svg { width: 140px; height: 140px; }
    .signature-block { text-align: left; }
    .sig-line { width: 220px; border-top: 1px solid #333; margin-bottom: 6px; }
    .sig-name { font-size: 12px; font-weight: 600; color: #1a1a2e; }
    .sig-title { font-size: 10px; color: #666; }
    .issue-date { margin-top: 12px; font-size: 10px; color: #666; }

    /* Footer */
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; line-height: 1.6; }

    @media print {
      body { margin: 0; padding: 0; }
      .page { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="border-outer"></div>
    <div class="border-inner"></div>
    <div class="content">
      <!-- Header -->
      <div class="header">
        <div class="logo-area">
          <img src="${FUZE_LOGO_B64}" alt="FUZE Biotech" />
        </div>
        <div class="header-right">
          FUZE Biotech<br>
          1895 West 2100 South<br>
          Salt Lake City, Utah 84119 USA
        </div>
      </div>

      <!-- Title -->
      <div class="title-block">
        <div class="cert-title">Certificate of Compliance</div>
        <div class="cert-subtitle">Antimicrobial Performance Verification</div>
        <div class="cert-number">${certNumber}</div>
      </div>

      <!-- Statement -->
      <div class="statement">
        This certifies that the fabric specimen described below has been tested by an independent laboratory
        in accordance with the specified methodology and has demonstrated compliance with
        FUZE antimicrobial performance standards.
      </div>

      <!-- Result highlight -->
      <div class="result-box">
        <div class="result-label">Test Result</div>
        <div class="result-value">${resultSummary}</div>
        ${fuzeTier ? `<div class="result-tier">FUZE Tier: ${fuzeTier}</div>` : ""}
      </div>

      <!-- Details -->
      <table class="details-table">
        <tr class="section-header"><td colspan="2">Test Information</td></tr>
        <tr><td class="label">Test Type</td><td class="value">${displayTestType}</td></tr>
        <tr><td class="label">Test Method</td><td class="value">${testRun.testMethodStd || testRun.testMethodRaw || "N/A"}</td></tr>
        <tr><td class="label">Test Date</td><td class="value">${formatDate(testRun.testDate)}</td></tr>
        <tr><td class="label">Laboratory</td><td class="value">${labName}${labAddress ? ` — ${labAddress}` : ""}</td></tr>

        <tr class="section-header"><td colspan="2">Fabric Details</td></tr>
        <tr><td class="label">Fabric Code</td><td class="value">${testRun.submission?.customerFabricCode || "N/A"}${testRun.submission?.factoryFabricCode ? ` / ${testRun.submission.factoryFabricCode}` : ""}</td></tr>
        ${fabricDesc ? `<tr><td class="label">Description</td><td class="value">${fabricDesc}</td></tr>` : ""}
        <tr><td class="label">Application Method</td><td class="value">${testRun.submission?.applicationMethod || "N/A"}</td></tr>
        <tr><td class="label">Brand</td><td class="value">${testRun.submission?.brand?.name || "N/A"}</td></tr>
      </table>

      <!-- Stamp + Signature -->
      <div class="stamp-area">
        <div class="signature-block">
          <div class="sig-line"></div>
          <div class="sig-name">FUZE Atlas Quality Assurance</div>
          <div class="sig-title">Electronically Verified</div>
          <div class="issue-date">Issued: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
        </div>
        <div class="stamp">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <!-- Outer ring -->
            <circle cx="100" cy="100" r="92" fill="none" stroke="#00b4c3" stroke-width="3" opacity="0.8"/>
            <circle cx="100" cy="100" r="85" fill="none" stroke="#00b4c3" stroke-width="1" opacity="0.5"/>
            <!-- Decorative dots -->
            <circle cx="100" cy="12" r="3" fill="#00b4c3" opacity="0.6"/>
            <circle cx="100" cy="188" r="3" fill="#00b4c3" opacity="0.6"/>
            <circle cx="12" cy="100" r="3" fill="#00b4c3" opacity="0.6"/>
            <circle cx="188" cy="100" r="3" fill="#00b4c3" opacity="0.6"/>
            <!-- Inner circle -->
            <circle cx="100" cy="100" r="65" fill="none" stroke="#00b4c3" stroke-width="1.5" opacity="0.7"/>
            <!-- Star -->
            <polygon points="100,45 108,75 140,75 114,93 122,123 100,105 78,123 86,93 60,75 92,75" fill="none" stroke="#00b4c3" stroke-width="1.5" opacity="0.6"/>
            <!-- Top arc text -->
            <path id="topArc" d="M 30,100 A 70,70 0 0,1 170,100" fill="none"/>
            <text font-size="11" font-weight="700" fill="#00b4c3" letter-spacing="3" opacity="0.85">
              <textPath href="#topArc" startOffset="50%" text-anchor="middle">FUZE BIOTECH</textPath>
            </text>
            <!-- Bottom arc text -->
            <path id="bottomArc" d="M 170,110 A 70,70 0 0,1 30,110" fill="none"/>
            <text font-size="9" font-weight="600" fill="#00b4c3" letter-spacing="2" opacity="0.85">
              <textPath href="#bottomArc" startOffset="50%" text-anchor="middle">CERTIFIED COMPLIANT</textPath>
            </text>
            <!-- Center text -->
            <text x="100" y="103" text-anchor="middle" font-size="12" font-weight="700" fill="#00b4c3" opacity="0.9">VERIFIED</text>
          </svg>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        This certificate was electronically generated and verified by FUZE Atlas on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.<br>
        Document ID: ${certNumber} &nbsp;|&nbsp; FUZE Biotech &nbsp;|&nbsp; fuzeatlas.com
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
