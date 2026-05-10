// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/library  (Phase 6B — unified read endpoint)
 *
 * Returns ProductDocuments filtered by the caller's audience (derived
 * from session role). Brand users get audience containing "BRAND",
 * factory containing "FACTORY", and so on. Admin/employee see all.
 *
 * Optional filters:
 *   ?category= one of the 6A categories
 *   ?productLine= F1 / F2 / F3 / F4
 */

const SELECT = {
  id: true,
  docType: true,
  title: true,
  description: true,
  fileUrl: true,
  version: true,
  effectiveDate: true,
  expiresAt: true,
  category: true,
  audience: true,
  productLine: true,
  uploadedByName: true,
  createdAt: true,
  updatedAt: true,
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function audienceFor(role: string): string | null {
  if (role === "BRAND_USER" || role === "BRAND_MANAGER") return "BRAND";
  if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") return "FACTORY";
  if (role === "DISTRIBUTOR_USER" || role === "DISTRIBUTOR_MANAGER") return "DISTRIBUTOR";
  if (role === "LAB_USER" || role === "LAB_MANAGER") return "LAB";
  return null; // admin/employee/sales/etc see all
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const productLine = url.searchParams.get("productLine") || undefined;

  const audienceTag = audienceFor(user.role);

  const where: any = {};
  if (audienceTag) where.audience = { has: audienceTag };
  if (category) where.category = category;
  if (productLine) where.productLine = productLine;

  const docs = await prisma.productDocument.findMany({
    where,
    select: SELECT,
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    docs,
    audience: audienceTag,
  });
}
