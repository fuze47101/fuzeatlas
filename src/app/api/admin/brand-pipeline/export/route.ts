// @ts-nocheck
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildBrandPipelineWhere } from "@/lib/brand-pipeline-where";

/**
 * GET /api/admin/brand-pipeline/export
 *
 * .xlsx export (default) or CSV legacy fallback. Mirrors the filter
 * shape of /api/admin/brand-pipeline. Same query params (view, mode,
 * stage, relevance, search) → same filtered brand set, serialized
 * with frozen header + autofilter + stage color-coding + currency/
 * percentage/date number formats + workbook metadata recording the
 * filters in use.
 *
 * Where-clause builder is shared with the JSON read route so the two
 * endpoints can't drift.
 */

const COLUMNS = [
  { header: "Brand", key: "name", width: 32 },
  { header: "Stage", key: "stage", width: 22 },
  { header: "Sales Rep", key: "salesRep", width: 22 },
  { header: "Website", key: "website", width: 36 },
  { header: "LinkedIn", key: "linkedIn", width: 36 },
  { header: "FUZE Relevance", key: "relevance", width: 14 },
  { header: "Validation Status", key: "validation", width: 16 },
  { header: "Textile Category", key: "textileCategory", width: 22 },
  { header: "Customer Type", key: "customerType", width: 16 },
  { header: "Contacts", key: "contacts", width: 10 },
  { header: "Outreach Sent", key: "outreach", width: 12 },
  { header: "Last Activity", key: "lastActivity", width: 14 },
  { header: "Predicted Value (USD)", key: "predictedValue", width: 18 },
  { header: "Churn Risk", key: "churnRisk", width: 12 },
  { header: "Date Initial Contact", key: "dateInitialContact", width: 16 },
  { header: "Presentation Date", key: "presentationDate", width: 16 },
  { header: "HQ Country", key: "country", width: 16 },
  { header: "Source", key: "source", width: 18 },
  { header: "Notes", key: "notes", width: 60 },
] as const;

const STAGE_COLORS: Record<string, string> = {
  LEAD: "FFFEF3C7", // amber-100
  PRESENTATION: "FFDDEAFE", // sky-100
  BRAND_TESTING: "FFE0E7FF", // indigo-100
  FACTORY_ONBOARDING: "FFE0F2FE", // sky-100
  FACTORY_TESTING: "FFCFFAFE", // cyan-100
  PRODUCTION: "FFD1FAE5", // emerald-100
  BRAND_EXPANSION: "FFA7F3D0", // emerald-200
  CUSTOMER_WON: "FF34D399", // emerald-400
  ARCHIVE: "FFE5E7EB", // gray-200
};

