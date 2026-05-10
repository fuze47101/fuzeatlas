// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Admin LabFormTemplate CRUD (Phase 4E).
 *
 * Path scoped to a single lab by id. Templates are scoped to that lab
 * via FK. ADMIN/EMPLOYEE only.
 *
 *   GET    /api/admin/labs/{id}/form-templates
 *   POST   { name, fields }                  — create
 *   PATCH  { id, name?, fields?, active? }   — update
 *   DELETE ?id=                              — remove
 */

const EDIT_ROLES = ["ADMIN", "EMPLOYEE"];

const SELECT = {
  id: true,
  labId: true,
  name: true,
  fields: true,
  active: true,
  createdAt: true,
  updatedAt: true,
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}
function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id } = await props.params;
  const [lab, templates] = await Promise.all([
    prisma.lab.findUnique({ where: { id }, select: { id: true, name: true } }),
    prisma.labFormTemplate.findMany({
      where: { labId: id },
      select: SELECT,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);
  if (!lab) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });
  return NextResponse.json({ ok: true, lab, templates });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id: labId } = await props.params;
  const body = await req.json().catch(() => ({}));
  if (!body.name) return bad("name required");
  if (!Array.isArray(body.fields)) return bad("fields must be an array");

  const created = await prisma.labFormTemplate.create({
    data: {
      labId,
      name: String(body.name),
      fields: body.fields,
      active: body.active !== false,
    },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, template: created });
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id: labId } = await props.params;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id required");

  // Ensure the target template belongs to this lab — defense-in-depth
  // against template-id reuse across labs.
  const existing = await prisma.labFormTemplate.findUnique({
    where: { id: body.id },
    select: { labId: true },
  });
  if (!existing) return bad("Template not found");
  if (existing.labId !== labId) return forbidden();

  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields)) return bad("fields must be an array");
    data.fields = body.fields;
  }
  if (typeof body.active === "boolean") data.active = body.active;

  const updated = await prisma.labFormTemplate.update({
    where: { id: body.id },
    data,
    select: SELECT,
  });
  return NextResponse.json({ ok: true, template: updated });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!EDIT_ROLES.includes(user.role)) return forbidden();

  const { id: labId } = await props.params;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return bad("id required");

  const existing = await prisma.labFormTemplate.findUnique({
    where: { id },
    select: { labId: true },
  });
  if (!existing) return bad("Template not found");
  if (existing.labId !== labId) return forbidden();

  await prisma.labFormTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
