// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const INTERNAL_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const note = await (prisma as any).meetingNote.findUnique({
    where: { id },
    include: {
      series: { select: { id: true, name: true, cadence: true } },
      brand: { select: { id: true, name: true } },
      factory: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      entries: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      actionItems: {
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
      projectBlocks: {
        include: {
          brand: { select: { id: true, name: true } },
          factory: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          actionItems: {
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
            include: { assignee: { select: { id: true, name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!note) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { ok: true, meetingNote: note },
    { headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) return forbidden();

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.status !== undefined) data.status = String(body.status);
  if (body.meetingDate !== undefined) data.meetingDate = new Date(body.meetingDate);
  if (body.brandId !== undefined) data.brandId = body.brandId || null;
  if (body.factoryId !== undefined) data.factoryId = body.factoryId || null;
  if (body.notesMd !== undefined) data.notesMd = String(body.notesMd);

  const updated = await (prisma as any).meetingNote.update({
    where: { id },
    data,
    select: { id: true, title: true, status: true, meetingDate: true },
  });
  return NextResponse.json({ ok: true, meetingNote: updated });
}
