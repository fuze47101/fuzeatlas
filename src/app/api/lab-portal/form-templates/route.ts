// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Lab-portal read endpoint for LabFormTemplate (Phase 4E).
 *
 * Lab users see only the active templates for their own lab. The
 * admin endpoint at /api/admin/labs/[id]/form-templates handles
 * writes; this is the pure-read view the lab portal uses.
 */

const SELECT = {
  id: true,
  name: true,
  fields: true,
  active: true,
  updatedAt: true,
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.labId) {
    return NextResponse.json(
      { ok: false, error: "No lab associated with this account" },
      { status: 403 },
    );
  }

  const templates = await prisma.labFormTemplate.findMany({
    where: { labId: user.labId, active: true },
    select: SELECT,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ ok: true, templates });
}

/**
 * POST /api/lab-portal/form-templates  — Phase 52 T4
 *
 * Lab user saves a template (typically after the AI extract review on
 * /lab-portal/forms). Body: { name, fields, active? }.
 * Scoped to the caller's lab. ADMIN/EMPLOYEE can override labId.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
  if (!user.labId && !isAdmin) {
    return NextResponse.json(
      { ok: false, error: "No lab associated with this account" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (!Array.isArray(body?.fields) || body.fields.length === 0) {
    return NextResponse.json({ ok: false, error: "fields[] required" }, { status: 400 });
  }
  const labId =
    isAdmin && body?.labId ? String(body.labId) : user.labId;
  if (!labId) {
    return NextResponse.json({ ok: false, error: "labId required" }, { status: 400 });
  }

  const created = await prisma.labFormTemplate.create({
    data: {
      labId,
      name,
      fields: body.fields,
      active: body?.active !== false,
    },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, template: created });
}
