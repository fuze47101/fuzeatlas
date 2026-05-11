// @ts-nocheck
/**
 * /api/me/onboarding-state — Phase 15 IMP-4.
 *
 * GET   ?surface=brand-portal → returns { completedItems[], dismissed }
 *                              for the caller. Creates the row lazily on
 *                              first GET so PATCH always has a row to
 *                              upsert against.
 * PATCH { surface, completedItems?, dismissed? } → upserts.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_SURFACES = new Set([
  "brand-portal",
  "factory-portal",
  "distributor-portal",
  "lab-portal",
  "admin",
]);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const surface = url.searchParams.get("surface") || "";
  if (!ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json({ ok: false, error: "Bad surface" }, { status: 400 });
  }
  const row = await prisma.userOnboardingState.findUnique({
    where: { userId_surface: { userId: user.id, surface } },
  });
  return NextResponse.json({
    ok: true,
    surface,
    completedItems: row?.completedItems || [],
    dismissed: row?.dismissed ?? false,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.surface || !ALLOWED_SURFACES.has(body.surface)) {
    return NextResponse.json({ ok: false, error: "Bad surface" }, { status: 400 });
  }
  const updates: any = {};
  if (Array.isArray(body.completedItems)) {
    updates.completedItems = body.completedItems.map(String).slice(0, 50);
  }
  if (typeof body.dismissed === "boolean") {
    updates.dismissed = body.dismissed;
    if (body.dismissed) updates.dismissedAt = new Date();
  }
  const row = await prisma.userOnboardingState.upsert({
    where: { userId_surface: { userId: user.id, surface: body.surface } },
    create: {
      userId: user.id,
      surface: body.surface,
      ...updates,
    },
    update: updates,
  });
  return NextResponse.json({
    ok: true,
    completedItems: row.completedItems,
    dismissed: row.dismissed,
  });
}
