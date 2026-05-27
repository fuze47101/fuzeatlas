// @ts-nocheck
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getCurrentUser } from "@/lib/auth";
import { COMPETITORS } from "@/lib/competitors";

/**
 * GET /api/admin/competitor-comparison-pdf?competitorId=<id>
 *
 * Phase 19.5+ Rudolf deep-dive Track 5 — renders a customer-facing
 * comparison PDF for the requested competitor.
 *
 * The source markdown lives in deliverables/Sustainability_Comparison_*.md
 * or deliverables/Carbon_Footprint_Comparison_*.md. The endpoint maps
 * competitorId → filename, reads the markdown from disk, and streams it
 * as a pdfkit-rendered PDF.
 *
 * Citations footer auto-appends a "Phase 19.5 audit" reference per
 * spec — the same citation appendix that surfaces on the sustainability
 * page.
 *
 * ACL: ADMIN / EMPLOYEE / SALES_MANAGER / SALES_REP / BD_REP.
 */

const ADMIN_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
]);

// Map competitorId → markdown filename in deliverables/.
const COMPETITOR_TO_DOC: Record<string, string> = {
  "rudolf-silverplus": "Sustainability_Comparison_FUZE_vs_SILVERPLUS.md",
  "rudolf-ruco-bac-agp": "Sustainability_Comparison_FUZE_vs_RUCO-BAC_AGP.md",
  "rudolf-ruco-bac-agl": "Sustainability_Comparison_FUZE_vs_RUCO-BAC_AGL.md",
  "rudolf-ruco-bac-rox": "Carbon_Footprint_Comparison_FUZE_vs_RUCO-BAC_ROX.md",
  "iftna-protx2": "Sustainability_Comparison_FUZE_vs_Protx2.md",
  "iftna-freshtx": "Carbon_Footprint_Comparison_FUZE_vs_IFTNA.md",
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const competitorId = url.searchParams.get("competitorId") || "";
  if (!competitorId) {
    return NextResponse.json({ ok: false, error: "competitorId required" }, { status: 400 });
  }

  const docFilename = COMPETITOR_TO_DOC[competitorId];
  if (!docFilename) {
    return NextResponse.json(
      {
        ok: false,
        error: `No comparison doc available for ${competitorId}. Available IDs: ${Object.keys(COMPETITOR_TO_DOC).join(", ")}`,
      },
      { status: 404 },
    );
  }

  const competitor = COMPETITORS.find((c) => c.id === competitorId);
  const docPath = path.join(process.cwd(), "deliverables", docFilename);
  let markdown: string;
  try {
    markdown = fs.readFileSync(docPath, "utf8");
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `Source doc not found at deliverables/${docFilename}` },
      { status: 500 },
    );
  }

  // pdfkit is CJS — dynamic import.
  const PDFKit = (await import("pdfkit")).default;
  const doc = new PDFKit({ size: "LETTER", margins: { top: 60, bottom: 60, left: 60, right: 60 } });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Minimal markdown → PDF renderer. Headings (#/##/###), bold (**), bullet (-),
  // tables (skipped — surface as monospace lines), blockquotes (>), horizontal
  // rules (---). Anything else flows as a paragraph.
  const lines = markdown.split("\n");
  let inCodeBlock = false;
  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      doc.moveDown(0.3);
      continue;
    }

    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      doc.fontSize(18).fillColor("#0f172a").font("Helvetica-Bold").text(line.slice(2));
      doc.moveDown(0.3);
      continue;
    }
    if (line.startsWith("## ")) {
      doc.moveDown(0.4);
      doc.fontSize(14).fillColor("#1e293b").font("Helvetica-Bold").text(line.slice(3));
      doc.moveDown(0.2);
      continue;
    }
    if (line.startsWith("### ")) {
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor("#334155").font("Helvetica-Bold").text(line.slice(4));
      doc.moveDown(0.15);
      continue;
    }
    if (line === "---") {
      doc.moveDown(0.3);
      const y = doc.y;
      doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
      doc.moveDown(0.4);
      continue;
    }
    if (line.startsWith("> ")) {
      doc.fontSize(10).fillColor("#475569").font("Helvetica-Oblique").text(line.slice(2), { indent: 16 });
      doc.moveDown(0.2);
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      doc.fontSize(10).fillColor("#0f172a").font("Helvetica").text("• " + line.slice(2), { indent: 12 });
      continue;
    }
    if (line.startsWith("|")) {
      // crude table rendering — monospace single line
      doc.fontSize(8).fillColor("#334155").font("Courier").text(line);
      continue;
    }
    if (line === "") {
      doc.moveDown(0.3);
      continue;
    }
    // Inline bold (**...**) — collapse to text since pdfkit doesn't do inline runs well
    const stripped = line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
    doc.fontSize(10).fillColor("#0f172a").font("Helvetica").text(stripped, { align: "left" });
  }

  // Footer / citation appendix
  doc.addPage();
  doc.fontSize(14).fillColor("#0f172a").font("Helvetica-Bold").text("A.6 — Phase 19.5 Audit Citations");
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor("#475569").font("Helvetica").text(
    "This comparison was generated from the FUZE Atlas competitor catalog (src/lib/competitors.ts) " +
      "and chemistry archetype library (src/lib/sustainability.ts). Every numeric value referenced " +
      "in this document carries a sourced() citation visible on the live /sustainability page. " +
      "Full audit transcript: deliverables/Competitor_SDS_Audit_2026-05.md.",
  );
  doc.moveDown(0.5);
  if (competitor) {
    doc.fontSize(10).fillColor("#1e293b").font("Helvetica-Bold").text(`Competitor: ${competitor.product}`);
    doc.fontSize(9).fillColor("#475569").font("Helvetica").text(`Company: ${competitor.company}`);
    doc.fontSize(9).fillColor("#475569").font("Helvetica").text(`Chemistry: ${competitor.chemistryLabel}`);
    doc.fontSize(9).fillColor("#475569").font("Helvetica").text(`EPA: ${competitor.epaRegNote}`, { align: "left" });
  }

  doc.end();
  const buf = await done;

  const safeProduct = (competitor?.product || competitorId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `FUZE_vs_${safeProduct}_Comparison.pdf`;
  return new Response(buf as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const maxDuration = 60;
