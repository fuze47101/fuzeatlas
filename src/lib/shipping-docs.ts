// @ts-nocheck
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

/* ─────────────────────────────────────────────────────────
 * FUZE Shipping Document PDF Generator
 * Generates: Sales Contract, Invoice, Packing List, CofA
 * Matches Kaylee's Texwell #1406 template format
 * ───────────────────────────────────────────────────────── */

const FUZE_TEAL = "#00b4c3";
const FUZE_DARK = "#1a1a2e";
const FUZE_GRAY = "#555555";
const FUZE_LIGHT_GRAY = "#999999";
const FUZE_LINE = "#cccccc";

const FUZE_ADDRESS = {
  name: "Fuze Biotech",
  line1: "1895 W 2100 S",
  line2: "Salt Lake City, UT 84119 USA",
  email: "accountant@evoqnano.com",
  emailCofA: "info@fuzebiotech.com",
};

interface LineItem {
  activity: string;
  qty: number;
  rate?: number;
  unit?: string;
}

interface AddressBlock {
  company: string;
  address1: string;
  address2: string;
  address3?: string;
  address4?: string;
  country: string;
  postalCode?: string;
}

export interface SalesContractData {
  docType: "sales_contract";
  invoiceNumber: string;
  date: string;
  dueDate: string;
  terms: string;
  incoterm: string;
  billTo: AddressBlock;
  shipTo: AddressBlock;
  lineItems: LineItem[];
  notes?: string;
  currency?: string;
}

export interface InvoiceData {
  docType: "invoice";
  invoiceNumber: string;
  date: string;
  dueDate: string;
  terms: string;
  billTo: AddressBlock;
  shipTo: AddressBlock;
  lineItems: LineItem[];
  currency?: string;
}

export interface PackingListData {
  docType: "packing_list";
  invoiceNumber: string;
  date: string;
  billTo: AddressBlock;
  shipTo: AddressBlock;
  lineItems: LineItem[];
  containers: string;
  dimensions: string;
  netWeight: string;
  grossWeight: string;
}

export interface CofAData {
  docType: "cofa";
  product: string;
  productDescription: string;
  lotNumber: string;
  deliveryDate: string;
  concentration: string;
  concentrationRange: string;
  size: string;
  sizeRange: string;
  additives: string;
  appearance: string;
  antibacterial: string;
  fungal: string;
  retestBy: string;
  expiration: string;
  otherNotes: string;
}

export type ShippingDocData = SalesContractData | InvoiceData | PackingListData | CofAData;

// ─── Helpers ───

