// @ts-nocheck
/**
 * POST /api/admin/bd/wizard/release
 *
 * Release the soft reservation the current rep is holding on a brand.
 * Called by the wizard when:
 *   - The rep clicks "Next Brand" (want to drop this one and pick fresh)
 *   - The wizard unmounts / page unloads (best-effort navigator.sendBeacon)
 *   - The rep explicitly bounces the brand (dead domain path — see
 *     /api/admin/bd/wizard/bounce-brand, which also releases)
 *
 * We only clear the reservation if *this* rep holds it. Prevents a
 * misbehaving client from stealing brands off other reps' queues by
 * racing a release for an ID they don't actually hold.
 *
 * Body: { brandId: string }
 * Returns: { ok, released: 0 | 1 }   — 0 means "you didn't hold it"
 *
 * Added for BD Wizard concurrency hardening (#101, 2026-04-23).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const brandId: string | undefined = body?.brandId;
    if (!brandId) {
      return NextResponse.json({ ok: false, error: "brandId is required" }, { status: 400 });
    }

    // Only clear if we hold the reservation. updateMany returns
    // { count } so we can tell the client whether the release
    // actually did anything.
    const r = await prisma.brand.updateMany({
      where: { id: brandId, reservedBy: user.id },
      data: { reservedBy: null, reservedUntil: null },
    });

    return NextResponse.json({ ok: true, released: r.count });
  } catch (err: any) {
    console.error("[bd/wizard/release] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to release reservation" },
      { status: 500 },
    );
  }
}
