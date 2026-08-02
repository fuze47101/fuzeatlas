// @ts-nocheck
/**
 * POST /api/admin/red-rover/[id]/activities — log an activity
 *   (type + body + occurredAt). Bumps the parent target's lastActivityAt.
 *
 * type = NOTE | MEETING | EMAIL | STATUS_CHANGE | MILESTONE.
 * Next.js 15: params awaited. getRealUser gate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const VALID_TYPE = new Set(["NOTE", "MEETING", "EMAIL", "STATUS_CHANGE", "MILESTONE"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRealUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!ADMIN_ROLES.has(user.role))
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const target = await prisma.redRoverTarget.findUnique({
    where: { id },
    select: { id: true, lastActivityAt: true },
  });
  if (!target) return NextResponse.json({ ok: false, error: "Target not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.body || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Activity body is required" }, { status: 400 });

  const type = VALID_TYPE.has(body.type) ? body.type : "NOTE";
  let occurredAt = new Date();
  if (body.occurredAt) {
    const d = new Date(body.occurredAt);
    if (!isNaN(d.getTime())) occurredAt = d;
  }

  // Bump lastActivityAt to the most recent activity (a backdated log must
  // not move it backwards).
  const bump =
    target.lastActivityAt && new Date(target.lastActivityAt).getTime() > occurredAt.getTime()
      ? new Date(target.lastActivityAt)
      : occurredAt;

  // Create the activity and bump the parent's lastActivityAt atomically.
  const [activity] = await prisma.$transaction([
    prisma.redRoverActivity.create({
      data: { targetId: id, userId: user.id, type, body: text, occurredAt },
    }),
    prisma.redRoverTarget.update({
      where: { id },
      data: { lastActivityAt: bump },
    }),
  ]);

  return NextResponse.json({ ok: true, activity });
}
