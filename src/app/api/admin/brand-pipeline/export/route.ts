// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildBrandPipelineWhere } from "@/lib/brand-pipeline-where";

/**
 * GET /api/admin/brand-pipeline/export
 *
 * CSV export mirroring the filter shape of /api/admin/brand-pipeline.
 * Same query params (view, mode, stage, relevance, search) → same
 * filtered brand set, serialized as RFC 4180 CSV with a UTF-8 BOM
 * so Excel renders unicode brand names cleanly.
 *
 * ACL identical to the read route: ADMIN / EMPLOYEE / SALES_MANAGER /
 * SALES_REP. Distributor / brand / factory users get 403.
 */

const COLUMNS = [
  "Brand",
  "Stage",
  "Sales Rep",
  "Website",
  "LinkedIn",
  "FUZE Relevance",
  "Validation Status",
  "Textile Category",
  "Customer Type",
  "Contacts",
  "Outreach Sent",
  "Last Activity",
  "Predicted Value (USD)",
  "Churn Risk",
  "Date Initial Contact",
  "Presentation Date",
  "HQ Country",
  "Source",
  "Notes",
] as const;

function csvCell(value: any): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Newlines in long-form fields collapse to spaces for spreadsheet sanity.
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
    // Brand directly. Aggregate per-brand in one round-trip rather than
    // N+1 per row.
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

    // Performance guardrail per spec — log when output gets unusually large
    // so we know when it's time to paginate. No pagination yet — Andrew
    // wants the whole file in one shot for now.
    if (brands.length > 5000) {
      const estKb = Math.round((brands.length * 0.6) /* ~600 bytes/row */);
      console.log(`[brand-pipeline-export] streaming ${brands.length} brands, est ${estKb} kb`);
    }

    const lines: string[] = [];
    lines.push(COLUMNS.map(csvCell).join(","));

    for (const b of brands) {
      const rep = b.salesRep?.name || b.salesRep?.email || "";
      const notesSnippet = (b.backgroundInfo || "").replace(/\r\n|\r|\n/g, " ").slice(0, 200);
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

    const today = new Date().toISOString().slice(0, 10);
    const view = url.searchParams.get("view") || "actionable";
    const stage = url.searchParams.get("stage");
    const stageSuffix = stage && stage !== "all" ? `_${stage}` : "";
    const filename = `brand_pipeline_${today}_${view}${stageSuffix}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("Brand pipeline export error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
