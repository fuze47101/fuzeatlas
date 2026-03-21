// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/audit-log ── list audit logs with filtering ────────── */
export async function GET(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    // Only admins can access audit logs
    if (userRole !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const entity = url.searchParams.get("entity");
    const entityId = url.searchParams.get("entityId");
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("userId");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const where: any = {};

    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (userId) where.userId = userId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}
