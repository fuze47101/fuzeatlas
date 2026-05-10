// @ts-nocheck
/**
 * POST/DELETE /api/admin/bd/playbooks/{id}/favorite — Phase 9H.
 *
 * Toggle the caller's UserPlaybookFavorite row for the given playbook.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.userPlaybookFavorite.upsert({
    where: { userId_playbookId: { userId: user.id, playbookId: id } },
    create: { userId: user.id, playbookId: id },
    update: {},
  });
  return NextResponse.json({ ok: true, favorite: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.userPlaybookFavorite
    .delete({ where: { userId_playbookId: { userId: user.id, playbookId: id } } })
    .catch(() => null);
  return NextResponse.json({ ok: true, favorite: false });
}
