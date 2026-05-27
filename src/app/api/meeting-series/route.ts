// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const INTERNAL_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

export async function GET(_req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const series = await (prisma as any).meetingSeries.findMany({
    where: { active: true },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ ok: true, series });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body?.name) {
    return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  }
  const created = await (prisma as any).meetingSeries.create({
    data: {
      name: String(body.name),
      description: body?.description || null,
      cadence: body?.cadence || null,
      cadenceDay: body?.cadenceDay ?? null,
      cadenceHour: body?.cadenceHour ?? null,
      templateMd: body?.templateMd || null,
      brandId: body?.brandId || null,
      factoryId: body?.factoryId || null,
      createdById: user.id,
    },
    select: { id: true, name: true, cadence: true },
  });
  return NextResponse.json({ ok: true, series: created });
}
