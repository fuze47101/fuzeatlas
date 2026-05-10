// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Product Documents — product-wide static docs (TDS, SDS, etc.)
 *
 * GET  /api/admin/product-documents — list (auth only, any role)
 * POST /api/admin/product-documents — create/update (admin only)
 *
 * docType is unique — uploading a new TDS replaces the old one.
 */

const DOC_TYPES = ["TDS", "SDS", "PRODUCT_SPEC", "HANDLING_GUIDE", "APPLICATION_GUIDE"];

const CATEGORIES = [
  "tds_sds",
  "toxicology",
  "pricing",
  "sustainability",
  "education",
  "claims_compliance",
  "application_guide",
  "case_study",
];

const AUDIENCE_TAGS = ["BRAND", "FACTORY", "DISTRIBUTOR", "LAB", "PUBLIC"];

const PRODUCT_LINES = ["F1", "F2", "F3", "F4"];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const docs = await prisma.productDocument.findMany({
      orderBy: { docType: "asc" },
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const {
      docType,
      title,
      description,
      fileUrl,
      version,
      effectiveDate,
      category,
      audience,
      productLine,
    } = body;

    if (!DOC_TYPES.includes(docType)) {
      return NextResponse.json({ ok: false, error: "Invalid docType" }, { status: 400 });
    }
    if (!fileUrl || !title) {
      return NextResponse.json({ ok: false, error: "title and fileUrl required" }, { status: 400 });
    }

    // Phase 6A/6D fields — optional but validated when present.
    if (category && !CATEGORIES.includes(category)) {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
    }
    if (productLine && !PRODUCT_LINES.includes(productLine)) {
      return NextResponse.json({ ok: false, error: "Invalid productLine" }, { status: 400 });
    }
    let audienceArray: string[] | undefined = undefined;
    if (audience !== undefined) {
      if (!Array.isArray(audience)) {
        return NextResponse.json({ ok: false, error: "audience must be an array" }, { status: 400 });
      }
      const bad = audience.find((a: any) => !AUDIENCE_TAGS.includes(a));
      if (bad) {
        return NextResponse.json({ ok: false, error: `Invalid audience tag: ${bad}` }, { status: 400 });
      }
      audienceArray = audience;
    }

    const baseData: any = {
      title,
      description: description || null,
      fileUrl,
      version: version || null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      uploadedById: user.id,
      uploadedByName: user.name || user.email,
    };
    if (category) baseData.category = category;
    if (audienceArray) baseData.audience = audienceArray;
    if (productLine !== undefined) baseData.productLine = productLine || null;

    const doc = await prisma.productDocument.upsert({
      where: { docType },
      create: { docType, ...baseData },
      update: baseData,
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/product-documents — bulk re-tag.
 * Body: { ids: string[], category?, audience?, productLine? }
 */
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }
    const body = await req.json();
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ ok: false, error: "ids[] required" }, { status: 400 });
    }

    const data: any = {};
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) {
        return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
      }
      data.category = body.category;
    }
    if (body.audience !== undefined) {
      if (!Array.isArray(body.audience)) {
        return NextResponse.json({ ok: false, error: "audience must be an array" }, { status: 400 });
      }
      const bad = body.audience.find((a: any) => !AUDIENCE_TAGS.includes(a));
      if (bad) {
        return NextResponse.json({ ok: false, error: `Invalid audience tag: ${bad}` }, { status: 400 });
      }
      data.audience = body.audience;
    }
    if (body.productLine !== undefined) {
      if (body.productLine && !PRODUCT_LINES.includes(body.productLine)) {
        return NextResponse.json({ ok: false, error: "Invalid productLine" }, { status: 400 });
      }
      data.productLine = body.productLine || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
    }

    const result = await prisma.productDocument.updateMany({
      where: { id: { in: body.ids } },
      data,
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
