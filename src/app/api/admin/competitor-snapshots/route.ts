// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { COMPETITOR_TARGETS } from "@/lib/competitor-targets";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const filter = url.searchParams.get("competitor");
  const snapshots = await prisma.competitorSnapshot.findMany({
    where: filter ? { competitor: filter } : {},
    orderBy: { fetchedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    ok: true,
    snapshots,
    targets: COMPETITOR_TARGETS,
  });
}