function formatCurrency(amount: number, currency = "USD"): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getLogoPath(): string | null {
  // Try multiple paths for the logo
  const candidates = [
    path.join(process.cwd(), "public", "fuze-logo-horizontal.png"),
    path.join(process.cwd(), "public", "fuze-logo-stacked.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function drawHeader(doc: any, email?: string) {
  const logoPath = getLogoPath();

  // Company info (left)
  doc.font("Helvetica-Bold").fontSize(11).fillColor(FUZE_DARK);
  doc.text(FUZE_ADDRESS.name, 50, 40);
  doc.font("Helvetica").fontSize(9).fillColor(FUZE_GRAY);
  doc.text(FUZE_ADDRESS.line1, 50, 55);
  doc.text(FUZE_ADDRESS.line2, 50, 67);
  doc.text(email || FUZE_ADDRESS.email, 50, 79);

  // Logo (right)
  if (logoPath) {
    try {
      doc.image(logoPath, 430, 30, { width: 120 });
    } catch {
      // Logo fails — just use text
      doc.font("Helvetica-Bold").fontSize(24).fillColor(FUZE_TEAL);
      doc.text("FUZE", 460, 40);
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(24).fillColor(FUZE_TEAL);
    doc.text("FUZE", 460, 40);
  }

  return 100; // Y position after header
}

function drawTitle(doc: any, title: string, y: number): number {
  doc.font("Helvetica").fontSize(26).fillColor(FUZE_TEAL);
  doc.text(title, 50, y);
  return y + 40;
}

function drawAddressAndMeta(
  doc: any,
  y: number,
  billTo: AddressBlock,
  shipTo: AddressBlock,
  meta: { label: string; value: string }[],
): number {
  const colBillTo = 50;
  const colShipTo = 220;
  const colMeta = 400;

  // Labels
  doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
  doc.text("BILL TO", colBillTo, y);
  doc.text("SHIP TO", colShipTo, y);
  y += 14;

  // Bill To
  doc.font("Helvetica-Bold").fontSize(8).fillColor(FUZE_DARK);
  doc.text(billTo.company, colBillTo, y, { width: 150 });
  const billToCompanyHeight = doc.heightOfString(billTo.company, { width: 150 });
  const billY = y + billToCompanyHeight + 2;
  doc.font("Helvetica").fontSize(8).fillColor(FUZE_GRAY);
  const billAddr = [billTo.address1, billTo.address2, billTo.address3, billTo.address4, `${billTo.postalCode || ""} ${billTo.country}`.trim()].filter(Boolean).join("\n");
  doc.text(billAddr, colBillTo, billY, { width: 150 });
  const billAddrH = doc.heightOfString(billAddr, { width: 150 });

  // Ship To
  doc.font("Helvetica-Bold").fontSize(8).fillColor(FUZE_DARK);
  doc.text(shipTo.company, colShipTo, y, { width: 150 });
  const shipY = y + billToCompanyHeight + 2;
  doc.font("Helvetica").fontSize(8).fillColor(FUZE_GRAY);
  const shipAddr = [shipTo.address1, shipTo.address2, shipTo.address3, shipTo.address4, `${shipTo.postalCode || ""} ${shipTo.country}`.trim()].filter(Boolean).join("\n");
  doc.text(shipAddr, colShipTo, shipY, { width: 150 });

  // Meta (right column)
  let metaY = y - 14;
  for (const item of meta) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(FUZE_TEAL);
    doc.text(item.label, colMeta, metaY, { width: 70, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor(FUZE_DARK);
    doc.text(item.value, colMeta + 75, metaY, { width: 85 });
    const h = Math.max(doc.heightOfString(item.value, { width: 85 }), 10);
    metaY += h + 2;
  }

  return Math.max(billY + billAddrH, metaY) + 20;
}

function drawLineItemsTable(
  doc: any,
  y: number,
  lineItems: LineItem[],
  showRate: boolean = true,
): number {
  // Separator line
  doc.moveTo(50, y).lineTo(560, y).strokeColor(FUZE_TEAL).lineWidth(1).stroke();
  y += 8;

  // Table header
  doc.font("Helvetica-Bold").fontSize(8).fillColor(FUZE_TEAL);
  doc.text("ACTIVITY", 50, y, { width: 200 });
  doc.text("QTY", 280, y, { width: 60, align: "right" });
  if (showRate) {
    doc.text("RATE", 350, y, { width: 60, align: "right" });
    doc.text("AMOUNT", 430, y, { width: 120, align: "right" });
  }
  y += 16;

  // Separator
  doc.moveTo(50, y - 2).lineTo(560, y - 2).strokeColor(FUZE_LINE).lineWidth(0.5).stroke();

  // Items
  for (const item of lineItems) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text(item.activity, 50, y, { width: 220 });
    const actH = doc.heightOfString(item.activity, { width: 220 });

    doc.font("Helvetica").fontSize(9).fillColor(FUZE_DARK);
    const qtyStr = item.unit
      ? `${item.qty.toLocaleString()} ${item.unit}`
      : item.qty.toLocaleString();
    doc.text(qtyStr, 280, y, { width: 60, align: "right" });

    if (showRate && item.rate) {
      doc.text(item.rate.toFixed(2), 350, y, { width: 60, align: "right" });
      const amount = item.qty * item.rate;
      doc.text(amount.toLocaleString("en-US", { minimumFractionDigits: 2 }), 430, y, { width: 120, align: "right" });
    }

    y += Math.max(actH, 14) + 4;
  }

  return y;
}

function drawMadeInUSA(doc: any, y: number): number {
  doc.font("Helvetica-Bold").fontSize(10).fillColor(FUZE_DARK);
  doc.text("MADE IN USA", 50, y);
  return y + 18;
}

function drawBalanceDue(doc: any, y: number, total: number, currency: string = "USD"): number {
  // Dotted line
  doc.moveTo(50, y).lineTo(560, y).strokeColor(FUZE_LINE).lineWidth(0.5).dash(2, { space: 2 }).stroke();
  doc.undash();
  y += 10;

  doc.font("Helvetica").fontSize(9).fillColor(FUZE_GRAY);
  doc.text("Please refer to the bank instructions attached to the\nemail for payment by wire or ACH.", 50, y, { width: 250 });

  doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_GRAY);
  doc.text("BALANCE DUE", 320, y, { width: 100 });

  doc.font("Helvetica-Bold").fontSize(18).fillColor(FUZE_DARK);
  doc.text(formatCurrency(total, currency), 400, y - 2, { width: 160, align: "right" });

  return y + 40;
}

function drawFooter(doc: any) {
  doc.font("Helvetica").fontSize(9).fillColor(FUZE_GRAY);
  doc.text("We appreciate your business.", 50, 720, { align: "center", width: 510 });
}

// ─── Document Generators ───

export function generateSalesContract(data: SalesContractData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margins: { top: 30, bottom: 30, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawHeader(doc);
    y = drawTitle(doc, "Sales Contract", y);

    const total = data.lineItems.reduce((s, i) => s + (i.qty * (i.rate || 0)), 0);
    const currency = data.currency || "USD";

    y = drawAddressAndMeta(doc, y, data.billTo, data.shipTo, [
      { label: "INVOICE #", value: data.invoiceNumber },
      { label: "DATE", value: data.date },
      { label: "DUE DATE", value: data.dueDate },
      { label: "TERMS", value: data.terms },
      { label: "INCOTERM", value: data.incoterm },
    ]);

    y = drawLineItemsTable(doc, y, data.lineItems);
    y = drawMadeInUSA(doc, y);
    y = drawBalanceDue(doc, y, total, currency);

    // Pay invoice button placeholder
    doc.roundedRect(50, y, 80, 24, 3).strokeColor(FUZE_DARK).lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Pay invoice", 55, y + 7, { width: 70, align: "center" });
    y += 35;

    // Notes
    if (data.notes) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
      doc.text("NOTE:", 50, y);
      y += 12;
      doc.font("Helvetica").fontSize(8).fillColor(FUZE_GRAY);
      doc.text(data.notes, 50, y, { width: 500 });
      y += doc.heightOfString(data.notes, { width: 500 }) + 20;
    }

    // Signature area (if space)
    if (y < 620) {
      // FUZE seal area
      doc.font("Helvetica-Bold").fontSize(10).fillColor(FUZE_DARK);
      const sigY = Math.max(y + 20, 600);

      // Distributor signature line
      doc.text(data.billTo.company, 320, sigY, { width: 220, align: "center" });
      doc.moveTo(330, sigY + 30).lineTo(540, sigY + 30).strokeColor(FUZE_DARK).lineWidth(1).stroke();
    }

    drawFooter(doc);
    doc.end();
  });
}

