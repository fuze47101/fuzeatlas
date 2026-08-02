// @ts-nocheck
/**
 * POST   /api/admin/red-rover/[id]/contacts        — add a contact
 * PATCH  /api/admin/red-rover/[id]/contacts        — edit (body.contactId)
 * DELETE /api/admin/red-rover/[id]/contacts?contactId=  — remove
 *
 * side = TARGET | FUZE ; role = NEGOTIATION | TECHNICAL_GATEKEEPER (tracked
 * separately per Andrew). Next.js 15: params awaited. getRealUser gate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealUser } from "@/lib/auth";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);
const VALID_SIDE = new Set(["TARGET", "FUZE"]);
const VALID_ROLE = new Set(["NEGOTIATION", "TECHNICAL_GATEKEEPER"]);

async function gate() {
  const user = await getRealUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  if (!ADMIN_ROLES.has(user.role))
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const target = await prisma.redRoverTarget.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: "Target not found" }, { status: 404 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Contact name is required" }, { status: 400 });

  const contact = await prisma.redRoverContact.create({
    data: {
      targetId: id,
      name,
      title: body.title?.trim() || null,
      email: body.email?.trim() || null,
      side: VALID_SIDE.has(body.side) ? body.side : "TARGET",
      role: VALID_ROLE.has(body.role) ? body.role : "NEGOTIATION",
      notes: body.notes?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, contact });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const contactId = body.contactId;
  if (!contactId) return NextResponse.json({ ok: false, error: "contactId required" }, { status: 400 });

  const existing = await prisma.redRoverContact.findFirst({
    where: { id: contactId, targetId: id },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });

  const data: Record<string, any> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("title" in body) data.title = body.title?.trim() || null;
  if ("email" in body) data.email = body.email?.trim() || null;
  if (body.side && VALID_SIDE.has(body.side)) data.side = body.side;
  if (body.role && VALID_ROLE.has(body.role)) data.role = body.role;
  if ("notes" in body) data.notes = body.notes?.trim() || null;

  if (Object.keys(data).length === 0)
    return NextResponse.json({ ok: false, error: "No changes" }, { status: 400 });

  const contact = await prisma.redRoverContact.update({ where: { id: contactId }, data });
  return NextResponse.json({ ok: true, contact });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate();
  if (g.error) return g.error;
  const { id } = await params;

  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ ok: false, error: "contactId required" }, { status: 400 });

  const existing = await prisma.redRoverContact.findFirst({
    where: { id: contactId, targetId: id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Contact not found" }, { status: 404 });

  await prisma.redRoverContact.delete({ where: { id: contactId } });
  return NextResponse.json({ ok: true, deleted: contactId });
}
