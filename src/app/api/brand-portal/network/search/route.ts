// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/brand-portal/network/search?q=
 *
 * Search Atlas factories by name / country / specialty / city.
 * Brand users picking suppliers see ALL factories (not CRM-scoped) —
 * they're choosing who supplies them, not browsing internal data.
 * Returns top 25.
 */

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.brandId) return forbidden();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, factories: [] });
  }

  const factories = await prisma.factory.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { specialty: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      country: true,
      city: true,
      specialty: true,
    },
    take: 25,
    orderBy: { name: "asc" },
  });

  // Annotate with whether already linked to this brand.
  const linkedRows = await prisma.supplyChainLink.findMany({
    where: {
      toType: "BRAND",
      toId: user.brandId,
      fromType: "FACTORY",
      fromId: { in: factories.map((f: any) => f.id) },
      relation: "SUPPLIES",
      active: true,
    },
    select: { fromId: true },
  });
  const linkedSet = new Set(linkedRows.map((l: any) => l.fromId));
  const annotated = factories.map((f: any) => ({ ...f, alreadyLinked: linkedSet.has(f.id) }));

  return NextResponse.json({ ok: true, factories: annotated });
}
