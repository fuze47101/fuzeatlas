// @ts-nocheck
/**
 * GET /api/public/claims — Phase 12D.
 *
 * Public endpoint returning ProductDocument rows whose audience
 * includes "PUBLIC". Grouped by category for the /claims page.
 * 10-minute edge cache.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const docs = await prisma.productDocument.findMany({
    where: { audience: { has: "PUBLIC" } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    select: {
      id: true,
      docType: true,
      title: true,
      description: true,
      fileUrl: true,
      version: true,
      effectiveDate: true,
      category: true,
      productLine: true,
    },
  });
  return NextResponse.json(
    { ok: true, documents: docs },
    {
      headers: {
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
