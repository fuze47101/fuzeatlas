// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_EDIT_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];
const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const playbook = await prisma.bDPlaybook.findUnique({ where: { id } });
  if (!playbook) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const fav = await prisma.userPlaybookFavorite.findUnique({
    where: { userId_playbookId: { userId: user.id, playbookId: id } },
  }).catch(() => null);
  return NextResponse.json({ ok: true, playbook: { ...playbook, isFavorite: !!fav } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: any = {};
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.textileCategory !== undefined) updates.textileCategory = String(body.textileCategory);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.recommendedSequenceId !== undefined)
    updates.recommendedSequenceId = body.recommendedSequenceId || null;
  if (Array.isArray(body.recommendedEmailTemplateIds))
    updates.recommendedEmailTemplateIds = body.recommendedEmailTemplateIds.map(String);
  if (body.notes !== undefined) updates.notes = body.notes || null;

  const playbook = await prisma.bDPlaybook.update({ where: { id }, data: updates });
  return NextResponse.json({ ok: true, playbook });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.bDPlaybook.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
