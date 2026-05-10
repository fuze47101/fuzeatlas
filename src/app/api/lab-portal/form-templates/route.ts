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
