// @ts-nocheck
/**
 * /api/admin/bd/playbooks — Phase 9H.
 *
 * GET   → list every playbook + which ones the caller has favorited.
 * POST  → create a new playbook (admin / sales-manager only).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const BD_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "BD_REP"];
const ADMIN_EDIT_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!BD_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const playbooks = await prisma.bDPlaybook.findMany({
    where: category ? { textileCategory: category } : {},
    orderBy: [{ textileCategory: "asc" }, { name: "asc" }],
  });

  const myFavs = await prisma.userPlaybookFavorite.findMany({
    where: { userId: user.id },
    select: { playbookId: true },
  });
  const favSet = new Set(myFavs.map((f) => f.playbookId));

  return NextResponse.json({
    ok: true,
    playbooks: playbooks.map((p) => ({
      ...p,
      isFavorite: favSet.has(p.id),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_EDIT_ROLES.includes(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.textileCategory || !body?.description) {
    return NextResponse.json(
      { ok: false, error: "name, textileCategory, and description required" },
      { status: 400 },
    );
  }
  const playbook = await prisma.bDPlaybook.create({
    data: {
      name: String(body.name).trim(),
      textileCategory: String(body.textileCategory).trim(),
      description: String(body.description),
      recommendedSequenceId: body.recommendedSequenceId || null,
      recommendedEmailTemplateIds: Array.isArray(body.recommendedEmailTemplateIds)
        ? body.recommendedEmailTemplateIds.map(String)
        : [],
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ ok: true, playbook });
}
