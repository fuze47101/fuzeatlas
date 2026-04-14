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
    const { docType, title, description, fileUrl, version, effectiveDate } = body;

    if (!DOC_TYPES.includes(docType)) {
      return NextResponse.json({ ok: false, error: "Invalid docType" }, { status: 400 });
    }
    if (!fileUrl || !title) {
      return NextResponse.json({ ok: false, error: "title and fileUrl required" }, { status: 400 });
    }

    const doc = await prisma.productDocument.upsert({
      where: { docType },
      create: {
        docType,
        title,
        description: description || null,
        fileUrl,
        version: version || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        uploadedById: user.id,
        uploadedByName: user.name || user.email,
      },
      update: {
        title,
        description: description || null,
        fileUrl,
        version: version || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        uploadedById: user.id,
        uploadedByName: user.name || user.email,
      },
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