function csvCell(value: any): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (s.includes("\n") || s.includes("\r")) {
    s = s.replace(/\r\n|\r|\n/g, " ");
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isoDate(d: any): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toDateOrNull(d: any): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function colLetter(n: number): string {
  let s = "";
  let v = n;
  while (v > 0) {
    const r = (v - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    v = Math.floor((v - 1) / 26);
  }
  return s;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const format = (url.searchParams.get("format") || "xlsx").toLowerCase();
    const where = buildBrandPipelineWhere(url.searchParams);

    const brands = await prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        pipelineStage: true,
        website: true,
        linkedInProfile: true,
        fuzeRelevance: true,
        validationStatus: true,
        textileCategory: true,
        customerType: true,
        lastActivityAt: true,
        predictedValueUSD: true,
        churnRiskScore: true,
        dateOfInitialContact: true,
        presentationDate: true,
        raw: true,
        leadReferralSource: true,
        backgroundInfo: true,
        salesRep: { select: { name: true, email: true } },
        _count: { select: { contacts: true } },
      },
      orderBy: [{ name: "asc" }],
    });

    // OutreachMessage attaches to Contact (which carries brandId), not to
    // Brand directly. Aggregate per-brand in one round-trip.
    const brandIds = brands.map((b) => b.id);
    const outreachByBrand: Record<string, number> = {};
    if (brandIds.length > 0) {
      const contactsWithCounts = await prisma.contact.findMany({
        where: { brandId: { in: brandIds } },
        select: { brandId: true, _count: { select: { outreachMessages: true } } },
      });
      for (const c of contactsWithCounts) {
        if (!c.brandId) continue;
        outreachByBrand[c.brandId] =
          (outreachByBrand[c.brandId] || 0) + (c._count?.outreachMessages || 0);
      }
    }

    if (brands.length > 10000) {
      const estKb = Math.round((brands.length * 0.6));
      console.log(`[brand-pipeline-export] streaming ${brands.length} brands, est ${estKb} kb`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const view = url.searchParams.get("view") || "actionable";
    const stage = url.searchParams.get("stage");
    const mode = url.searchParams.get("mode");
    const relevance = url.searchParams.get("relevance");
    const search = url.searchParams.get("search");
    const stageSuffix = stage && stage !== "all" ? `_${stage}` : "";

    // ─── CSV legacy fallback ──────────────────────────────────────────
    if (format === "csv") {
      const headers = COLUMNS.map((c) => c.header);
      const lines: string[] = [headers.map(csvCell).join(",")];
      for (const b of brands) {
        const rep = b.salesRep?.name || b.salesRep?.email || "";
        const notesSnippet = (b.backgroundInfo || "").replace(/\r\n|\r|\n/g, " ").slice(0, 500);
        const country =
          (b.raw && typeof b.raw === "object" && (b.raw as any).country) || "";
        const row = [
          b.name,
          b.pipelineStage,
          rep,
          b.website || "",
          b.linkedInProfile || "",
          b.fuzeRelevance || "",
          b.validationStatus || "",
          b.textileCategory || "",
          b.customerType || "",
          b._count?.contacts ?? 0,
          outreachByBrand[b.id] || 0,
          isoDate(b.lastActivityAt),
          b.predictedValueUSD != null ? String(Math.round(b.predictedValueUSD)) : "",
          b.churnRiskScore != null ? b.churnRiskScore.toFixed(2) : "",
          isoDate(b.dateOfInitialContact),
          isoDate(b.presentationDate),
          country,
          b.leadReferralSource || "",
          notesSnippet,
        ];
        lines.push(row.map(csvCell).join(","));
      }
      const csv = "﻿" + lines.join("\r\n") + "\r\n";
      const filename = `brand_pipeline_${today}_${view}${stageSuffix}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // ─── XLSX (default) ───────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "FUZE Atlas";
    workbook.created = new Date();
    workbook.subject = `Brand Pipeline — ${view} — ${today}`;
    workbook.description = `Generated from /admin/brand-pipeline with filters: view=${view}, mode=${mode || "(any)"}, stage=${stage || "(all)"}, relevance=${relevance || "(all)"}, search=${search || "(none)"}`;
    workbook.company = "FUZE Biotech";

    const sheet = workbook.addWorksheet("Brand Pipeline", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = COLUMNS as any;

    // Header styling: slate-800 fill, white bold text.
    const headerRow = sheet.getRow(1);
    headerRow.values = COLUMNS.map((c) => c.header);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "left" };
    headerRow.height = 22;

    for (const b of brands) {
      const rep = b.salesRep?.name || b.salesRep?.email || "";
      const notesSnippet = (b.backgroundInfo || "").replace(/\r\n|\r|\n/g, " ").slice(0, 500);
      const country =
        (b.raw && typeof b.raw === "object" && (b.raw as any).country) || "";

      const row = sheet.addRow({
        name: b.name,
        stage: b.pipelineStage,
        salesRep: rep,
        website: b.website || null,
        linkedIn: b.linkedInProfile || null,
        relevance: b.fuzeRelevance || "",
        validation: b.validationStatus || "",
        textileCategory: b.textileCategory || "",
        customerType: b.customerType || "",
        contacts: b._count?.contacts ?? 0,
        outreach: outreachByBrand[b.id] || 0,
        lastActivity: toDateOrNull(b.lastActivityAt),
        predictedValue: b.predictedValueUSD != null ? Math.round(b.predictedValueUSD) : null,
        churnRisk: b.churnRiskScore != null ? b.churnRiskScore : null,
        dateInitialContact: toDateOrNull(b.dateOfInitialContact),
        presentationDate: toDateOrNull(b.presentationDate),
        country,
        source: b.leadReferralSource || "",
        notes: notesSnippet,
      });

      if (b.website) {
        const cell = row.getCell("website");
        cell.value = { text: b.website, hyperlink: b.website };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }
      if (b.linkedInProfile) {
        const cell = row.getCell("linkedIn");
        cell.value = { text: b.linkedInProfile, hyperlink: b.linkedInProfile };
        cell.font = { color: { argb: "FF2563EB" }, underline: true };
      }

      const stageCell = row.getCell("stage");
      const argb = STAGE_COLORS[b.pipelineStage as string];
      if (argb) {
        stageCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb },
        };
        if (b.pipelineStage === "CUSTOMER_WON") {
          stageCell.font = { bold: true, color: { argb: "FF064E3B" } };
        }
      }

      row.getCell("predictedValue").numFmt = '"$"#,##0';
      row.getCell("churnRisk").numFmt = "0.0%";
      row.getCell("lastActivity").numFmt = "yyyy-mm-dd";
      row.getCell("dateInitialContact").numFmt = "yyyy-mm-dd";
      row.getCell("presentationDate").numFmt = "yyyy-mm-dd";

      row.getCell("notes").alignment = { wrapText: true, vertical: "top" };
    }

    const lastCol = colLetter(COLUMNS.length);
    sheet.autoFilter = { from: "A1", to: `${lastCol}1` };

    const buf = await workbook.xlsx.writeBuffer();

    const filename = `brand_pipeline_${today}_${view}${stageSuffix}.xlsx`;
    return new Response(buf as any, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("Brand pipeline export error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
