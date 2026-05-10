// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/docs/public  (Phase 6C — public no-auth read)
 *
 * Returns ProductDocuments tagged with audience containing "PUBLIC".
 * Optional ?productLine= filter for the per-product-line page.
 *
 * Middleware exempts /api/docs/public so anonymous browsers can hit it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = {
  id: true,
  title: true,
  description: true,
  fileUrl: true,
  version: true,
  effectiveDate: true,
  category: true,
  productLine: true,
  updatedAt: true,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productLine = url.searchParams.get("productLine");

  const where: any = { audience: { has: "PUBLIC" } };
  if (productLine) where.productLine = productLine;

  const docs = await prisma.productDocument.findMany({
    where,
    select: SELECT,
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  return NextResponse.json({ ok: true, docs });
}
