// @ts-nocheck
/**
 * POST /api/admin/red-rover/[id]/next-action — AI Next-Best-Action + draft
 * outreach for one target. One Haiku call per request (no auto-loops).
 * getRealUser admin gate; Next.js 15 params awaited.
 */
import { NextResponse } from "next/server";
import { getRealUser } from "@/lib/auth";
import { generateNextAction } from "@/lib/red-rover-next-action";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const exists = await prisma.redRoverTarget.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ ok: false, error: "Target not found" }, { status: 404 });

  try {
    const out = await generateNextAction(prisma, id);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e), code: e?.code || null },
      { status: 500 },
    );
  }
}
