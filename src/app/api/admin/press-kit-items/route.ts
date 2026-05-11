// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER"];
const ALLOWED_TYPES = new Set(["LOGO", "IMAGE", "RELEASE", "NEWS_LINK"]);

async function authz() {
  const user = await getCurrentUser();
  if (!user) return { err: "Unauthorized", status: 401 };
  if (!ADMIN_ROLES.includes(user.role)) return { err: "Forbidden", status: 403 };
  return { user };
}

export async function GET() {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const items = await prisma.pressKitItem.findMany({
    orderBy: [{ active: "desc" }, { type: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const body = await req.json().catch(() => null);
  if (!body?.type || !body?.url) {
    return NextResponse.json({ ok: false, error: "type and url required" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(body.type)) {
    return NextResponse.json({ ok: false, error: "Bad type" }, { status: 400 });
  }
  const item = await prisma.pressKitItem.create({
    data: {
      type: String(body.type),
      url: String(body.url),
      caption: body.caption || null,
      releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
      active: body.active !== false,
    },
  });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const updates: any = {};
  if (body.type !== undefined) {
    if (!ALLOWED_TYPES.has(body.type)) {
      return NextResponse.json({ ok: false, error: "Bad type" }, { status: 400 });
    }
    updates.type = body.type;
  }
  if (body.url !== undefined) updates.url = String(body.url);
  if (body.caption !== undefined) updates.caption = body.caption || null;
  if (body.releaseDate !== undefined)
    updates.releaseDate = body.releaseDate ? new Date(body.releaseDate) : null;
  if (body.active !== undefined) updates.active = !!body.active;
  const item = await prisma.pressKitItem.update({
    where: { id: body.id },
    data: updates,
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: Request) {
  const a = await authz();
  if (a.err) return NextResponse.json({ ok: false, error: a.err }, { status: a.status });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await prisma.pressKitItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
