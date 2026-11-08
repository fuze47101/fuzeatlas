import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANAGER_ROLES, type EntityType } from "@/lib/book";
import { notifyHelpEscalated } from "@/lib/book-notify";

/** POST /api/book/help/[id]  { action: "ack" | "done" | "escalate" | "cancel", resolution? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  const h = await prisma.helpRequest.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, distributorId: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  if (!h) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isRequester = h.requesterId === user.id,
    isAssignee = h.assigneeId === user.id,
    isManager = MANAGER_ROLES.includes(user.role);
  const now = new Date();

  if (action === "ack") {
    if (!isAssignee && !isManager)
      return NextResponse.json({ error: "Only the assignee can acknowledge" }, { status: 403 });
    if (h.status !== "OPEN" && h.status !== "ESCALATED")
      return NextResponse.json({ error: `Already ${h.status}` }, { status: 409 });
    const u = await prisma.helpRequest.update({
      where: { id },
      data: { status: "ACKED", ackedAt: now },
    });
    return NextResponse.json({ ok: true, help: u });
  }
  if (action === "done") {
    if (!isAssignee && !isRequester && !isManager)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const u = await prisma.helpRequest.update({
      where: { id },
      data: {
        status: "DONE",
        doneAt: now,
        resolution: typeof body.resolution === "string" ? body.resolution.trim() || null : null,
      },
    });
    return NextResponse.json({ ok: true, help: u });
  }
  if (action === "cancel") {
    if (!isRequester && !isManager)
      return NextResponse.json({ error: "Only the requester can cancel" }, { status: 403 });
    const u = await prisma.helpRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true, help: u });
  }
  if (action === "escalate") {
    if (!isRequester && !isManager)
      return NextResponse.json({ error: "Only the requester can escalate" }, { status: 403 });
    if (h.status === "DONE" || h.status === "CANCELLED")
      return NextResponse.json({ error: `Already ${h.status}` }, { status: 409 });
    if (now < h.dueAt && !isManager)
      return NextResponse.json(
        { error: "Escalate becomes available after the due date" },
        { status: 409 },
      );
    const u = await prisma.helpRequest.update({
      where: { id },
      data: { status: "ESCALATED", escalatedAt: now },
    });
    let entityName = h.entityId;
    if (h.entityType === "BRAND")
      entityName =
        (await prisma.brand.findUnique({ where: { id: h.entityId }, select: { name: true } }))
          ?.name || entityName;
    else if (h.entityType === "FACTORY")
      entityName =
        (await prisma.factory.findUnique({ where: { id: h.entityId }, select: { name: true } }))
          ?.name || entityName;
    notifyHelpEscalated({
      requester: h.requester,
      assignee: h.assignee,
      entityType: h.entityType as EntityType,
      entityId: h.entityId,
      entityName,
      ask: h.ask,
      helpId: h.id,
      createdAt: h.createdAt,
    });
    return NextResponse.json({ ok: true, help: u });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
