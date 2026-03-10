// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import PDFDocument from "pdfkit";

/* ── GET /api/admin/distributor-docs/[id]/pdf ──
 *  Generate a downloadable PDF for a distributor document.
 *  Supports: Certificate of Analysis, Bill of Lading, Commercial Invoice, Generic.
 * ───────────────────────────────────────────────── */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isDistributor = user.role === "DISTRIBUTOR_USER";
    if (!isAdmin && !isDistributor) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const doc = await prisma.distributorDocument.findUnique({
      where: { id },
      include: {
        distributor: {
          select: { name: true, country: true, region: true, contactName: true, contactEmail: true, phone: true, address: true },
        },
        factory: {
          select: { name: true, country: true, city: true, address: true },
        },
      },
    });

    if (!doc) return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    if (isDistributor && doc.distributorId !== user.distributorId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Generate PDF
    const chunks: Buffer[] = [];
    const pdfDoc = new PDFDocument({ size: "letter", margins: { top: 60, bottom: 60, left: 60, right: 60 } });

    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const pdfDone = new Promise<Buffer>((resolve) => {
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    // Render based on doc type
    switch (doc.docType) {
      case "CERTIFICATE_OF_ANALYSIS":
        renderCOA(pdfDoc, doc);
        break;
      case "BILL_OF_LADING":
        renderBOL(pdfDoc, doc);
        break;
      case "COMMERCIAL_INVOICE":
        renderInvoice(pdfDoc, doc);
        break;
      default:
        renderGeneric(pdfDoc, doc);
    }

    pdfDoc.end();
    const pdfBuffer = await pdfDone;

    const typeSlug = doc.docType.toLowerCase().replace(/_/g, "-");
    const filename = `fuze-${typeSlug}-${doc.batchNumber || doc.id.slice(-8)}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("PDF generation error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ─── HELPERS ─── */
const FUZE_TEAL = "#00b4c3";
const SLATE_800 = "#1e293b";
const SLATE_500 = "#64748b";
const SLATE_300 = "#cbd5e1";

function drawHeader(pdf: any, title: string, docNumber: string) {
  // FUZE logo text
  pdf.fontSize(24).font("Helvetica-Bold").fillColor(SLATE_800).text("FUZE", 60, 60);
  pdf.fontSize(7).font("Helvetica").fillColor(SLATE_500).text("Biotech · Antimicrobial Technology", 60, 88);

  // Document title
  pdf.fontSize(14).font("Helvetica-Bold").fillColor(SLATE_800).text(title, 300, 60, { align: "right", width: 232 });
  pdf.fontSize(8).font("Helvetica").fillColor(SLATE_500).text(`Document #: ${docNumber}`, 300, 80, { align: "right", width: 232 });

  // Address line
  pdf.fontSize(7).fillColor(SLATE_500).text(
    "FUZE Biotech Inc. · 1625 W 820 N, Provo, UT 84601, USA · contact@fuzebiotech.com · +1 (801) 710-7222",
    60, 105
  );

  // Horizontal rule
  pdf.moveTo(60, 118).lineTo(552, 118).strokeColor(SLATE_800).lineWidth(1.5).stroke();

  pdf.y = 130;
}

function drawFooter(pdf: any, docNumber: string) {
  const y = 720;
  pdf.moveTo(60, y).lineTo(552, y).strokeColor(SLATE_300).lineWidth(0.5).stroke();
  pdf.fontSize(7).fillColor(SLATE_500)
    .text("FUZE Biotech Inc. — Confidential", 60, y + 6)
    .text(`Document #: ${docNumber}`, 250, y + 6, { align: "center", width: 100 })
    .text(`Generated: ${new Date().toLocaleDateString("en-US")}`, 400, y + 6, { align: "right", width: 152 });
}

function infoRow(pdf: any, label: string, value: string | null | undefined, y: number) {
  if (!value) return y;
  pdf.fontSize(8).font("Helvetica-Bold").fillColor(SLATE_500).text(label.toUpperCase(), 70, y, { width: 130 });
  pdf.fontSize(9).font("Helvetica").fillColor(SLATE_800).text(value, 200, y, { width: 340 });
  return y + 16;
}

function sectionTitle(pdf: any, title: string) {
  const y = pdf.y + 10;
  pdf.fontSize(8).font("Helvetica-Bold").fillColor(SLATE_500).text(title.toUpperCase(), 60, y);
  pdf.y = y + 14;
}

function drawParties(pdf: any, doc: any, leftLabel: string, rightLabel: string) {
  const startY = pdf.y;

  // Left
  pdf.fontSize(8).font("Helvetica-Bold").fillColor(SLATE_500).text(leftLabel.toUpperCase(), 60, startY);
  pdf.fontSize(10).font("Helvetica-Bold").fillColor(SLATE_800).text("FUZE Biotech Inc.", 60, startY + 14);
  pdf.fontSize(9).font("Helvetica").fillColor(SLATE_800)
    .text("1625 W 820 N", 60, startY + 28)
    .text("Provo, UT 84601, USA", 60, startY + 40)
    .text("Tel: +1 (801) 710-7222", 60, startY + 54);

  // Right
  pdf.fontSize(8).font("Helvetica-Bold").fillColor(SLATE_500).text(rightLabel.toUpperCase(), 310, startY);
  pdf.fontSize(10).font("Helvetica-Bold").fillColor(SLATE_800).text(doc.distributor?.name || "—", 310, startY + 14);
  let ry = startY + 28;
  if (doc.distributor?.address) { pdf.fontSize(9).font("Helvetica").text(doc.distributor.address, 310, ry); ry += 12; }
  if (doc.distributor?.country) { pdf.text(doc.distributor.country, 310, ry); ry += 12; }
  if (doc.distributor?.contactName) { pdf.fillColor(SLATE_500).text(`Attn: ${doc.distributor.contactName}`, 310, ry); ry += 12; }
  if (doc.distributor?.phone) { pdf.text(`Tel: ${doc.distributor.phone}`, 310, ry); ry += 12; }

  pdf.y = Math.max(startY + 75, ry + 10);
}

function drawSignatures(pdf: any, labels: string[]) {
  const y = Math.max(pdf.y + 40, 640);
  const colWidth = 492 / labels.length;
  labels.forEach((label, i) => {
    const x = 60 + (i * colWidth);
    pdf.moveTo(x, y + 20).lineTo(x + colWidth - 20, y + 20).strokeColor(SLATE_300).lineWidth(0.5).stroke();
    pdf.fontSize(7).font("Helvetica").fillColor(SLATE_500).text(label, x, y + 24);
  });
}

/* ─── CERTIFICATE OF ANALYSIS ─── */
function renderCOA(pdf: any, doc: any) {
  const docNumber = `COA-${doc.batchNumber || doc.id.slice(-8).toUpperCase()}`;
  drawHeader(pdf, "Certificate of Analysis", docNumber);

  const docDate = new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  // Parties
  drawParties(pdf, doc, "Issued To", "Manufacturing Origin");

  // Certificate Details
  sectionTitle(pdf, "Certificate Details");
  let y = pdf.y;
  y = infoRow(pdf, "Certificate Title", doc.title, y);
  y = infoRow(pdf, "Batch Number", doc.batchNumber, y);
  y = infoRow(pdf, "PO Number", doc.poNumber, y);
  y = infoRow(pdf, "Date of Issue", docDate, y);
  if (expiry) y = infoRow(pdf, "Valid Until", expiry, y);
  y = infoRow(pdf, "HS Code", doc.hsCode, y);
  pdf.y = y + 10;

  // Product Information Table
  sectionTitle(pdf, "Product Information");
  const tableData = [
    ["Product Name", "FUZE High Density Allotrope", "Conforms"],
    ["Active Ingredient", "High Density Allotrope (Ag)", "Conforms"],
    ["Mode of Action", "Sulfur Sequestration / Disulfide Bond Elimination", "Confirmed"],
    ["Appearance", "Clear to slight amber liquid", "Conforms"],
    ["Concentration (Stock)", "30 mg/L nominal", "Conforms"],
  ];

  const ty = pdf.y;
  // Table header
  pdf.rect(60, ty, 492, 18).fill("#f1f5f9");
  pdf.fontSize(7).font("Helvetica-Bold").fillColor(SLATE_500)
    .text("PARAMETER", 70, ty + 5, { width: 160 })
    .text("SPECIFICATION", 230, ty + 5, { width: 200 })
    .text("RESULT", 440, ty + 5, { width: 100 });

  let rowY = ty + 20;
  tableData.forEach(([param, spec, result]) => {
    pdf.fontSize(8).font("Helvetica").fillColor(SLATE_800)
      .text(param, 70, rowY + 4, { width: 160 })
      .text(spec, 230, rowY + 4, { width: 200 });
    pdf.font("Helvetica-Bold").text(result, 440, rowY + 4, { width: 100 });
    rowY += 18;
    pdf.moveTo(60, rowY).lineTo(552, rowY).strokeColor("#e2e8f0").lineWidth(0.3).stroke();
  });
  pdf.y = rowY + 10;

  // Description
  if (doc.description) {
    sectionTitle(pdf, "Notes");
    pdf.fontSize(9).font("Helvetica").fillColor(SLATE_800).text(doc.description, 60, pdf.y, { width: 492 });
    pdf.y += 10;
  }

  // Certification statement
  pdf.y += 5;
  pdf.rect(60, pdf.y, 4, 40).fill(FUZE_TEAL);
  pdf.fontSize(8).font("Helvetica").fillColor(SLATE_800).text(
    "This is to certify that the above referenced product meets all stated specifications and has been manufactured and tested in accordance with FUZE Biotech quality standards. The product referenced in this certificate conforms to applicable regulatory requirements.",
    72, pdf.y + 4, { width: 476 }
  );

  drawSignatures(pdf, ["Authorized Signature", "Date"]);
  drawFooter(pdf, docNumber);
}

/* ─── BILL OF LADING ─── */
function renderBOL(pdf: any, doc: any) {
  const docNumber = `BOL-${doc.shipmentRef || doc.id.slice(-8).toUpperCase()}`;
  drawHeader(pdf, "Bill of Lading", docNumber);

  const docDate = new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  drawParties(pdf, doc, "Shipper / Exporter", "Consignee");

  // Routing details
  sectionTitle(pdf, "Routing & Shipment Details");
  let y = pdf.y;
  y = infoRow(pdf, "Shipment Date", docDate, y);
  y = infoRow(pdf, "Tracking / Ref #", doc.shipmentRef, y);
  y = infoRow(pdf, "PO Number", doc.poNumber, y);
  y = infoRow(pdf, "Port of Origin", doc.portOfOrigin, y);
  y = infoRow(pdf, "Port of Destination", doc.portOfDest, y);
  y = infoRow(pdf, "HS Code", doc.hsCode, y);
  pdf.y = y + 10;

  // Cargo description
  sectionTitle(pdf, "Description of Goods");
  const ty = pdf.y;
  pdf.rect(60, ty, 492, 18).fill("#f1f5f9");
  pdf.fontSize(7).font("Helvetica-Bold").fillColor(SLATE_500)
    .text("ITEM", 70, ty + 5, { width: 30 })
    .text("DESCRIPTION", 110, ty + 5, { width: 250 })
    .text("HS CODE", 370, ty + 5, { width: 80 })
    .text("BATCH", 460, ty + 5, { width: 80 });

  pdf.fontSize(8).font("Helvetica").fillColor(SLATE_800)
    .text("1", 70, ty + 24, { width: 30 });
  pdf.font("Helvetica-Bold").text(doc.title, 110, ty + 24, { width: 250 });
  if (doc.description) {
    pdf.font("Helvetica").fontSize(7).fillColor(SLATE_500).text(doc.description, 110, ty + 36, { width: 250 });
  }
  pdf.fontSize(8).font("Helvetica").fillColor(SLATE_800)
    .text(doc.hsCode || "—", 370, ty + 24, { width: 80 })
    .text(doc.batchNumber || "—", 460, ty + 24, { width: 80 });

  pdf.y = ty + (doc.description ? 55 : 42);

  // Factory
  if (doc.factory) {
    sectionTitle(pdf, "Manufacturing Origin");
    let fy = pdf.y;
    fy = infoRow(pdf, "Factory", doc.factory.name, fy);
    fy = infoRow(pdf, "Location", [doc.factory.city, doc.factory.country].filter(Boolean).join(", "), fy);
    pdf.y = fy + 10;
  }

  // Terms
  pdf.y += 5;
  pdf.fontSize(7).font("Helvetica-Bold").fillColor(SLATE_800).text("Terms & Conditions:", 60, pdf.y);
  pdf.fontSize(7).font("Helvetica").fillColor(SLATE_500).text(
    "RECEIVED in apparent good order and condition, the goods described above, to be transported to the destination indicated. The carrier shall not be liable for loss or damage arising from circumstances beyond the carrier's control.",
    60, pdf.y + 12, { width: 492 }
  );

  drawSignatures(pdf, ["Shipper Signature", "Carrier Signature", "Consignee Signature"]);
  drawFooter(pdf, docNumber);
}

/* ─── COMMERCIAL INVOICE ─── */
function renderInvoice(pdf: any, doc: any) {
  const docNumber = `INV-${doc.poNumber || doc.id.slice(-8).toUpperCase()}`;
  drawHeader(pdf, "Commercial Invoice", docNumber);

  const docDate = new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  drawParties(pdf, doc, "Seller / Exporter", "Buyer / Importer");

  // Invoice Details
  sectionTitle(pdf, "Invoice Details");
  let y = pdf.y;
  y = infoRow(pdf, "Invoice Number", docNumber, y);
  y = infoRow(pdf, "Invoice Date", docDate, y);
  y = infoRow(pdf, "PO Number", doc.poNumber, y);
  y = infoRow(pdf, "Shipment Ref", doc.shipmentRef, y);
  y = infoRow(pdf, "Port of Origin", doc.portOfOrigin, y);
  y = infoRow(pdf, "Port of Destination", doc.portOfDest, y);
  y = infoRow(pdf, "Terms", "Net 30", y);
  y = infoRow(pdf, "Currency", "USD", y);
  pdf.y = y + 10;

  // Line items table
  sectionTitle(pdf, "Invoice Line Items");
  const ty = pdf.y;
  pdf.rect(60, ty, 492, 18).fill("#f1f5f9");
  pdf.fontSize(7).font("Helvetica-Bold").fillColor(SLATE_500)
    .text("#", 70, ty + 5, { width: 20 })
    .text("DESCRIPTION", 95, ty + 5, { width: 200 })
    .text("HS CODE", 300, ty + 5, { width: 60 })
    .text("QTY", 370, ty + 5, { width: 50 })
    .text("UNIT PRICE", 420, ty + 5, { width: 60, align: "right" })
    .text("TOTAL", 485, ty + 5, { width: 60, align: "right" });

  pdf.fontSize(8).font("Helvetica").fillColor(SLATE_800)
    .text("1", 70, ty + 24, { width: 20 });
  pdf.font("Helvetica-Bold").text(doc.title, 95, ty + 24, { width: 200 });
  pdf.font("Helvetica")
    .text(doc.hsCode || "—", 300, ty + 24, { width: 60 })
    .text("[qty]", 370, ty + 24, { width: 50 })
    .text("[price]", 420, ty + 24, { width: 60, align: "right" })
    .font("Helvetica-Bold").text("[total]", 485, ty + 24, { width: 60, align: "right" });

  // Total row
  const totalY = ty + 44;
  pdf.rect(60, totalY, 492, 22).fill("#f8fafc");
  pdf.moveTo(60, totalY).lineTo(552, totalY).strokeColor(SLATE_300).lineWidth(1).stroke();
  pdf.fontSize(9).font("Helvetica-Bold").fillColor(SLATE_800)
    .text("TOTAL (USD)", 70, totalY + 5, { width: 410, align: "right" })
    .text("[total]", 485, totalY + 5, { width: 60, align: "right" });
  pdf.y = totalY + 30;

  // Note
  pdf.fontSize(7).font("Helvetica").fillColor(SLATE_500).text(
    "Note: Quantity, unit price, and total amounts are to be completed prior to finalizing this invoice.",
    60, pdf.y, { width: 492 }
  );
  pdf.y += 20;

  // Declaration
  pdf.rect(60, pdf.y, 4, 35).fill(FUZE_TEAL);
  pdf.fontSize(7).font("Helvetica-Bold").fillColor(SLATE_800).text("Declaration:", 72, pdf.y + 2);
  pdf.font("Helvetica").fillColor(SLATE_500).text(
    "I/We hereby certify that the information contained in this invoice is true and correct, and that the contents and value of this shipment are as stated above. The goods originate from the United States of America.",
    72, pdf.y + 12, { width: 476 }
  );

  drawSignatures(pdf, ["Authorized Signature", "Date"]);
  drawFooter(pdf, docNumber);
}

/* ─── GENERIC DOCUMENT ─── */
function renderGeneric(pdf: any, doc: any) {
  const typeLabels: Record<string, string> = {
    PACKING_LIST: "Packing List",
    CUSTOMS_DECLARATION: "Customs Declaration",
    IMPORT_PERMIT: "Import Permit",
    EXPORT_PERMIT: "Export Permit",
    PHYTOSANITARY_CERT: "Phytosanitary Certificate",
    INSURANCE_CERT: "Insurance Certificate",
    SDS_MSDS: "Safety Data Sheet",
    OTHER: "Document",
  };
  const title = typeLabels[doc.docType] || "Document";
  const docNumber = `DOC-${doc.id.slice(-8).toUpperCase()}`;
  drawHeader(pdf, title, docNumber);

  const docDate = new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

  drawParties(pdf, doc, "From", "To");

  sectionTitle(pdf, "Document Details");
  let y = pdf.y;
  y = infoRow(pdf, "Title", doc.title, y);
  y = infoRow(pdf, "Date Issued", docDate, y);
  if (expiry) y = infoRow(pdf, "Expiry Date", expiry, y);
  y = infoRow(pdf, "Batch Number", doc.batchNumber, y);
  y = infoRow(pdf, "PO Number", doc.poNumber, y);
  y = infoRow(pdf, "Shipment Ref", doc.shipmentRef, y);
  y = infoRow(pdf, "Port of Origin", doc.portOfOrigin, y);
  y = infoRow(pdf, "Port of Destination", doc.portOfDest, y);
  y = infoRow(pdf, "HS Code", doc.hsCode, y);
  if (doc.factory) y = infoRow(pdf, "Factory", `${doc.factory.name}${doc.factory.country ? `, ${doc.factory.country}` : ""}`, y);
  pdf.y = y + 10;

  if (doc.description) {
    sectionTitle(pdf, "Description / Notes");
    pdf.fontSize(9).font("Helvetica").fillColor(SLATE_800).text(doc.description, 60, pdf.y, { width: 492 });
  }

  drawSignatures(pdf, ["Authorized Signature"]);
  drawFooter(pdf, docNumber);
}
