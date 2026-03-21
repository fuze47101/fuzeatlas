// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/notifications ── list notifications for current user ────────── */
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const where: any = { userId };
    if (unreadOnly) {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/* ── POST /api/notifications ── create notification ────────── */
export async function POST(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    // Only admin/employees can create notifications
    if (!["ADMIN", "EMPLOYEE"].includes(userRole || "")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, type, title, message, link, metadata } = body;

    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata,
      },
    });

    return NextResponse.json({ ok: true, notification });
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

/* ── PATCH /api/notifications ── mark as read ────────── */
export async function PATCH(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, all } = body;

    if (all === true) {
      // Mark all as read
      await prisma.notification.updateMany({
        where: { userId },
        data: { read: true, readAt: new Date() },
      });
    } else if (ids && Array.isArray(ids)) {
      // Mark specific IDs as read
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId },
        data: { read: true, readAt: new Date() },
      });
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to mark as read" },
      { status: 500 }
    );
  }
}
