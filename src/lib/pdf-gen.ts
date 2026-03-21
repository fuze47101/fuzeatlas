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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; color: #333; background: white; }
    .container { width: 100%; max-width: 8.5in; margin: 0 auto; padding: 60px 40px; }
    .seal-area { text-align: center; margin-bottom: 40px; }
    .seal { display: inline-block; width: 120px; height: 120px; border: 3px solid #00b4c3; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .seal-text { font-size: 10px; font-weight: bold; color: #00b4c3; text-align: center; }
    .cert-title { text-align: center; font-size: 32px; font-weight: bold; color: #1A1A2E; margin: 30px 0 10px 0; letter-spacing: 2px; }
    .cert-subtitle { text-align: center; font-size: 14px; color: #666; margin-bottom: 40px; }
    .cert-number { text-align: center; font-size: 12px; color: #999; margin-bottom: 30px; font-family: monospace; }
    .cert-body { margin: 40px 0; line-height: 1.8; }
    .cert-statement { font-size: 13px; text-align: justify; margin: 25px 0; padding: 20px; background: #f9f9f9; border-left: 4px solid #00b4c3; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 40px 0; }
    .detail-block { font-size: 11px; }
    .detail-label { font-weight: bold; color: #1A1A2E; margin-bottom: 5px; font-size: 12px; }
    .detail-value { color: #333; margin-bottom: 8px; }
    .signature-line { border-top: 1px solid #333; width: 200px; margin-top: 40px; }
    .footer { text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
    @media print { body { margin: 0; padding: 0; } .container { padding: 40px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="seal-area">
      <div class="seal">
        <div class="seal-text">FUZE ATLAS<br>CERTIFIED</div>
      </div>
    </div>

    <div class="cert-title">CERTIFICATE OF COMPLIANCE</div>
    <div class="cert-subtitle">Antimicrobial Performance Testing</div>
    <div class="cert-number">Certificate #: ${certNumber}</div>

    <div class="cert-body">
      <div class="cert-statement">
        This certifies that the fabric described below has been tested in accordance with the specified testing methodology and has demonstrated compliance with the antimicrobial performance standards indicated.
      </div>

      <div class="details-grid">
        <div class="detail-block">
          <div class="detail-label">TEST TYPE</div>
          <div class="detail-value">${testRun.testType}</div>

          <div class="detail-label" style="margin-top: 15px;">TEST METHOD</div>
          <div class="detail-value">${testRun.testMethodStd || testRun.testMethodRaw || "N/A"}</div>
        </div>

        <div class="detail-block">
          <div class="detail-label">TEST DATE</div>
          <div class="detail-value">${formatDate(testRun.testDate)}</div>

          <div class="detail-label" style="margin-top: 15px;">LAB</div>
          <div class="detail-value">${labName}</div>
        </div>

        <div class="detail-block">
          <div class="detail-label">FABRIC INFORMATION</div>
          <div class="detail-value">${testRun.submission?.customerFabricCode || "N/A"}</div>

          <div class="detail-label" style="margin-top: 15px;">BRAND</div>
          <div class="detail-value">${testRun.submission?.brand?.name || "N/A"}</div>
        </div>

        <div class="detail-block">
          <div class="detail-label">RESULT SUMMARY</div>
          <div class="detail-value" style="font-weight: bold; color: #00b4c3;">${resultSummary}</div>

          <div class="detail-label" style="margin-top: 15px;">STATUS</div>
          <div class="detail-value" style="font-weight: bold;">PASSED</div>
        </div>
      </div>

      <div style="margin-top: 50px; padding: 20px; background: #f5f5f5; border-left: 3px solid #00b4c3; font-size: 11px; line-height: 1.6;">
        <p>This fabric meets the specified antimicrobial performance standards as verified by independent laboratory testing. The results confirm effective antimicrobial properties suitable for commercial use.</p>
      </div>
    </div>

    <div style="margin-top: 60px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 50px;">
        <div>
          <div class="signature-line"></div>
          <div style="margin-top: 10px; font-size: 11px; color: #666;">Authorized by FUZE Atlas</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #666;">Date: ${new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      Generated by FUZE Atlas on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}<br>
      This document is electronically generated and certified by FUZE Atlas
    </div>
  </div>
</body>
</html>
  `;
}
