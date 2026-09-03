// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getRealUser } from "@/lib/auth";

/**
 * Product Documents — product-wide static docs (TDS, SDS, etc.)
 *
 * GET    /api/admin/product-documents — list ALL docs (auth only, any role)
 * POST   /api/admin/product-documents — create/replace (ADMIN/EMPLOYEE)
 * DELETE /api/admin/product-documents?id= — delete one (ADMIN/EMPLOYEE)
 * PATCH  /api/admin/product-documents — bulk re-tag (ADMIN/EMPLOYEE)
 *
 * MANY docs per docType now, keyed by (docType, productLine, language).
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

// Normalize a free-form product-line / language value to a stable token.
function norm(v: any, fallback: string): string {
  const s = String(v ?? "").trim();
  if (!s) return fallback;
  return s.toUpperCase().replace(/[\s-]+/g, "_");
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const docs = await prisma.productDocument.findMany({
      orderBy: [{ docType: "asc" }, { productLine: "asc" }, { language: "asc" }],
    });
    return NextResponse.json({ ok: true, documents: docs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRealUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { docType, title, description, fileUrl, version, effectiveDate, category, audience } = body;

    if (!DOC_TYPES.includes(docType)) {
      return NextResponse.json({ ok: false, error: "Invalid docType" }, { status: 400 });
    }
    if (!fileUrl || !title) {
      return NextResponse.json({ ok: false, error: "title and fileUrl required" }, { status: 400 });
    }
    if (category && !CATEGORIES.includes(category)) {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
    }

    // Many-per-type key fields. productLine is free-ish (F1_SILVER /
    // HELIOS_GOLD / COMBINED / DEFAULT / custom); language is EN/VI/ZH/…
    const productLineBase = norm(body.productLine, "DEFAULT");
    const language = norm(body.language, "EN");

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

    // Fields that update on replace (NOT the composite key).
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

    // If replaceId is provided, update the specific document by id (replace flow).
    const replaceId: string | undefined = body.replaceId || undefined;
    if (replaceId) {
      const existing = await prisma.productDocument.findUnique({ where: { id: replaceId }, select: { id: true } });
      if (!existing) return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
      const doc = await prisma.productDocument.update({ where: { id: replaceId }, data: baseData });
      return NextResponse.json({ ok: true, document: doc });
    }

    // New document — always create.  If (docType, productLine, language) already
    // exists, append a sequence suffix (_2, _3, …) until we find a free slot.
    let doc: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const productLine = attempt === 0 ? productLineBase : `${productLineBase}_${attempt + 1}`;
      try {
        doc = await prisma.productDocument.create({ data: { docType, productLine, language, ...baseData } });
        break;
      } catch (e: any) {
        if (e.code !== "P2002") throw e; // re-throw non-unique-constraint errors
      }
    }
    if (!doc) return NextResponse.json({ ok: false, error: "Could not create document after 10 attempts" }, { status: 500 });
    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/product-documents?id=<id> — remove a single document.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getRealUser();
    if (!user || !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

    const existing = await prisma.productDocument.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    await prisma.productDocument.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: id });
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
    const user = await getRealUser();
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
      // productLine is non-null now — never write null; fall back to DEFAULT.
      data.productLine = norm(body.productLine, "DEFAULT");
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
