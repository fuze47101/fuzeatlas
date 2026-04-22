// @ts-nocheck
/**
 * /api/email-templates/[id] — read, update, archive single template.
 *
 * Edit/delete authorization:
 *   - PRIVATE: only the owner.
 *   - SHARED:  owner OR any ADMIN.
 *   - GLOBAL:  ADMIN only.
 *
 * "Delete" is a soft-archive (sets archivedAt). Hard delete reserved for
 * admin-only — exposed via DELETE with ?hard=true query param.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

async function loadAndAuthorize(id: string, me: any, requireWrite: boolean) {
  const tpl = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!tpl) return { error: "Template not found", status: 404 } as const;

  // Read access: own + SHARED + GLOBAL.
  if (!requireWrite) {
    const canRead = tpl.ownerId === me.id || tpl.scope === "SHARED" || tpl.scope === "GLOBAL";
    if (!canRead) return { error: "Forbidden", status: 403 } as const;
    return { tpl } as const;
  }

  // Write access:
  const isAdmin = hasMinRole(me.role, "ADMIN");
  if (tpl.scope === "GLOBAL" && !isAdmin) {
    return { error: "Only admins can edit GLOBAL templates", status: 403 } as const;
  }
  if (tpl.scope === "SHARED" && tpl.ownerId !== me.id && !isAdmin) {
    return {
      error: "Only the owner or an admin can edit this SHARED template",
      status: 403,
    } as const;
  }
  if (tpl.scope === "PRIVATE" && tpl.ownerId !== me.id) {
    return { error: "This template belongs to someone else", status: 403 } as const;
  }
  return { tpl } as const;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await loadAndAuthorize(id, me, false);
    if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, template: r.tpl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await loadAndAuthorize(id, me, true);
    if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });

    const body = await req.json();
    const update: any = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.subject === "string") update.subject = body.subject.trim();
    if (typeof body.body === "string") update.body = body.body;
    if (typeof body.bodyHtml === "string") update.body = body.bodyHtml;
    if ("category" in body) update.category = body.category?.trim() || null;
    if (body.scope) {
      const s = body.scope.toUpperCase();
      if (!["PRIVATE", "SHARED", "GLOBAL"].includes(s)) {
        return NextResponse.json(
          { ok: false, error: "scope must be PRIVATE, SHARED, or GLOBAL" },
          { status: 400 },
        );
      }
      // Promotion to GLOBAL is admin-only — keeps the org-wide picker clean.
      if (s === "GLOBAL" && !hasMinRole(me.role, "ADMIN")) {
        return NextResponse.json(
          { ok: false, error: "Only admins can promote a template to GLOBAL" },
          { status: 403 },
        );
      }
      update.scope = s;
    }
    if ("archivedAt" in body) {
      update.archivedAt = body.archivedAt ? new Date(body.archivedAt) : null;
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: update,
    });
    return NextResponse.json({ ok: true, template: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const r = await loadAndAuthorize(id, me, true);
    if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    if (hard) {
      // Hard delete is admin-only — keeps history-tracking via archivedAt safe
      // for everyone else.
      if (!hasMinRole(me.role, "ADMIN")) {
        return NextResponse.json(
          { ok: false, error: "Hard delete is admin-only — use archive instead" },
          { status: 403 },
        );
      }
      await prisma.emailTemplate.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: true });
    }

    // Soft delete (archive)
    const archived = await prisma.emailTemplate.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json({ ok: true, template: archived, archived: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
