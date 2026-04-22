// @ts-nocheck
/**
 * POST /api/email-templates/[id]/use
 *
 * Bumps useCount + lastUsedAt when a template is actually injected into a
 * compose draft. Separated from PATCH so the client can fire-and-forget
 * (no read/write lock dance, just an atomic increment).
 *
 * Auth: same READ rules as GET — caller must have visibility on the template.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const tpl = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!tpl) return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });

    const canRead =
      tpl.ownerId === me.id ||
      tpl.scope === "SHARED" ||
      tpl.scope === "GLOBAL" ||
      hasMinRole(me.role, "ADMIN");
    if (!canRead) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Atomic increment so concurrent uses don't clobber each other.
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      select: { id: true, useCount: true, lastUsedAt: true },
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
