// @ts-nocheck
/**
 * CRM Task CRUD (list + create).
 *
 *   GET  /api/crm/tasks?status=OPEN&brandId=...&mine=true&window=overdue|today|week
 *   POST /api/crm/tasks { title, notes?, dueAt, ownerId?, brandId?, priority? }
 *
 * Powers the My Tasks widget, the /crm/tasks page, and the +Task button on
 * brand detail pages. Reminder emails are sent by /api/cron/task-reminders.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || ""; // OPEN / DONE / SNOOZED / CANCELLED, "" = any
    const brandId = url.searchParams.get("brandId") || "";
    const mine = url.searchParams.get("mine") === "true";
    const window = url.searchParams.get("window") || ""; // overdue | today | week
    const take = Math.min(parseInt(url.searchParams.get("take") || "100", 10) || 100, 500);

    const where: any = {};
    if (status) where.status = status;
    if (brandId) where.brandId = brandId;
    if (mine) where.ownerId = user.id;

    // Non-admin / non-employee see only their own tasks
    const isTeam =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    if (!isTeam) where.ownerId = user.id;

    if (window) {
      const now = new Date();
      if (window === "overdue") {
        where.dueAt = { lt: now };
        where.status = where.status || "OPEN";
      } else if (window === "today") {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        where.dueAt = { gte: startOfDay, lte: endOfDay };
      } else if (window === "week") {
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        where.dueAt = { gte: now, lte: end };
      }
    }

    const tasks = await prisma.crmTask.findMany({
      where,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      total: tasks.length,
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        dueAt: t.dueAt.toISOString(),
        status: t.status,
        priority: t.priority,
        ownerId: t.ownerId,
        ownerName: t.owner?.name || t.owner?.email || null,
        ownerEmail: t.owner?.email || null,
        brandId: t.brandId,
        brandName: t.brand?.name || null,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err: any) {
    console.error("[crm/tasks] GET error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to list tasks" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, notes, dueAt, ownerId, brandId, priority } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    if (!dueAt) {
      return NextResponse.json({ ok: false, error: "dueAt is required" }, { status: 400 });
    }
    const due = new Date(dueAt);
    if (isNaN(due.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid dueAt" }, { status: 400 });
    }

    // Default owner is the creator; only team users can assign to someone else
    const isTeam =
      user.role === "ADMIN" ||
      user.role === "EMPLOYEE" ||
      user.role === "SALES_MANAGER" ||
      user.role === "SALES_REP";
    const resolvedOwnerId = isTeam && ownerId ? ownerId : user.id;

    // Validate brandId if supplied
    if (brandId) {
      const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } });
      if (!brand) {
        return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 400 });
      }
    }

    const task = await prisma.crmTask.create({
      data: {
        title: title.trim(),
        notes: notes || null,
        dueAt: due,
        ownerId: resolvedOwnerId,
        createdById: user.id,
        brandId: brandId || null,
        priority: priority && ["LOW", "NORMAL", "HIGH"].includes(priority) ? priority : "NORMAL",
        status: "OPEN",
      },
    });

    return NextResponse.json({ ok: true, taskId: task.id });
  } catch (err: any) {
    console.error("[crm/tasks] POST error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to create task" },
      { status: 500 },
    );
  }
}