export function generateInvoice(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margins: { top: 30, bottom: 30, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawHeader(doc);
    y = drawTitle(doc, "Invoice", y);

    const total = data.lineItems.reduce((s, i) => s + (i.qty * (i.rate || 0)), 0);
    const currency = data.currency || "USD";

    y = drawAddressAndMeta(doc, y, data.billTo, data.shipTo, [
      { label: "INVOICE #", value: data.invoiceNumber },
      { label: "DATE", value: data.date },
      { label: "DUE DATE", value: data.dueDate },
      { label: "TERMS", value: data.terms },
    ]);

    y = drawLineItemsTable(doc, y, data.lineItems);
    y = drawMadeInUSA(doc, y);
    y = drawBalanceDue(doc, y, total, currency);

    // Pay invoice button
    doc.roundedRect(50, y, 80, 24, 3).strokeColor(FUZE_DARK).lineWidth(1).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Pay invoice", 55, y + 7, { width: 70, align: "center" });

    drawFooter(doc);
    doc.end();
  });
}

export function generatePackingList(data: PackingListData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margins: { top: 30, bottom: 30, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawHeader(doc);
    y = drawTitle(doc, "Packing Slip", y);

    y = drawAddressAndMeta(doc, y, data.billTo, data.shipTo, [
      { label: "INVOICE", value: `#${data.invoiceNumber}` },
      { label: "DATE", value: data.date },
    ]);

    // Dimensions / weight table
    const tableY = y;
    const colW = [170, 170, 170];
    const tableX = 50;

    // Header row
    doc.rect(tableX, tableY, 510, 20).strokeColor(FUZE_DARK).lineWidth(0.5).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(FUZE_DARK);
    doc.text("Dim:", tableX + 5, tableY + 5, { width: colW[0] });
    doc.text("Net Weight:", tableX + colW[0] + 5, tableY + 5, { width: colW[1] });
    doc.text("Gross Weight:", tableX + colW[0] + colW[1] + 5, tableY + 5, { width: colW[2] });

    // Data row
    const dataRowY = tableY + 20;
    doc.rect(tableX, dataRowY, 510, 36).strokeColor(FUZE_DARK).lineWidth(0.5).stroke();
    // Vertical lines
    doc.moveTo(tableX + colW[0], tableY).lineTo(tableX + colW[0], dataRowY + 36).stroke();
    doc.moveTo(tableX + colW[0] + colW[1], tableY).lineTo(tableX + colW[0] + colW[1], dataRowY + 36).stroke();

    doc.font("Helvetica").fontSize(9).fillColor(FUZE_DARK);
    doc.text(data.containers, tableX + 5, dataRowY + 5, { width: colW[0] - 10 });
    doc.text(data.dimensions, tableX + 5, dataRowY + 18, { width: colW[0] - 10 });
    doc.text(data.netWeight, tableX + colW[0] + 5, dataRowY + 12, { width: colW[1] - 10, align: "center" });
    doc.text(data.grossWeight, tableX + colW[0] + colW[1] + 5, dataRowY + 12, { width: colW[2] - 10, align: "center" });

    y = dataRowY + 50;

    // Line items (simplified — just activity + qty)
    y = drawLineItemsTable(doc, y, data.lineItems.map(i => ({ ...i, unit: i.unit || "lt" })), false);
    y += 5;
    drawMadeInUSA(doc, y);

    drawFooter(doc);
    doc.end();
  });
}

