// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/test-requests/[id]/wizard-pdf
 *
 * Phase 52 T6 — printable PDF for a wizard-submitted TestRequest.
 *
 * Tina specifically asked: "print the matching form for the lab and
 * hit submit and it goes to the lab." v1 ships generic-layout PDF
 * (option B in the spec) using pdfkit — universal compatibility.
 * Field-overlay onto the lab's original PDF (option A) is a Phase 52.5
 * follow-up once we capture field coordinates during PDF extract.
 *
 * Session-authed. Returns application/pdf with inline Content-Disposition
 * so the browser opens it in a new tab; user can ⌘P from there.
 */

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "BRAND_USER",
  "BRAND_MANAGER",
  "FACTORY_USER",
  "FACTORY_LEAD",
  "FACTORY_MANAGER",
  "DISTRIBUTOR_USER",
  "LAB_USER",
  "LAB_MANAGER",
  "TESTING_MANAGER",
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const tr = await prisma.testRequest.findUnique({
    where: { id },
    select: {
      id: true,
      poNumber: true,
      poDate: true,
      status: true,
      fuzeFabricNumber: true,
      customerFabricCode: true,
      factoryFabricCode: true,
      raw: true,
      brand: { select: { id: true, name: true } },
      lab: { select: { id: true, name: true, country: true, customerNumber: true } },
      fabric: {
        select: {
          fuzeNumber: true,
          customerCode: true,
          factoryCode: true,
          factory: { select: { name: true, country: true } },
        },
      },
      lines: {
        select: {
          testType: true,
          testMethod: true,
          organisms: true,
          washCount: true,
          quantity: true,
        },
      },
    },
  });
  if (!tr) return NextResponse.json({ ok: false, error: "Test request not found" }, { status: 404 });

  // pdfkit is CJS — dynamic import.
  const PDFKit = (await import("pdfkit")).default;
  const doc = new PDFKit({ size: "LETTER", margin: 48 });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fontSize(16).fillColor("#0f172a").text("FUZE Atlas — Test Request", { align: "left" });
  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text(`Generated ${new Date().toLocaleString()}`, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor("#1e293b").text(tr.lab?.name || "Lab", { align: "left" });
  if (tr.lab?.country) doc.fontSize(10).fillColor("#64748b").text(tr.lab.country);
  doc.moveDown();

  // Identity block
  const idRows: [string, string][] = [
    ["PO Number", tr.poNumber || "—"],
    ["PO Date", tr.poDate ? new Date(tr.poDate).toLocaleDateString() : "—"],
    ["Status", tr.status || "—"],
    ["Lab Customer #", tr.lab?.customerNumber || "—"],
    ["Brand", tr.brand?.name || "—"],
    ["Factory", tr.fabric?.factory?.name || "—"],
    ["FUZE Fabric #", tr.fuzeFabricNumber || (tr.fabric?.fuzeNumber ? `FUZE-${tr.fabric.fuzeNumber}` : "—")],
    ["Customer Code", tr.customerFabricCode || tr.fabric?.customerCode || "—"],
    ["Factory Code", tr.factoryFabricCode || tr.fabric?.factoryCode || "—"],
  ];
  doc.fontSize(11).fillColor("#0f172a").text("Identification", { underline: true });
  doc.moveDown(0.3);
  for (const [k, v] of idRows) {
    doc.fontSize(10).fillColor("#475569").text(`${k}:`, { continued: true });
    doc.fillColor("#0f172a").text(` ${v}`);
  }
  doc.moveDown();

  // Test lines
  doc.fontSize(11).fillColor("#0f172a").text("Tests Requested", { underline: true });
  doc.moveDown(0.3);
  for (const l of tr.lines) {
    const head = `${l.testType}${l.testMethod ? ` · ${l.testMethod}` : ""}`;
    doc.fontSize(10).fillColor("#1e293b").text(head);
    const sub: string[] = [];
    if (l.organisms) sub.push(`Organisms: ${l.organisms}`);
    if (l.washCount != null) sub.push(`Wash count: ${l.washCount}`);
    if (l.quantity && l.quantity > 1) sub.push(`Qty: ${l.quantity}`);
    if (sub.length > 0) doc.fontSize(9).fillColor("#64748b").text(sub.join(" · "));
    doc.moveDown(0.2);
  }
  doc.moveDown();

  // Form responses (wizard payload)
  const wizard = (tr.raw as any)?.formResponses;
  if (wizard && typeof wizard === "object") {
    doc.fontSize(11).fillColor("#0f172a").text("Customer-Provided Details", { underline: true });
    doc.moveDown(0.3);
    for (const [k, v] of Object.entries(wizard)) {
      const display = Array.isArray(v) ? v.join(", ") : String(v ?? "—");
      doc.fontSize(10).fillColor("#475569").text(`${k}:`, { continued: true });
      doc.fillColor("#0f172a").text(` ${display}`);
    }
    doc.moveDown();
  }

  // Footer
  doc.fontSize(8).fillColor("#94a3b8").text(
    "Generated by FUZE Atlas — fuzeatlas.com. Print this page and attach to the physical sample shipment.",
    { align: "center" },
  );

  doc.end();
  const buf = await done;

  const filename = `test-request-${tr.poNumber || tr.id.slice(-6)}.pdf`;
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const maxDuration = 60;
