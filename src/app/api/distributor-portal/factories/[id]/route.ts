// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * DELETE /api/distributor-portal/factories/[id]
 *
 * Removes a factory from the caller's distributor roster. [id] is the
 * DistributorFactory row id. Admins can target any roster row;
 * distributor roles can only remove rows belonging to their own
 * distributor.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.distributorFactory.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const adminOverride = user.role === "ADMIN" || user.role === "EMPLOYEE";
  if (!adminOverride && row.distributorId !== user.distributorId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await prisma.distributorFactory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
