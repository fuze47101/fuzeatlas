// @ts-nocheck
/**
 * ACM Task detail / edit / complete / delete.
 *
 *   GET    /api/acm/tasks/[id]
 *   PATCH  /api/acm/tasks/[id]    { action?: "complete"|"reopen", title?, notes?, dueAt?, ... }
 *   DELETE /api/acm/tasks/[id]
 *
 * When `dueAt` changes we clear the reminder flags so the cron will re-send
 * if the new due date pushes them back into the window.
 *
 * Renamed from /api/crm on 2026-04-20. A 308-redirect shim at the old
 * path keeps stale clients working.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const task = await prisma.crmTask.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        brand: { select: { id: true, name: true } },
      },
    });
    if (!task) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, task });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.crmTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const isTeam =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    const canEdit = isTeam || existing.ownerId === user.id || existing.createdById === user.id;
    if (!canEdit) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const data: any = {};

    if (body.action === "complete") {
      data.status = "DONE";
      data.completedAt = new Date();
    } else if (body.action === "reopen") {
      data.status = "OPEN";
      data.completedAt = null;
    } else if (body.action === "cancel") {
      data.status = "CANCELLED";
      data.completedAt = new Date();
    }

    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.priority !== undefined && ["LOW", "NORMAL", "HIGH"].includes(body.priority)) {
      data.priority = body.priority;
    }
    if (body.ownerId !== undefined && isTeam) data.ownerId = body.ownerId;
    if (body.brandId !== undefined) data.brandId = body.brandId || null;
    if (body.dueAt !== undefined) {
      const due = new Date(body.dueAt);
      if (isNaN(due.getTime())) {
        return NextResponse.json({ ok: false, error: "Invalid dueAt" }, { status: 400 });
      }
      data.dueAt = due;
      // If due date moved, clear reminder flags so the cron may re-send
      data.weekReminderSentAt = null;
      data.dayReminderSentAt = null;
    }

    const task = await prisma.crmTask.update({ where: { id }, data });
    return NextResponse.json({ ok: true, task });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.crmTask.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: true });

    const isTeam =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    const canDelete = isTeam || existing.ownerId === user.id || existing.createdById === user.id;
    if (!canDelete) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    await prisma.crmTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
