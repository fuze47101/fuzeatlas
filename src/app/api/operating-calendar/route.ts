// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  OWNER_EMAIL,
  isOwner,
  computeRunway,
  findConflicts,
  BLACKOUTS,
} from "@/lib/operating-calendar";

/**
 * Operating Calendar API — owner-only. Andrew's personal planning board.
 *
 * Every method re-checks the session owner. This is NOT role-gated: an
 * ADMIN who is not the owner gets 403 the same as anyone else, because the
 * board carries private entries that no FUZE role should confer access to.
 *
 * GET    → events + recomputed runway windows + conflicts
 * POST   → create an event
 * PATCH  → update an event by id
 * DELETE → remove an event by id (?id=...)
 */

async function gate() {
  const user = await getCurrentUser();
  if (!isOwner(user?.email)) return null;
  return user;
}

const shape = (r: any) => ({
  id: r.id,
  title: r.title,
  startDate: r.startDate.toISOString().slice(0, 10),
  endDate: r.endDate.toISOString().slice(0, 10),
  lane: r.lane,
  account: r.account,
  status: r.status,
  isPrivate: r.isPrivate,
  isShow: r.isShow,
  holds: r.holds,
  detail: r.detail,
});

export async function GET() {
  if (!(await gate())) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 });
  }
  const rows = await prisma.operatingCalendarEvent.findMany({
    where: { ownerEmail: OWNER_EMAIL },
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
  });
  const events = rows.map(shape);
  return NextResponse.json({
    ok: true,
    events,
    runway: computeRunway(events),
    conflicts: findConflicts(events).map(([a, b]) => ({ a: a.title, b: b.title })),
    blackouts: BLACKOUTS,
  });
}

function parseBody(body: any) {
  return {
    title: String(body.title || "").trim(),
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate || body.startDate),
    lane: body.lane || "fuze",
    account: body.account ?? null,
    status: body.status || "tentative",
    isPrivate: !!body.isPrivate,
    isShow: !!body.isShow,
    holds: body.holds !== false,
    detail: body.detail ?? null,
  };
}

export async function POST(req: Request) {
  if (!(await gate())) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 });
  }
  const body = await req.json();
  const data = parseBody(body);
  if (!data.title) {
    return NextResponse.json({ ok: false, error: "Title required" }, { status: 400 });
  }
  if (isNaN(data.startDate.getTime()) || isNaN(data.endDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Valid dates required" }, { status: 400 });
  }
  if (data.endDate < data.startDate) {
    return NextResponse.json(
      { ok: false, error: "End date is before start date" },
      { status: 400 },
    );
  }
  const created = await prisma.operatingCalendarEvent.create({
    data: { ...data, ownerEmail: OWNER_EMAIL },
  });
  return NextResponse.json({ ok: true, event: shape(created) }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!(await gate())) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const existing = await prisma.operatingCalendarEvent.findUnique({ where: { id: body.id } });
  if (!existing || existing.ownerEmail !== OWNER_EMAIL) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  const data = parseBody({ ...shape(existing), ...body });
  if (data.endDate < data.startDate) {
    return NextResponse.json(
      { ok: false, error: "End date is before start date" },
      { status: 400 },
    );
  }
  const updated = await prisma.operatingCalendarEvent.update({
    where: { id: body.id },
    data,
  });
  return NextResponse.json({ ok: true, event: shape(updated) });
}

export async function DELETE(req: Request) {
  if (!(await gate())) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.operatingCalendarEvent.findUnique({ where: { id } });
  if (!existing || existing.ownerEmail !== OWNER_EMAIL) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  await prisma.operatingCalendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