export function generateCofA(data: CofAData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "letter", margins: { top: 30, bottom: 30, left: 50, right: 50 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawHeader(doc, FUZE_ADDRESS.emailCofA);
    y += 10;

    // Product info table
    const infoFields = [
      ["Product:", data.product],
      ["Product Description:", data.productDescription],
      ["Lot #:", data.lotNumber],
      ["Delivery Date:", data.deliveryDate],
    ];

    for (const [label, value] of infoFields) {
      doc.rect(50, y, 200, 18).strokeColor(FUZE_DARK).lineWidth(0.5).stroke();
      doc.rect(250, y, 260, 18).strokeColor(FUZE_DARK).lineWidth(0.5).stroke();

      doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
      doc.text(label, 55, y + 4, { width: 190 });
      doc.font("Helvetica").fontSize(9).fillColor(FUZE_DARK);
      const isBold = label === "Delivery Date:";
      if (isBold) doc.font("Helvetica-Bold");
      doc.text(value, 255, y + 4, { width: 250 });
      y += 18;
    }

    y += 20;

    // QC Results table
    const colLabel = 50;
    const colItem = 130;
    const colRange = 300;
    const colResult = 430;
    const rowH = 20;

    // Header
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("", colLabel, y);
    doc.text("Item", colItem, y);
    doc.text("Acceptable Range", colRange, y);
    doc.text("Result", colResult, y);
    y += 4;
    doc.moveTo(colLabel, y + 12).lineTo(540, y + 12).strokeColor(FUZE_DARK).lineWidth(0.5).stroke();
    y += 16;

    // Physical Attributes section
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Physical", colLabel, y);
    doc.text("Attributes", colLabel, y + 12);
    doc.font("Helvetica").fontSize(9);

    // Concentration
    doc.text("Concentration", colItem, y);
    doc.text(data.concentrationRange, colRange, y);
    doc.text(data.concentration, colResult, y);
    y += rowH;

    // Size
    doc.text("Size", colItem, y);
    doc.text(data.sizeRange, colRange, y);
    doc.text(data.size, colResult, y);
    y += rowH;

    // Additives
    doc.text("Additives/Preservatives", colItem, y);
    doc.text("N/A", colRange, y);
    doc.text(data.additives || "N/A", colResult, y);
    y += rowH + 5;
    doc.moveTo(colLabel, y).lineTo(540, y).strokeColor(FUZE_LINE).lineWidth(0.3).stroke();
    y += 8;

    // Appearance
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Appearance", colLabel, y);
    doc.font("Helvetica").fontSize(9);
    doc.text("Color, transparency", colItem, y);
    doc.text("Deep orange-yellow", colRange, y);
    doc.text(data.appearance || "Deep orange-yellow", colResult, y);
    y += rowH + 5;
    doc.moveTo(colLabel, y).lineTo(540, y).strokeColor(FUZE_LINE).lineWidth(0.3).stroke();
    y += 8;

    // Micros
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Micros", colLabel, y);
    doc.font("Helvetica").fontSize(9);

    doc.text("Antibac.", colItem, y);
    doc.text("Pass", colRange, y);
    doc.text(data.antibacterial || "Pass", colResult, y);
    y += rowH;

    doc.text("Fungal", colItem, y);
    doc.text("N/A", colRange, y);
    doc.text(data.fungal || "N/A", colResult, y);
    y += rowH + 5;
    doc.moveTo(colLabel, y).lineTo(540, y).strokeColor(FUZE_LINE).lineWidth(0.3).stroke();
    y += 8;

    // Retest / Expiration
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Retest or", colLabel, y);
    doc.text("Expiration Date", colLabel, y + 12);
    doc.font("Helvetica").fontSize(9);

    doc.text("Retest by", colItem, y);
    doc.text(data.retestBy || "N/A", colRange, y);
    doc.text("N/A", colResult, y);
    y += rowH;

    doc.text("Expiration", colItem, y);
    doc.text("10 years", colRange, y);
    doc.text(data.expiration, colResult, y);
    y += rowH + 5;
    doc.moveTo(colLabel, y).lineTo(540, y).strokeColor(FUZE_LINE).lineWidth(0.3).stroke();
    y += 8;

    // Other
    doc.font("Helvetica-Bold").fontSize(9).fillColor(FUZE_DARK);
    doc.text("Other", colLabel, y);
    doc.font("Helvetica").fontSize(9);
    doc.text(data.otherNotes || "Recommended to shake mixture prior to use.", colItem, y, { width: 350 });

    doc.end();
  });
}
