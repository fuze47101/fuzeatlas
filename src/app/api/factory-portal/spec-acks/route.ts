// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listPendingAcksForFactory } from "@/lib/spec-acks";

/**
 * GET /api/factory-portal/spec-acks
 *
 * NEED-6 — one row per brand supplying this factory whose spec is
 * newer than the factory's most-recent acknowledgement.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!user.factoryId)
    return NextResponse.json({ ok: false, error: "Not a factory user" }, { status: 403 });

  try {
    const pending = await listPendingAcksForFactory(user.factoryId);
    return NextResponse.json({
      ok: true,
      pending: pending.map((p) => ({
        ...p,
        specVersion: p.specVersion.toISOString(),
        lastAcknowledgedAt: p.lastAcknowledgedAt?.toISOString() || null,
        lastAcknowledgedVersion: p.lastAcknowledgedVersion?.toISOString() || null,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to list pending acks" },
      { status: 500 },
    );
  }
}
