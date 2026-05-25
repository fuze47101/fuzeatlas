// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/factories
 * POST /api/distributor-portal/factories
 *
 * T5 of phase 16 — distributor self-service factory roster.
 *
 * GET returns:
 *   - factories explicitly added to this distributor's roster via
 *     DistributorFactory (the new junction), AND
 *   - factories whose Factory.distributorId points at this distributor
 *     (the legacy "primary distributor" pointer — shown so reps don't
 *     have to re-claim them manually).
 *   Combined + deduped, each row carries `via: "roster" | "primary"`.
 *
 * POST { factoryId, note? } adds a factory to the roster. Idempotent
 * (the @@unique([distributorId, factoryId]) prevents duplicates).
 *
 * Closes cmpdnfb9f0001l104s1w3h9i9 (Tina Distributor).
 */

function distributorIdFor(user: any): string | null {
  if (user?.role === "ADMIN" || user?.role === "EMPLOYEE") return null;
  return user?.distributorId || null;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const adminOverride = user.role === "ADMIN" || user.role === "EMPLOYEE";
  const url = new URL(req.url);
  const targetId = adminOverride
    ? url.searchParams.get("distributorId") || user.distributorId
    : user.distributorId;

  if (!targetId) {
    return NextResponse.json(
      { ok: false, error: "No distributor on session" },
      { status: 400 },
    );
  }

  const [rosterRows, primaryRows] = await Promise.all([
    prisma.distributorFactory.findMany({
      where: { distributorId: targetId },
      include: {
        factory: {
          select: { id: true, name: true, country: true, city: true, distributorId: true },
        },
      },
    }),
    prisma.factory.findMany({
      where: { distributorId: targetId },
      select: { id: true, name: true, country: true, city: true, distributorId: true },
    }),
  ]);

  const byId = new Map<string, any>();
  for (const r of rosterRows) {
    byId.set(r.factory.id, {
      ...r.factory,
      via: "roster",
      rosterId: r.id,
      note: r.note,
      addedAt: r.createdAt,
    });
  }
  for (const f of primaryRows) {
    if (!byId.has(f.id)) byId.set(f.id, { ...f, via: "primary" });
  }

  return NextResponse.json({
    ok: true,
    factories: Array.from(byId.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    ),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const adminOverride = user.role === "ADMIN" || user.role === "EMPLOYEE";
  const body = await req.json().catch(() => ({} as any));
  const distributorId = adminOverride
    ? body?.distributorId || user.distributorId
    : user.distributorId;
  const factoryId: string = String(body?.factoryId || "").trim();
  const note: string | null = body?.note ? String(body.note).trim() : null;

  if (!distributorId) {
    return NextResponse.json(
      { ok: false, error: "No distributor on session" },
      { status: 400 },
    );
  }
  if (!factoryId) {
    return NextResponse.json({ ok: false, error: "factoryId required" }, { status: 400 });
  }

  const factory = await prisma.factory.findUnique({
    where: { id: factoryId },
    select: { id: true, name: true },
  });
  if (!factory) {
    return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
  }

  const row = await prisma.distributorFactory.upsert({
    where: { distributorId_factoryId: { distributorId, factoryId } },
    create: { distributorId, factoryId, note },
    update: { note: note ?? undefined },
    include: {
      factory: { select: { id: true, name: true, country: true, city: true } },
    },
  });

  return NextResponse.json({ ok: true, link: row });
}
