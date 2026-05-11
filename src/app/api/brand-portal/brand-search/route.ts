// @ts-nocheck
/**
 * GET /api/brand-portal/brand-search?q= — Phase 15 IMP-1.
 *
 * Public-to-authenticated brand typeahead so a new user without a
 * brandId can find their brand. Returns top 10 matches by name.
 * Used by the BrandClaimCard.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, brands: [] });
  }
  const brands = await prisma.brand.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, website: true, country: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return NextResponse.json({ ok: true, brands });
}
