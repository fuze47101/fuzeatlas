// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * POST /api/fabric-submissions/[id]/photo
 * Body: { kind: "received", photoUrl: string }
 *
 * Stamps a "sample as received" photo onto FabricSubmission.raw so
 * we have proof of sample quality on arrival at the lab/factory.
 * Distinct from the intake-form photo on Fabric.raw.intakePhotoUrl
 * (which captures the sample as it left the brand).
 *
 * Scoped to ADMIN | EMPLOYEE | FACTORY_USER+MANAGER | LAB_USER —
 * the receive flow is run by whoever physically picks up the box.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const allowed = new Set([
    "ADMIN",
    "EMPLOYEE",
    "FACTORY_USER",
    "FACTORY_MANAGER",
    "LAB_USER",
    "TESTING_MANAGER",
    "FABRIC_MANAGER",
  ]);
  if (!allowed.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({} as any));
  const photoUrl = String(body?.photoUrl || "").trim();
  if (!photoUrl) {
    return NextResponse.json({ ok: false, error: "photoUrl required" }, { status: 400 });
  }

  const existing = await prisma.fabricSubmission.findUnique({
    where: { id },
    select: { id: true, raw: true, factoryId: true },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
  }

  // Factory users can only stamp their own factory's submissions.
  if (
    (user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER") &&
    existing.factoryId !== user.factoryId
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const rawNext: any = { ...(existing.raw as any) };
  rawNext.receivedPhotoUrl = photoUrl;
  rawNext.receivedPhotoAt = new Date().toISOString();
  rawNext.receivedPhotoBy = user.id;

  const updated = await prisma.fabricSubmission.update({
    where: { id },
    data: { raw: rawNext },
    select: { id: true, raw: true },
  });

  return NextResponse.json({ ok: true, submission: updated });
}
